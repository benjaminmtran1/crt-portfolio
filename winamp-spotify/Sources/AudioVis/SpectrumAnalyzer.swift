import Foundation
import Accelerate

/// Turns interleaved float audio into the two things a Winamp visualiser
/// draws: a bar spectrum and an oscilloscope trace.
///
/// Deliberately allocation-free in the hot path — it runs on a Core Audio IO
/// thread, where allocating or locking would cause dropouts.
public final class SpectrumAnalyzer {

    /// Power-of-two FFT size. 1024 at 48kHz gives ~47Hz bins, which is plenty
    /// for a 19-bar display and cheap enough to run every callback.
    public let fftSize: Int
    /// Number of bars the spectrum is reduced to. Classic Winamp draws 19 in a
    /// 76px-wide window (4px per bar minus the gap).
    public let bandCount: Int

    private let log2n: vDSP_Length
    private let setup: FFTSetup
    private var window: [Float]
    private var realPart: [Float]
    private var imaginaryPart: [Float]
    private var magnitudes: [Float]
    private var windowed: [Float]

    /// Bin ranges for each band, precomputed on a log frequency scale.
    private var bandRanges: [(start: Int, end: Int)] = []

    /// Smoothed output, read by the renderer.
    private var bandLevels: [Float]
    private var peakLevels: [Float]
    private var peakHoldFrames: [Int]
    private var scope: [Float]

    /// Guards the smoothed output, which is written on the audio thread and
    /// read on the main thread. Strictly speaking a lock does not belong in a
    /// render callback; the held region here is a few dozen float writes with
    /// no allocation, and the alternative (a lock-free triple buffer) is not
    /// worth the complexity for a 76x16 visualiser.
    private let lock = NSLock()

    /// Attack is immediate and decay is slow, which is what makes bars look
    /// like they are falling under gravity rather than flickering.
    public var decayPerFrame: Float = 0.06
    public var peakDecayPerFrame: Float = 0.015
    public var peakHoldDuration = 12

    public init(fftSize: Int = 1024, bandCount: Int = 19, sampleRate: Double = 48_000) {
        self.fftSize = fftSize
        self.bandCount = bandCount
        self.log2n = vDSP_Length(log2(Double(fftSize)))
        self.setup = vDSP_create_fftsetup(log2n, FFTRadix(kFFTRadix2))!

        self.window = [Float](repeating: 0, count: fftSize)
        vDSP_hann_window(&window, vDSP_Length(fftSize), Int32(vDSP_HANN_DENORM))

        self.realPart = [Float](repeating: 0, count: fftSize / 2)
        self.imaginaryPart = [Float](repeating: 0, count: fftSize / 2)
        self.magnitudes = [Float](repeating: 0, count: fftSize / 2)
        self.windowed = [Float](repeating: 0, count: fftSize)

        self.bandLevels = [Float](repeating: 0, count: bandCount)
        self.peakLevels = [Float](repeating: 0, count: bandCount)
        self.peakHoldFrames = [Int](repeating: 0, count: bandCount)
        self.scope = [Float](repeating: 0, count: 76)

        rebuildBands(sampleRate: sampleRate)
    }

    deinit {
        vDSP_destroy_fftsetup(setup)
    }

    /// Splits the spectrum into bands on a log scale between 40Hz and 16kHz —
    /// linear bands put almost everything in the first two bars.
    public func rebuildBands(sampleRate: Double) {
        let binCount = fftSize / 2
        let nyquist = sampleRate / 2
        let lowest = 40.0
        let highest = min(16_000.0, nyquist * 0.95)

        var ranges: [(Int, Int)] = []
        ranges.reserveCapacity(bandCount)
        var previousEnd = 1
        for band in 0 ..< bandCount {
            let fraction = Double(band + 1) / Double(bandCount)
            let frequency = lowest * pow(highest / lowest, fraction)
            var end = Int((frequency / nyquist * Double(binCount)).rounded())
            end = min(binCount, max(previousEnd + 1, end))
            ranges.append((previousEnd, end))
            previousEnd = end
        }
        lock.lock()
        bandRanges = ranges
        lock.unlock()
    }

    // MARK: - Hot path

    /// Feeds one buffer of interleaved samples. Safe to call from a Core Audio
    /// render thread.
    public func process(samples: UnsafePointer<Float>, frameCount: Int, channelCount: Int) {
        guard frameCount > 0, channelCount > 0 else { return }

        // Mono mixdown into the FFT input, zero-padded when the buffer is
        // shorter than the window.
        let usable = min(frameCount, fftSize)
        for frame in 0 ..< usable {
            var sum: Float = 0
            for channel in 0 ..< channelCount {
                sum += samples[frame * channelCount + channel]
            }
            windowed[frame] = sum / Float(channelCount)
        }
        if usable < fftSize {
            for frame in usable ..< fftSize { windowed[frame] = 0 }
        }

        updateScope(from: windowed, count: usable)

        // In-place windowing, through a mutable pointer so input and output
        // are not two simultaneous accesses to the same array.
        windowed.withUnsafeMutableBufferPointer { buffer in
            vDSP_vmul(buffer.baseAddress!, 1, window, 1, buffer.baseAddress!, 1, vDSP_Length(fftSize))
        }

        // Pack the real signal into the split-complex form vDSP's real FFT
        // wants, transform, and take magnitudes.
        let halfSize = fftSize / 2
        realPart.withUnsafeMutableBufferPointer { realBuffer in
            imaginaryPart.withUnsafeMutableBufferPointer { imaginaryBuffer in
                var split = DSPSplitComplex(
                    realp: realBuffer.baseAddress!,
                    imagp: imaginaryBuffer.baseAddress!
                )
                windowed.withUnsafeBufferPointer { input in
                    input.baseAddress!.withMemoryRebound(
                        to: DSPComplex.self, capacity: halfSize
                    ) { complex in
                        vDSP_ctoz(complex, 2, &split, 1, vDSP_Length(halfSize))
                    }
                }
                vDSP_fft_zrip(setup, &split, 1, log2n, FFTDirection(FFT_FORWARD))
                magnitudes.withUnsafeMutableBufferPointer { output in
                    vDSP_zvabs(&split, 1, output.baseAddress!, 1, vDSP_Length(halfSize))
                }
            }
        }

        // vDSP's real FFT leaves an unnormalised result; divide it out so the
        // dB floor below does not depend on fftSize.
        var scale = 1 / Float(fftSize)
        magnitudes.withUnsafeMutableBufferPointer { buffer in
            vDSP_vsmul(buffer.baseAddress!, 1, &scale, buffer.baseAddress!, 1, vDSP_Length(halfSize))
        }

        lock.lock()
        let ranges = bandRanges
        for (index, range) in ranges.enumerated() where index < bandCount {
            var peak: Float = 0
            for bin in range.start ..< min(range.end, magnitudes.count) {
                peak = max(peak, magnitudes[bin])
            }
            // -60dB floor mapped to 0...1. Music sits mostly in the top 40dB.
            let decibels = 20 * log10(max(peak, 1e-7))
            let level = max(0, min(1, (decibels + 60) / 60))

            if level > bandLevels[index] {
                bandLevels[index] = level
            } else {
                bandLevels[index] = max(level, bandLevels[index] - decayPerFrame)
            }

            if bandLevels[index] >= peakLevels[index] {
                peakLevels[index] = bandLevels[index]
                peakHoldFrames[index] = peakHoldDuration
            } else if peakHoldFrames[index] > 0 {
                peakHoldFrames[index] -= 1
            } else {
                peakLevels[index] = max(bandLevels[index], peakLevels[index] - peakDecayPerFrame)
            }
        }
        lock.unlock()
    }

    /// Decimates the buffer to the oscilloscope's pixel width.
    private func updateScope(from buffer: [Float], count: Int) {
        guard count > 0 else { return }
        let width = scope.count
        let step = max(1, count / width)
        for column in 0 ..< width {
            let start = min(count - 1, column * step)
            let end = min(count, start + step)
            var extreme: Float = 0
            for index in start ..< end where abs(buffer[index]) > abs(extreme) {
                extreme = buffer[index]
            }
            scope[column] = extreme
        }
    }

    /// Called when audio stops, so the bars fall instead of freezing mid-air.
    public func decayToSilence() {
        lock.lock()
        for index in 0 ..< bandCount {
            bandLevels[index] = max(0, bandLevels[index] - decayPerFrame)
            peakLevels[index] = max(0, peakLevels[index] - peakDecayPerFrame)
        }
        for index in scope.indices { scope[index] *= 0.8 }
        lock.unlock()
    }

    // MARK: - Reading

    public struct Frame: Sendable {
        /// One value per band, 0...1.
        public let bands: [Float]
        /// Peak markers, 0...1.
        public let peaks: [Float]
        /// Oscilloscope samples, -1...1, one per pixel column.
        public let scope: [Float]
    }

    public func currentFrame() -> Frame {
        lock.lock()
        defer { lock.unlock() }
        return Frame(bands: bandLevels, peaks: peakLevels, scope: scope)
    }
}

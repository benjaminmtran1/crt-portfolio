import Foundation
import CoreAudio
import AudioToolbox
import OSLog

/// Taps another application's audio output so the visualiser shows what is
/// actually playing.
///
/// This is the one legitimate way to see Spotify's audio on macOS. Core Audio
/// process taps (macOS 14.2+) let an app read a specific process's output, with
/// the user's consent, without a virtual audio driver. We create a private tap
/// on Spotify, wrap it in a private aggregate device, and run an IO proc that
/// hands buffers to a `SpectrumAnalyzer`.
///
/// The tap is read-only: it observes the mix, it cannot alter it. That is
/// exactly why this app has a visualiser and no equaliser — inserting DSP into
/// Spotify's output would need a virtual output device the user installs, and
/// that trade was declined.
@available(macOS 14.2, *)
public final class ProcessTap {

    public enum Error: Swift.Error, LocalizedError {
        case processNotFound(String)
        case tapCreationFailed(OSStatus)
        case aggregateDeviceFailed(OSStatus)
        case formatUnavailable(OSStatus)
        case ioProcFailed(OSStatus)
        case startFailed(OSStatus)

        public var errorDescription: String? {
            switch self {
            case .processNotFound(let name):
                return "\(name) does not appear to be producing audio right now."
            case .tapCreationFailed(let status):
                return "Could not create the audio tap (\(Self.describe(status))). Check System Settings > Privacy & Security > Audio Recording."
            case .aggregateDeviceFailed(let status):
                return "Could not create the aggregate audio device (\(Self.describe(status)))."
            case .formatUnavailable(let status):
                return "Could not read the tap's stream format (\(Self.describe(status)))."
            case .ioProcFailed(let status):
                return "Could not install the audio IO callback (\(Self.describe(status)))."
            case .startFailed(let status):
                return "Could not start the audio tap (\(Self.describe(status)))."
            }
        }

        /// Core Audio status codes are four-character codes; printing them raw
        /// turns a diagnosable error into a meaningless integer.
        static func describe(_ status: OSStatus) -> String {
            let value = UInt32(bitPattern: status)
            let bytes = [
                UInt8((value >> 24) & 0xFF),
                UInt8((value >> 16) & 0xFF),
                UInt8((value >> 8) & 0xFF),
                UInt8(value & 0xFF),
            ]
            if bytes.allSatisfy({ $0 >= 32 && $0 < 127 }) {
                return "'\(String(bytes: bytes, encoding: .ascii) ?? "")' / \(status)"
            }
            return "\(status)"
        }
    }

    private let logger = Logger(subsystem: "com.winampspotify", category: "ProcessTap")
    private let analyzer: SpectrumAnalyzer
    private let targetBundleID: String

    private var tapID: AudioObjectID = .zero
    private var aggregateDeviceID: AudioDeviceID = .zero
    private var ioProcID: AudioDeviceIOProcID?
    private var streamDescription: AudioStreamBasicDescription?

    public private(set) var isRunning = false

    public init(analyzer: SpectrumAnalyzer, targetBundleID: String = "com.spotify.client") {
        self.analyzer = analyzer
        self.targetBundleID = targetBundleID
    }

    deinit {
        // Aggregate devices and taps are system-wide objects; leaking one
        // leaves a phantom device in the system until reboot.
        try? tearDown()
    }

    // MARK: - Lifecycle

    public func start() throws {
        guard !isRunning else { return }

        let processObject = try findProcessObject(bundleID: targetBundleID)
        try createTap(for: processObject)
        let format = try readTapFormat()
        streamDescription = format
        analyzer.rebuildBands(sampleRate: format.mSampleRate)
        try createAggregateDevice()
        try installIOProc(channelCount: Int(format.mChannelsPerFrame))

        let status = AudioDeviceStart(aggregateDeviceID, ioProcID)
        guard status == noErr else {
            try? tearDown()
            throw Error.startFailed(status)
        }
        isRunning = true
        logger.info("Tap running on \(self.targetBundleID, privacy: .public) at \(format.mSampleRate)Hz")
    }

    public func stop() {
        guard isRunning else { return }
        try? tearDown()
    }

    private func tearDown() throws {
        if let ioProcID, aggregateDeviceID != .zero {
            AudioDeviceStop(aggregateDeviceID, ioProcID)
            AudioDeviceDestroyIOProcID(aggregateDeviceID, ioProcID)
        }
        ioProcID = nil

        if aggregateDeviceID != .zero {
            AudioHardwareDestroyAggregateDevice(aggregateDeviceID)
            aggregateDeviceID = .zero
        }
        if tapID != .zero {
            AudioHardwareDestroyProcessTap(tapID)
            tapID = .zero
        }
        isRunning = false
    }

    // MARK: - Finding the process

    /// Core Audio exposes one audio object per process that has an audio
    /// client. A process that has never played anything is simply absent, which
    /// is why this is a recoverable error and not a fatal one.
    private func findProcessObject(bundleID: String) throws -> AudioObjectID {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyProcessObjectList,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )

        var dataSize: UInt32 = 0
        var status = AudioObjectGetPropertyDataSize(
            AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &dataSize
        )
        guard status == noErr, dataSize > 0 else { throw Error.processNotFound(bundleID) }

        let count = Int(dataSize) / MemoryLayout<AudioObjectID>.size
        var objects = [AudioObjectID](repeating: .zero, count: count)
        status = AudioObjectGetPropertyData(
            AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &dataSize, &objects
        )
        guard status == noErr else { throw Error.processNotFound(bundleID) }

        for object in objects where processBundleID(of: object) == bundleID {
            return object
        }
        throw Error.processNotFound(bundleID)
    }

    private func processBundleID(of object: AudioObjectID) -> String? {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioProcessPropertyBundleID,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        var dataSize = UInt32(MemoryLayout<CFString?>.size)
        var value: CFString?
        let status = AudioObjectGetPropertyData(object, &address, 0, nil, &dataSize, &value)
        guard status == noErr else { return nil }
        return value as String?
    }

    // MARK: - Tap and aggregate device

    private func createTap(for processObject: AudioObjectID) throws {
        let description = CATapDescription(stereoMixdownOfProcesses: [processObject])
        description.name = "WinampSpotify Visualiser"
        description.uuid = UUID()
        // Private so the tap does not show up as a system-wide capture source,
        // and unmuted so tapping does not silence what the user is listening to.
        description.isPrivate = true
        description.muteBehavior = .unmuted

        var newTapID: AudioObjectID = .zero
        let status = AudioHardwareCreateProcessTap(description, &newTapID)
        guard status == noErr, newTapID != .zero else { throw Error.tapCreationFailed(status) }
        tapID = newTapID
    }

    private func readTapFormat() throws -> AudioStreamBasicDescription {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioTapPropertyFormat,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        var format = AudioStreamBasicDescription()
        var dataSize = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        let status = AudioObjectGetPropertyData(tapID, &address, 0, nil, &dataSize, &format)
        guard status == noErr, format.mSampleRate > 0 else { throw Error.formatUnavailable(status) }
        return format
    }

    private func createAggregateDevice() throws {
        // A tap is not itself an IO device; it has to be aggregated before an
        // IO proc can pull from it.
        let uid = "com.winampspotify.tap.\(UUID().uuidString)"
        let description: [String: Any] = [
            kAudioAggregateDeviceNameKey: "WinampSpotify Visualiser",
            kAudioAggregateDeviceUIDKey: uid,
            // Private keeps it out of the user's sound settings.
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceIsStackedKey: false,
            kAudioAggregateDeviceTapAutoStartKey: true,
            kAudioAggregateDeviceSubDeviceListKey: [] as [[String: Any]],
            kAudioAggregateDeviceTapListKey: [
                [
                    kAudioSubTapDriftCompensationKey: true,
                    kAudioSubTapUIDKey: tapUUIDString() ?? uid,
                ] as [String: Any],
            ],
        ]

        var newDeviceID: AudioDeviceID = .zero
        let status = AudioHardwareCreateAggregateDevice(description as CFDictionary, &newDeviceID)
        guard status == noErr, newDeviceID != .zero else {
            throw Error.aggregateDeviceFailed(status)
        }
        aggregateDeviceID = newDeviceID
    }

    private func tapUUIDString() -> String? {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioTapPropertyUID,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        var dataSize = UInt32(MemoryLayout<CFString?>.size)
        var value: CFString?
        let status = AudioObjectGetPropertyData(tapID, &address, 0, nil, &dataSize, &value)
        guard status == noErr else { return nil }
        return value as String?
    }

    // MARK: - IO

    private func installIOProc(channelCount: Int) throws {
        let analyzer = self.analyzer
        // The block runs on a real-time thread: no allocation, no locks beyond
        // the analyser's short one, no logging.
        var newProcID: AudioDeviceIOProcID?
        let status = AudioDeviceCreateIOProcIDWithBlock(
            &newProcID,
            aggregateDeviceID,
            nil
        ) { _, inputData, _, _, _ in
            let buffers = UnsafeMutableAudioBufferListPointer(
                UnsafeMutablePointer(mutating: inputData)
            )
            guard let first = buffers.first, let raw = first.mData else { return }

            let channels = Int(first.mNumberChannels)
            guard channels > 0 else { return }
            let frames = Int(first.mDataByteSize) / (MemoryLayout<Float>.size * channels)
            guard frames > 0 else { return }

            analyzer.process(
                samples: raw.assumingMemoryBound(to: Float.self),
                frameCount: frames,
                channelCount: channels
            )
        }
        guard status == noErr, let newProcID else { throw Error.ioProcFailed(status) }
        ioProcID = newProcID
    }
}

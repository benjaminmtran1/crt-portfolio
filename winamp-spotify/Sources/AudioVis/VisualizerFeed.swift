import Foundation
import Combine
import OSLog

/// Owns the audio tap and hands the renderer frames.
///
/// When the tap is unavailable — an older macOS, permission refused, Spotify
/// not currently producing audio — the feed reports that plainly and the
/// visualiser draws an idle line. It never synthesises a fake spectrum: a
/// visualiser that does not match what you hear is worse than an honest flat
/// line.
@MainActor
public final class VisualizerFeed: ObservableObject {

    public enum Status: Equatable, Sendable {
        case idle
        case running
        /// Tapping is possible but not currently active, with the reason.
        case unavailable(String)
        /// This build of macOS has no process-tap API.
        case unsupported

        public var isRunning: Bool { self == .running }

        public var message: String? {
            switch self {
            case .idle: return nil
            case .running: return nil
            case .unavailable(let reason): return reason
            case .unsupported: return "Audio visualisation needs macOS 14.2 or later."
            }
        }
    }

    public enum Mode: String, CaseIterable, Sendable {
        case spectrum
        case oscilloscope
        case off

        public var title: String {
            switch self {
            case .spectrum: return "Spectrum Analyzer"
            case .oscilloscope: return "Oscilloscope"
            case .off: return "Off"
            }
        }

        /// Cycles in the same order clicking the visualiser in Winamp does.
        public var next: Mode {
            switch self {
            case .spectrum: return .oscilloscope
            case .oscilloscope: return .off
            case .off: return .spectrum
            }
        }
    }

    @Published public private(set) var status: Status = .idle
    @Published public var mode: Mode = .spectrum

    public let analyzer: SpectrumAnalyzer
    private let logger = Logger(subsystem: "com.winampspotify", category: "Visualizer")

    private var tap: AnyObject?
    /// Retry timer for the common case: Spotify has not opened an audio client
    /// yet, so the process object does not exist until the first note plays.
    private var retryTask: Task<Void, Never>?

    public init(bandCount: Int = 19) {
        self.analyzer = SpectrumAnalyzer(bandCount: bandCount)
    }

    // MARK: - Control

    /// Starts tapping, retrying quietly while Spotify has no audio client yet.
    public func start() {
        guard mode != .off else { return }
        guard #available(macOS 14.2, *) else {
            status = .unsupported
            return
        }
        guard status != .running else { return }

        attemptStart()
        guard status != .running else { return }

        retryTask?.cancel()
        retryTask = Task { [weak self] in
            // Back off gently: this is a background nicety, not a hot path.
            for delay in [1, 2, 4, 8, 15] {
                try? await Task.sleep(nanoseconds: UInt64(delay) * 1_000_000_000)
                guard let self, !Task.isCancelled else { return }
                if self.status == .running || self.mode == .off { return }
                if #available(macOS 14.2, *) { self.attemptStart() }
            }
        }
    }

    @available(macOS 14.2, *)
    private func attemptStart() {
        let tap = (self.tap as? ProcessTap) ?? ProcessTap(analyzer: analyzer)
        self.tap = tap
        do {
            try tap.start()
            status = .running
            retryTask?.cancel()
            retryTask = nil
        } catch {
            status = .unavailable(error.localizedDescription)
            logger.debug("Tap unavailable: \(error.localizedDescription, privacy: .public)")
        }
    }

    public func stop() {
        retryTask?.cancel()
        retryTask = nil
        if #available(macOS 14.2, *), let tap = tap as? ProcessTap {
            tap.stop()
        }
        tap = nil
        if status == .running { status = .idle }
    }

    public func cycleMode() {
        mode = mode.next
        if mode == .off {
            stop()
        } else {
            start()
        }
    }

    /// Called by the renderer each frame. Also nudges the analyser's decay so
    /// bars fall when the tap is delivering silence.
    public func frame(isPlaying: Bool) -> SpectrumAnalyzer.Frame {
        if !isPlaying || !status.isRunning {
            analyzer.decayToSilence()
        }
        return analyzer.currentFrame()
    }
}

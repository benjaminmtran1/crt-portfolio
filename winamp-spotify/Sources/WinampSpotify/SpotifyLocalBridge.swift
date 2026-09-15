import Foundation
import AppKit
import ScriptingBridge
import CoreServices
import PlayerCore
import OSLog

/// Drives the Spotify desktop app on this Mac through Apple events.
///
/// Spotify ships a scripting interface, and using it is the fastest, most
/// reliable way to control local playback: no OAuth, no Premium requirement for
/// transport, sub-second position reporting, and it acts on whatever the user
/// is already listening to.
///
/// The usual ScriptingBridge recipe generates a header from Spotify's `.sdef`
/// with `sdp`, which would mean Spotify has to be installed at build time. The
/// alternative — declaring `@objc` protocols and casting — does not actually
/// work, because `SBApplication` forwards unknown *selectors* but does not
/// answer `-conformsToProtocol:`, so the cast fails at runtime.
///
/// So this talks to `SBApplication` the way it is really built to be talked to:
/// key-value coding for properties, selectors for commands. The stringly-typed
/// surface is confined to `Key` and `Command` below, and `SpotifyScriptingTarget`
/// wraps it in something typed.
public actor SpotifyLocalBridge: PlaybackEngine {

    public static let bundleIdentifier = "com.spotify.client"

    public enum Error: Swift.Error, LocalizedError {
        case notInstalled
        case notRunning
        case automationDenied

        public var errorDescription: String? {
            switch self {
            case .notInstalled:
                return "The Spotify app is not installed on this Mac."
            case .notRunning:
                return "Spotify is not running."
            case .automationDenied:
                return "This app is not allowed to control Spotify. Grant it in System Settings › Privacy & Security › Automation."
            }
        }
    }

    private let logger = Logger(subsystem: "com.winampspotify", category: "LocalBridge")
    /// Cached: building an `SBApplication` is not free and this is polled
    /// several times a second.
    private var target: SpotifyScriptingTarget?
    /// Latched once the Automation prompt has been refused, so a denial does
    /// not re-prompt on every poll.
    private var automationDenied = false

    /// Bitrate shown on the KBPS readout. Spotify reports no such thing, so
    /// this is only ever a user-set hint about their streaming-quality setting.
    public var assumedBitrateKbps: Int?

    public init(assumedBitrateKbps: Int? = nil) {
        self.assumedBitrateKbps = assumedBitrateKbps
    }

    // MARK: - Connection

    private var isSpotifyRunning: Bool {
        !NSRunningApplication.runningApplications(withBundleIdentifier: Self.bundleIdentifier).isEmpty
    }

    private var scripting: SpotifyScriptingTarget? {
        guard !automationDenied, isSpotifyRunning else { return nil }
        if target == nil {
            target = SpotifyScriptingTarget(bundleIdentifier: Self.bundleIdentifier)
        }
        return target
    }

    /// Checks — and, the first time, provokes — the Automation permission
    /// prompt, so the user sees it in response to launching this app rather
    /// than mysteriously later.
    @discardableResult
    public func requestAutomationPermission() -> Bool {
        guard isSpotifyRunning else { return false }

        var descriptor = AEAddressDesc()
        let bundleID = Self.bundleIdentifier
        let created = Array(bundleID.utf8).withUnsafeBytes { bytes -> OSStatus in
            AECreateDesc(typeApplicationBundleID, bytes.baseAddress, bytes.count, &descriptor)
        }
        guard created == noErr else { return false }
        defer { AEDisposeDesc(&descriptor) }

        let permission = AEDeterminePermissionToAutomateTarget(
            &descriptor, typeWildCard, typeWildCard, true
        )
        switch permission {
        case noErr:
            automationDenied = false
            return true
        case OSStatus(errAEEventNotPermitted):
            automationDenied = true
            logger.notice("Automation permission for Spotify was denied")
            return false
        default:
            // procNotFound just means Spotify is not up yet; not a denial.
            logger.debug("Automation permission check returned \(permission)")
            return false
        }
    }

    public func isAvailable() async -> Bool {
        guard let scripting else { return false }
        // A property read is the cheapest liveness probe, and comes back nil
        // when the Apple event was refused.
        return scripting.playerState != nil
    }

    // MARK: - PlaybackEngine

    public func snapshot() async -> PlayerSnapshot? {
        guard let scripting, let state = scripting.playerState else { return nil }
        let track = scripting.currentTrack

        return PlayerSnapshot(
            state: state,
            source: .localApp,
            trackTitle: track?.name,
            artist: track?.artist,
            album: track?.album,
            trackURI: track?.id,
            artworkURL: track?.artworkURL,
            position: scripting.playerPosition ?? 0,
            // Spotify reports track duration in milliseconds while
            // playerPosition is in seconds; conflating them is the classic bug
            // with this interface.
            duration: track?.duration ?? 0,
            volume: Double(scripting.soundVolume ?? 75) / 100,
            balance: 0,
            shuffle: scripting.shuffling ?? false,
            // The scripting interface exposes repeat as a bool, with no way to
            // distinguish "repeat one" from "repeat all".
            repeatMode: (scripting.repeating ?? false) ? .context : .off,
            isStereo: true,
            bitrateKbps: state == .stopped ? nil : assumedBitrateKbps,
            sampleRateKHz: state == .stopped ? nil : 44
        )
    }

    public func play() async throws {
        try requireConnection().run(.play)
    }

    public func pause() async throws {
        try requireConnection().run(.pause)
    }

    public func togglePlayPause() async throws {
        try requireConnection().run(.playpause)
    }

    /// Spotify has no stop verb, so the stop button pauses and rewinds — which
    /// is what stop means everywhere else in the app.
    public func stop() async throws {
        let scripting = try requireConnection()
        scripting.run(.pause)
        scripting.playerPosition = 0
    }

    public func next() async throws {
        try requireConnection().run(.nextTrack)
    }

    public func previous() async throws {
        try requireConnection().run(.previousTrack)
    }

    public func seek(to position: TimeInterval) async throws {
        let scripting = try requireConnection()
        scripting.playerPosition = max(0, position)
    }

    public func setVolume(_ volume: Double) async throws {
        let scripting = try requireConnection()
        scripting.soundVolume = Int((min(1, max(0, volume)) * 100).rounded())
    }

    public func setShuffle(_ enabled: Bool) async throws {
        let scripting = try requireConnection()
        scripting.shuffling = enabled
    }

    public func setRepeatMode(_ mode: PlayerSnapshot.RepeatMode) async throws {
        // Collapse the three-way mode onto the bool Spotify offers.
        let scripting = try requireConnection()
        scripting.repeating = mode != .off
    }

    public func play(uri: String, contextURI: String?) async throws {
        try requireConnection().playTrack(uri: uri, contextURI: contextURI)
    }

    private func requireConnection() throws -> SpotifyScriptingTarget {
        guard isSpotifyRunning else { throw Error.notRunning }
        guard let scripting else { throw Error.automationDenied }
        return scripting
    }

    // MARK: - Launching

    public static var isSpotifyInstalled: Bool {
        NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleIdentifier) != nil
    }

    /// Launches Spotify if it is installed but not running, so the transport
    /// buttons do something sensible on a cold start.
    @discardableResult
    public func launchSpotifyIfNeeded() async -> Bool {
        if isSpotifyRunning { return true }
        guard let url = NSWorkspace.shared.urlForApplication(
            withBundleIdentifier: Self.bundleIdentifier
        ) else { return false }

        let configuration = NSWorkspace.OpenConfiguration()
        // Launch in the background: the whole point is that this app is the
        // face of it.
        configuration.activates = false
        configuration.addsToRecentItems = false
        do {
            _ = try await NSWorkspace.shared.openApplication(at: url, configuration: configuration)
            // Spotify needs a moment before it answers Apple events.
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            target = nil
            return true
        } catch {
            logger.error("Could not launch Spotify: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }
}

// MARK: - Scripting target

/// A typed façade over `SBApplication`'s dynamic interface.
///
/// Every string that names part of Spotify's scripting dictionary lives here.
/// Anything that fails — permission refused, Spotify quitting mid-call, a
/// property Spotify has since removed — comes back as nil rather than trapping.
final class SpotifyScriptingTarget {

    /// Property names from Spotify's scripting dictionary.
    private enum Key {
        static let currentTrack = "currentTrack"
        static let playerPosition = "playerPosition"
        static let playerState = "playerState"
        static let soundVolume = "soundVolume"
        static let shuffling = "shuffling"
        static let repeating = "repeating"

        static let trackName = "name"
        static let trackArtist = "artist"
        static let trackAlbum = "album"
        static let trackDuration = "duration"
        static let trackArtworkURL = "artworkUrl"
        static let trackID = "id"
    }

    /// Zero-argument commands.
    enum Command: String {
        case play
        case pause
        case playpause
        case nextTrack
        case previousTrack
    }

    /// Spotify's `playerState` values are four-character codes.
    private enum StateCode {
        static let stopped: UInt32 = 0x6B50_5353 // 'kPSS'
        static let playing: UInt32 = 0x6B50_5350 // 'kPSP'
        static let paused: UInt32 = 0x6B50_5370  // 'kPSp'
    }

    private let application: SBApplication?

    init(bundleIdentifier: String) {
        let application = SBApplication(bundleIdentifier: bundleIdentifier)
        // Two seconds in ticks. Without this, a hung Spotify hangs the poll.
        application?.timeout = 120
        application?.sendMode = .waitForReply
        self.application = application
    }

    // MARK: Properties

    var playerState: PlayerSnapshot.State? {
        guard let raw = application?.value(forKey: Key.playerState) else { return nil }
        // KVC hands back an NSNumber for enumerated properties, but an
        // NSAppleEventDescriptor if the bridge could not map the type.
        let code: UInt32
        if let number = raw as? NSNumber {
            code = number.uint32Value
        } else if let descriptor = raw as? NSAppleEventDescriptor {
            code = descriptor.typeCodeValue
        } else {
            return nil
        }

        switch code {
        case StateCode.playing: return .playing
        case StateCode.paused: return .paused
        case StateCode.stopped: return .stopped
        default: return .stopped
        }
    }

    var playerPosition: TimeInterval? {
        get { (application?.value(forKey: Key.playerPosition) as? NSNumber)?.doubleValue }
        set {
            guard let newValue else { return }
            application?.setValue(newValue, forKey: Key.playerPosition)
        }
    }

    var soundVolume: Int? {
        get { (application?.value(forKey: Key.soundVolume) as? NSNumber)?.intValue }
        set {
            guard let newValue else { return }
            application?.setValue(newValue, forKey: Key.soundVolume)
        }
    }

    var shuffling: Bool? {
        get { (application?.value(forKey: Key.shuffling) as? NSNumber)?.boolValue }
        set {
            guard let newValue else { return }
            application?.setValue(newValue, forKey: Key.shuffling)
        }
    }

    var repeating: Bool? {
        get { (application?.value(forKey: Key.repeating) as? NSNumber)?.boolValue }
        set {
            guard let newValue else { return }
            application?.setValue(newValue, forKey: Key.repeating)
        }
    }

    struct Track {
        var name: String?
        var artist: String?
        var album: String?
        /// Seconds. Converted here so no caller has to remember that Spotify
        /// reports this one in milliseconds.
        var duration: TimeInterval
        var artworkURL: URL?
        var id: String?
    }

    var currentTrack: Track? {
        guard let raw = application?.value(forKey: Key.currentTrack) as? NSObject else { return nil }

        func string(_ key: String) -> String? {
            let value = raw.value(forKey: key) as? String
            // Spotify returns an empty string rather than nothing when a
            // field is unset, and an empty title should read as absent.
            return (value?.isEmpty ?? true) ? nil : value
        }

        let milliseconds = (raw.value(forKey: Key.trackDuration) as? NSNumber)?.doubleValue ?? 0
        return Track(
            name: string(Key.trackName),
            artist: string(Key.trackArtist),
            album: string(Key.trackAlbum),
            duration: milliseconds / 1000,
            artworkURL: string(Key.trackArtworkURL).flatMap(URL.init(string:)),
            id: string(Key.trackID)
        )
    }

    // MARK: Commands

    func run(_ command: Command) {
        let selector = NSSelectorFromString(command.rawValue)
        guard let application, application.responds(to: selector) else { return }
        _ = application.perform(selector)
    }

    /// `play track "uri" in context "uri"`. Spotify's two-argument form is the
    /// only way to start a specific track from outside the app.
    func playTrack(uri: String, contextURI: String?) {
        guard let application else { return }
        let twoArgument = NSSelectorFromString("playTrack:inContext:")
        if application.responds(to: twoArgument) {
            _ = application.perform(twoArgument, with: uri, with: contextURI ?? "")
            return
        }
        let oneArgument = NSSelectorFromString("playTrack:")
        if application.responds(to: oneArgument) {
            _ = application.perform(oneArgument, with: uri)
        }
    }
}

import Foundation

/// Everything the skin needs to draw one frame of the player.
///
/// Both backends — the local Spotify app over ScriptingBridge, and a remote
/// device over the Web API — produce this same value, so the renderer has no
/// idea which one is driving.
public struct PlayerSnapshot: Equatable, Sendable {

    public enum State: String, Sendable {
        case stopped, playing, paused
    }

    public enum Source: String, Sendable {
        /// The Spotify desktop app on this Mac, driven by Apple events.
        case localApp
        /// Some other Spotify Connect device, driven by the Web API.
        case remoteDevice
        /// Nothing is reachable.
        case none
    }

    public enum RepeatMode: String, Sendable {
        case off, context, track
    }

    public var state: State
    public var source: Source

    public var trackTitle: String?
    public var artist: String?
    public var album: String?
    /// `spotify:track:...`, used to line the now-playing track up with the
    /// playlist window.
    public var trackURI: String?
    public var artworkURL: URL?

    public var position: TimeInterval
    public var duration: TimeInterval

    /// 0...1.
    public var volume: Double
    /// -1...1, centre is 0. Spotify exposes no balance control, so this is the
    /// app's own output balance and is purely local.
    public var balance: Double

    public var shuffle: Bool
    public var repeatMode: RepeatMode

    /// Shown on the mono/stereo indicator. Spotify streams are stereo; this
    /// goes false only when the balance is hard-panned.
    public var isStereo: Bool

    /// Filled in when known, for the KBPS/KHZ readouts. Spotify does not
    /// report per-stream bitrate, so these come from the account's quality
    /// tier and stay nil for free accounts.
    public var bitrateKbps: Int?
    public var sampleRateKHz: Int?

    public static let empty = PlayerSnapshot(
        state: .stopped,
        source: .none,
        trackTitle: nil,
        artist: nil,
        album: nil,
        trackURI: nil,
        artworkURL: nil,
        position: 0,
        duration: 0,
        volume: 0.75,
        balance: 0,
        shuffle: false,
        repeatMode: .off,
        isStereo: true,
        bitrateKbps: nil,
        sampleRateKHz: nil
    )

    public init(
        state: State,
        source: Source,
        trackTitle: String?,
        artist: String?,
        album: String?,
        trackURI: String?,
        artworkURL: URL?,
        position: TimeInterval,
        duration: TimeInterval,
        volume: Double,
        balance: Double,
        shuffle: Bool,
        repeatMode: RepeatMode,
        isStereo: Bool,
        bitrateKbps: Int?,
        sampleRateKHz: Int?
    ) {
        self.state = state
        self.source = source
        self.trackTitle = trackTitle
        self.artist = artist
        self.album = album
        self.trackURI = trackURI
        self.artworkURL = artworkURL
        self.position = position
        self.duration = duration
        self.volume = volume
        self.balance = balance
        self.shuffle = shuffle
        self.repeatMode = repeatMode
        self.isStereo = isStereo
        self.bitrateKbps = bitrateKbps
        self.sampleRateKHz = sampleRateKHz
    }

    // MARK: - Display

    /// "Artist - Title", the convention the title marquee expects.
    public var marqueeText: String {
        switch (artist, trackTitle) {
        case let (artist?, title?) where !artist.isEmpty:
            return "\(artist) - \(title)"
        case let (_, title?):
            return title
        default:
            return state == .stopped ? "WINAMP SPOTIFY" : "BUFFERING"
        }
    }

    public var progress: Double {
        guard duration > 0 else { return 0 }
        return min(1, max(0, position / duration))
    }

    /// Remaining rather than elapsed, for the clock's alternate mode.
    public var remaining: TimeInterval {
        max(0, duration - position)
    }
}

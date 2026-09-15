import Foundation
import PlayerCore
import AudioVis

/// User-facing settings, backed by `UserDefaults`.
///
/// The Spotify client ID lives here rather than being baked into the binary:
/// PKCE apps have no secret, but the ID is still per-developer, and anyone
/// building this from source needs to register their own.
@MainActor
final class Settings: ObservableObject {

    private enum Key {
        static let clientID = "spotify.clientID"
        static let redirectURI = "spotify.redirectURI"
        static let skinID = "skin.selected"
        static let scale = "window.scale"
        static let backend = "playback.preference"
        static let visualizerMode = "visualizer.mode"
        static let showsRemainingTime = "clock.showsRemaining"
        static let alwaysOnTop = "window.alwaysOnTop"
        static let assumedBitrate = "spotify.assumedBitrate"
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.clientID = defaults.string(forKey: Key.clientID) ?? ""
        self.redirectURI = defaults.string(forKey: Key.redirectURI) ?? Settings.defaultRedirectURI
        self.selectedSkinID = defaults.string(forKey: Key.skinID)
        self.scale = max(1, min(4, defaults.object(forKey: Key.scale) as? Int ?? 1))
        self.backend = PlaybackCoordinator.Preference(
            rawValue: defaults.string(forKey: Key.backend) ?? ""
        ) ?? .preferLocal
        self.visualizerMode = VisualizerFeed.Mode(
            rawValue: defaults.string(forKey: Key.visualizerMode) ?? ""
        ) ?? .spectrum
        self.showsRemainingTime = defaults.bool(forKey: Key.showsRemainingTime)
        self.alwaysOnTop = defaults.bool(forKey: Key.alwaysOnTop)
        self.assumedBitrate = defaults.object(forKey: Key.assumedBitrate) as? Int
    }

    /// The scheme half must be registered in the app's Info.plist and the whole
    /// string must match a Redirect URI on the Spotify dashboard exactly.
    static let defaultRedirectURI = "winamp-spotify://auth"

    @Published var clientID: String {
        didSet { defaults.set(clientID, forKey: Key.clientID) }
    }

    @Published var redirectURI: String {
        didSet { defaults.set(redirectURI, forKey: Key.redirectURI) }
    }

    @Published var selectedSkinID: String? {
        didSet { defaults.set(selectedSkinID, forKey: Key.skinID) }
    }

    @Published var scale: Int {
        didSet { defaults.set(scale, forKey: Key.scale) }
    }

    @Published var backend: PlaybackCoordinator.Preference {
        didSet { defaults.set(backend.rawValue, forKey: Key.backend) }
    }

    @Published var visualizerMode: VisualizerFeed.Mode {
        didSet { defaults.set(visualizerMode.rawValue, forKey: Key.visualizerMode) }
    }

    @Published var showsRemainingTime: Bool {
        didSet { defaults.set(showsRemainingTime, forKey: Key.showsRemainingTime) }
    }

    @Published var alwaysOnTop: Bool {
        didSet { defaults.set(alwaysOnTop, forKey: Key.alwaysOnTop) }
    }

    /// Nil means "unknown", and the KBPS readout stays blank rather than
    /// showing a number nobody verified.
    @Published var assumedBitrate: Int? {
        didSet { defaults.set(assumedBitrate, forKey: Key.assumedBitrate) }
    }

    var isSpotifyConfigured: Bool {
        !clientID.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// The custom scheme, derived from the redirect URI, for the callback
    /// handler and for `ASWebAuthenticationSession`.
    var callbackScheme: String? {
        URL(string: redirectURI)?.scheme
    }
}

import AppKit
import SwiftUI
import Combine
import SkinKit
import SpotifyKit
import PlayerCore
import AudioVis
import OSLog

/// Assembles the app and owns everything with a lifetime.
///
/// The split is: views know pixels, the coordinator knows playback, and this
/// knows what a click *means* and which window should show the result.
@MainActor
final class AppController: NSObject, NSApplicationDelegate {

    private let logger = Logger(subsystem: "com.winampspotify", category: "App")

    // MARK: Model

    let settings = Settings()
    let skinLibrary = SkinLibrary()
    let visualizer = VisualizerFeed()

    private var auth: SpotifyAuth!
    private var api: SpotifyWebAPI!
    private var localBridge: SpotifyLocalBridge!
    private var coordinator: PlaybackCoordinator!
    private var authCoordinator: AuthCoordinator?

    // MARK: Views

    private var renderer: SkinRenderer!
    private var playerView: MainPlayerView!
    private var mainWindowController: MainWindowController!
    private var playlistWindowController: NSWindowController?
    private var playlistView: PlaylistView?
    private var preferencesWindow: NSWindow?
    private var libraryWindow: NSWindow?

    private var cancellables: Set<AnyCancellable> = []

    // MARK: - Accessors used by the interaction and menu extensions

    /// The live coordinator. Exposed as a computed property because sign-in
    /// replaces it, so extensions must never hold their own reference.
    var coordinatorRef: PlaybackCoordinator { coordinator }

    var playlistIsVisible: Bool {
        playlistWindowController?.window?.isVisible ?? false
    }

    func toggleShade() {
        mainWindowController.toggleShade()
    }

    // MARK: - Launch

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildModel()
        buildWindows()
        buildMenus()
        observeModel()

        Task {
            await auth.restoreSession()
            // Provoke the Automation prompt now, so the user connects it with
            // having just launched this app.
            await localBridge.launchSpotifyIfNeeded()
            _ = await localBridge.requestAutomationPermission()
            coordinator.start()
            if settings.visualizerMode != .off { visualizer.start() }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        coordinator.stop()
        visualizer.stop()
    }

    private func buildModel() {
        auth = SpotifyAuth(
            configuration: SpotifyAuth.Configuration(
                clientID: settings.clientID,
                redirectURI: settings.redirectURI
            ),
            tokenStore: KeychainTokenStore()
        )
        api = SpotifyWebAPI(auth: auth)
        localBridge = SpotifyLocalBridge(assumedBitrateKbps: settings.assumedBitrate)
        coordinator = PlaybackCoordinator(
            localEngine: localBridge,
            remoteEngine: RemotePlaybackEngine(api: api),
            preference: settings.backend
        )
        visualizer.mode = settings.visualizerMode

        skinLibrary.refresh(bundledSkinURLs: Self.bundledSkinURLs)
    }

    private func buildWindows() {
        let skin = currentSkin()
        renderer = SkinRenderer(skin: skin, scale: settings.scale)
        playerView = MainPlayerView(renderer: renderer, visualizer: visualizer)
        playerView.delegate = self
        playerView.showsRemainingTime = settings.showsRemainingTime

        mainWindowController = MainWindowController(playerView: playerView)
        mainWindowController.showWindow(nil)
        applyAlwaysOnTop()
    }

    /// Skins shipped inside the app bundle, copied there by
    /// Scripts/build-app.sh. Running the bare `swift build` binary has no
    /// bundle, so this is simply empty then.
    static var bundledSkinURLs: [URL] {
        guard let directory = Bundle.main.resourceURL?
            .appendingPathComponent("Skins", isDirectory: true) else { return [] }
        return (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        )) ?? []
    }

    private func currentSkin() -> Skin {
        let entries = skinLibrary.entries
        let entry = entries.first { $0.id == settings.selectedSkinID } ?? skinLibrary.builtInEntry
        do {
            return try skinLibrary.skin(for: entry)
        } catch {
            logger.error("Could not load skin \(entry.name, privacy: .public): \(error.localizedDescription, privacy: .public)")
            // Fall back rather than launching to a blank window.
            return (try? skinLibrary.skin(for: skinLibrary.builtInEntry)) ?? DefaultSkin.make()
        }
    }

    private func observeModel() {
        coordinator.$snapshot
            .receive(on: RunLoop.main)
            .sink { [weak self] snapshot in
                guard let self else { return }
                playerView.snapshot = snapshot
                playlistView?.nowPlayingURI = snapshot.trackURI
                if let uri = snapshot.trackURI { playlistView?.scrollToTrack(uri: uri) }
                // The tap can only attach once Spotify has opened an audio
                // client, which is the moment playback starts.
                if snapshot.state == .playing, !visualizer.status.isRunning, visualizer.mode != .off {
                    visualizer.start()
                }
            }
            .store(in: &cancellables)

        coordinator.$playlist
            .receive(on: RunLoop.main)
            .sink { [weak self] playlist in
                self?.playlistView?.playlist = playlist
            }
            .store(in: &cancellables)

        visualizer.$mode
            .sink { [weak self] mode in
                self?.settings.visualizerMode = mode
                self?.playerView.needsDisplay = true
            }
            .store(in: &cancellables)
    }

    // MARK: - Skins

    func applySkin(entryID: String?) {
        settings.selectedSkinID = entryID
        let skin = currentSkin()
        mainWindowController.applySkin(skin)
        playlistView?.needsDisplay = true
    }

    func setScale(_ scale: Int) {
        settings.scale = scale
        mainWindowController.setScale(scale)
        playlistView?.needsDisplay = true
    }

    /// Opens the file picker for `.wsz` / `.wskin` skins and installs the pick.
    func importSkin() {
        let panel = NSOpenPanel()
        panel.title = "Choose a Skin"
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = true
        panel.canChooseFiles = true
        panel.allowedContentTypes = []
        panel.message = "Winamp skins (.wsz, .wsp) and Winamp Spotify skins (.wskin)."

        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            let entry = try skinLibrary.install(from: url)
            applySkin(entryID: entry.id)
        } catch {
            present(error: error, title: "That skin could not be loaded")
        }
    }

    func applyAlwaysOnTop() {
        mainWindowController.window?.level = settings.alwaysOnTop ? .floating : .normal
        playlistWindowController?.window?.level = settings.alwaysOnTop ? .floating : .normal
    }

    // MARK: - Playlist window

    func togglePlaylistWindow() {
        if let controller = playlistWindowController, controller.window?.isVisible == true {
            controller.close()
            playlistWindowController = nil
            playlistView = nil
            playerView.isPlaylistVisible = false
            return
        }

        let view = PlaylistView(renderer: renderer)
        view.delegate = self
        view.playlist = coordinator.playlist
        view.nowPlayingURI = coordinator.snapshot.trackURI

        let window = SkinnedWindow(contentRect: NSRect(x: 0, y: 0, width: 275 * settings.scale, height: 232 * settings.scale))
        // The playlist is the one window that resizes, and only in the 25px
        // steps its frame tiles are built from.
        window.styleMask.insert(.resizable)
        window.contentMinSize = NSSize(width: 275 * settings.scale, height: 116 * settings.scale)
        window.resizeIncrements = NSSize(width: 25 * settings.scale, height: 29 * settings.scale)
        window.contentView = view
        window.setFrameAutosaveName("PlaylistWindow")

        let controller = NSWindowController(window: window)
        // Sit just below the main window so the two move as a pair.
        if let main = mainWindowController.window {
            window.setFrameOrigin(NSPoint(x: main.frame.minX, y: main.frame.minY - window.frame.height))
        }
        controller.showWindow(nil)

        playlistWindowController = controller
        playlistView = view
        playerView.isPlaylistVisible = true
        applyAlwaysOnTop()
    }

    // MARK: - Library

    /// The eject button's job: pick something from Spotify to load.
    func showLibraryBrowser() {
        guard settings.isSpotifyConfigured else {
            showPreferences()
            present(
                message: "Add your Spotify client ID first",
                informative: "The playlist browser uses the Spotify Web API, which needs a client ID from developer.spotify.com. Preferences is open."
            )
            return
        }

        if let window = libraryWindow {
            window.makeKeyAndOrderFront(nil)
            return
        }

        let browser = LibraryBrowserView(
            api: api,
            onLoad: { [weak self] name, entries in
                guard let self else { return }
                var playlist = coordinator.playlist
                playlist.replaceAll(with: entries, name: name)
                coordinator.playlist = playlist
                if playlistWindowController == nil { togglePlaylistWindow() }
            },
            onEnqueue: { [weak self] entries in
                guard let self else { return }
                var playlist = coordinator.playlist
                playlist.append(entries)
                coordinator.playlist = playlist
                if playlistWindowController == nil { togglePlaylistWindow() }
            }
        )

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 620, height: 460),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Spotify Library"
        window.contentView = NSHostingView(rootView: browser)
        window.isReleasedWhenClosed = false
        window.center()
        window.makeKeyAndOrderFront(nil)
        libraryWindow = window
    }

    func showPreferences() {
        if let window = preferencesWindow {
            window.makeKeyAndOrderFront(nil)
            return
        }
        let view = PreferencesView(
            settings: settings,
            skinLibrary: skinLibrary,
            visualizer: visualizer,
            onSignIn: { [weak self] in await self?.signIn() },
            onSignOut: { [weak self] in await self?.signOut() },
            onSelectSkin: { [weak self] id in self?.applySkin(entryID: id) },
            onImportSkin: { [weak self] in self?.importSkin() },
            onScaleChange: { [weak self] scale in self?.setScale(scale) },
            onBackendChange: { [weak self] preference in self?.coordinator.preference = preference },
            onAlwaysOnTopChange: { [weak self] in self?.applyAlwaysOnTop() }
        )

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 560),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Winamp Spotify Preferences"
        window.contentView = NSHostingView(rootView: view)
        window.isReleasedWhenClosed = false
        window.center()
        window.makeKeyAndOrderFront(nil)
        preferencesWindow = window
    }

    // MARK: - Auth

    func signIn() async {
        guard let scheme = settings.callbackScheme else {
            present(
                message: "That redirect URI has no scheme",
                informative: "It should look like winamp-spotify://auth."
            )
            return
        }
        // Rebuild so an edited client ID takes effect without a relaunch.
        buildAuth()
        let coordinatorForAuth = AuthCoordinator(
            auth: auth,
            callbackScheme: scheme,
            anchorWindow: preferencesWindow ?? mainWindowController.window
        )
        authCoordinator = coordinatorForAuth
        do {
            try await coordinatorForAuth.signIn()
            await coordinator.refreshEngineSelection()
        } catch {
            present(error: error, title: "Spotify sign-in failed")
        }
        authCoordinator = nil
    }

    func signOut() async {
        await auth.signOut()
        await coordinator.refreshEngineSelection()
    }

    private func buildAuth() {
        auth = SpotifyAuth(
            configuration: SpotifyAuth.Configuration(
                clientID: settings.clientID,
                redirectURI: settings.redirectURI
            ),
            tokenStore: KeychainTokenStore()
        )
        api = SpotifyWebAPI(auth: auth)
        // The coordinator holds the old remote engine; give it a fresh one
        // pointed at the new credentials.
        coordinator.stop()
        coordinator = PlaybackCoordinator(
            localEngine: localBridge,
            remoteEngine: RemotePlaybackEngine(api: api),
            preference: settings.backend
        )
        cancellables.removeAll()
        observeModel()
        coordinator.start()
    }

    // MARK: - Alerts

    func present(error: Error, title: String) {
        present(message: title, informative: error.localizedDescription)
    }

    func present(message: String, informative: String) {
        let alert = NSAlert()
        alert.messageText = message
        alert.informativeText = informative
        alert.alertStyle = .warning
        alert.runModal()
    }
}

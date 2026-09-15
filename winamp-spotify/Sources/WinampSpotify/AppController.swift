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
    private var playlistRenderer: SkinRenderer?
    private var preferencesWindow: NSWindow?
    private var libraryWindowController: NSWindowController?
    private var libraryView: MediaLibraryView?
    private var libraryRenderer: SkinRenderer?
    private var browser: MediaBrowser!

    /// Every renderer currently backing a window. A skin or scale change has to
    /// reach all of them, and each window needs its own because the renderer
    /// carries the canvas height used for coordinate flipping.
    private var activeRenderers: [SkinRenderer] {
        [renderer, playlistRenderer, libraryRenderer].compactMap { $0 }
    }

    private var cancellables: Set<AnyCancellable> = []
    private var browserCancellable: AnyCancellable?

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
        browser = MediaBrowser(api: api)

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
        previousScale = settings.scale
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
        for secondary in [playlistRenderer, libraryRenderer].compactMap({ $0 }) {
            secondary.apply(skin: skin)
        }
        playlistView?.needsDisplay = true
        // The library regenerates its widget art from the new skin's palette.
        libraryView?.skinDidChange()
    }

    func setScale(_ scale: Int) {
        settings.scale = scale
        for active in activeRenderers { active.scale = max(1, scale) }
        mainWindowController.setScale(scale)
        resizeSecondaryWindows()
        playlistView?.needsDisplay = true
        libraryView?.needsDisplay = true
    }

    /// Keeps the playlist and library windows at whole multiples of their
    /// layout size when the scale changes, so they stay pixel-exact.
    private func resizeSecondaryWindows() {
        let scale = CGFloat(settings.scale)
        for window in [playlistWindowController?.window, libraryWindowController?.window].compactMap({ $0 }) {
            let layoutWidth = (window.frame.width / CGFloat(max(1, previousScale))).rounded()
            let layoutHeight = (window.frame.height / CGFloat(max(1, previousScale))).rounded()
            let size = NSSize(width: layoutWidth * scale, height: layoutHeight * scale)
            window.setFrame(
                NSRect(
                    x: window.frame.minX,
                    y: window.frame.maxY - size.height,
                    width: size.width,
                    height: size.height
                ),
                display: true
            )
            window.contentMinSize = NSSize(width: 275 * scale, height: 160 * scale)
            window.resizeIncrements = NSSize(width: 25 * scale, height: 1 * scale)
        }
        previousScale = settings.scale
    }

    /// Scale the secondary windows were last laid out at, so a change can be
    /// applied as a ratio rather than guessing their layout size.
    private var previousScale = 1

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
        let level: NSWindow.Level = settings.alwaysOnTop ? .floating : .normal
        mainWindowController.window?.level = level
        playlistWindowController?.window?.level = level
        libraryWindowController?.window?.level = level
    }

    // MARK: - Playlist window

    func togglePlaylistWindow() {
        if let controller = playlistWindowController, controller.window?.isVisible == true {
            controller.close()
            playlistWindowController = nil
            playlistView = nil
            playlistRenderer = nil
            playerView.isPlaylistVisible = false
            return
        }

        // A renderer of its own: the canvas height it carries is this window's,
        // not the main window's.
        let ownRenderer = SkinRenderer(skin: currentSkin(), scale: settings.scale)
        playlistRenderer = ownRenderer

        let view = PlaylistView(renderer: ownRenderer)
        view.delegate = self
        view.playlist = coordinator.playlist
        view.nowPlayingURI = coordinator.snapshot.trackURI

        let scale = CGFloat(settings.scale)
        let window = SkinnedWindow(
            contentRect: NSRect(x: 0, y: 0, width: 275 * scale, height: 232 * scale)
        )
        // The playlist is resizable, and only in the steps its frame tiles are
        // built from.
        window.styleMask.insert(.resizable)
        window.contentMinSize = NSSize(width: 275 * scale, height: 116 * scale)
        window.resizeIncrements = NSSize(width: 25 * scale, height: 29 * scale)
        window.contentView = view
        window.setFrameAutosaveName("PlaylistWindow")

        let controller = NSWindowController(window: window)
        // Sit directly below the main window, so the two move as a pair.
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
    ///
    /// Drawn in the current skin rather than in system chrome, because a native
    /// panel next to a skinned player looks like two different applications.
    func showLibraryBrowser() {
        if let controller = libraryWindowController, controller.window?.isVisible == true {
            controller.window?.makeKeyAndOrderFront(nil)
            return
        }

        guard settings.isSpotifyConfigured else {
            showPreferences()
            present(
                message: "Add your Spotify client ID first",
                informative: """
                Searching and browsing use the Spotify Web API, which needs a \
                client ID from developer.spotify.com. Preferences is open — \
                transport control keeps working without it.
                """
            )
            return
        }

        let ownRenderer = SkinRenderer(skin: currentSkin(), scale: settings.scale)
        libraryRenderer = ownRenderer

        let view = MediaLibraryView(renderer: ownRenderer, browser: browser)
        view.delegate = self

        let scale = CGFloat(settings.scale)
        let window = SkinnedWindow(
            contentRect: NSRect(x: 0, y: 0, width: 420 * scale, height: 320 * scale)
        )
        window.styleMask.insert(.resizable)
        window.contentMinSize = NSSize(width: 320 * scale, height: 200 * scale)
        // Width steps match the frame tiles; height is free because rows are a
        // fixed height and a partial row at the bottom is simply not drawn.
        window.resizeIncrements = NSSize(width: 25 * scale, height: 1 * scale)
        window.contentView = view
        window.setFrameAutosaveName("MediaLibraryWindow")

        let controller = NSWindowController(window: window)
        if let main = mainWindowController.window {
            window.setFrameOrigin(NSPoint(
                x: main.frame.maxX + 8,
                y: main.frame.maxY - window.frame.height
            ))
        }
        controller.showWindow(nil)
        window.makeFirstResponder(view)

        libraryWindowController = controller
        libraryView = view
        applyAlwaysOnTop()

        // Observe the model here rather than in the view: the view is a
        // renderer, and this keeps its redraws driven by one place.
        browserCancellable = browser.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.libraryView?.modelDidChange() }

        browser.reload()
    }

    func closeLibraryWindow() {
        libraryWindowController?.close()
        libraryWindowController = nil
        libraryView = nil
        libraryRenderer = nil
        browserCancellable = nil
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
            theme: { [weak self] in self?.renderer.skin.effectiveTheme ?? .fallback },
            onClearArtworkCache: { ArtworkLoader.shared.clearCache() },
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
        browser = MediaBrowser(api: api)
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

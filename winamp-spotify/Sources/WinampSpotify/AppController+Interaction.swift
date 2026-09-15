import AppKit
import SkinKit
import PlayerCore
import AudioVis

// MARK: - Main window interactions

extension AppController: MainPlayerViewDelegate {

    func playerViewDidTapPrevious(_ view: MainPlayerView) { coordinatorRef.previous() }
    func playerViewDidTapPlay(_ view: MainPlayerView) { coordinatorRef.play() }
    func playerViewDidTapPause(_ view: MainPlayerView) { coordinatorRef.togglePlayPause() }
    func playerViewDidTapStop(_ view: MainPlayerView) { coordinatorRef.stopPlayback() }
    func playerViewDidTapNext(_ view: MainPlayerView) { coordinatorRef.next() }

    /// Eject has always meant "load something", which here means the Spotify
    /// library browser.
    func playerViewDidTapEject(_ view: MainPlayerView) { showLibraryBrowser() }

    func playerViewDidToggleShuffle(_ view: MainPlayerView) { coordinatorRef.toggleShuffle() }
    func playerViewDidCycleRepeat(_ view: MainPlayerView) { coordinatorRef.cycleRepeatMode() }
    func playerViewDidTogglePlaylist(_ view: MainPlayerView) { togglePlaylistWindow() }

    /// Winamp's EQ button. There is no equaliser here — Spotify's audio cannot
    /// be filtered without a virtual output device — so the button cycles the
    /// visualiser instead, which is the one thing in that corner of the window
    /// this app can do honestly.
    func playerViewDidTapEqualizer(_ view: MainPlayerView) { visualizer.cycleMode() }

    func playerViewDidCycleVisualizer(_ view: MainPlayerView) { visualizer.cycleMode() }

    func playerViewDidToggleTimeMode(_ view: MainPlayerView) {
        view.showsRemainingTime.toggle()
        settings.showsRemainingTime = view.showsRemainingTime
    }

    func playerViewDidRequestClose(_ view: MainPlayerView) { NSApp.terminate(nil) }

    func playerViewDidRequestMinimize(_ view: MainPlayerView) {
        view.window?.miniaturize(nil)
    }

    func playerViewDidToggleShade(_ view: MainPlayerView) { toggleShade() }

    func playerViewDidOpenMenu(_ view: MainPlayerView, at point: NSPoint) {
        let menu = makeContextMenu()
        menu.popUp(positioning: nil, at: point, in: view)
    }

    func playerView(_ view: MainPlayerView, didBeginSeekAt fraction: Double) {
        coordinatorRef.beginScrub(to: fraction * coordinatorRef.snapshot.duration)
    }

    func playerView(_ view: MainPlayerView, didUpdateSeekTo fraction: Double) {
        coordinatorRef.updateScrub(to: fraction * coordinatorRef.snapshot.duration)
    }

    func playerViewDidEndSeek(_ view: MainPlayerView) {
        coordinatorRef.endScrub()
    }

    func playerView(_ view: MainPlayerView, didSetVolume volume: Double) {
        coordinatorRef.setVolume(volume)
    }

    func playerView(_ view: MainPlayerView, didSetBalance balance: Double) {
        coordinatorRef.setBalance(balance)
    }
}

// MARK: - Playlist window interactions

extension AppController: PlaylistViewDelegate {

    func playlistView(_ view: PlaylistView, didActivate entry: PlaylistEntry) {
        coordinatorRef.playEntry(entry)
    }

    func playlistView(_ view: PlaylistView, didChangeSelection selection: Set<UUID>) {
        var playlist = coordinatorRef.playlist
        playlist.selection = selection
        // The view already has the new selection; writing it back keeps the
        // model authoritative without bouncing a redraw.
        playlist.entries = view.playlist.entries
        coordinatorRef.playlist = playlist
    }

    func playlistViewDidRequestClose(_ view: PlaylistView) {
        togglePlaylistWindow()
    }

    func playlistViewDidToggleShade(_ view: PlaylistView) {
        // Playlist windowshade collapses to its title bar.
        guard let window = view.window else { return }
        let scale = CGFloat(settings.scale)
        let isShaded = window.frame.height <= 20 * scale + 1
        let height = isShaded ? 232 * scale : 20 * scale
        let frame = NSRect(
            x: window.frame.minX,
            y: window.frame.maxY - height,
            width: window.frame.width,
            height: height
        )
        window.setFrame(frame, display: true, animate: false)
    }

    func playlistView(_ view: PlaylistView, didPressMenuButton button: PlaylistView.MenuButton, at point: NSPoint) {
        let menu = NSMenu()
        switch button {
        case .add:
            menu.addItem(withTitle: "Add from Spotify…", action: #selector(menuShowLibrary), keyEquivalent: "")
        case .remove:
            menu.addItem(withTitle: "Remove Selected", action: #selector(menuRemoveSelected), keyEquivalent: "")
            menu.addItem(withTitle: "Remove All", action: #selector(menuRemoveAll), keyEquivalent: "")
        case .select:
            menu.addItem(withTitle: "Select All", action: #selector(menuSelectAll), keyEquivalent: "")
            menu.addItem(withTitle: "Select None", action: #selector(menuSelectNone), keyEquivalent: "")
            menu.addItem(withTitle: "Invert Selection", action: #selector(menuInvertSelection), keyEquivalent: "")
        case .misc:
            menu.addItem(withTitle: "Sort by Title", action: #selector(menuSortByTitle), keyEquivalent: "")
            menu.addItem(withTitle: "Sort by Artist", action: #selector(menuSortByArtist), keyEquivalent: "")
            menu.addItem(withTitle: "Sort by Album", action: #selector(menuSortByAlbum), keyEquivalent: "")
            menu.addItem(withTitle: "Randomize List", action: #selector(menuRandomize), keyEquivalent: "")
        case .list:
            menu.addItem(withTitle: "Open Playlist…", action: #selector(menuOpenPlaylist), keyEquivalent: "")
            menu.addItem(withTitle: "Save Playlist…", action: #selector(menuSavePlaylist), keyEquivalent: "")
            menu.addItem(withTitle: "Export as M3U…", action: #selector(menuExportM3U), keyEquivalent: "")
        }
        for item in menu.items { item.target = self }
        menu.popUp(positioning: nil, at: point, in: view)
    }
}

// MARK: - Menus

extension AppController {

    /// Right-click / options-button menu, mirroring what Winamp put there.
    func makeContextMenu() -> NSMenu {
        let menu = NSMenu()

        let playlistItem = NSMenuItem(
            title: "Playlist Editor",
            action: #selector(menuTogglePlaylist),
            keyEquivalent: ""
        )
        playlistItem.state = playlistIsVisible ? .on : .off
        menu.addItem(playlistItem)

        menu.addItem(withTitle: "Spotify Library…", action: #selector(menuShowLibrary), keyEquivalent: "")
        menu.addItem(.separator())

        // Skins
        let skinsItem = NSMenuItem(title: "Skins", action: nil, keyEquivalent: "")
        let skinsMenu = NSMenu()
        for entry in skinLibrary.entries {
            let item = NSMenuItem(title: entry.name, action: #selector(menuSelectSkin(_:)), keyEquivalent: "")
            item.representedObject = entry.id
            item.state = entry.id == (settings.selectedSkinID ?? skinLibrary.builtInEntry.id) ? .on : .off
            item.target = self
            skinsMenu.addItem(item)
        }
        skinsMenu.addItem(.separator())
        let importItem = NSMenuItem(title: "Add Skin…", action: #selector(menuImportSkin), keyEquivalent: "")
        importItem.target = self
        skinsMenu.addItem(importItem)
        skinsItem.submenu = skinsMenu
        menu.addItem(skinsItem)

        // Size
        let sizeItem = NSMenuItem(title: "Size", action: nil, keyEquivalent: "")
        let sizeMenu = NSMenu()
        for scale in 1 ... 4 {
            let item = NSMenuItem(
                title: scale == 1 ? "Normal" : "\(scale)x",
                action: #selector(menuSetScale(_:)),
                keyEquivalent: ""
            )
            item.tag = scale
            item.state = settings.scale == scale ? .on : .off
            item.target = self
            sizeMenu.addItem(item)
        }
        sizeItem.submenu = sizeMenu
        menu.addItem(sizeItem)

        // Visualiser
        let visualizerItem = NSMenuItem(title: "Visualization", action: nil, keyEquivalent: "")
        let visualizerMenu = NSMenu()
        for mode in VisualizerFeed.Mode.allCases {
            let item = NSMenuItem(title: mode.title, action: #selector(menuSetVisualizer(_:)), keyEquivalent: "")
            item.representedObject = mode.rawValue
            item.state = visualizer.mode == mode ? .on : .off
            item.target = self
            visualizerMenu.addItem(item)
        }
        if let message = visualizer.status.message {
            visualizerMenu.addItem(.separator())
            let info = NSMenuItem(title: message, action: nil, keyEquivalent: "")
            info.isEnabled = false
            visualizerMenu.addItem(info)
        }
        visualizerItem.submenu = visualizerMenu
        menu.addItem(visualizerItem)

        menu.addItem(.separator())
        let onTop = NSMenuItem(title: "Always on Top", action: #selector(menuToggleAlwaysOnTop), keyEquivalent: "")
        onTop.state = settings.alwaysOnTop ? .on : .off
        menu.addItem(onTop)
        menu.addItem(withTitle: "Double Size", action: #selector(menuToggleDoubleSize), keyEquivalent: "")
        menu.addItem(withTitle: "Windowshade Mode", action: #selector(menuToggleShade), keyEquivalent: "")

        menu.addItem(.separator())
        menu.addItem(withTitle: "Preferences…", action: #selector(menuShowPreferences), keyEquivalent: ",")
        menu.addItem(withTitle: "Quit Winamp Spotify", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        for item in menu.items where item.target == nil && item.action != #selector(NSApplication.terminate(_:)) {
            item.target = self
        }
        return menu
    }

    /// The main menu bar. A skinned player still needs one: it is where the
    /// standard shortcuts and the Services menu live.
    func buildMenus() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Winamp Spotify", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        let preferences = NSMenuItem(title: "Preferences…", action: #selector(menuShowPreferences), keyEquivalent: ",")
        preferences.target = self
        appMenu.addItem(preferences)
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Winamp Spotify", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit Winamp Spotify", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let playbackItem = NSMenuItem()
        let playbackMenu = NSMenu(title: "Playback")
        let entries: [(String, Selector, String)] = [
            ("Play / Pause", #selector(menuTogglePlayPause), " "),
            ("Stop", #selector(menuStop), "."),
            ("Next Track", #selector(menuNext), "\u{2192}"),
            ("Previous Track", #selector(menuPrevious), "\u{2190}"),
            ("Volume Up", #selector(menuVolumeUp), "\u{2191}"),
            ("Volume Down", #selector(menuVolumeDown), "\u{2193}"),
        ]
        for (title, action, key) in entries {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
            item.target = self
            playbackMenu.addItem(item)
        }
        playbackMenu.addItem(.separator())
        let shuffle = NSMenuItem(title: "Shuffle", action: #selector(menuToggleShuffle), keyEquivalent: "s")
        shuffle.target = self
        playbackMenu.addItem(shuffle)
        let repeatItem = NSMenuItem(title: "Repeat", action: #selector(menuCycleRepeat), keyEquivalent: "r")
        repeatItem.target = self
        playbackMenu.addItem(repeatItem)
        playbackItem.submenu = playbackMenu
        mainMenu.addItem(playbackItem)

        let viewItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        let viewEntries: [(String, Selector, String)] = [
            ("Playlist Editor", #selector(menuTogglePlaylist), "e"),
            ("Spotify Library…", #selector(menuShowLibrary), "l"),
            ("Windowshade Mode", #selector(menuToggleShade), "w"),
            ("Double Size", #selector(menuToggleDoubleSize), "d"),
            ("Cycle Visualization", #selector(menuCycleVisualizer), "v"),
            ("Add Skin…", #selector(menuImportSkin), "k"),
        ]
        for (title, action, key) in viewEntries {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
            item.target = self
            viewMenu.addItem(item)
        }
        viewItem.submenu = viewMenu
        mainMenu.addItem(viewItem)

        NSApp.mainMenu = mainMenu
    }
}

// MARK: - Menu actions

extension AppController {

    @objc func menuTogglePlayPause() { coordinatorRef.togglePlayPause() }
    @objc func menuStop() { coordinatorRef.stopPlayback() }
    @objc func menuNext() { coordinatorRef.next() }
    @objc func menuPrevious() { coordinatorRef.previous() }
    @objc func menuToggleShuffle() { coordinatorRef.toggleShuffle() }
    @objc func menuCycleRepeat() { coordinatorRef.cycleRepeatMode() }

    @objc func menuVolumeUp() {
        coordinatorRef.setVolume(min(1, coordinatorRef.snapshot.volume + 0.05))
    }

    @objc func menuVolumeDown() {
        coordinatorRef.setVolume(max(0, coordinatorRef.snapshot.volume - 0.05))
    }

    @objc func menuTogglePlaylist() { togglePlaylistWindow() }
    @objc func menuShowLibrary() { showLibraryBrowser() }
    @objc func menuShowPreferences() { showPreferences() }
    @objc func menuImportSkin() { importSkin() }
    @objc func menuToggleShade() { toggleShade() }
    @objc func menuCycleVisualizer() { visualizer.cycleMode() }

    @objc func menuToggleDoubleSize() {
        setScale(settings.scale == 1 ? 2 : 1)
    }

    @objc func menuToggleAlwaysOnTop() {
        settings.alwaysOnTop.toggle()
        applyAlwaysOnTop()
    }

    @objc func menuSelectSkin(_ sender: NSMenuItem) {
        applySkin(entryID: sender.representedObject as? String)
    }

    @objc func menuSetScale(_ sender: NSMenuItem) {
        setScale(sender.tag)
    }

    @objc func menuSetVisualizer(_ sender: NSMenuItem) {
        guard let raw = sender.representedObject as? String,
              let mode = VisualizerFeed.Mode(rawValue: raw) else { return }
        visualizer.mode = mode
        if mode == .off { visualizer.stop() } else { visualizer.start() }
    }

    // MARK: Playlist menu actions

    @objc func menuRemoveSelected() {
        var playlist = coordinatorRef.playlist
        playlist.removeSelected()
        coordinatorRef.playlist = playlist
    }

    @objc func menuRemoveAll() {
        var playlist = coordinatorRef.playlist
        playlist.removeAll()
        coordinatorRef.playlist = playlist
    }

    @objc func menuSelectAll() {
        var playlist = coordinatorRef.playlist
        playlist.selection = Set(playlist.entries.map(\.id))
        coordinatorRef.playlist = playlist
    }

    @objc func menuSelectNone() {
        var playlist = coordinatorRef.playlist
        playlist.selection = []
        coordinatorRef.playlist = playlist
    }

    @objc func menuInvertSelection() {
        var playlist = coordinatorRef.playlist
        let all = Set(playlist.entries.map(\.id))
        playlist.selection = all.subtracting(playlist.selection)
        coordinatorRef.playlist = playlist
    }

    @objc func menuSortByTitle() { sortPlaylist(by: .title) }
    @objc func menuSortByArtist() { sortPlaylist(by: .artist) }
    @objc func menuSortByAlbum() { sortPlaylist(by: .album) }

    @objc func menuRandomize() {
        var playlist = coordinatorRef.playlist
        playlist.randomize()
        coordinatorRef.playlist = playlist
    }

    private func sortPlaylist(by key: Playlist.SortKey) {
        var playlist = coordinatorRef.playlist
        playlist.sort(by: key)
        coordinatorRef.playlist = playlist
    }

    @objc func menuOpenPlaylist() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.title = "Open Playlist"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            coordinatorRef.playlist = try Playlist.read(from: url)
        } catch {
            present(error: error, title: "That playlist could not be opened")
        }
    }

    @objc func menuSavePlaylist() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "\(coordinatorRef.playlist.name).json"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try coordinatorRef.playlist.write(to: url)
        } catch {
            present(error: error, title: "That playlist could not be saved")
        }
    }

    @objc func menuExportM3U() {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "\(coordinatorRef.playlist.name).m3u8"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try coordinatorRef.playlist.m3u8Representation().write(to: url, atomically: true, encoding: .utf8)
        } catch {
            present(error: error, title: "That playlist could not be exported")
        }
    }
}

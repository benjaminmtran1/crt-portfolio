import SwiftUI
import AppKit
import SkinKit
import PlayerCore
import AudioVis

/// Preferences. Deliberately a plain SwiftUI form rather than a skinned window:
/// the skin is for the player, and settings should look like the rest of macOS.
struct PreferencesView: View {

    @ObservedObject var settings: Settings
    let skinLibrary: SkinLibrary
    @ObservedObject var visualizer: VisualizerFeed

    /// Read lazily: the theme changes when the skin does.
    let theme: () -> SkinTheme
    let onClearArtworkCache: () -> Void
    let onSignIn: () async -> Void
    let onSignOut: () async -> Void
    let onSelectSkin: (String?) -> Void
    let onImportSkin: () -> Void
    let onScaleChange: (Int) -> Void
    let onBackendChange: (PlaybackCoordinator.Preference) -> Void
    let onAlwaysOnTopChange: () -> Void

    @State private var isSigningIn = false
    @State private var skinEntries: [SkinLibrary.Entry] = []

    var body: some View {
        TabView {
            spotifyTab
                .tabItem { Label("Spotify", systemImage: "music.note") }
            appearanceTab
                .tabItem { Label("Skins", systemImage: "paintbrush") }
            visualizerTab
                .tabItem { Label("Visualizer", systemImage: "waveform") }
            libraryTab
                .tabItem { Label("Library", systemImage: "books.vertical") }
        }
        .padding(16)
        .frame(minWidth: 480, minHeight: 500)
        .onAppear { skinEntries = skinLibrary.refresh(bundledSkinURLs: AppController.bundledSkinURLs) }
    }

    // MARK: - Spotify

    private var spotifyTab: some View {
        Form {
            Section {
                Picker("Control", selection: Binding(
                    get: { settings.backend },
                    set: { settings.backend = $0; onBackendChange($0) }
                )) {
                    ForEach(PlaybackCoordinator.Preference.allCases, id: \.self) { preference in
                        Text(preference.title).tag(preference)
                    }
                }
                Text("""
                The Spotify app on this Mac is controlled with Apple events: \
                instant, works with a free account, and follows whatever you are \
                already playing. Spotify Connect devices are controlled over the \
                Web API, which needs Premium.
                """)
                .font(.caption)
                .foregroundStyle(.secondary)
            } header: {
                Text("Playback")
            }

            Section {
                TextField("Client ID", text: $settings.clientID)
                    .textFieldStyle(.roundedBorder)
                TextField("Redirect URI", text: $settings.redirectURI)
                    .textFieldStyle(.roundedBorder)

                HStack {
                    Button(isSigningIn ? "Signing in…" : "Sign in to Spotify") {
                        isSigningIn = true
                        Task {
                            await onSignIn()
                            isSigningIn = false
                        }
                    }
                    .disabled(!settings.isSpotifyConfigured || isSigningIn)

                    Button("Sign Out") {
                        Task { await onSignOut() }
                    }
                }

                Text("""
                Browsing your playlists, searching, and controlling other devices \
                need a Spotify app of your own. Create one at \
                developer.spotify.com/dashboard, then add the Redirect URI above \
                to it exactly as written. Transport control of the local Spotify \
                app works without any of this.
                """)
                .font(.caption)
                .foregroundStyle(.secondary)
            } header: {
                Text("Web API access")
            }

            Section {
                Picker("Assume stream quality", selection: Binding(
                    get: { settings.assumedBitrate ?? 0 },
                    set: { settings.assumedBitrate = $0 == 0 ? nil : $0 }
                )) {
                    Text("Don't show").tag(0)
                    Text("96 kbps (Low)").tag(96)
                    Text("160 kbps (Normal)").tag(160)
                    Text("320 kbps (Very High)").tag(320)
                }
                Text("""
                Spotify does not report the bitrate of the stream it is playing, \
                so the KBPS readout can only show what you tell it. Leave it off \
                rather than displaying a guess.
                """)
                .font(.caption)
                .foregroundStyle(.secondary)
            } header: {
                Text("Readouts")
            }
        }
        .formStyle(.grouped)
    }

    // MARK: - Skins

    private var appearanceTab: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Skins")
                .font(.headline)

            List(skinEntries, id: \.id) { entry in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.name)
                        Text(entry.isBuiltIn ? "Built in" : entry.format == .classic ? "Winamp classic" : "Winamp Spotify")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if isSelected(entry) {
                        Image(systemName: "checkmark")
                            .foregroundStyle(.tint)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture { onSelectSkin(entry.isBuiltIn ? nil : entry.id) }
            }
            .frame(minHeight: 200)

            HStack {
                Button("Add Skin…") { onImportSkin(); skinEntries = skinLibrary.refresh(bundledSkinURLs: AppController.bundledSkinURLs) }
                Button("Reveal Skins Folder") {
                    NSWorkspace.shared.open(skinLibrary.skinsDirectory)
                }
                Spacer()
                Button("Refresh") { skinEntries = skinLibrary.refresh(bundledSkinURLs: AppController.bundledSkinURLs) }
            }

            Divider()

            Picker("Window size", selection: Binding(
                get: { settings.scale },
                set: { settings.scale = $0; onScaleChange($0) }
            )) {
                Text("Normal").tag(1)
                Text("Double").tag(2)
                Text("Triple").tag(3)
                Text("Quadruple").tag(4)
            }
            .pickerStyle(.segmented)

            Toggle("Always on top", isOn: Binding(
                get: { settings.alwaysOnTop },
                set: { settings.alwaysOnTop = $0; onAlwaysOnTopChange() }
            ))

            Text("""
            Drop .wsz or .wsp files from any Winamp skin archive into the skins \
            folder, or add a .wskin bundle. Classic skins keep the original \
            275×116 layout; .wskin skins can ship retina art and move controls.
            """)
            .font(.caption)
            .foregroundStyle(.secondary)

            Spacer()
        }
    }

    // MARK: - Library

    private var libraryTab: some View {
        let current = theme()
        return Form {
            Section {
                Text("""
                The media library window has no artwork in any skin — no Winamp \
                skin ever contained a search field or a tab strip. So it is \
                framed in the skin's own playlist tiles, and every control \
                inside is generated from a palette read out of the skin: its \
                pledit.txt list colours, its viscolor.txt ramp, and the \
                faceplate colours sampled from main.bmp.
                """)
                .font(.caption)
                .foregroundStyle(.secondary)

                LabeledContent("Derived palette") {
                    HStack(spacing: 3) {
                        ForEach(Array(swatches(of: current).enumerated()), id: \.offset) { _, swatch in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color(
                                    red: Double(swatch.1.r) / 255,
                                    green: Double(swatch.1.g) / 255,
                                    blue: Double(swatch.1.b) / 255
                                ))
                                .frame(width: 18, height: 18)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 2)
                                        .strokeBorder(.separator, lineWidth: 0.5)
                                )
                                .help(swatch.0)
                        }
                    }
                }

                LabeledContent("List font") {
                    Text(current.listFontName ?? "System (skin did not name one)")
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("Theming")
            }

            Section {
                Button("Clear Artwork Cache", action: onClearArtworkCache)
                Text("""
                Album and artist artwork is the one thing that cannot be themed \
                — it is someone's cover, not skin art — so it is framed in the \
                skin's bevel instead. Thumbnails are cached on disk.
                """)
                .font(.caption)
                .foregroundStyle(.secondary)
            } header: {
                Text("Artwork")
            }
        }
        .formStyle(.grouped)
    }

    private func swatches(of theme: SkinTheme) -> [(String, SkinColor)] {
        [
            ("Faceplate", theme.faceBase),
            ("Bevel light", theme.bevelLight),
            ("Bevel dark", theme.bevelDark),
            ("Display", theme.displayBackground),
            ("Display text", theme.displayText),
            ("List background", theme.listBackground),
            ("List text", theme.listText),
            ("Selection", theme.selectionBackground),
            ("Accent", theme.accent),
        ]
    }

    private func isSelected(_ entry: SkinLibrary.Entry) -> Bool {
        if entry.isBuiltIn { return settings.selectedSkinID == nil }
        return settings.selectedSkinID == entry.id
    }

    // MARK: - Visualizer

    private var visualizerTab: some View {
        Form {
            Section {
                Picker("Mode", selection: $visualizer.mode) {
                    ForEach(VisualizerFeed.Mode.allCases, id: \.self) { mode in
                        Text(mode.title).tag(mode)
                    }
                }

                LabeledContent("Status") {
                    Text(statusText)
                        .foregroundStyle(visualizer.status.isRunning ? .green : .secondary)
                }

                if let message = visualizer.status.message {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Button("Reconnect") { visualizer.start() }
            } header: {
                Text("Visualization")
            }

            Section {
                Text("""
                The spectrum analyzer reads Spotify's real audio output through a \
                Core Audio process tap, so it needs macOS 14.2 or later and audio \
                recording permission. Nothing is recorded or written to disk — the \
                samples go straight into an FFT and are discarded.
                """)
                .font(.caption)
                .foregroundStyle(.secondary)

                Text("""
                There is no equalizer. A tap can read Spotify's output but not \
                change it, and inserting real filters would mean installing a \
                virtual audio device and rerouting your system output. Rather \
                than ship ten sliders that do nothing, they are left out.
                """)
                .font(.caption)
                .foregroundStyle(.secondary)
            } header: {
                Text("About")
            }
        }
        .formStyle(.grouped)
    }

    private var statusText: String {
        switch visualizer.status {
        case .running: return "Reading Spotify's output"
        case .idle: return "Not started"
        case .unavailable: return "Unavailable"
        case .unsupported: return "Not supported on this macOS"
        }
    }
}

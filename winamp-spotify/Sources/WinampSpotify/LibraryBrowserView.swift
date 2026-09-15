import SwiftUI
import AppKit
import SpotifyKit
import PlayerCore

/// Browse Spotify playlists, liked songs and search results, and load them into
/// the playlist window.
///
/// This is the one part of the app that is unapologetically modern: a skinned
/// browser at 275 pixels wide would be miserable to use, and Winamp's own
/// "open file" dialog was always the host platform's.
struct LibraryBrowserView: View {

    let api: SpotifyWebAPI
    let onLoad: (String, [PlaylistEntry]) -> Void
    let onEnqueue: ([PlaylistEntry]) -> Void

    private enum Source: Hashable {
        case playlists
        case liked
        case search
    }

    @State private var source: Source = .playlists
    @State private var playlists: [SpotifyPlaylist] = []
    @State private var selectedPlaylist: SpotifyPlaylist?
    @State private var tracks: [SpotifyTrack] = []
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationSplitView {
            sidebar
                .navigationSplitViewColumnWidth(min: 200, ideal: 220)
        } detail: {
            detail
        }
        .task { await loadPlaylists() }
    }

    // MARK: - Sidebar

    private var sidebar: some View {
        List(selection: $source) {
            Section {
                Label("Playlists", systemImage: "music.note.list").tag(Source.playlists)
                Label("Liked Songs", systemImage: "heart").tag(Source.liked)
                Label("Search", systemImage: "magnifyingglass").tag(Source.search)
            }

            if source == .playlists, !playlists.isEmpty {
                Section("Your Playlists") {
                    ForEach(playlists) { playlist in
                        Button {
                            selectedPlaylist = playlist
                            Task { await loadPlaylistTracks(playlist) }
                        } label: {
                            HStack {
                                Text(playlist.name).lineLimit(1)
                                Spacer()
                                if let total = playlist.tracks?.total {
                                    Text("\(total)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .fontWeight(selectedPlaylist?.id == playlist.id ? .semibold : .regular)
                    }
                }
            }
        }
        .onChange(of: source) { _, newValue in
            Task {
                switch newValue {
                case .playlists: await loadPlaylists()
                case .liked: await loadLikedSongs()
                case .search: tracks = []
                }
            }
        }
    }

    // MARK: - Detail

    private var detail: some View {
        VStack(spacing: 0) {
            if source == .search {
                HStack {
                    TextField("Search Spotify", text: $searchText)
                        .textFieldStyle(.roundedBorder)
                        .onSubmit { Task { await runSearch() } }
                    Button("Search") { Task { await runSearch() } }
                        .disabled(searchText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(12)
                Divider()
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Divider()
            }

            trackTable

            Divider()
            HStack {
                if isLoading { ProgressView().controlSize(.small) }
                Text(footerText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Add to Playlist") { onEnqueue(entries) }
                    .disabled(tracks.isEmpty)
                Button("Replace Playlist") { onLoad(currentTitle, entries) }
                    .keyboardShortcut(.defaultAction)
                    .disabled(tracks.isEmpty)
            }
            .padding(12)
        }
    }

    private var trackTable: some View {
        Table(tracks) {
            TableColumn("Title") { track in
                Text(track.name).lineLimit(1)
            }
            TableColumn("Artist") { track in
                Text(track.artistNames).lineLimit(1).foregroundStyle(.secondary)
            }
            TableColumn("Album") { track in
                Text(track.album?.name ?? "").lineLimit(1).foregroundStyle(.secondary)
            }
            TableColumn("Time") { track in
                Text(PlaylistEntry.formatDuration(track.duration))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            .width(56)
        }
    }

    private var entries: [PlaylistEntry] {
        tracks.map(PlaylistEntry.init(track:))
    }

    private var currentTitle: String {
        switch source {
        case .playlists: return selectedPlaylist?.name ?? "Playlist"
        case .liked: return "Liked Songs"
        case .search: return searchText.isEmpty ? "Search" : searchText
        }
    }

    private var footerText: String {
        guard !tracks.isEmpty else { return "Nothing loaded" }
        let total = tracks.reduce(0) { $0 + $1.duration }
        return "\(tracks.count) tracks · \(PlaylistEntry.formatDuration(total))"
    }

    // MARK: - Loading

    private func loadPlaylists() async {
        await perform {
            playlists = try await api.playlists().items
        }
    }

    private func loadPlaylistTracks(_ playlist: SpotifyPlaylist) async {
        await perform {
            var collected: [SpotifyTrack] = []
            var offset = 0
            // Spotify pages playlists at 100; keep going but stop at a
            // thousand so a 10,000-track playlist does not hang the window.
            while offset < 1_000 {
                let page = try await api.playlistTracks(id: playlist.id, offset: offset)
                let pageTracks = page.items.compactMap(\.track).filter { $0.isLocal != true }
                collected.append(contentsOf: pageTracks)
                if page.next == nil || page.items.isEmpty { break }
                offset += 100
            }
            tracks = collected
        }
    }

    private func loadLikedSongs() async {
        await perform {
            var collected: [SpotifyTrack] = []
            var offset = 0
            while offset < 1_000 {
                let page = try await api.savedTracks(offset: offset)
                collected.append(contentsOf: page.items.map(\.track))
                if page.next == nil || page.items.isEmpty { break }
                offset += 50
            }
            tracks = collected
        }
    }

    private func runSearch() async {
        let query = searchText.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return }
        await perform {
            tracks = try await api.search(query, types: ["track"], limit: 50).tracks?.items ?? []
        }
    }

    /// One place for the loading flag and error surfacing, so every fetch
    /// behaves the same.
    private func perform(_ work: () async throws -> Void) async {
        isLoading = true
        errorMessage = nil
        do {
            try await work()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

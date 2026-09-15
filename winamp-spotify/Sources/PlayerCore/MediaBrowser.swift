import Foundation
import Combine
import SpotifyKit

/// The model behind the media library: where you are, what is listed, and how
/// to get one level deeper.
///
/// Everything the browser can show reduces to a list of `BrowseRow`, whatever
/// the source. That is what lets one drawn list view serve search results,
/// a discography, an album's tracks and a playlist without four code paths —
/// and it is what makes the whole thing skinnable, because there is exactly
/// one row renderer to theme.
@MainActor
public final class MediaBrowser: ObservableObject {

    // MARK: - Where we are

    public enum Section: String, CaseIterable, Hashable, Sendable {
        case search
        case artists
        case albums
        case playlists
        case liked

        /// Tab labels. Short, because the bitmap font is 5px per character and
        /// the window starts at 275 wide.
        public var title: String {
            switch self {
            case .search: return "SEARCH"
            case .artists: return "ARTISTS"
            case .albums: return "ALBUMS"
            case .playlists: return "LISTS"
            case .liked: return "LIKED"
            }
        }
    }

    /// A position in the browse hierarchy. The stack of these is the back path.
    public enum Location: Hashable, Sendable {
        case sectionRoot(Section)
        case artist(id: String, name: String)
        case artistDiscography(id: String, name: String)
        case album(id: String, name: String)
        case playlist(id: String, name: String)

        public var title: String {
            switch self {
            case .sectionRoot(let section): return section.title
            case .artist(_, let name): return name
            case .artistDiscography(_, let name): return "\(name) — ALBUMS"
            case .album(_, let name): return name
            case .playlist(_, let name): return name
            }
        }
    }

    // MARK: - What is listed

    public struct Row: Identifiable, Hashable, Sendable {
        public enum Kind: Hashable, Sendable {
            case track
            case album
            case artist
            case playlist
            /// A row that drills in but is not itself a thing — "All albums".
            case navigation
        }

        public let id: String
        public let kind: Kind
        public let title: String
        public let subtitle: String?
        /// Right-aligned: a duration, a track count, a year.
        public let trailing: String?
        public let artworkURL: URL?
        /// Spotify URI, for playing or for use as a playback context.
        public let uri: String?
        /// Set when `kind == .track`, so activating a row needs no second fetch.
        public let entry: PlaylistEntry?
        /// Where activating this row goes. Nil means it plays instead.
        public let destination: Location?

        public var isPlayable: Bool { entry != nil }
    }

    // MARK: - Published state

    @Published public private(set) var section: Section = .search
    @Published public private(set) var stack: [Location] = [.sectionRoot(.search)]
    @Published public private(set) var rows: [Row] = []
    @Published public private(set) var isLoading = false
    @Published public private(set) var errorMessage: String?
    @Published public var searchText = ""
    /// Index into `rows`, or nil. Single-selection: the library is for finding
    /// one thing and sending it to the playlist.
    @Published public var selectedRowID: String?

    /// Artwork for the current location, when it has any — an album cover, an
    /// artist photo. Drawn in the detail strip.
    @Published public private(set) var headerArtworkURL: URL?
    @Published public private(set) var headerSubtitle: String?

    public var location: Location { stack.last ?? .sectionRoot(section) }
    public var canGoBack: Bool { stack.count > 1 }

    /// Breadcrumb, oldest first, for the nav bar.
    public var breadcrumb: [String] { stack.map(\.title) }

    /// Every track in the current view, in order — what PLAY ALL and ENQUEUE
    /// operate on.
    public var allEntries: [PlaylistEntry] { rows.compactMap(\.entry) }

    /// The playback context for the current view, so starting a track lets
    /// Spotify's own queue continue with the rest of the album or playlist.
    public private(set) var contextURI: String?

    // MARK: - Dependencies

    private let api: SpotifyWebAPI
    /// Cancels an in-flight load when the user navigates again, so a slow
    /// search cannot land after a newer one.
    private var loadTask: Task<Void, Never>?
    private var searchDebounce: Task<Void, Never>?

    public init(api: SpotifyWebAPI) {
        self.api = api
    }

    // MARK: - Navigation

    public func select(section newSection: Section) {
        guard newSection != section || stack.count > 1 else { return }
        section = newSection
        stack = [.sectionRoot(newSection)]
        selectedRowID = nil
        reload()
    }

    public func push(_ destination: Location) {
        stack.append(destination)
        selectedRowID = nil
        reload()
    }

    public func goBack() {
        guard canGoBack else { return }
        stack.removeLast()
        selectedRowID = nil
        reload()
    }

    public func goToRoot() {
        guard canGoBack else { return }
        stack = [stack[0]]
        selectedRowID = nil
        reload()
    }

    /// Row activation: drill in, or hand the track back to the caller to play.
    public func activate(_ row: Row) -> PlaylistEntry? {
        if let destination = row.destination {
            push(destination)
            return nil
        }
        return row.entry
    }

    // MARK: - Searching

    /// Debounced: typing in the search field should not fire a request per
    /// keystroke, and Spotify rate-limits.
    public func searchTextChanged(_ text: String) {
        searchText = text
        searchDebounce?.cancel()
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            rows = []
            return
        }
        searchDebounce = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            self?.reload()
        }
    }

    public func submitSearch() {
        searchDebounce?.cancel()
        reload()
    }

    // MARK: - Loading

    public func reload() {
        loadTask?.cancel()
        let target = location
        loadTask = Task { [weak self] in
            guard let self else { return }
            isLoading = true
            errorMessage = nil
            do {
                let result = try await load(target)
                guard !Task.isCancelled else { return }
                rows = result.rows
                contextURI = result.contextURI
                headerArtworkURL = result.artworkURL
                headerSubtitle = result.subtitle
            } catch is CancellationError {
                // Superseded by a newer navigation; leave the state alone.
            } catch {
                guard !Task.isCancelled else { return }
                rows = []
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }

    private struct LoadResult {
        var rows: [Row]
        var contextURI: String?
        var artworkURL: URL?
        var subtitle: String?
    }

    private func load(_ target: Location) async throws -> LoadResult {
        switch target {
        case .sectionRoot(.search):
            return try await loadSearch()
        case .sectionRoot(.artists):
            return try await loadFollowedArtists()
        case .sectionRoot(.albums):
            return try await loadSavedAlbums()
        case .sectionRoot(.playlists):
            return try await loadPlaylists()
        case .sectionRoot(.liked):
            return try await loadLikedSongs()
        case .artist(let id, let name):
            return try await loadArtist(id: id, name: name)
        case .artistDiscography(let id, let name):
            return try await loadDiscography(id: id, name: name)
        case .album(let id, _):
            return try await loadAlbum(id: id)
        case .playlist(let id, _):
            return try await loadPlaylist(id: id)
        }
    }

    // MARK: Section roots

    private func loadSearch() async throws -> LoadResult {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return LoadResult(rows: []) }

        let response = try await api.search(
            query,
            types: ["track", "artist", "album"],
            limit: 20
        )

        // Interleaved by type with headers would need a section-aware list;
        // instead the most specific matches lead — artists, then albums, then
        // tracks — which is how you actually look for music.
        var rows: [Row] = []
        rows += (response.artists?.items ?? []).map(Self.row(forArtist:))
        rows += (response.albums?.items ?? []).map(Self.row(forAlbum:))
        rows += (response.tracks?.items ?? []).map { Self.row(forTrack: $0, index: nil) }
        return LoadResult(rows: rows)
    }

    private func loadFollowedArtists() async throws -> LoadResult {
        var collected: [SpotifyArtist] = []
        var cursor: String?
        // Cursor-paged; bounded so a user following thousands does not stall.
        for _ in 0 ..< 10 {
            let page = try await api.followedArtists(after: cursor)
            collected += page.artists.items
            guard page.artists.next != nil, let last = page.artists.items.last?.id else { break }
            cursor = last
            try Task.checkCancellation()
        }
        let sorted = collected.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        return LoadResult(rows: sorted.map(Self.row(forArtist:)))
    }

    private func loadSavedAlbums() async throws -> LoadResult {
        var collected: [SpotifyAlbum] = []
        var offset = 0
        while offset < 500 {
            let page = try await api.savedAlbums(offset: offset)
            collected += page.items.map(\.album)
            if page.next == nil || page.items.isEmpty { break }
            offset += 50
            try Task.checkCancellation()
        }
        return LoadResult(rows: collected.map(Self.row(forAlbum:)))
    }

    private func loadPlaylists() async throws -> LoadResult {
        var collected: [SpotifyPlaylist] = []
        var offset = 0
        while offset < 500 {
            let page = try await api.playlists(offset: offset)
            collected += page.items
            if page.next == nil || page.items.isEmpty { break }
            offset += 50
            try Task.checkCancellation()
        }
        return LoadResult(rows: collected.map(Self.row(forPlaylist:)))
    }

    private func loadLikedSongs() async throws -> LoadResult {
        var collected: [SpotifyTrack] = []
        var offset = 0
        while offset < 1_000 {
            let page = try await api.savedTracks(offset: offset)
            collected += page.items.map(\.track)
            if page.next == nil || page.items.isEmpty { break }
            offset += 50
            try Task.checkCancellation()
        }
        return LoadResult(
            rows: collected.enumerated().map { Self.row(forTrack: $1, index: $0 + 1) },
            contextURI: nil
        )
    }

    // MARK: Drill-downs

    private func loadArtist(id: String, name: String) async throws -> LoadResult {
        // Top tracks and the artist record in parallel: two independent
        // requests, and the artist photo should not wait on the track list.
        async let artistRequest = api.artist(id: id)
        async let topTracksRequest = api.artistTopTracks(id: id)

        let artist = try? await artistRequest
        let topTracks = try await topTracksRequest

        var rows: [Row] = [
            Row(
                id: "nav-discography-\(id)",
                kind: .navigation,
                title: "ALL ALBUMS AND SINGLES",
                subtitle: nil,
                trailing: nil,
                artworkURL: nil,
                uri: nil,
                entry: nil,
                destination: .artistDiscography(id: id, name: name)
            )
        ]
        rows += topTracks.enumerated().map { Self.row(forTrack: $1, index: $0 + 1) }

        return LoadResult(
            rows: rows,
            contextURI: artist?.uri,
            artworkURL: artist?.artworkURL(minimumEdge: 160),
            subtitle: artist?.genreSummary
        )
    }

    private func loadDiscography(id: String, name: String) async throws -> LoadResult {
        var collected: [SpotifyAlbum] = []
        var offset = 0
        while offset < 300 {
            let page = try await api.artistAlbums(id: id, offset: offset)
            collected += page.items
            if page.next == nil || page.items.isEmpty { break }
            offset += 50
            try Task.checkCancellation()
        }

        // Spotify returns the same record once per market; collapse on name
        // and year or a discography reads as triplicated.
        var seen: Set<String> = []
        let unique = collected.filter { album in
            let key = "\(album.name.lowercased())|\(album.releaseYear ?? "")"
            return seen.insert(key).inserted
        }
        let sorted = unique.sorted { ($0.releaseYear ?? "") > ($1.releaseYear ?? "") }
        return LoadResult(rows: sorted.map(Self.row(forAlbum:)))
    }

    private func loadAlbum(id: String) async throws -> LoadResult {
        async let albumRequest = api.album(id: id)
        async let tracksRequest = api.albumTracks(id: id)

        let album = try await albumRequest
        let page = try await tracksRequest

        // Album track objects carry no album reference, so graft it on: without
        // this the playlist window would show these rows with no artwork and no
        // album name.
        let entries = page.items.map { track in
            PlaylistEntry(
                uri: track.uri,
                title: track.name,
                artist: track.artists.isEmpty ? album.artistNames : track.artistNames,
                album: album.name,
                duration: track.duration
            )
        }

        let rows = zip(page.items, entries).enumerated().map { index, pair in
            Row(
                id: pair.0.uri,
                kind: .track,
                title: pair.0.name,
                subtitle: pair.1.artist,
                trailing: PlaylistEntry.formatDuration(pair.0.duration),
                artworkURL: nil,
                uri: pair.0.uri,
                entry: pair.1,
                destination: nil
            )
        }

        var subtitle = album.artistNames
        if let year = album.releaseYear { subtitle += " \u{00B7} \(year)" }

        return LoadResult(
            rows: rows,
            contextURI: album.uri,
            artworkURL: album.artworkURL(minimumEdge: 160),
            subtitle: subtitle
        )
    }

    private func loadPlaylist(id: String) async throws -> LoadResult {
        var collected: [SpotifyTrack] = []
        var offset = 0
        while offset < 1_000 {
            let page = try await api.playlistTracks(id: id, offset: offset)
            collected += page.items.compactMap(\.track).filter { $0.isLocal != true }
            if page.next == nil || page.items.isEmpty { break }
            offset += 100
            try Task.checkCancellation()
        }
        return LoadResult(
            rows: collected.enumerated().map { Self.row(forTrack: $1, index: $0 + 1) },
            contextURI: "spotify:playlist:\(id)"
        )
    }

    // MARK: - Row construction

    private static func row(forTrack track: SpotifyTrack, index: Int?) -> Row {
        let entry = PlaylistEntry(track: track)
        return Row(
            id: track.uri,
            kind: .track,
            title: index.map { "\($0). \(track.name)" } ?? track.name,
            subtitle: track.artistNames,
            trailing: PlaylistEntry.formatDuration(track.duration),
            artworkURL: track.album?.artworkURL(minimumEdge: 64),
            uri: track.uri,
            entry: entry,
            destination: nil
        )
    }

    private static func row(forAlbum album: SpotifyAlbum) -> Row {
        var trailing = album.releaseYear
        if let count = album.totalTracks, trailing == nil { trailing = "\(count) TRK" }
        return Row(
            id: album.uri ?? album.id ?? album.name,
            kind: .album,
            title: album.name,
            subtitle: album.artistNames.isEmpty ? album.albumType?.uppercased() : album.artistNames,
            trailing: trailing,
            artworkURL: album.artworkURL(minimumEdge: 64),
            uri: album.uri,
            entry: nil,
            destination: album.id.map { .album(id: $0, name: album.name) }
        )
    }

    private static func row(forArtist artist: SpotifyArtist) -> Row {
        Row(
            id: artist.uri ?? artist.id ?? artist.name,
            kind: .artist,
            title: artist.name,
            subtitle: artist.genreSummary,
            trailing: artist.followers?.total.map { followers in
                followers >= 1_000_000
                    ? "\(followers / 1_000_000)M"
                    : (followers >= 1_000 ? "\(followers / 1_000)K" : "\(followers)")
            },
            artworkURL: artist.artworkURL(minimumEdge: 64),
            uri: artist.uri,
            entry: nil,
            destination: artist.id.map { .artist(id: $0, name: artist.name) }
        )
    }

    private static func row(forPlaylist playlist: SpotifyPlaylist) -> Row {
        Row(
            id: playlist.uri,
            kind: .playlist,
            title: playlist.name,
            subtitle: playlist.owner?.displayName,
            trailing: playlist.tracks?.total.map { "\($0)" },
            artworkURL: playlist.images?.first.flatMap { URL(string: $0.url) },
            uri: playlist.uri,
            entry: nil,
            destination: .playlist(id: playlist.id, name: playlist.name)
        )
    }
}

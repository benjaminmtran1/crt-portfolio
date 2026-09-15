import Foundation

// Web API payloads, trimmed to the fields the player actually uses. Spotify
// returns a great deal more; decoding only what we need keeps these types
// stable when the API grows.

public struct SpotifyImage: Codable, Hashable, Sendable {
    public let url: String
    public let width: Int?
    public let height: Int?
}

public struct SpotifyArtist: Codable, Hashable, Sendable, Identifiable {
    public let id: String?
    public let name: String
    public let uri: String?
    /// Only present on the full artist object, not on the simplified one
    /// embedded in a track.
    public let images: [SpotifyImage]?
    public let genres: [String]?
    public let popularity: Int?
    public let followers: Followers?

    public struct Followers: Codable, Hashable, Sendable {
        public let total: Int?
    }

    public func artworkURL(minimumEdge: Int) -> URL? {
        guard let images, !images.isEmpty else { return nil }
        let sorted = images.sorted { ($0.width ?? 0) < ($1.width ?? 0) }
        let match = sorted.first { ($0.width ?? 0) >= minimumEdge } ?? sorted.last
        return match.flatMap { URL(string: $0.url) }
    }

    /// "Rock · Shoegaze", for the subtitle line in an artist list.
    public var genreSummary: String? {
        guard let genres, !genres.isEmpty else { return nil }
        return genres.prefix(2).joined(separator: " \u{00B7} ")
    }
}

public struct SpotifyAlbum: Codable, Hashable, Sendable, Identifiable {
    public let id: String?
    public let name: String
    public let uri: String?
    public let images: [SpotifyImage]?
    public let releaseDate: String?
    /// `album`, `single` or `compilation`. Used to label and to filter out the
    /// singles that flood an artist's discography.
    public let albumType: String?
    public let totalTracks: Int?
    public let artists: [SpotifyArtist]?

    enum CodingKeys: String, CodingKey {
        case id, name, uri, images, artists
        case releaseDate = "release_date"
        case albumType = "album_type"
        case totalTracks = "total_tracks"
    }

    public var artistNames: String {
        (artists ?? []).map(\.name).joined(separator: ", ")
    }

    /// Just the year: release dates arrive as `2001`, `2001-05` or `2001-05-21`
    /// depending on how precisely the label reported them.
    public var releaseYear: String? {
        guard let releaseDate, releaseDate.count >= 4 else { return nil }
        return String(releaseDate.prefix(4))
    }

    /// The smallest image at least `minimumEdge` across, falling back to the
    /// largest available. Skin windows are tiny; pulling the 640px art for a
    /// 60px slot is pure waste.
    public func artworkURL(minimumEdge: Int) -> URL? {
        guard let images, !images.isEmpty else { return nil }
        let sorted = images.sorted { ($0.width ?? 0) < ($1.width ?? 0) }
        let match = sorted.first { ($0.width ?? 0) >= minimumEdge } ?? sorted.last
        return match.flatMap { URL(string: $0.url) }
    }
}

public struct SpotifyTrack: Codable, Hashable, Sendable, Identifiable {
    public let id: String?
    public let uri: String
    public let name: String
    public let durationMs: Int
    public let artists: [SpotifyArtist]
    public let album: SpotifyAlbum?
    public let trackNumber: Int?
    public let isLocal: Bool?
    public let explicit: Bool?

    enum CodingKeys: String, CodingKey {
        case id, uri, name, artists, album, explicit
        case durationMs = "duration_ms"
        case trackNumber = "track_number"
        case isLocal = "is_local"
    }

    public var artistNames: String {
        artists.map(\.name).joined(separator: ", ")
    }

    /// Winamp's title convention: "Artist - Title".
    public var displayTitle: String {
        artistNames.isEmpty ? name : "\(artistNames) - \(name)"
    }

    public var duration: TimeInterval { Double(durationMs) / 1000 }
}

public struct SpotifyPlaylist: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let uri: String
    public let name: String
    public let images: [SpotifyImage]?
    public let owner: SpotifyUser?
    public let tracks: TrackCount?
    public let isPublic: Bool?

    public struct TrackCount: Codable, Hashable, Sendable {
        public let total: Int
    }

    enum CodingKeys: String, CodingKey {
        case id, uri, name, images, owner, tracks
        case isPublic = "public"
    }
}

public struct SpotifyUser: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let displayName: String?
    public let product: String?

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case product
    }

    /// Only Premium accounts may drive the Web API's playback endpoints, so
    /// the app checks this before offering remote-device control.
    public var isPremium: Bool { product == "premium" }
}

public struct SpotifyDevice: Codable, Hashable, Sendable, Identifiable {
    public let id: String?
    public let name: String
    public let type: String
    public let isActive: Bool
    public let volumePercent: Int?

    enum CodingKeys: String, CodingKey {
        case id, name, type
        case isActive = "is_active"
        case volumePercent = "volume_percent"
    }
}

public struct SpotifyPlaybackState: Codable, Sendable {
    public let device: SpotifyDevice?
    public let isPlaying: Bool
    public let progressMs: Int?
    public let item: SpotifyTrack?
    public let shuffleState: Bool?
    public let repeatState: String?

    enum CodingKeys: String, CodingKey {
        case device, item
        case isPlaying = "is_playing"
        case progressMs = "progress_ms"
        case shuffleState = "shuffle_state"
        case repeatState = "repeat_state"
    }
}

// MARK: - Paged responses

public struct SpotifyPage<Item: Codable & Sendable>: Codable, Sendable {
    public let items: [Item]
    public let total: Int?
    public let next: String?
    public let offset: Int?

    enum CodingKeys: String, CodingKey {
        case items, total, next, offset
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Spotify sprinkles nulls through `items` — playlists whose owner
        // deleted them, tracks pulled from the catalogue. Dropping them beats
        // failing the whole page.
        let raw = try container.decodeIfPresent([Item?].self, forKey: .items) ?? []
        self.items = raw.compactMap { $0 }
        self.total = try container.decodeIfPresent(Int.self, forKey: .total)
        self.next = try container.decodeIfPresent(String.self, forKey: .next)
        self.offset = try container.decodeIfPresent(Int.self, forKey: .offset)
    }

    public init(items: [Item], total: Int? = nil, next: String? = nil, offset: Int? = nil) {
        self.items = items
        self.total = total
        self.next = next
        self.offset = offset
    }
}

/// Playlist items wrap the track, and can legitimately contain a null track
/// (removed from the catalogue) or a podcast episode we cannot play.
public struct SpotifyPlaylistItem: Codable, Sendable {
    public let track: SpotifyTrack?
    public let addedAt: String?

    enum CodingKeys: String, CodingKey {
        case track
        case addedAt = "added_at"
    }
}

public struct SpotifySavedTrack: Codable, Sendable {
    public let track: SpotifyTrack
    public let addedAt: String?

    enum CodingKeys: String, CodingKey {
        case track
        case addedAt = "added_at"
    }
}

public struct SpotifySearchResponse: Codable, Sendable {
    public let tracks: SpotifyPage<SpotifyTrack>?
    public let albums: SpotifyPage<SpotifyAlbum>?
    public let artists: SpotifyPage<SpotifyArtist>?
    public let playlists: SpotifyPage<SpotifyPlaylist>?
}

/// `me/albums` wraps each album the way `me/tracks` wraps each track.
public struct SpotifySavedAlbum: Codable, Sendable {
    public let album: SpotifyAlbum
    public let addedAt: String?

    enum CodingKeys: String, CodingKey {
        case album
        case addedAt = "added_at"
    }
}

/// `me/following` nests its page one level deeper than every other endpoint.
public struct SpotifyFollowedArtists: Codable, Sendable {
    public let artists: CursorPage

    public struct CursorPage: Codable, Sendable {
        public let items: [SpotifyArtist]
        public let next: String?
        public let total: Int?
    }
}

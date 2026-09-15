import Foundation
import SpotifyKit

/// One row in the playlist window.
public struct PlaylistEntry: Identifiable, Hashable, Codable, Sendable {
    public let id: UUID
    public var uri: String
    public var title: String
    public var artist: String
    public var album: String?
    public var duration: TimeInterval

    public init(
        id: UUID = UUID(),
        uri: String,
        title: String,
        artist: String,
        album: String? = nil,
        duration: TimeInterval
    ) {
        self.id = id
        self.uri = uri
        self.title = title
        self.artist = artist
        self.album = album
        self.duration = duration
    }

    public init(track: SpotifyTrack) {
        self.init(
            uri: track.uri,
            title: track.name,
            artist: track.artistNames,
            album: track.album?.name,
            duration: track.duration
        )
    }

    /// "Artist - Title", matching the main window's marquee.
    public var displayTitle: String {
        artist.isEmpty ? title : "\(artist) - \(title)"
    }

    public var durationText: String {
        PlaylistEntry.formatDuration(duration)
    }

    public static func formatDuration(_ duration: TimeInterval) -> String {
        guard duration.isFinite, duration >= 0 else { return "0:00" }
        let total = Int(duration.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

/// The playlist window's model: an ordered list with a current track, a
/// selection, and the shuffle order.
///
/// Spotify keeps its own queue, and we do not fight it — when a track is
/// double-clicked we hand Spotify the URI and let it take over. This list is
/// what the *window* shows and what "next" means when the user is driving from
/// here rather than from Spotify's queue.
public struct Playlist: Codable, Sendable {

    public var name: String
    public var entries: [PlaylistEntry]
    /// Index into `entries`, not into the shuffle order.
    public var currentIndex: Int?
    public var selection: Set<UUID>

    /// Populated when shuffle is on: a permutation of `entries.indices`.
    private var shuffleOrder: [Int]

    public init(name: String = "Playlist", entries: [PlaylistEntry] = []) {
        self.name = name
        self.entries = entries
        self.currentIndex = nil
        self.selection = []
        self.shuffleOrder = []
    }

    enum CodingKeys: String, CodingKey {
        case name, entries, currentIndex
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? "Playlist"
        entries = try container.decodeIfPresent([PlaylistEntry].self, forKey: .entries) ?? []
        currentIndex = try container.decodeIfPresent(Int.self, forKey: .currentIndex)
        // Selection and shuffle order are session state, not saved.
        selection = []
        shuffleOrder = []
    }

    public var isEmpty: Bool { entries.isEmpty }
    public var count: Int { entries.count }

    public var current: PlaylistEntry? {
        guard let currentIndex, entries.indices.contains(currentIndex) else { return nil }
        return entries[currentIndex]
    }

    public var totalDuration: TimeInterval {
        entries.reduce(0) { $0 + $1.duration }
    }

    // MARK: - Mutation

    public mutating func append(_ newEntries: [PlaylistEntry]) {
        entries.append(contentsOf: newEntries)
        invalidateShuffle()
    }

    public mutating func replaceAll(with newEntries: [PlaylistEntry], name: String? = nil) {
        entries = newEntries
        if let name { self.name = name }
        currentIndex = nil
        selection = []
        invalidateShuffle()
    }

    public mutating func removeSelected() {
        guard !selection.isEmpty else { return }
        // Keep the current track pointing at the same row where possible.
        let currentID = current?.id
        entries.removeAll { selection.contains($0.id) }
        selection = []
        currentIndex = currentID.flatMap { id in entries.firstIndex { $0.id == id } }
        invalidateShuffle()
    }

    public mutating func removeAll() {
        entries = []
        selection = []
        currentIndex = nil
        invalidateShuffle()
    }

    /// Reorders rows, matching the semantics of SwiftUI's `onMove`.
    ///
    /// Implemented here rather than using `Array.move(fromOffsets:toOffset:)`:
    /// that method comes from SwiftUI, and PlayerCore has no business importing
    /// a UI framework.
    public mutating func move(fromOffsets source: IndexSet, toOffset destination: Int) {
        guard !source.isEmpty else { return }
        let currentID = current?.id

        let moving = source.compactMap { entries.indices.contains($0) ? entries[$0] : nil }
        // Count how many of the moved rows sat before the drop point: removing
        // them shifts the insertion index left by that much.
        let removedBefore = source.filter { $0 < destination }.count
        var remaining = entries
        for index in source.sorted(by: >) where remaining.indices.contains(index) {
            remaining.remove(at: index)
        }
        let insertionPoint = min(max(0, destination - removedBefore), remaining.count)
        remaining.insert(contentsOf: moving, at: insertionPoint)

        entries = remaining
        currentIndex = currentID.flatMap { id in entries.firstIndex { $0.id == id } }
        invalidateShuffle()
    }

    /// Sorts by whatever the playlist window's MISC menu asked for.
    public enum SortKey: String, Sendable { case title, artist, album, duration }

    public mutating func sort(by key: SortKey, ascending: Bool = true) {
        let currentID = current?.id
        entries.sort { lhs, rhs in
            let result: Bool
            switch key {
            case .title: result = lhs.title.localizedStandardCompare(rhs.title) == .orderedAscending
            case .artist: result = lhs.artist.localizedStandardCompare(rhs.artist) == .orderedAscending
            case .album:
                result = (lhs.album ?? "").localizedStandardCompare(rhs.album ?? "") == .orderedAscending
            case .duration: result = lhs.duration < rhs.duration
            }
            return ascending ? result : !result
        }
        currentIndex = currentID.flatMap { id in entries.firstIndex { $0.id == id } }
        invalidateShuffle()
    }

    /// Randomises the list itself, as Winamp's "randomize list" does — distinct
    /// from shuffle playback, which leaves the order alone.
    public mutating func randomize() {
        let currentID = current?.id
        entries.shuffle()
        currentIndex = currentID.flatMap { id in entries.firstIndex { $0.id == id } }
        invalidateShuffle()
    }

    // MARK: - Navigation

    public mutating func setCurrent(id: UUID) {
        currentIndex = entries.firstIndex { $0.id == id }
    }

    public mutating func setCurrent(uri: String) {
        // Match by URI so that a track Spotify advanced to on its own still
        // highlights the right row.
        if let index = entries.firstIndex(where: { $0.uri == uri }) {
            currentIndex = index
        }
    }

    /// The next entry to play, honouring shuffle and repeat.
    public mutating func advance(shuffle: Bool, repeatMode: PlayerSnapshot.RepeatMode) -> PlaylistEntry? {
        guard !entries.isEmpty else { return nil }

        if repeatMode == .track, let current {
            return current
        }

        if shuffle {
            ensureShuffleOrder()
            guard let currentIndex,
                  let positionInOrder = shuffleOrder.firstIndex(of: currentIndex) else {
                let first = shuffleOrder.first ?? 0
                self.currentIndex = first
                return entries[first]
            }
            let nextPosition = positionInOrder + 1
            if nextPosition < shuffleOrder.count {
                self.currentIndex = shuffleOrder[nextPosition]
                return entries[shuffleOrder[nextPosition]]
            }
            guard repeatMode == .context else { return nil }
            // Reshuffle at the wrap so a repeated list is not the same order.
            // Clear the current index first: `ensureShuffleOrder` pins the
            // current track to the front, which would make the wrap a no-op.
            invalidateShuffle()
            self.currentIndex = nil
            ensureShuffleOrder()
            self.currentIndex = shuffleOrder.first
            return self.currentIndex.map { entries[$0] }
        }

        let next = (currentIndex ?? -1) + 1
        if entries.indices.contains(next) {
            currentIndex = next
            return entries[next]
        }
        guard repeatMode == .context else { return nil }
        currentIndex = 0
        return entries[0]
    }

    public mutating func retreat(shuffle: Bool) -> PlaylistEntry? {
        guard !entries.isEmpty else { return nil }

        if shuffle {
            ensureShuffleOrder()
            guard let currentIndex,
                  let positionInOrder = shuffleOrder.firstIndex(of: currentIndex),
                  positionInOrder > 0 else { return current }
            self.currentIndex = shuffleOrder[positionInOrder - 1]
            return entries[shuffleOrder[positionInOrder - 1]]
        }

        let previous = (currentIndex ?? 0) - 1
        guard entries.indices.contains(previous) else { return current }
        currentIndex = previous
        return entries[previous]
    }

    private mutating func ensureShuffleOrder() {
        guard shuffleOrder.count != entries.count else { return }
        shuffleOrder = Array(entries.indices).shuffled()
        // Start from wherever we already are, so toggling shuffle mid-track
        // does not jump.
        if let currentIndex, let position = shuffleOrder.firstIndex(of: currentIndex), position != 0 {
            shuffleOrder.swapAt(0, position)
        }
    }

    private mutating func invalidateShuffle() {
        shuffleOrder = []
    }
}

// MARK: - Persistence

public extension Playlist {
    /// Playlists are saved as JSON rather than M3U: Spotify URIs are not file
    /// paths, and we want titles and durations without a round trip.
    func write(to url: URL) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(self).write(to: url, options: .atomic)
    }

    static func read(from url: URL) throws -> Playlist {
        try JSONDecoder().decode(Playlist.self, from: try Data(contentsOf: url))
    }

    /// Exports an `.m3u8` with `spotify:` URIs, which Spotify's own desktop app
    /// will import.
    func m3u8Representation() -> String {
        var lines = ["#EXTM3U"]
        for entry in entries {
            lines.append("#EXTINF:\(Int(entry.duration.rounded())),\(entry.displayTitle)")
            lines.append(entry.uri)
        }
        return lines.joined(separator: "\n") + "\n"
    }
}

import Foundation
import Combine
import SpotifyKit

/// The hub the UI binds to.
///
/// Owns both engines, decides which one is live, polls it, and turns skin
/// interactions into playback commands. Everything here is main-actor because
/// it exists to feed a view.
@MainActor
public final class PlaybackCoordinator: ObservableObject {

    /// Which backend the user wants to drive.
    public enum Preference: String, CaseIterable, Sendable {
        /// The Spotify app on this Mac, falling back to a remote device.
        case preferLocal
        /// A Spotify Connect device, falling back to the local app.
        case preferRemote

        public var title: String {
            switch self {
            case .preferLocal: return "Spotify app on this Mac"
            case .preferRemote: return "Spotify Connect device"
            }
        }
    }

    // MARK: - Published state

    @Published public private(set) var snapshot: PlayerSnapshot = .empty
    @Published public var playlist = Playlist()
    @Published public private(set) var availableDevices: [SpotifyDevice] = []
    /// Set when a command failed, for the status line; cleared on the next
    /// successful command.
    @Published public private(set) var lastError: String?
    @Published public private(set) var isConnected = false

    /// Local output balance, which Spotify itself has no concept of. Applied
    /// by the app's own output stage when one is active, and otherwise just
    /// drives the mono/stereo indicator.
    @Published public var balance: Double = 0

    @Published public var preference: Preference {
        didSet {
            guard preference != oldValue else { return }
            Task { await refreshEngineSelection() }
        }
    }

    // MARK: - Dependencies

    private let localEngine: any PlaybackEngine
    private let remoteEngine: RemotePlaybackEngine
    private var activeEngine: any PlaybackEngine

    private var pollTask: Task<Void, Never>?
    /// Set while the user is dragging the seek bar, so polling does not fight
    /// the thumb back to where playback actually is.
    private var scrubPosition: TimeInterval?

    public init(
        localEngine: any PlaybackEngine,
        remoteEngine: RemotePlaybackEngine,
        preference: Preference = .preferLocal
    ) {
        self.localEngine = localEngine
        self.remoteEngine = remoteEngine
        self.preference = preference
        self.activeEngine = localEngine
    }

    // MARK: - Lifecycle

    /// Starts polling. `positionInterval` drives the seek bar and clock;
    /// `stateInterval` is how often we re-check which engine is live.
    public func start(positionInterval: TimeInterval = 0.1, stateInterval: TimeInterval = 5) {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            guard let self else { return }
            await self.refreshEngineSelection()
            var sinceEngineCheck: TimeInterval = 0

            while !Task.isCancelled {
                await self.tick()
                sinceEngineCheck += positionInterval
                if sinceEngineCheck >= stateInterval {
                    sinceEngineCheck = 0
                    await self.refreshEngineSelection()
                }
                try? await Task.sleep(nanoseconds: UInt64(positionInterval * 1_000_000_000))
            }
        }
    }

    public func stop() {
        pollTask?.cancel()
        pollTask = nil
    }

    private func tick() async {
        guard var next = await activeEngine.snapshot() else {
            isConnected = false
            if snapshot != .empty { snapshot = .empty }
            return
        }
        isConnected = true

        // Hold the scrub position until the engine catches up, or the thumb
        // visibly snaps back on every frame of the drag.
        if let scrubPosition { next.position = scrubPosition }
        next.balance = balance
        next.isStereo = abs(balance) < 0.98

        if next != snapshot {
            snapshot = next
            // Keep the playlist highlight on whatever Spotify actually moved to.
            if let uri = next.trackURI, playlist.current?.uri != uri {
                playlist.setCurrent(uri: uri)
            }
        }
    }

    /// Picks the engine to drive, honouring the preference but falling back
    /// when the preferred one has nothing to talk to.
    public func refreshEngineSelection() async {
        let order: [any PlaybackEngine] = preference == .preferLocal
            ? [localEngine, remoteEngine]
            : [remoteEngine, localEngine]

        // `await` is not allowed in a for-in `where` clause, hence the
        // explicit loop.
        for engine in order {
            if await engine.isAvailable() {
                activeEngine = engine
                break
            }
        }

        // Device list is only meaningful for the remote engine, and it is a
        // network call, so refresh it on the slow cadence.
        availableDevices = (try? await remoteEngine.availableDevices()) ?? []
    }

    // MARK: - Transport

    public func togglePlayPause() {
        run { try await $0.togglePlayPause() }
    }

    public func play() {
        // With an empty Spotify queue, pressing play should start whatever the
        // playlist window is pointing at.
        if snapshot.state == .stopped, snapshot.trackURI == nil, let entry = playlist.current ?? playlist.entries.first {
            playEntry(entry)
            return
        }
        run { try await $0.play() }
    }

    public func pause() {
        run { try await $0.pause() }
    }

    public func stopPlayback() {
        run { try await $0.stop() }
    }

    public func next() {
        // When the playlist window is driving, advance through it so shuffle
        // and repeat mean what this app's buttons say they mean.
        if !playlist.isEmpty, playlist.current != nil {
            if let entry = playlist.advance(shuffle: snapshot.shuffle, repeatMode: snapshot.repeatMode) {
                playEntry(entry)
            } else {
                run { try await $0.stop() }
            }
            return
        }
        run { try await $0.next() }
    }

    public func previous() {
        if !playlist.isEmpty, playlist.current != nil {
            if let entry = playlist.retreat(shuffle: snapshot.shuffle) {
                playEntry(entry)
            }
            return
        }
        run { try await $0.previous() }
    }

    public func playEntry(_ entry: PlaylistEntry) {
        playlist.setCurrent(id: entry.id)
        // Optimistically show the new track: the engines take a moment to
        // report it and a blank marquee reads as a hang.
        snapshot.trackTitle = entry.title
        snapshot.artist = entry.artist
        snapshot.trackURI = entry.uri
        snapshot.duration = entry.duration
        snapshot.position = 0
        snapshot.state = .playing
        run { try await $0.play(uri: entry.uri, contextURI: nil) }
    }

    // MARK: - Scrubbing

    public func beginScrub(to position: TimeInterval) {
        scrubPosition = position
        snapshot.position = position
    }

    public func updateScrub(to position: TimeInterval) {
        scrubPosition = position
        snapshot.position = position
    }

    public func endScrub() {
        guard let target = scrubPosition else { return }
        scrubPosition = nil
        run { try await $0.seek(to: target) }
    }

    // MARK: - Settings

    public func setVolume(_ volume: Double) {
        snapshot.volume = min(1, max(0, volume))
        run { try await $0.setVolume(volume) }
    }

    public func setBalance(_ value: Double) {
        balance = min(1, max(-1, value))
        snapshot.balance = balance
        snapshot.isStereo = abs(balance) < 0.98
    }

    public func toggleShuffle() {
        let enabled = !snapshot.shuffle
        snapshot.shuffle = enabled
        run { try await $0.setShuffle(enabled) }
    }

    /// Cycles off -> whole list -> single track, as the classic repeat button
    /// does when right-clicked.
    public func cycleRepeatMode() {
        let next: PlayerSnapshot.RepeatMode
        switch snapshot.repeatMode {
        case .off: next = .context
        case .context: next = .track
        case .track: next = .off
        }
        snapshot.repeatMode = next
        run { try await $0.setRepeatMode(next) }
    }

    public func selectDevice(_ device: SpotifyDevice) {
        guard let id = device.id else { return }
        Task {
            await remoteEngine.setPreferredDevice(id)
            do {
                try await remoteEngine.transfer(toDevice: id, play: snapshot.state == .playing)
                activeEngine = remoteEngine
                lastError = nil
            } catch {
                lastError = error.localizedDescription
            }
        }
    }

    // MARK: - Command plumbing

    /// Runs a command against the active engine and surfaces any failure as
    /// `lastError` rather than throwing into the UI layer.
    private func run(_ command: @escaping @Sendable (any PlaybackEngine) async throws -> Void) {
        let engine = activeEngine
        Task { @MainActor in
            do {
                try await command(engine)
                lastError = nil
            } catch {
                lastError = error.localizedDescription
            }
        }
    }
}

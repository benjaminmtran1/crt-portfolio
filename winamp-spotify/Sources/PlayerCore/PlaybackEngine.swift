import Foundation

/// A thing that can play Spotify.
///
/// Two implementations exist: one talks Apple events to the Spotify desktop
/// app, the other talks HTTP to Spotify Connect. The coordinator picks whichever
/// is actually available and the UI never asks which.
public protocol PlaybackEngine: Sendable {

    /// Cheap enough to call on a timer; the coordinator polls it a few times a
    /// second to drive the seek bar.
    func snapshot() async -> PlayerSnapshot?

    /// True when this engine has something to talk to right now.
    func isAvailable() async -> Bool

    func play() async throws
    func pause() async throws
    func togglePlayPause() async throws
    func stop() async throws
    func next() async throws
    func previous() async throws

    func seek(to position: TimeInterval) async throws
    func setVolume(_ volume: Double) async throws
    func setShuffle(_ enabled: Bool) async throws
    func setRepeatMode(_ mode: PlayerSnapshot.RepeatMode) async throws

    /// Starts a specific track, optionally inside a context (album/playlist) so
    /// Spotify's own queue continues sensibly afterwards.
    func play(uri: String, contextURI: String?) async throws
}

public extension PlaybackEngine {
    /// Default derived from the engine's own state, so implementations only
    /// need `play` and `pause`.
    func togglePlayPause() async throws {
        if await snapshot()?.state == .playing {
            try await pause()
        } else {
            try await play()
        }
    }
}

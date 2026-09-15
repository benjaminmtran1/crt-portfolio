import Foundation
import SpotifyKit

/// Drives playback on a Spotify Connect device over the Web API — a phone, a
/// speaker, another computer.
///
/// This is the fallback path. It needs Premium, and every call is a network
/// round trip, so position updates are interpolated between polls rather than
/// asked for at 10Hz.
public actor RemotePlaybackEngine: PlaybackEngine {

    private let api: SpotifyWebAPI
    private var cachedState: SpotifyPlaybackState?
    private var cachedAt: Date?
    /// Spotify's rate limits make sub-second polling a bad idea.
    private let minimumPollInterval: TimeInterval = 1.0

    /// The device we are steering. Nil means "whatever is active", which is
    /// what Spotify assumes when no device_id is given.
    public private(set) var preferredDeviceID: String?

    public init(api: SpotifyWebAPI) {
        self.api = api
    }

    public func setPreferredDevice(_ deviceID: String?) {
        preferredDeviceID = deviceID
    }

    public func availableDevices() async throws -> [SpotifyDevice] {
        try await api.devices()
    }

    /// Hands playback to another Connect device and steers it from then on.
    public func transfer(toDevice deviceID: String, play shouldPlay: Bool) async throws {
        try await api.transferPlayback(to: deviceID, play: shouldPlay)
        preferredDeviceID = deviceID
        invalidate()
    }

    // MARK: - PlaybackEngine

    public func isAvailable() async -> Bool {
        guard let devices = try? await api.devices() else { return false }
        return !devices.isEmpty
    }

    public func snapshot() async -> PlayerSnapshot? {
        let state: SpotifyPlaybackState?
        if let cachedAt, Date().timeIntervalSince(cachedAt) < minimumPollInterval {
            state = cachedState
        } else {
            state = try? await api.playbackState()
            cachedState = state
            cachedAt = Date()
        }
        guard let state else { return nil }

        // Interpolate position between polls so the seek bar moves smoothly
        // instead of stepping once a second.
        var position = Double(state.progressMs ?? 0) / 1000
        if state.isPlaying, let cachedAt {
            position += Date().timeIntervalSince(cachedAt)
        }
        let duration = state.item?.duration ?? 0
        if duration > 0 { position = min(position, duration) }

        return PlayerSnapshot(
            state: state.isPlaying ? .playing : (state.item == nil ? .stopped : .paused),
            source: .remoteDevice,
            trackTitle: state.item?.name,
            artist: state.item?.artistNames,
            album: state.item?.album?.name,
            trackURI: state.item?.uri,
            artworkURL: state.item?.album?.artworkURL(minimumEdge: 300),
            position: position,
            duration: duration,
            volume: Double(state.device?.volumePercent ?? 75) / 100,
            balance: 0,
            shuffle: state.shuffleState ?? false,
            repeatMode: PlayerSnapshot.RepeatMode(rawValue: state.repeatState ?? "off") ?? .off,
            isStereo: true,
            bitrateKbps: nil,
            sampleRateKHz: nil
        )
    }

    public func play() async throws {
        try await api.play(deviceID: preferredDeviceID)
        invalidate()
    }

    public func pause() async throws {
        try await api.pause(deviceID: preferredDeviceID)
        invalidate()
    }

    /// Spotify Connect has no stop, only pause. Pausing and seeking to zero is
    /// the closest equivalent and is what the stop button does.
    public func stop() async throws {
        try await api.pause(deviceID: preferredDeviceID)
        try? await api.seek(toMilliseconds: 0, deviceID: preferredDeviceID)
        invalidate()
    }

    public func next() async throws {
        try await api.next(deviceID: preferredDeviceID)
        invalidate()
    }

    public func previous() async throws {
        try await api.previous(deviceID: preferredDeviceID)
        invalidate()
    }

    public func seek(to position: TimeInterval) async throws {
        try await api.seek(toMilliseconds: Int(position * 1000), deviceID: preferredDeviceID)
        invalidate()
    }

    public func setVolume(_ volume: Double) async throws {
        try await api.setVolume(percent: Int((min(1, max(0, volume)) * 100).rounded()), deviceID: preferredDeviceID)
        invalidate()
    }

    public func setShuffle(_ enabled: Bool) async throws {
        try await api.setShuffle(enabled, deviceID: preferredDeviceID)
        invalidate()
    }

    public func setRepeatMode(_ mode: PlayerSnapshot.RepeatMode) async throws {
        try await api.setRepeat(mode.rawValue, deviceID: preferredDeviceID)
        invalidate()
    }

    public func play(uri: String, contextURI: String?) async throws {
        if let contextURI {
            // Playing inside a context lets Spotify's own queue carry on after
            // this track, which is what a double-click in a playlist should do.
            try await api.play(deviceID: preferredDeviceID, contextURI: contextURI)
            try? await api.seek(toMilliseconds: 0, deviceID: preferredDeviceID)
        } else {
            try await api.play(deviceID: preferredDeviceID, uris: [uri])
        }
        invalidate()
    }

    /// Forces the next `snapshot()` to hit the network: after a command the
    /// cached state is known-stale.
    private func invalidate() {
        cachedAt = nil
        cachedState = nil
    }
}

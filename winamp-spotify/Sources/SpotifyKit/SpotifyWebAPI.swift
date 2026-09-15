import Foundation

/// A thin, typed client over the Spotify Web API.
///
/// Scope is deliberately narrow: what the player needs to fill a playlist
/// window, search the catalogue, fetch artwork, and drive playback on remote
/// devices. Everything goes through `send` so token refresh, rate limiting and
/// error mapping are handled once.
public actor SpotifyWebAPI {

    public enum Error: Swift.Error, LocalizedError {
        case notAuthorized
        case premiumRequired
        case noActiveDevice
        case rateLimited(retryAfter: TimeInterval)
        case http(status: Int, message: String)
        case decoding(underlying: String)

        public var errorDescription: String? {
            switch self {
            case .notAuthorized:
                return "Spotify rejected the request; sign in again."
            case .premiumRequired:
                return "Spotify Premium is required to control playback through the Web API."
            case .noActiveDevice:
                return "No active Spotify device. Start playback in the Spotify app first."
            case .rateLimited(let retryAfter):
                return "Spotify is rate limiting requests; retrying in \(Int(retryAfter))s."
            case .http(let status, let message):
                return "Spotify returned HTTP \(status): \(message)"
            case .decoding(let underlying):
                return "Could not read Spotify's response: \(underlying)"
            }
        }
    }

    private let auth: SpotifyAuth
    private let session: URLSession
    private let baseURL = URL(string: "https://api.spotify.com/v1")!
    private let decoder = JSONDecoder()

    public init(auth: SpotifyAuth, session: URLSession = .shared) {
        self.auth = auth
        self.session = session
    }

    // MARK: - Profile and devices

    public func currentUser() async throws -> SpotifyUser {
        try await get("me")
    }

    public func devices() async throws -> [SpotifyDevice] {
        struct Response: Decodable { let devices: [SpotifyDevice] }
        let response: Response = try await get("me/player/devices")
        return response.devices
    }

    /// Current playback state, or nil when Spotify has nothing to report —
    /// a 204, which is the normal "no active device" answer and not an error.
    public func playbackState() async throws -> SpotifyPlaybackState? {
        try await getOptional("me/player")
    }

    // MARK: - Library

    public func playlists(limit: Int = 50, offset: Int = 0) async throws -> SpotifyPage<SpotifyPlaylist> {
        try await get("me/playlists", query: ["limit": "\(limit)", "offset": "\(offset)"])
    }

    public func playlistTracks(
        id: String,
        limit: Int = 100,
        offset: Int = 0
    ) async throws -> SpotifyPage<SpotifyPlaylistItem> {
        try await get(
            "playlists/\(id)/tracks",
            query: [
                "limit": "\(limit)",
                "offset": "\(offset)",
                // Ask for only the fields we decode; playlist pages are huge
                // otherwise and this is the single biggest request the app makes.
                "fields": "total,next,offset,items(added_at,track(id,uri,name,duration_ms,explicit,track_number,is_local,artists(id,name,uri),album(id,name,uri,release_date,images)))",
            ]
        )
    }

    public func savedTracks(limit: Int = 50, offset: Int = 0) async throws -> SpotifyPage<SpotifySavedTrack> {
        try await get("me/tracks", query: ["limit": "\(limit)", "offset": "\(offset)"])
    }

    public func search(
        _ query: String,
        types: [String] = ["track"],
        limit: Int = 30
    ) async throws -> SpotifySearchResponse {
        try await get("search", query: [
            "q": query,
            "type": types.joined(separator: ","),
            "limit": "\(limit)",
        ])
    }

    // MARK: Artists

    public func artist(id: String) async throws -> SpotifyArtist {
        try await get("artists/\(id)")
    }

    /// An artist's most-played tracks.
    ///
    /// `market` is deliberately omitted: it used to be required as the magic
    /// value `from_token`, which is now deprecated, and leaving it out makes
    /// Spotify use the country on the signed-in account — which is what we
    /// wanted `from_token` for in the first place.
    public func artistTopTracks(id: String) async throws -> [SpotifyTrack] {
        struct Response: Decodable { let tracks: [SpotifyTrack] }
        let response: Response = try await get("artists/\(id)/top-tracks")
        return response.tracks
    }

    /// An artist's discography.
    ///
    /// `includeGroups` defaults to albums and singles but not `appears_on`,
    /// which is mostly compilations and would bury the real releases.
    public func artistAlbums(
        id: String,
        includeGroups: [String] = ["album", "single"],
        limit: Int = 50,
        offset: Int = 0
    ) async throws -> SpotifyPage<SpotifyAlbum> {
        try await get("artists/\(id)/albums", query: [
            "include_groups": includeGroups.joined(separator: ","),
            "limit": "\(limit)",
            "offset": "\(offset)",
        ])
    }

    // MARK: Albums

    public func album(id: String) async throws -> SpotifyAlbum {
        try await get("albums/\(id)")
    }

    /// An album's track list.
    ///
    /// The simplified track objects this returns carry no album reference, so
    /// the caller has to graft one on if it wants artwork — `MediaBrowser` does.
    public func albumTracks(
        id: String,
        limit: Int = 50,
        offset: Int = 0
    ) async throws -> SpotifyPage<SpotifyTrack> {
        try await get("albums/\(id)/tracks", query: [
            "limit": "\(limit)",
            "offset": "\(offset)",
        ])
    }

    // MARK: Library

    public func savedAlbums(limit: Int = 50, offset: Int = 0) async throws -> SpotifyPage<SpotifySavedAlbum> {
        try await get("me/albums", query: ["limit": "\(limit)", "offset": "\(offset)"])
    }

    /// Followed artists. Cursor-paged rather than offset-paged, unlike
    /// everything else in the API.
    public func followedArtists(limit: Int = 50, after: String? = nil) async throws -> SpotifyFollowedArtists {
        var query = ["type": "artist", "limit": "\(limit)"]
        if let after { query["after"] = after }
        return try await get("me/following", query: query)
    }

    public func track(id: String) async throws -> SpotifyTrack {
        try await get("tracks/\(id)")
    }

    /// Fetches several tracks in one request. Spotify caps this at 50 ids, so
    /// longer lists are chunked.
    public func tracks(ids: [String]) async throws -> [SpotifyTrack] {
        struct Response: Decodable { let tracks: [SpotifyTrack?] }
        var collected: [SpotifyTrack] = []
        for chunk in stride(from: 0, to: ids.count, by: 50) {
            let slice = ids[chunk ..< min(chunk + 50, ids.count)]
            let response: Response = try await get("tracks", query: ["ids": slice.joined(separator: ",")])
            collected.append(contentsOf: response.tracks.compactMap { $0 })
        }
        return collected
    }

    // MARK: - Playback control
    //
    // Used when the Spotify desktop app is not the target — a phone, a speaker,
    // another Mac. Local playback goes through ScriptingBridge instead, which
    // is both faster and works without Premium.

    public func play(deviceID: String? = nil, uris: [String]? = nil, contextURI: String? = nil, offset: Int? = nil) async throws {
        var body: [String: Any] = [:]
        if let uris { body["uris"] = uris }
        if let contextURI { body["context_uri"] = contextURI }
        if let offset { body["offset"] = ["position": offset] }
        try await send(
            "me/player/play",
            method: "PUT",
            query: deviceID.map { ["device_id": $0] } ?? [:],
            body: body.isEmpty ? nil : body
        )
    }

    public func pause(deviceID: String? = nil) async throws {
        try await send("me/player/pause", method: "PUT", query: deviceID.map { ["device_id": $0] } ?? [:])
    }

    public func next(deviceID: String? = nil) async throws {
        try await send("me/player/next", method: "POST", query: deviceID.map { ["device_id": $0] } ?? [:])
    }

    public func previous(deviceID: String? = nil) async throws {
        try await send("me/player/previous", method: "POST", query: deviceID.map { ["device_id": $0] } ?? [:])
    }

    public func seek(toMilliseconds position: Int, deviceID: String? = nil) async throws {
        var query = ["position_ms": "\(max(0, position))"]
        if let deviceID { query["device_id"] = deviceID }
        try await send("me/player/seek", method: "PUT", query: query)
    }

    public func setVolume(percent: Int, deviceID: String? = nil) async throws {
        var query = ["volume_percent": "\(min(100, max(0, percent)))"]
        if let deviceID { query["device_id"] = deviceID }
        try await send("me/player/volume", method: "PUT", query: query)
    }

    public func setShuffle(_ enabled: Bool, deviceID: String? = nil) async throws {
        var query = ["state": enabled ? "true" : "false"]
        if let deviceID { query["device_id"] = deviceID }
        try await send("me/player/shuffle", method: "PUT", query: query)
    }

    /// `state` is Spotify's vocabulary: `off`, `context`, or `track`.
    public func setRepeat(_ state: String, deviceID: String? = nil) async throws {
        var query = ["state": state]
        if let deviceID { query["device_id"] = deviceID }
        try await send("me/player/repeat", method: "PUT", query: query)
    }

    public func transferPlayback(to deviceID: String, play: Bool = true) async throws {
        try await send(
            "me/player",
            method: "PUT",
            body: ["device_ids": [deviceID], "play": play]
        )
    }

    // MARK: - Transport

    private func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        guard let value: T = try await request(path, method: "GET", query: query, body: nil) else {
            throw Error.decoding(underlying: "empty response for \(path)")
        }
        return value
    }

    /// For endpoints where "no content" is a meaningful answer rather than a
    /// failure — `me/player` returns 204 when nothing is playing anywhere.
    private func getOptional<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T? {
        try await request(path, method: "GET", query: query, body: nil)
    }

    private func send(
        _ path: String,
        method: String,
        query: [String: String] = [:],
        body: [String: Any]? = nil
    ) async throws {
        let _: Empty? = try await request(path, method: method, query: query, body: body)
    }

    private struct Empty: Decodable {}

    private func request<T: Decodable>(
        _ path: String,
        method: String,
        query: [String: String],
        body: [String: Any]?,
        attempt: Int = 0
    ) async throws -> T? {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }

        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("Bearer \(try await auth.accessToken())", forHTTPHeaderField: "Authorization")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: request)
        let http = response as? HTTPURLResponse
        let status = http?.statusCode ?? 0

        switch status {
        case 200 ..< 300:
            // 204 and empty bodies are normal for the playback endpoints.
            guard !data.isEmpty, status != 204 else { return nil }
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw Error.decoding(underlying: "\(error)")
            }

        case 401:
            // The token expired mid-flight. Refresh once and retry; a second
            // 401 means the grant is genuinely gone.
            guard attempt == 0 else { throw Error.notAuthorized }
            _ = try? await auth.refresh()
            return try await self.request(path, method: method, query: query, body: body, attempt: 1)

        case 403:
            let message = Self.errorMessage(in: data)
            // Spotify uses 403 both for "not Premium" and for genuine scope
            // problems; the message is the only way to tell them apart.
            if message.localizedCaseInsensitiveContains("premium") {
                throw Error.premiumRequired
            }
            throw Error.http(status: 403, message: message)

        case 404:
            let message = Self.errorMessage(in: data)
            if message.localizedCaseInsensitiveContains("device") {
                throw Error.noActiveDevice
            }
            throw Error.http(status: 404, message: message)

        case 429:
            let retryAfter = TimeInterval(http?.value(forHTTPHeaderField: "Retry-After") ?? "1") ?? 1
            // Honour the header once, then surface it so the caller can back
            // off rather than hammering.
            guard attempt == 0 else { throw Error.rateLimited(retryAfter: retryAfter) }
            try await Task.sleep(nanoseconds: UInt64(retryAfter * 1_000_000_000))
            return try await self.request(path, method: method, query: query, body: body, attempt: 1)

        default:
            throw Error.http(status: status, message: Self.errorMessage(in: data))
        }
    }

    private static func errorMessage(in data: Data) -> String {
        struct Envelope: Decodable {
            struct Inner: Decodable { let message: String? }
            let error: Inner?
        }
        if let envelope = try? JSONDecoder().decode(Envelope.self, from: data),
           let message = envelope.error?.message {
            return message
        }
        return String(data: data, encoding: .utf8) ?? "<no body>"
    }
}

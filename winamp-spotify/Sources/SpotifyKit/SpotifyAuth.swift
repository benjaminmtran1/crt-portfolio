import Foundation
import CryptoKit

/// Authorization Code flow with PKCE, which is the only sanctioned flow for a
/// native app: there is no client secret to hide in the bundle.
///
/// This type is deliberately UI-free. It produces the URL to open and consumes
/// the callback URL, so the same code backs a macOS `ASWebAuthenticationSession`
/// and an iOS one without SpotifyKit importing AppKit or UIKit.
public actor SpotifyAuth {

    public struct Configuration: Sendable {
        /// Client ID from your app at developer.spotify.com/dashboard.
        public var clientID: String
        /// Must match a Redirect URI registered on that app exactly.
        public var redirectURI: String
        public var scopes: [String]

        public init(clientID: String, redirectURI: String, scopes: [String] = Configuration.defaultScopes) {
            self.clientID = clientID
            self.redirectURI = redirectURI
            self.scopes = scopes
        }

        /// What the player needs: read what is playing, drive playback on
        /// remote devices, and browse the user's own library.
        public static let defaultScopes = [
            "user-read-playback-state",
            "user-modify-playback-state",
            "user-read-currently-playing",
            "playlist-read-private",
            "playlist-read-collaborative",
            "user-library-read",
            "user-read-private",
            "user-read-email",
        ]
    }

    public struct Tokens: Codable, Sendable {
        public var accessToken: String
        public var refreshToken: String?
        public var expiresAt: Date
        public var scope: String?

        /// Treated as expired a minute early, so a request never sets off with
        /// a token that dies in flight.
        public var isExpired: Bool {
            Date() >= expiresAt.addingTimeInterval(-60)
        }
    }

    public enum Error: Swift.Error, LocalizedError {
        case notConfigured
        case notAuthorized
        case stateMismatch
        case authorizationDenied(String)
        case missingCode
        case tokenRequestFailed(status: Int, body: String)
        case refreshUnavailable

        public var errorDescription: String? {
            switch self {
            case .notConfigured:
                return "No Spotify client ID has been set. Add one in Preferences."
            case .notAuthorized:
                return "Not signed in to Spotify."
            case .stateMismatch:
                return "The Spotify sign-in response did not match the request. Please try again."
            case .authorizationDenied(let reason):
                return "Spotify sign-in was denied: \(reason)."
            case .missingCode:
                return "Spotify's response contained no authorization code."
            case .tokenRequestFailed(let status, let body):
                return "Spotify rejected the token request (HTTP \(status)): \(body)"
            case .refreshUnavailable:
                return "This session has no refresh token; sign in to Spotify again."
            }
        }
    }

    /// One in-flight authorization attempt. The verifier must survive until the
    /// callback arrives, which is why it is handed back to the caller.
    public struct PendingAuthorization: Sendable {
        public let url: URL
        public let state: String
        let codeVerifier: String
    }

    private let configuration: Configuration
    private let tokenStore: any TokenStore
    private let session: URLSession
    private var tokens: Tokens?
    /// Coalesces concurrent refreshes so a burst of requests triggers one.
    private var refreshTask: Task<Tokens, Swift.Error>?

    public init(
        configuration: Configuration,
        tokenStore: any TokenStore,
        session: URLSession = .shared
    ) {
        self.configuration = configuration
        self.tokenStore = tokenStore
        self.session = session
    }

    // MARK: - Session state

    public func restoreSession() async {
        tokens = await tokenStore.load()
    }

    public var isAuthorized: Bool {
        tokens?.refreshToken != nil || (tokens.map { !$0.isExpired } ?? false)
    }

    public func signOut() async {
        tokens = nil
        refreshTask = nil
        await tokenStore.clear()
    }

    // MARK: - Authorization

    public func beginAuthorization() throws -> PendingAuthorization {
        guard !configuration.clientID.isEmpty else { throw Error.notConfigured }

        let verifier = Self.makeCodeVerifier()
        let challenge = Self.codeChallenge(for: verifier)
        let state = Self.makeCodeVerifier(byteCount: 16)

        var components = URLComponents(string: "https://accounts.spotify.com/authorize")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: configuration.clientID),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "redirect_uri", value: configuration.redirectURI),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "scope", value: configuration.scopes.joined(separator: " ")),
        ]
        guard let url = components.url else { throw Error.notConfigured }
        return PendingAuthorization(url: url, state: state, codeVerifier: verifier)
    }

    /// Completes the flow from the redirect URL the browser handed back.
    @discardableResult
    public func completeAuthorization(
        callbackURL: URL,
        pending: PendingAuthorization
    ) async throws -> Tokens {
        let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)
        let items = components?.queryItems ?? []

        if let error = items.first(where: { $0.name == "error" })?.value {
            throw Error.authorizationDenied(error)
        }
        guard let returnedState = items.first(where: { $0.name == "state" })?.value,
              returnedState == pending.state else {
            throw Error.stateMismatch
        }
        guard let code = items.first(where: { $0.name == "code" })?.value else {
            throw Error.missingCode
        }

        let tokens = try await requestTokens(parameters: [
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": configuration.redirectURI,
            "client_id": configuration.clientID,
            "code_verifier": pending.codeVerifier,
        ])
        self.tokens = tokens
        await tokenStore.save(tokens)
        return tokens
    }

    // MARK: - Access tokens

    /// A valid access token, refreshing if needed.
    public func accessToken() async throws -> String {
        guard let current = tokens else { throw Error.notAuthorized }
        if !current.isExpired { return current.accessToken }
        return try await refresh().accessToken
    }

    @discardableResult
    public func refresh() async throws -> Tokens {
        if let existing = refreshTask { return try await existing.value }

        guard let refreshToken = tokens?.refreshToken else { throw Error.refreshUnavailable }

        let task = Task<Tokens, Swift.Error> { [configuration] in
            var refreshed = try await requestTokens(parameters: [
                "grant_type": "refresh_token",
                "refresh_token": refreshToken,
                "client_id": configuration.clientID,
            ])
            // Spotify only sometimes rotates the refresh token; keep the old
            // one when it does not, or the session dies on the next refresh.
            if refreshed.refreshToken == nil { refreshed.refreshToken = refreshToken }
            return refreshed
        }
        refreshTask = task

        do {
            let refreshed = try await task.value
            refreshTask = nil
            tokens = refreshed
            await tokenStore.save(refreshed)
            return refreshed
        } catch {
            refreshTask = nil
            throw error
        }
    }

    private func requestTokens(parameters: [String: String]) async throws -> Tokens {
        var request = URLRequest(url: URL(string: "https://accounts.spotify.com/api/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = Self.formEncode(parameters).data(using: .utf8)

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ..< 300).contains(status) else {
            throw Error.tokenRequestFailed(
                status: status,
                body: String(data: data, encoding: .utf8) ?? "<no body>"
            )
        }

        struct Payload: Decodable {
            let access_token: String
            let refresh_token: String?
            let expires_in: Int
            let scope: String?
        }
        let payload = try JSONDecoder().decode(Payload.self, from: data)
        return Tokens(
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token,
            expiresAt: Date().addingTimeInterval(TimeInterval(payload.expires_in)),
            scope: payload.scope
        )
    }

    // MARK: - PKCE helpers

    static func makeCodeVerifier(byteCount: Int = 48) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        // SystemRandomNumberGenerator is CSPRNG-backed on Apple platforms.
        var generator = SystemRandomNumberGenerator()
        for index in bytes.indices { bytes[index] = UInt8.random(in: .min ... .max, using: &generator) }
        return base64URLEncode(Data(bytes))
    }

    static func codeChallenge(for verifier: String) -> String {
        let digest = SHA256.hash(data: Data(verifier.utf8))
        return base64URLEncode(Data(digest))
    }

    static func base64URLEncode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func formEncode(_ parameters: [String: String]) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return parameters
            .map { key, value in
                let encodedKey = key.addingPercentEncoding(withAllowedCharacters: allowed) ?? key
                let encodedValue = value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
                return "\(encodedKey)=\(encodedValue)"
            }
            .joined(separator: "&")
    }
}

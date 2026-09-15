import Foundation
import Security

/// Where OAuth tokens are persisted between launches.
public protocol TokenStore: Sendable {
    func save(_ tokens: SpotifyAuth.Tokens) async
    func load() async -> SpotifyAuth.Tokens?
    func clear() async
}

/// Keychain-backed token storage.
///
/// A refresh token is a long-lived credential for someone's music account, so
/// it belongs in the keychain rather than `UserDefaults` — and the item is
/// marked `ThisDeviceOnly` so it never rides an iCloud or Migration Assistant
/// transfer to another machine.
public struct KeychainTokenStore: TokenStore {

    private let service: String
    private let account: String

    public init(service: String = "com.winampspotify.oauth", account: String = "spotify") {
        self.service = service
        self.account = account
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    public func save(_ tokens: SpotifyAuth.Tokens) async {
        guard let data = try? JSONEncoder().encode(tokens) else { return }

        // Update in place when the item already exists; SecItemAdd fails with
        // errSecDuplicateItem otherwise.
        let updateStatus = SecItemUpdate(
            baseQuery as CFDictionary,
            [kSecValueData as String: data] as CFDictionary
        )
        if updateStatus == errSecSuccess { return }

        var query = baseQuery
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        SecItemAdd(query as CFDictionary, nil)
    }

    public func load() async -> SpotifyAuth.Tokens? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(SpotifyAuth.Tokens.self, from: data)
    }

    public func clear() async {
        SecItemDelete(baseQuery as CFDictionary)
    }
}

/// In-memory storage, for tests and for a "don't remember me" mode.
public actor EphemeralTokenStore: TokenStore {
    private var tokens: SpotifyAuth.Tokens?

    public init() {}

    public func save(_ tokens: SpotifyAuth.Tokens) async { self.tokens = tokens }
    public func load() async -> SpotifyAuth.Tokens? { tokens }
    public func clear() async { tokens = nil }
}

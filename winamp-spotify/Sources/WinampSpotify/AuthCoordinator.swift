import AppKit
import AuthenticationServices
import SpotifyKit

/// Runs the browser half of the OAuth flow.
///
/// `ASWebAuthenticationSession` is the right tool here: it uses Safari's cookie
/// jar, so someone already signed in to Spotify gets a one-click consent
/// screen, and the app never sees their password.
@MainActor
final class AuthCoordinator: NSObject, ASWebAuthenticationPresentationContextProviding {

    private let auth: SpotifyAuth
    private let callbackScheme: String
    private var session: ASWebAuthenticationSession?
    private weak var anchorWindow: NSWindow?

    init(auth: SpotifyAuth, callbackScheme: String, anchorWindow: NSWindow?) {
        self.auth = auth
        self.callbackScheme = callbackScheme
        self.anchorWindow = anchorWindow
        super.init()
    }

    func signIn() async throws {
        let pending = try await auth.beginAuthorization()

        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: pending.url,
                callbackURLScheme: callbackScheme
            ) { url, error in
                if let url {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(throwing: error ?? SpotifyAuth.Error.missingCode)
                }
            }
            session.presentationContextProvider = self
            // Deliberately shares the session cookie: being already signed in
            // to Spotify in the browser should make this one click.
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            session.start()
        }

        try await auth.completeAuthorization(callbackURL: callbackURL, pending: pending)
        session = nil
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchorWindow ?? NSApp.windows.first ?? NSWindow()
    }
}

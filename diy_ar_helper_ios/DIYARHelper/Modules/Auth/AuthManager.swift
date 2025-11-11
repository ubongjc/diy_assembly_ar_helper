import Foundation
import AuthenticationServices
import Combine

/// AuthManager handles authentication with passkey support (WebAuthn)
@MainActor
class AuthManager: NSObject, ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var error: AuthError?
    @Published var isLoading = false

    private let networkManager: NetworkManager

    override init() {
        self.networkManager = NetworkManager()
        super.init()
    }

    // MARK: - Passkey Authentication

    /// Sign in or register using passkey (WebAuthn/FIDO2)
    func signInWithPasskey() async {
        isLoading = true
        defer { isLoading = false }

        // In a real implementation, this would:
        // 1. Get challenge from server
        // 2. Use ASAuthorizationController to create/use passkey
        // 3. Send response to server
        // 4. Receive and store auth token

        do {
            // Create passkey authentication request
            let publicKeyCredentialProvider = ASAuthorizationPlatformPublicKeyCredentialProvider(
                relyingPartyIdentifier: "diyarhelper.com"
            )

            // Request both assertion (sign in) and registration options
            let assertionRequest = publicKeyCredentialProvider.createCredentialAssertionRequest(
                challenge: Data() // Would come from server
            )

            let authController = ASAuthorizationController(authorizationRequests: [assertionRequest])
            authController.delegate = self
            authController.presentationContextProvider = self

            authController.performRequests()
        } catch {
            self.error = .passkeyFailed(error)
        }
    }

    /// Register new passkey
    func registerPasskey(username: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            // In production:
            // 1. Request registration options from server
            // 2. Create credential registration request
            // 3. Get user to authenticate
            // 4. Send public key to server

            let publicKeyCredentialProvider = ASAuthorizationPlatformPublicKeyCredentialProvider(
                relyingPartyIdentifier: "diyarhelper.com"
            )

            let registrationRequest = publicKeyCredentialProvider.createCredentialRegistrationRequest(
                challenge: Data(), // From server
                name: username,
                userID: Data() // From server
            )

            let authController = ASAuthorizationController(authorizationRequests: [registrationRequest])
            authController.delegate = self
            authController.presentationContextProvider = self

            authController.performRequests()
        } catch {
            self.error = .passkeyFailed(error)
        }
    }

    // MARK: - Token Management

    func saveAuthToken(_ token: String) {
        do {
            try KeychainManager.shared.store(
                token.data(using: .utf8)!,
                forKey: "auth_token"
            )
            networkManager.setAuthToken(token)
            isAuthenticated = true
        } catch {
            self.error = .tokenStorageFailed
        }
    }

    func loadAuthToken() -> String? {
        guard let tokenData = try? KeychainManager.shared.retrieve(forKey: "auth_token"),
              let token = String(data: tokenData, encoding: .utf8) else {
            return nil
        }
        return token
    }

    func checkExistingAuth() async {
        if let token = loadAuthToken() {
            networkManager.setAuthToken(token)
            // Verify token is still valid
            do {
                _ = try await networkManager.checkHealth()
                isAuthenticated = true
            } catch {
                // Token expired or invalid
                signOut()
            }
        }
    }

    // MARK: - Sign Out

    func signOut() {
        try? KeychainManager.shared.delete(forKey: "auth_token")
        networkManager.clearAuthToken()
        isAuthenticated = false
        currentUser = nil
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AuthManager: ASAuthorizationControllerDelegate {
    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        Task { @MainActor in
            switch authorization.credential {
            case let credentialAssertion as ASAuthorizationPlatformPublicKeyCredentialAssertion:
                // User signed in with passkey
                // Send assertion to server for verification
                print("Passkey assertion received")
                // In production: send to server and get auth token
                isAuthenticated = true

            case let credentialRegistration as ASAuthorizationPlatformPublicKeyCredentialRegistration:
                // User registered new passkey
                // Send public key to server
                print("Passkey registered")
                // In production: send to server and get auth token
                isAuthenticated = true

            default:
                error = .unknownCredentialType
            }
        }
    }

    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        Task { @MainActor in
            if let authError = error as? ASAuthorizationError {
                switch authError.code {
                case .canceled:
                    self.error = .userCancelled
                case .failed:
                    self.error = .authenticationFailed
                default:
                    self.error = .passkeyFailed(error)
                }
            } else {
                self.error = .passkeyFailed(error)
            }
        }
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension AuthManager: ASAuthorizationControllerPresentationContextProviding {
    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        // Return the window for presenting the authentication UI
        return ASPresentationAnchor()
    }
}

// MARK: - User Model

struct User: Codable {
    let id: String
    let email: String?
    let name: String?
    let role: String
    let subscriptionTier: String?
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case passkeyFailed(Error)
    case tokenStorageFailed
    case userCancelled
    case authenticationFailed
    case unknownCredentialType

    var errorDescription: String? {
        switch self {
        case .passkeyFailed(let error):
            return "Passkey authentication failed: \(error.localizedDescription)"
        case .tokenStorageFailed:
            return "Failed to store authentication token"
        case .userCancelled:
            return "Authentication cancelled by user"
        case .authenticationFailed:
            return "Authentication failed"
        case .unknownCredentialType:
            return "Unknown credential type"
        }
    }
}

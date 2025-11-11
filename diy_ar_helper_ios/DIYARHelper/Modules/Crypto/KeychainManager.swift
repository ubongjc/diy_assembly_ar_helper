import Foundation
import Security

/// KeychainManager handles secure storage of sensitive data in iOS Keychain
class KeychainManager {
    static let shared = KeychainManager()

    private let service = "com.diyarhelper.ios"

    private init() {}

    // MARK: - Store

    func store(_ data: Data, forKey key: String) throws {
        // Delete any existing item
        try? delete(forKey: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw KeychainError.storeFailed(status: status)
        }
    }

    // MARK: - Retrieve

    func retrieve(forKey key: String) throws -> Data {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else {
            throw KeychainError.retrieveFailed(status: status)
        }

        guard let data = result as? Data else {
            throw KeychainError.invalidData
        }

        return data
    }

    // MARK: - Delete

    func delete(forKey key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status: status)
        }
    }

    // MARK: - Clear All

    func clearAll() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status: status)
        }
    }
}

// MARK: - Keychain Errors

enum KeychainError: LocalizedError {
    case storeFailed(status: OSStatus)
    case retrieveFailed(status: OSStatus)
    case deleteFailed(status: OSStatus)
    case invalidData

    var errorDescription: String? {
        switch self {
        case .storeFailed(let status):
            return "Failed to store item in keychain (status: \(status))"
        case .retrieveFailed(let status):
            return "Failed to retrieve item from keychain (status: \(status))"
        case .deleteFailed(let status):
            return "Failed to delete item from keychain (status: \(status))"
        case .invalidData:
            return "Invalid data retrieved from keychain"
        }
    }
}

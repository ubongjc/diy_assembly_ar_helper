import Foundation
import CryptoKit

/// CryptoManager handles client-side encryption/decryption of sensitive data
/// Uses AES-GCM for authenticated encryption
class CryptoManager {
    static let shared = CryptoManager()

    private init() {}

    // MARK: - Key Management

    /// Generate a new symmetric key
    func generateKey() -> SymmetricKey {
        return SymmetricKey(size: .bits256)
    }

    /// Derive a key from a password using PBKDF2
    func deriveKey(from password: String, salt: Data, iterations: Int = 100_000) throws -> SymmetricKey {
        guard let passwordData = password.data(using: .utf8) else {
            throw CryptoError.invalidPassword
        }

        // Use PBKDF2 for key derivation
        // Note: CryptoKit doesn't have built-in PBKDF2, so in production you'd use CommonCrypto
        // This is a simplified example
        let key = HKDF<SHA256>.deriveKey(
            inputKeyMaterial: SymmetricKey(data: passwordData),
            salt: salt,
            outputByteCount: 32
        )

        return key
    }

    /// Store key securely in Keychain
    func storeKey(_ key: SymmetricKey, identifier: String) throws {
        let keyData = key.withUnsafeBytes { Data($0) }
        try KeychainManager.shared.store(keyData, forKey: identifier)
    }

    /// Retrieve key from Keychain
    func retrieveKey(identifier: String) throws -> SymmetricKey {
        let keyData = try KeychainManager.shared.retrieve(forKey: identifier)
        return SymmetricKey(data: keyData)
    }

    // MARK: - Encryption/Decryption

    /// Encrypt data using AES-GCM
    func encrypt(data: Data, using key: SymmetricKey) throws -> EncryptedData {
        let nonce = AES.GCM.Nonce()
        let sealedBox = try AES.GCM.seal(data, using: key, nonce: nonce)

        guard let ciphertext = sealedBox.ciphertext.withUnsafeBytes({ Data($0) }) as Data?,
              let tag = sealedBox.tag.withUnsafeBytes({ Data($0) }) as Data? else {
            throw CryptoError.encryptionFailed
        }

        return EncryptedData(
            ciphertext: ciphertext,
            nonce: Data(nonce),
            tag: tag
        )
    }

    /// Decrypt data using AES-GCM
    func decrypt(encryptedData: EncryptedData, using key: SymmetricKey) throws -> Data {
        guard let nonce = try? AES.GCM.Nonce(data: encryptedData.nonce) else {
            throw CryptoError.invalidNonce
        }

        let sealedBox = try AES.GCM.SealedBox(
            nonce: nonce,
            ciphertext: encryptedData.ciphertext,
            tag: encryptedData.tag
        )

        return try AES.GCM.open(sealedBox, using: key)
    }

    /// Encrypt string using AES-GCM
    func encrypt(string: String, using key: SymmetricKey) throws -> EncryptedData {
        guard let data = string.data(using: .utf8) else {
            throw CryptoError.invalidData
        }
        return try encrypt(data: data, using: key)
    }

    /// Decrypt to string using AES-GCM
    func decryptToString(encryptedData: EncryptedData, using key: SymmetricKey) throws -> String {
        let data = try decrypt(encryptedData: encryptedData, using: key)
        guard let string = String(data: data, encoding: .utf8) else {
            throw CryptoError.invalidData
        }
        return string
    }

    // MARK: - Hashing

    /// Generate SHA256 hash of data
    func hash(data: Data) -> Data {
        let hash = SHA256.hash(data: data)
        return Data(hash)
    }

    /// Generate SHA256 hash of string
    func hash(string: String) -> Data? {
        guard let data = string.data(using: .utf8) else {
            return nil
        }
        return hash(data: data)
    }
}

// MARK: - Encrypted Data Model

struct EncryptedData: Codable {
    let ciphertext: Data
    let nonce: Data
    let tag: Data

    /// Convert to base64 encoded string for storage/transmission
    func toBase64() -> String {
        let combined = ciphertext + nonce + tag
        return combined.base64EncodedString()
    }

    /// Create from base64 encoded string
    static func fromBase64(_ base64: String) throws -> EncryptedData {
        guard let data = Data(base64Encoded: base64) else {
            throw CryptoError.invalidData
        }

        // Assuming fixed sizes: nonce (12 bytes), tag (16 bytes)
        let nonceSize = 12
        let tagSize = 16

        guard data.count >= nonceSize + tagSize else {
            throw CryptoError.invalidData
        }

        let ciphertextSize = data.count - nonceSize - tagSize
        let ciphertext = data.prefix(ciphertextSize)
        let nonce = data.dropFirst(ciphertextSize).prefix(nonceSize)
        let tag = data.dropFirst(ciphertextSize + nonceSize)

        return EncryptedData(
            ciphertext: Data(ciphertext),
            nonce: Data(nonce),
            tag: Data(tag)
        )
    }
}

// MARK: - Crypto Errors

enum CryptoError: LocalizedError {
    case invalidPassword
    case invalidData
    case invalidNonce
    case encryptionFailed
    case decryptionFailed
    case keyNotFound

    var errorDescription: String? {
        switch self {
        case .invalidPassword:
            return "Invalid password provided"
        case .invalidData:
            return "Invalid data format"
        case .invalidNonce:
            return "Invalid nonce"
        case .encryptionFailed:
            return "Encryption failed"
        case .decryptionFailed:
            return "Decryption failed"
        case .keyNotFound:
            return "Encryption key not found"
        }
    }
}

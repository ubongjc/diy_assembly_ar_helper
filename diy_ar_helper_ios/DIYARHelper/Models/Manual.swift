import Foundation

// MARK: - Manual Model

struct Manual: Identifiable, Codable {
    let id: String
    let userId: String
    let brand: String
    let model: String
    let category: String?
    let title: String
    let description: String?
    let steps: [ManualStep]
    let partsRequired: [String]?
    let toolsRequired: [String]?
    let estimatedTime: Int?
    let difficultyLevel: DifficultyLevel?
    let isPublic: Bool
    let isPro: Bool
    let imageUrls: [String]?
    let createdAt: Date
    let updatedAt: Date
}

// MARK: - Manual Step

struct ManualStep: Codable, Identifiable {
    var id: Int { order }
    let order: Int
    let title: String
    let description: String
    let imageUrl: String?
    let estimatedTime: Int?
    let warnings: [String]?
    let partsUsed: [String]?
}

// MARK: - Difficulty Level

enum DifficultyLevel: String, Codable {
    case easy
    case medium
    case hard
}

// MARK: - API Request/Response Models

struct ManualIngestRequest: Encodable {
    let brand: String
    let model: String
    let category: String?
    let title: String
    let description: String?
    let steps: [ManualStep]
    let partsRequired: [String]?
    let toolsRequired: [String]?
    let estimatedTime: Int?
    let difficultyLevel: DifficultyLevel?
    let isPublic: Bool
    let isPro: Bool
    let imageUrls: [String]?
}

struct ManualIngestResponse: Decodable {
    let success: Bool
    let manual: Manual
}

struct ManualResponse: Decodable {
    let success: Bool
    let manual: Manual
}

// MARK: - Health Response

struct HealthResponse: Decodable {
    let status: String
    let timestamp: String
    let version: String
    let environment: String
}

import Foundation
import Combine

/// NetworkManager handles all API communication with the backend
@MainActor
class NetworkManager: ObservableObject {
    @Published var isLoading = false
    @Published var error: NetworkError?

    private let baseURL: URL
    private let session: URLSession
    private var authToken: String?

    init(baseURL: String = "http://localhost:3000") {
        guard let url = URL(string: baseURL) else {
            fatalError("Invalid base URL")
        }
        self.baseURL = url
        self.session = URLSession.shared
    }

    // MARK: - Authentication

    func setAuthToken(_ token: String) {
        self.authToken = token
    }

    func clearAuthToken() {
        self.authToken = nil
    }

    // MARK: - Generic Request Handler

    func request<T: Decodable>(
        _ endpoint: APIEndpoint,
        method: HTTPMethod = .get,
        body: Encodable? = nil
    ) async throws -> T {
        isLoading = true
        defer { isLoading = false }

        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint.path))
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Add auth token if available
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Encode body if present
        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.httpError(statusCode: httpResponse.statusCode)
        }

        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        } catch {
            throw NetworkError.decodingError(error)
        }
    }

    // MARK: - Manual API

    func fetchManual(id: String) async throws -> Manual {
        let response: ManualResponse = try await request(.manual(id: id))
        return response.manual
    }

    func ingestManual(_ manual: ManualIngestRequest) async throws -> Manual {
        let response: ManualIngestResponse = try await request(
            .manualIngest,
            method: .post,
            body: manual
        )
        return response.manual
    }

    // MARK: - Health Check

    func checkHealth() async throws -> HealthResponse {
        return try await request(.health)
    }
}

// MARK: - API Endpoints

enum APIEndpoint {
    case health
    case manual(id: String)
    case manualIngest
    case session(id: String)

    var path: String {
        switch self {
        case .health:
            return "/api/health"
        case .manual(let id):
            return "/api/manual/\(id)"
        case .manualIngest:
            return "/api/manual/ingest"
        case .session(let id):
            return "/api/session/\(id)"
        }
    }
}

// MARK: - HTTP Method

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case delete = "DELETE"
    case patch = "PATCH"
}

// MARK: - Network Error

enum NetworkError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int)
    case decodingError(Error)
    case encodingError(Error)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let statusCode):
            return "HTTP Error: \(statusCode)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .encodingError(let error):
            return "Failed to encode request: \(error.localizedDescription)"
        case .unauthorized:
            return "Unauthorized access"
        }
    }
}

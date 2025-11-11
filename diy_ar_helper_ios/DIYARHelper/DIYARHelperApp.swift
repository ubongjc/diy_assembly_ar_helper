import SwiftUI

@main
struct DIYARHelperApp: App {
    @StateObject private var authManager = AuthManager()
    @StateObject private var networkManager = NetworkManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(networkManager)
                .onAppear {
                    // Check for existing passkey on launch
                    Task {
                        await authManager.checkExistingAuth()
                    }
                }
        }
    }
}

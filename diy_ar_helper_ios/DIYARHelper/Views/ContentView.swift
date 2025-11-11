import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        Group {
            if authManager.isAuthenticated {
                MainTabView()
            } else {
                SignInView()
            }
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            ManualListView()
                .tabItem {
                    Label("Manuals", systemImage: "book.fill")
                }

            ARSessionView()
                .tabItem {
                    Label("AR Guide", systemImage: "arkit")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthManager())
        .environmentObject(NetworkManager())
}

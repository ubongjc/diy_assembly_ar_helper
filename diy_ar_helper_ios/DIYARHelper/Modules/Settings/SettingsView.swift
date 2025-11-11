import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var showingExportData = false
    @State private var showingDeleteAccount = false
    @State private var enableNotifications = true
    @State private var enableOfflineMode = false
    @State private var enableHaptics = true

    var body: some View {
        NavigationView {
            List {
                // Profile Section
                Section(header: Text("Profile")) {
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.blue)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(authManager.currentUser?.name ?? "User")
                                .font(.headline)

                            Text(authManager.currentUser?.email ?? "")
                                .font(.subheadline)
                                .foregroundColor(.secondary)

                            if let tier = authManager.currentUser?.subscriptionTier {
                                Text(tier.uppercased())
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(tier == "pro" ? Color.orange : Color.gray.opacity(0.2))
                                    .foregroundColor(tier == "pro" ? .white : .primary)
                                    .cornerRadius(4)
                            }
                        }
                    }
                    .padding(.vertical, 8)

                    NavigationLink(destination: EditProfileView()) {
                        Label("Edit Profile", systemImage: "pencil")
                    }
                }

                // Subscription Section
                Section(header: Text("Subscription")) {
                    if authManager.currentUser?.subscriptionTier == "pro" {
                        HStack {
                            VStack(alignment: .leading) {
                                Text("Pro Subscription")
                                    .font(.headline)
                                Text("Active")
                                    .font(.caption)
                                    .foregroundColor(.green)
                            }

                            Spacer()

                            Button("Manage") {
                                // Open subscription management
                            }
                            .font(.subheadline)
                        }
                    } else {
                        NavigationLink(destination: SubscriptionView()) {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text("Upgrade to Pro")
                                        .font(.headline)
                                    Text("Unlock advanced AR features & offline packs")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                Spacer()

                                Image(systemName: "crown.fill")
                                    .foregroundColor(.orange)
                            }
                        }
                    }
                }

                // Preferences Section
                Section(header: Text("Preferences")) {
                    Toggle("Notifications", isOn: $enableNotifications)

                    Toggle("Offline Mode", isOn: $enableOfflineMode)

                    Toggle("Haptic Feedback", isOn: $enableHaptics)

                    NavigationLink(destination: Text("AR Settings")) {
                        Label("AR Settings", systemImage: "arkit")
                    }
                }

                // Privacy Section
                Section(header: Text("Privacy & Security")) {
                    NavigationLink(destination: PasskeyManagementView()) {
                        Label("Passkey Management", systemImage: "key.fill")
                    }

                    Button(action: { showingExportData = true }) {
                        Label("Export My Data", systemImage: "arrow.down.doc")
                    }

                    NavigationLink(destination: Text("Privacy Policy")) {
                        Label("Privacy Policy", systemImage: "hand.raised")
                    }
                }

                // Support Section
                Section(header: Text("Support")) {
                    Link(destination: URL(string: "https://help.diyarhelper.com")!) {
                        Label("Help Center", systemImage: "questionmark.circle")
                    }

                    Button(action: {}) {
                        Label("Send Feedback", systemImage: "envelope")
                    }

                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0 (MVP)")
                            .foregroundColor(.secondary)
                    }
                }

                // Account Actions
                Section {
                    Button(action: { authManager.signOut() }) {
                        HStack {
                            Spacer()
                            Text("Sign Out")
                                .foregroundColor(.blue)
                            Spacer()
                        }
                    }

                    Button(action: { showingDeleteAccount = true }) {
                        HStack {
                            Spacer()
                            Text("Delete Account")
                                .foregroundColor(.red)
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .alert("Export Data", isPresented: $showingExportData) {
                Button("Request Export") {
                    // Request data export
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("We'll send you a download link with all your data within 48 hours.")
            }
            .alert("Delete Account", isPresented: $showingDeleteAccount) {
                Button("Delete", role: .destructive) {
                    // Delete account
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This action cannot be undone. All your data will be permanently deleted.")
            }
        }
    }
}

// MARK: - Edit Profile View

struct EditProfileView: View {
    @State private var name = ""
    @State private var email = ""

    var body: some View {
        Form {
            Section(header: Text("Profile Information")) {
                TextField("Name", text: $name)
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
            }

            Section {
                Button("Save Changes") {
                    // Save profile changes
                }
            }
        }
        .navigationTitle("Edit Profile")
    }
}

// MARK: - Subscription View

struct SubscriptionView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 30) {
                // Header
                VStack(spacing: 12) {
                    Image(systemName: "crown.fill")
                        .font(.system(size: 60))
                        .foregroundColor(.orange)

                    Text("Upgrade to Pro")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    Text("Unlock advanced features and offline capabilities")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 40)

                // Features
                VStack(alignment: .leading, spacing: 20) {
                    FeatureRow(
                        icon: "arkit",
                        title: "Advanced AR Features",
                        description: "Part detection, hand placement hints, and torque warnings"
                    )

                    FeatureRow(
                        icon: "arrow.down.circle.fill",
                        title: "Offline Packs",
                        description: "Download manuals for offline use in your garage"
                    )

                    FeatureRow(
                        icon: "star.fill",
                        title: "Manufacturer Integrations",
                        description: "Access official manuals and exclusive content"
                    )

                    FeatureRow(
                        icon: "lock.fill",
                        title: "Priority Support",
                        description: "Get help faster with priority customer support"
                    )
                }
                .padding()

                // Pricing
                VStack(spacing: 16) {
                    Text("$9.99/month")
                        .font(.title)
                        .fontWeight(.bold)

                    Button(action: {
                        // Start subscription flow
                    }) {
                        Text("Start Free Trial")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }

                    Text("7 days free, then $9.99/month. Cancel anytime.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
            }
        }
        .navigationTitle("Pro Subscription")
    }
}

// MARK: - Feature Row

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
                .frame(width: 40)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)

                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Passkey Management View

struct PasskeyManagementView: View {
    var body: some View {
        List {
            Section(header: Text("Your Passkeys")) {
                HStack {
                    Image(systemName: "person.badge.key.fill")
                        .foregroundColor(.blue)

                    VStack(alignment: .leading) {
                        Text("iPhone 15 Pro")
                            .font(.headline)
                        Text("Added Nov 11, 2025")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Button(action: {}) {
                        Text("Remove")
                            .font(.subheadline)
                            .foregroundColor(.red)
                    }
                }
            }

            Section {
                Button(action: {}) {
                    Label("Add New Passkey", systemImage: "plus.circle.fill")
                }
            }

            Section(footer: Text("Passkeys provide secure, password-less authentication using your device's biometrics.")) {
                EmptyView()
            }
        }
        .navigationTitle("Passkey Management")
    }
}

#Preview {
    SettingsView()
        .environmentObject(AuthManager())
}

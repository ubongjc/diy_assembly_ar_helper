import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var username = ""
    @State private var isRegistering = false

    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                // Logo/Header
                VStack(spacing: 12) {
                    Image(systemName: "wrench.and.screwdriver.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.blue)

                    Text("DIY AR Helper")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    Text("Step-by-step AR assembly guidance")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.top, 60)

                Spacer()

                // Sign In Options
                VStack(spacing: 20) {
                    // Passkey Sign In
                    Button(action: {
                        Task {
                            await authManager.signInWithPasskey()
                        }
                    }) {
                        HStack {
                            Image(systemName: "person.badge.key.fill")
                            Text("Sign in with Passkey")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }

                    // Register New Passkey
                    Button(action: {
                        isRegistering = true
                    }) {
                        HStack {
                            Image(systemName: "key.fill")
                            Text("Create Account")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }

                    // Magic Link Alternative
                    NavigationLink(destination: MagicLinkView()) {
                        HStack {
                            Image(systemName: "envelope.fill")
                            Text("Sign in with Email")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.gray.opacity(0.2))
                        .foregroundColor(.primary)
                        .cornerRadius(12)
                    }
                }
                .padding(.horizontal, 30)

                Spacer()

                // Privacy Notice
                Text("We never record your face. All data is encrypted.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 30)
            }
            .navigationBarHidden(true)
            .alert("Error", isPresented: .constant(authManager.error != nil)) {
                Button("OK") {
                    authManager.error = nil
                }
            } message: {
                if let error = authManager.error {
                    Text(error.localizedDescription)
                }
            }
            .sheet(isPresented: $isRegistering) {
                RegistrationView(isPresented: $isRegistering)
                    .environmentObject(authManager)
            }
        }
    }
}

// MARK: - Registration View

struct RegistrationView: View {
    @EnvironmentObject var authManager: AuthManager
    @Binding var isPresented: Bool
    @State private var username = ""
    @State private var email = ""

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Account Information")) {
                    TextField("Username", text: $username)
                        .textContentType(.username)
                        .autocapitalization(.none)

                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                }

                Section(header: Text("Passkey")) {
                    Text("A passkey will be created on this device for secure, password-less authentication.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Section {
                    Button(action: {
                        Task {
                            await authManager.registerPasskey(username: username)
                            isPresented = false
                        }
                    }) {
                        Text("Create Account & Passkey")
                            .frame(maxWidth: .infinity)
                            .fontWeight(.semibold)
                    }
                    .disabled(username.isEmpty || email.isEmpty)
                }
            }
            .navigationTitle("Create Account")
            .navigationBarItems(trailing: Button("Cancel") {
                isPresented = false
            })
        }
    }
}

// MARK: - Magic Link View (Fallback)

struct MagicLinkView: View {
    @State private var email = ""
    @State private var linkSent = false

    var body: some View {
        Form {
            Section(header: Text("Email Sign In")) {
                TextField("Email address", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)

                if linkSent {
                    Text("Check your email for a sign-in link!")
                        .foregroundColor(.green)
                } else {
                    Button("Send Magic Link") {
                        // In production: call API to send magic link
                        linkSent = true
                    }
                    .disabled(email.isEmpty)
                }
            }

            Section {
                Text("We'll send you a secure link to sign in without a password.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .navigationTitle("Email Sign In")
    }
}

#Preview {
    SignInView()
        .environmentObject(AuthManager())
}

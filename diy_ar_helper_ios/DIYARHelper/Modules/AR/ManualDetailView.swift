import SwiftUI

struct ManualDetailView: View {
    let manual: Manual
    @State private var selectedStep = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text(manual.title)
                        .font(.title)
                        .fontWeight(.bold)

                    Text("\(manual.brand) \(manual.model)")
                        .font(.title3)
                        .foregroundColor(.secondary)

                    if let description = manual.description {
                        Text(description)
                            .font(.body)
                            .foregroundColor(.secondary)
                    }

                    // Metadata
                    HStack(spacing: 16) {
                        if let difficulty = manual.difficultyLevel {
                            Label(difficulty.rawValue.capitalized, systemImage: "gauge")
                        }

                        if let time = manual.estimatedTime {
                            Label("\(time) min", systemImage: "clock")
                        }

                        Label("\(manual.steps.count) steps", systemImage: "list.number")
                    }
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                }
                .padding()

                Divider()

                // Required Items
                if let parts = manual.partsRequired, !parts.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Parts Required")
                            .font(.headline)

                        ForEach(parts, id: \.self) { part in
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text(part)
                            }
                        }
                    }
                    .padding()
                }

                if let tools = manual.toolsRequired, !tools.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Tools Required")
                            .font(.headline)

                        ForEach(tools, id: \.self) { tool in
                            HStack {
                                Image(systemName: "wrench.fill")
                                    .foregroundColor(.blue)
                                Text(tool)
                            }
                        }
                    }
                    .padding()
                }

                Divider()

                // Steps Preview
                VStack(alignment: .leading, spacing: 12) {
                    Text("Steps (\(manual.steps.count))")
                        .font(.headline)
                        .padding(.horizontal)

                    ForEach(manual.steps) { step in
                        StepPreviewRow(step: step)
                            .padding(.horizontal)
                    }
                }

                // Start AR Button
                NavigationLink(destination: ARSessionView(manual: manual)) {
                    HStack {
                        Image(systemName: "arkit")
                        Text("Start AR Guide")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .padding()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Step Preview Row

struct StepPreviewRow: View {
    let step: ManualStep

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Step Number
            Text("\(step.order)")
                .font(.headline)
                .frame(width: 32, height: 32)
                .background(Color.blue.opacity(0.1))
                .foregroundColor(.blue)
                .cornerRadius(16)

            // Step Info
            VStack(alignment: .leading, spacing: 4) {
                Text(step.title)
                    .font(.headline)

                Text(step.description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                if let time = step.estimatedTime {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                        Text("\(time) min")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }

            Spacer()
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
    }
}

#Preview {
    NavigationView {
        ManualDetailView(manual: mockManuals[0])
    }
}

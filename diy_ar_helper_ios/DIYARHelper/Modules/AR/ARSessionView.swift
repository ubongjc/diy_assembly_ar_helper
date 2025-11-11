import SwiftUI
import RealityKit
import ARKit

struct ARSessionView: View {
    let manual: Manual?
    @State private var currentStep = 0
    @State private var isPlaying = false
    @State private var showStepControls = true
    @Environment(\.dismiss) private var dismiss

    init(manual: Manual? = nil) {
        self.manual = manual
    }

    var body: some View {
        ZStack {
            // AR View
            ARViewContainer(manual: manual, currentStep: $currentStep)
                .edgesIgnoringSafeArea(.all)

            // Overlay Controls
            VStack {
                // Top Bar
                HStack {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .background(Circle().fill(Color.black.opacity(0.5)))
                    }

                    Spacer()

                    if let manual = manual {
                        Text("\(currentStep + 1) / \(manual.steps.count)")
                            .font(.headline)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.black.opacity(0.6))
                            .foregroundColor(.white)
                            .cornerRadius(20)
                    }

                    Spacer()

                    Button(action: { showStepControls.toggle() }) {
                        Image(systemName: showStepControls ? "eye.slash.fill" : "eye.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .background(Circle().fill(Color.black.opacity(0.5)))
                    }
                }
                .padding()

                Spacer()

                // Step Controls
                if showStepControls, let manual = manual {
                    VStack(spacing: 16) {
                        // Current Step Card
                        StepCard(step: manual.steps[currentStep])

                        // Navigation Controls
                        HStack(spacing: 20) {
                            Button(action: previousStep) {
                                Image(systemName: "chevron.left")
                                    .font(.title2)
                                    .frame(width: 50, height: 50)
                                    .background(Color.white)
                                    .foregroundColor(.blue)
                                    .cornerRadius(25)
                            }
                            .disabled(currentStep == 0)

                            Button(action: { isPlaying.toggle() }) {
                                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                                    .font(.title2)
                                    .frame(width: 60, height: 60)
                                    .background(Color.blue)
                                    .foregroundColor(.white)
                                    .cornerRadius(30)
                            }

                            Button(action: nextStep) {
                                Image(systemName: "chevron.right")
                                    .font(.title2)
                                    .frame(width: 50, height: 50)
                                    .background(Color.white)
                                    .foregroundColor(.blue)
                                    .cornerRadius(25)
                            }
                            .disabled(currentStep == manual.steps.count - 1)
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationBarHidden(true)
    }

    private func previousStep() {
        if currentStep > 0 {
            currentStep -= 1
        }
    }

    private func nextStep() {
        if let manual = manual, currentStep < manual.steps.count - 1 {
            currentStep += 1
        }
    }
}

// MARK: - Step Card

struct StepCard: View {
    let step: ManualStep

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Step \(step.order)")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)

                if let time = step.estimatedTime {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                        Text("\(time) min")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }

                Spacer()
            }

            Text(step.title)
                .font(.headline)

            Text(step.description)
                .font(.body)
                .foregroundColor(.secondary)

            if let warnings = step.warnings, !warnings.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(warnings, id: \.self) { warning in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            Text(warning)
                                .font(.caption)
                        }
                    }
                }
                .padding()
                .background(Color.orange.opacity(0.1))
                .cornerRadius(8)
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .shadow(radius: 10)
    }
}

// MARK: - AR View Container

struct ARViewContainer: UIViewRepresentable {
    let manual: Manual?
    @Binding var currentStep: Int

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero)

        // Configure AR session
        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal, .vertical]
        configuration.environmentTexturing = .automatic

        // Enable object detection if available
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            configuration.sceneReconstruction = .mesh
        }

        arView.session.run(configuration)

        // Add coaching overlay
        let coachingOverlay = ARCoachingOverlayView()
        coachingOverlay.session = arView.session
        coachingOverlay.goal = .horizontalPlane
        coachingOverlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        arView.addSubview(coachingOverlay)

        return arView
    }

    func updateUIView(_ uiView: ARView, context: Context) {
        // Update AR content based on current step
        // In production: add 3D models, annotations, hand placement hints, etc.
    }
}

#Preview {
    ARSessionView(manual: mockManuals[0])
}

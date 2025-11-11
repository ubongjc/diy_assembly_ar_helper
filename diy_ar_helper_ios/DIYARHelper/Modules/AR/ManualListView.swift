import SwiftUI

struct ManualListView: View {
    @EnvironmentObject var networkManager: NetworkManager
    @State private var manuals: [Manual] = []
    @State private var isLoading = false
    @State private var searchText = ""
    @State private var selectedCategory: String?

    let categories = ["All", "Electronics", "Furniture", "Automotive", "Appliances"]

    var filteredManuals: [Manual] {
        var filtered = manuals

        if let category = selectedCategory, category != "All" {
            filtered = filtered.filter { $0.category == category }
        }

        if !searchText.isEmpty {
            filtered = filtered.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                $0.brand.localizedCaseInsensitiveContains(searchText) ||
                $0.model.localizedCaseInsensitiveContains(searchText)
            }
        }

        return filtered
    }

    var body: some View {
        NavigationView {
            VStack {
                // Category Filter
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(categories, id: \.self) { category in
                            CategoryChip(
                                title: category,
                                isSelected: selectedCategory == category || (category == "All" && selectedCategory == nil)
                            ) {
                                selectedCategory = category == "All" ? nil : category
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical, 8)

                // Manual List
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if filteredManuals.isEmpty {
                    EmptyStateView()
                } else {
                    List(filteredManuals) { manual in
                        NavigationLink(destination: ManualDetailView(manual: manual)) {
                            ManualRowView(manual: manual)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Manuals")
            .searchable(text: $searchText, prompt: "Search manuals...")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        // Add manual
                    }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .task {
                await loadManuals()
            }
        }
    }

    private func loadManuals() async {
        isLoading = true
        defer { isLoading = false }

        // In production: fetch from API
        // For now, using mock data
        manuals = mockManuals
    }
}

// MARK: - Manual Row View

struct ManualRowView: View {
    let manual: Manual

    var body: some View {
        HStack(spacing: 16) {
            // Thumbnail
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.gray.opacity(0.2))
                .frame(width: 60, height: 60)
                .overlay(
                    Image(systemName: "book.fill")
                        .foregroundColor(.gray)
                )

            // Details
            VStack(alignment: .leading, spacing: 4) {
                Text(manual.title)
                    .font(.headline)
                    .lineLimit(1)

                Text("\(manual.brand) \(manual.model)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                HStack(spacing: 8) {
                    if let difficulty = manual.difficultyLevel {
                        DifficultyBadge(level: difficulty)
                    }

                    if let time = manual.estimatedTime {
                        HStack(spacing: 4) {
                            Image(systemName: "clock")
                            Text("\(time) min")
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }

                    if manual.isPro {
                        Text("PRO")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.orange)
                            .foregroundColor(.white)
                            .cornerRadius(4)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(.gray)
                .font(.caption)
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Category Chip

struct CategoryChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.blue : Color.gray.opacity(0.2))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}

// MARK: - Difficulty Badge

struct DifficultyBadge: View {
    let level: DifficultyLevel

    var color: Color {
        switch level {
        case .easy: return .green
        case .medium: return .orange
        case .hard: return .red
        }
    }

    var body: some View {
        Text(level.rawValue.capitalized)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.2))
            .foregroundColor(color)
            .cornerRadius(4)
    }
}

// MARK: - Empty State

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.closed")
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text("No manuals found")
                .font(.headline)

            Text("Add a manual or scan one to get started")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Mock Data

let mockManuals: [Manual] = [
    Manual(
        id: "1",
        userId: "user1",
        brand: "IKEA",
        model: "BILLY",
        category: "Furniture",
        title: "BILLY Bookcase Assembly",
        description: "Complete assembly guide for IKEA BILLY bookcase",
        steps: [],
        partsRequired: ["Screws", "Dowels", "Shelf pins"],
        toolsRequired: ["Phillips screwdriver", "Hammer"],
        estimatedTime: 45,
        difficultyLevel: .easy,
        isPublic: true,
        isPro: false,
        imageUrls: nil,
        createdAt: Date(),
        updatedAt: Date()
    )
]

#Preview {
    ManualListView()
        .environmentObject(NetworkManager())
}

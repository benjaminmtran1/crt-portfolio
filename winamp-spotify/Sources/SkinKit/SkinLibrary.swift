import Foundation

/// Discovers, loads and caches the skins available to the app.
///
/// Skins live in `~/Library/Application Support/WinampSpotify/Skins`. Anything
/// dropped in there — `.wsz`, `.wsp`, `.zip`, a `.wskin` bundle, or an unpacked
/// folder — is offered in the skin browser. Every skin is merged over the
/// built-in one so a partial skin still produces a complete window.
public final class SkinLibrary {

    public struct Entry: Identifiable, Sendable {
        public var id: String { url?.path ?? name }
        public var name: String
        public var url: URL?
        public var format: Skin.Format
        /// Set when a skin was found but failed to load, so the browser can
        /// show it greyed out with the reason instead of silently hiding it.
        public var loadError: String?

        public init(name: String, url: URL?, format: Skin.Format, loadError: String? = nil) {
            self.name = name
            self.url = url
            self.format = format
            self.loadError = loadError
        }

        public var isBuiltIn: Bool { url == nil }
    }

    public static let skinFileExtensions: Set<String> = ["wsz", "wsp", "zip", "wskin"]

    private let fileManager = FileManager.default
    private var cache: [String: Skin] = [:]
    private let baseSkin: Skin

    public private(set) var entries: [Entry] = []

    public init(baseSkin: Skin = DefaultSkin.make()) {
        self.baseSkin = baseSkin
        self.cache[Entry(name: baseSkin.metadata.name, url: nil, format: .modern).id] = baseSkin
    }

    // MARK: - Locations

    /// Where user-installed skins live. Created on first access.
    public var skinsDirectory: URL {
        let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? fileManager.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support")
        let directory = support
            .appendingPathComponent("WinampSpotify", isDirectory: true)
            .appendingPathComponent("Skins", isDirectory: true)
        if !fileManager.fileExists(atPath: directory.path) {
            try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        return directory
    }

    // MARK: - Discovery

    /// Rescans the skins directory plus any bundled skins.
    @discardableResult
    public func refresh(bundledSkinURLs: [URL] = []) -> [Entry] {
        var found: [Entry] = [
            Entry(name: baseSkin.metadata.name, url: nil, format: baseSkin.metadata.format)
        ]

        var candidates = bundledSkinURLs
        if let contents = try? fileManager.contentsOfDirectory(
            at: skinsDirectory,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) {
            candidates.append(contentsOf: contents)
        }

        for url in candidates {
            let ext = url.pathExtension.lowercased()
            let isDirectory = (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
            // A directory qualifies if it is a .wskin bundle or looks like an
            // unpacked classic skin.
            if !isDirectory && !Self.skinFileExtensions.contains(ext) { continue }
            if isDirectory && ext != "wskin" && !looksLikeUnpackedClassicSkin(url) { continue }

            found.append(Entry(
                name: url.deletingPathExtension().lastPathComponent,
                url: url,
                format: Self.probableFormat(of: url)
            ))
        }

        entries = found.sorted { lhs, rhs in
            if lhs.isBuiltIn != rhs.isBuiltIn { return lhs.isBuiltIn }
            return lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending
        }
        return entries
    }

    private func looksLikeUnpackedClassicSkin(_ url: URL) -> Bool {
        guard let contents = try? fileManager.contentsOfDirectory(atPath: url.path) else { return false }
        let lowered = Set(contents.map { $0.lowercased() })
        return lowered.contains("main.bmp") || lowered.contains("skin.json")
    }

    static func probableFormat(of url: URL) -> Skin.Format {
        url.pathExtension.lowercased() == "wskin" ? .modern : .classic
    }

    // MARK: - Loading

    /// Loads a skin, merged over the built-in one, and caches the result.
    ///
    /// Format detection does not trust the extension: people rename skins, and
    /// a `.zip` holding a `skin.json` is a modern skin regardless.
    public func skin(for entry: Entry) throws -> Skin {
        if let cached = cache[entry.id] { return cached }
        guard let url = entry.url else { return baseSkin }

        let loaded = try loadSkin(at: url)
        let merged = loaded.merged(over: baseSkin)
        cache[entry.id] = merged
        return merged
    }

    public func loadSkin(at url: URL) throws -> Skin {
        // Try the format the contents suggest first, then the other one; a
        // renamed skin should still load.
        let preferModern = try containsModernManifest(at: url)
        do {
            return preferModern
                ? try ModernSkinLoader.load(url: url)
                : try ClassicSkinLoader.load(url: url)
        } catch {
            do {
                return preferModern
                    ? try ClassicSkinLoader.load(url: url)
                    : try ModernSkinLoader.load(url: url)
            } catch {
                // Report the error from the format we actually expected — it is
                // the more useful of the two.
                throw error
            }
        }
    }

    private func containsModernManifest(at url: URL) throws -> Bool {
        let isDirectory = (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
        if isDirectory {
            return fileManager.fileExists(atPath: url.appendingPathComponent("skin.json").path)
        }
        guard let archive = try? ZipArchive(url: url) else { return false }
        return archive.contains("skin.json")
    }

    /// Copies a skin the user picked into the skins directory so it survives
    /// being moved out of Downloads.
    @discardableResult
    public func install(from url: URL) throws -> Entry {
        // Validate before copying: no point installing something unloadable.
        let skin = try loadSkin(at: url)

        let destination = skinsDirectory.appendingPathComponent(url.lastPathComponent)
        var target = destination
        var suffix = 2
        while fileManager.fileExists(atPath: target.path) {
            let base = destination.deletingPathExtension().lastPathComponent
            let ext = destination.pathExtension
            target = skinsDirectory.appendingPathComponent("\(base) \(suffix).\(ext)")
            suffix += 1
        }
        try fileManager.copyItem(at: url, to: target)

        let entry = Entry(
            name: target.deletingPathExtension().lastPathComponent,
            url: target,
            format: skin.metadata.format
        )
        cache[entry.id] = skin.merged(over: baseSkin)
        entries.append(entry)
        entries.sort { lhs, rhs in
            if lhs.isBuiltIn != rhs.isBuiltIn { return lhs.isBuiltIn }
            return lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending
        }
        return entry
    }

    public func remove(_ entry: Entry) throws {
        guard let url = entry.url else { return }
        try fileManager.removeItem(at: url)
        cache[entry.id] = nil
        entries.removeAll { $0.id == entry.id }
    }

    public var builtInEntry: Entry {
        Entry(name: baseSkin.metadata.name, url: nil, format: baseSkin.metadata.format)
    }
}

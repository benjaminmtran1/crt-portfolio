import AppKit
import ImageIO
import CryptoKit

/// Fetches and caches album and artist artwork.
///
/// Artwork is the one part of the media library that cannot be themed — it is
/// someone's album cover, not skin art. What it *can* do is sit inside a frame
/// the skin drew, which is what `ThemedChrome.artworkFrame` provides.
///
/// Caching is two-tier: an in-memory dictionary for the current session, and a
/// disk cache so reopening the library does not re-download a hundred
/// thumbnails. Both are bounded.
@MainActor
final class ArtworkLoader {

    static let shared = ArtworkLoader()

    private var memory: [URL: CGImage] = [:]
    private var inFlight: Set<URL> = []
    /// URLs that failed, so a broken image is not retried on every redraw.
    private var failed: Set<URL> = []
    private let session: URLSession
    private let diskDirectory: URL?

    /// Bumped when anything new lands. Views redraw from the `onLoad`
    /// callback; this is here so a caller can cheaply tell whether anything
    /// changed since it last looked.
    private(set) var generation = 0

    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.requestCachePolicy = .returnCacheDataElseLoad
        configuration.timeoutIntervalForRequest = 15
        self.session = URLSession(configuration: configuration)

        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
        self.diskDirectory = caches?.appendingPathComponent("WinampSpotify/Artwork", isDirectory: true)
        if let diskDirectory {
            try? FileManager.default.createDirectory(at: diskDirectory, withIntermediateDirectories: true)
        }
    }

    /// The image if it is already available. Otherwise starts a fetch and
    /// returns nil; `onLoad` fires when it arrives.
    func image(for url: URL?, onLoad: @escaping () -> Void) -> CGImage? {
        guard let url else { return nil }
        if let cached = memory[url] { return cached }
        guard !failed.contains(url), !inFlight.contains(url) else { return nil }

        inFlight.insert(url)
        Task { [weak self] in
            guard let self else { return }
            let image = await fetch(url)
            inFlight.remove(url)
            if let image {
                // Bounded: a long scroll through a big library would otherwise
                // hold every thumbnail it passed.
                if memory.count > 300 { memory.removeAll(keepingCapacity: true) }
                memory[url] = image
                generation += 1
                onLoad()
            } else {
                failed.insert(url)
            }
        }
        return nil
    }

    private func fetch(_ url: URL) async -> CGImage? {
        if let cached = readFromDisk(url) { return cached }
        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
                return nil
            }
            writeToDisk(data, for: url)
            return decode(data)
        } catch {
            return nil
        }
    }

    private func decode(_ data: Data) -> CGImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        // Thumbnails are drawn at 60-160px; decoding the full 640px cover and
        // downsampling on every draw is wasted work.
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: 320,
            kCGImageSourceCreateThumbnailWithTransform: true,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
            ?? CGImageSourceCreateImageAtIndex(source, 0, nil)
    }

    // MARK: - Disk cache

    /// Filename is a hash of the URL: Spotify's CDN paths are long and contain
    /// characters that are awkward in a filename.
    private func diskURL(for url: URL) -> URL? {
        guard let diskDirectory else { return nil }
        let digest = SHA256.hash(data: Data(url.absoluteString.utf8))
        let name = digest.map { String(format: "%02x", $0) }.joined()
        return diskDirectory.appendingPathComponent(name).appendingPathExtension("img")
    }

    private func readFromDisk(_ url: URL) -> CGImage? {
        guard let path = diskURL(for: url),
              let data = try? Data(contentsOf: path) else { return nil }
        return decode(data)
    }

    private func writeToDisk(_ data: Data, for url: URL) {
        guard let path = diskURL(for: url) else { return }
        try? data.write(to: path, options: .atomic)
    }

    /// Clears both tiers. Offered in preferences, because an artwork cache is
    /// the kind of thing people want to be able to delete.
    func clearCache() {
        memory.removeAll()
        failed.removeAll()
        if let diskDirectory {
            try? FileManager.default.removeItem(at: diskDirectory)
            try? FileManager.default.createDirectory(at: diskDirectory, withIntermediateDirectories: true)
        }
        generation += 1
    }
}

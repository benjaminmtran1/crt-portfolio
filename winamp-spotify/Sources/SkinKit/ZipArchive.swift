import Foundation
import Compression

/// Minimal, dependency-free ZIP reader.
///
/// Classic Winamp skins (`.wsz`, `.wsp`) are plain ZIP archives, and the modern
/// `.wskin` format is one too. Foundation has no public ZIP API, so we parse the
/// central directory by hand and inflate entries with the `Compression`
/// framework (`COMPRESSION_ZLIB` is raw DEFLATE, which is exactly what ZIP
/// stores).
///
/// Only the two storage methods that occur in practice are supported: stored
/// (0) and deflate (8).
public struct ZipArchive {

    public struct Entry {
        public let path: String
        public let compressedSize: Int
        public let uncompressedSize: Int
        public let compressionMethod: UInt16
        /// Offset of the *local* file header, from the central directory.
        let localHeaderOffset: Int
    }

    public enum Error: Swift.Error, LocalizedError {
        case notAZipArchive
        case truncated
        case unsupportedCompression(UInt16)
        case inflateFailed(String)
        case entryNotFound(String)

        public var errorDescription: String? {
            switch self {
            case .notAZipArchive:
                return "This file is not a ZIP archive (no end-of-central-directory record)."
            case .truncated:
                return "The archive is truncated or corrupt."
            case .unsupportedCompression(let method):
                return "Unsupported ZIP compression method \(method); only stored and deflate are handled."
            case .inflateFailed(let path):
                return "Failed to decompress \(path)."
            case .entryNotFound(let path):
                return "No entry named \(path) in the archive."
            }
        }
    }

    private let data: Data
    public let entries: [Entry]

    /// Entry lookup keyed by lowercased basename. Classic skins are wildly
    /// inconsistent about case (`MAIN.BMP`, `Main.bmp`, `main.bmp`) and some are
    /// packed with a containing folder, so basename matching is what actually
    /// works in the wild.
    private let byLowercasedName: [String: Entry]

    public init(data: Data) throws {
        self.data = data
        self.entries = try Self.readCentralDirectory(data)
        var index: [String: Entry] = [:]
        for entry in entries {
            let name = (entry.path as NSString).lastPathComponent.lowercased()
            guard !name.isEmpty else { continue }
            // A shallower path wins, so a stray nested duplicate can't shadow
            // the real asset at the archive root.
            let depth = entry.path.filter { $0 == "/" }.count
            if let existing = index[name], existing.path.filter({ $0 == "/" }).count <= depth {
                continue
            }
            index[name] = entry
        }
        self.byLowercasedName = index
    }

    public init(url: URL) throws {
        try self.init(data: try Data(contentsOf: url, options: .mappedIfSafe))
    }

    // MARK: - Lookup

    public func contains(_ name: String) -> Bool {
        byLowercasedName[name.lowercased()] != nil
    }

    /// All entry basenames, lowercased. Useful for sniffing what a skin provides.
    public var fileNames: [String] { Array(byLowercasedName.keys) }

    /// Reads an entry by basename, case-insensitively. Returns nil if absent —
    /// missing sprite sheets are normal in classic skins and the loader falls
    /// back to the default skin for those.
    public func contents(of name: String) throws -> Data? {
        guard let entry = byLowercasedName[name.lowercased()] else { return nil }
        return try read(entry)
    }

    public func requireContents(of name: String) throws -> Data {
        guard let data = try contents(of: name) else { throw Error.entryNotFound(name) }
        return data
    }

    // MARK: - Reading

    public func read(_ entry: Entry) throws -> Data {
        // Re-read the compressed size from the local header region rather than
        // trusting a streamed entry's zeroed local fields; the central
        // directory is authoritative, we only need the local header's length to
        // find where the payload starts.
        let base = entry.localHeaderOffset
        guard base + 30 <= data.count else { throw Error.truncated }
        guard data.u32(at: base) == 0x0403_4b50 else { throw Error.truncated }
        let nameLength = Int(data.u16(at: base + 26))
        let extraLength = Int(data.u16(at: base + 28))
        let payloadStart = base + 30 + nameLength + extraLength
        let payloadEnd = payloadStart + entry.compressedSize
        guard payloadEnd <= data.count else { throw Error.truncated }

        let payload = data.subdata(in: payloadStart ..< payloadEnd)

        switch entry.compressionMethod {
        case 0:
            return payload
        case 8:
            if entry.uncompressedSize == 0 { return Data() }
            return try Self.inflate(payload, expectedSize: entry.uncompressedSize, path: entry.path)
        default:
            throw Error.unsupportedCompression(entry.compressionMethod)
        }
    }

    private static func inflate(_ payload: Data, expectedSize: Int, path: String) throws -> Data {
        var output = Data(count: expectedSize)
        let written: Int = output.withUnsafeMutableBytes { outBuffer in
            payload.withUnsafeBytes { inBuffer -> Int in
                guard let outBase = outBuffer.bindMemory(to: UInt8.self).baseAddress,
                      let inBase = inBuffer.bindMemory(to: UInt8.self).baseAddress else { return 0 }
                return compression_decode_buffer(
                    outBase, expectedSize,
                    inBase, payload.count,
                    nil, COMPRESSION_ZLIB
                )
            }
        }
        guard written == expectedSize else { throw Error.inflateFailed(path) }
        return output
    }

    // MARK: - Central directory

    private static func readCentralDirectory(_ data: Data) throws -> [Entry] {
        guard data.count >= 22 else { throw Error.notAZipArchive }

        // Scan backwards for the end-of-central-directory signature. The
        // trailing comment can be up to 64 KiB, so bound the search there.
        let searchFloor = max(0, data.count - 22 - 65_535)
        var eocd: Int?
        var cursor = data.count - 22
        while cursor >= searchFloor {
            if data.u32(at: cursor) == 0x0605_4b50 { eocd = cursor; break }
            cursor -= 1
        }
        guard let eocd else { throw Error.notAZipArchive }

        let entryCount = Int(data.u16(at: eocd + 10))
        let directoryOffset = Int(data.u32(at: eocd + 16))
        guard directoryOffset < data.count else { throw Error.truncated }

        var entries: [Entry] = []
        entries.reserveCapacity(entryCount)
        var offset = directoryOffset
        for _ in 0 ..< entryCount {
            guard offset + 46 <= data.count else { throw Error.truncated }
            guard data.u32(at: offset) == 0x0201_4b50 else { throw Error.truncated }

            let method = data.u16(at: offset + 10)
            let compressedSize = Int(data.u32(at: offset + 20))
            let uncompressedSize = Int(data.u32(at: offset + 24))
            let nameLength = Int(data.u16(at: offset + 28))
            let extraLength = Int(data.u16(at: offset + 30))
            let commentLength = Int(data.u16(at: offset + 32))
            let localOffset = Int(data.u32(at: offset + 42))

            let nameStart = offset + 46
            guard nameStart + nameLength <= data.count else { throw Error.truncated }
            let nameData = data.subdata(in: nameStart ..< nameStart + nameLength)
            // Skin archives predate UTF-8 flags; fall back to Latin-1 so
            // non-ASCII filenames at least round-trip to something usable.
            let path = String(data: nameData, encoding: .utf8)
                ?? String(data: nameData, encoding: .isoLatin1)
                ?? ""

            // Directories carry a trailing separator and no payload.
            if !path.hasSuffix("/") && !path.isEmpty {
                entries.append(Entry(
                    path: path,
                    compressedSize: compressedSize,
                    uncompressedSize: uncompressedSize,
                    compressionMethod: method,
                    localHeaderOffset: localOffset
                ))
            }

            offset = nameStart + nameLength + extraLength + commentLength
        }
        return entries
    }
}

// MARK: - Little-endian scalar reads

extension Data {
    fileprivate func u16(at offset: Int) -> UInt16 {
        guard offset + 2 <= count else { return 0 }
        let base = startIndex + offset
        return UInt16(self[base]) | UInt16(self[base + 1]) << 8
    }

    fileprivate func u32(at offset: Int) -> UInt32 {
        guard offset + 4 <= count else { return 0 }
        let base = startIndex + offset
        return UInt32(self[base])
            | UInt32(self[base + 1]) << 8
            | UInt32(self[base + 2]) << 16
            | UInt32(self[base + 3]) << 24
    }
}

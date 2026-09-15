import Foundation

/// Loads a Winamp 2.x skin: a `.wsz` / `.wsp` archive (or an unpacked folder)
/// of BMP sheets plus a few text config files.
///
/// Missing files are not errors. A skin that only replaces `main.bmp` is
/// legitimate and common, so anything absent is simply left out of the result
/// and filled in by `Skin.merged(over:)` against the base skin.
public enum ClassicSkinLoader {

    public enum Error: Swift.Error, LocalizedError {
        case noSpriteSheets(String)

        public var errorDescription: String? {
            switch self {
            case .noSpriteSheets(let name):
                return "\"\(name)\" does not contain any Winamp skin bitmaps."
            }
        }
    }

    /// A source of skin files: either a zip archive or a directory on disk.
    /// Unpacked skin folders are common once someone has been editing one.
    enum Source {
        case archive(ZipArchive)
        case directory(URL)

        func data(named name: String) throws -> Data? {
            switch self {
            case .archive(let archive):
                return try archive.contents(of: name)
            case .directory(let url):
                // Match case-insensitively, the same as the archive path does.
                let target = name.lowercased()
                let contents = try FileManager.default.contentsOfDirectory(
                    at: url, includingPropertiesForKeys: nil
                )
                guard let match = contents.first(where: { $0.lastPathComponent.lowercased() == target })
                else { return nil }
                return try Data(contentsOf: match)
            }
        }
    }

    public static func load(url: URL) throws -> Skin {
        let isDirectory = (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
        let source: Source = isDirectory ? .directory(url) : .archive(try ZipArchive(url: url))
        let name = url.deletingPathExtension().lastPathComponent
        return try load(source: source, name: name, sourceURL: url)
    }

    public static func load(data: Data, name: String) throws -> Skin {
        try load(source: .archive(try ZipArchive(data: data)), name: name, sourceURL: nil)
    }

    static func load(source: Source, name: String, sourceURL: URL?) throws -> Skin {

        // MARK: Decode the sheets we can find

        var sheets: [String: RasterImage] = [:]
        for sheetName in ClassicSpriteTable.sheetNames {
            guard let data = try source.data(named: sheetName) else { continue }
            guard let image = RasterImage.decode(data) else { continue }
            sheets[sheetName] = image
        }
        guard !sheets.isEmpty else { throw Error.noSpriteSheets(name) }

        // MARK: Slice the named sprites

        var sprites: [SpriteID: RasterImage] = [:]
        for (id, reference) in ClassicSpriteTable.sprites {
            guard let sheet = sheets[reference.sheet] else { continue }
            let rect = reference.rect
            // Skip sprites that fall entirely outside a sheet: some skins ship
            // truncated sheets, and a blank sprite is worse than inheriting the
            // base skin's version.
            guard rect.x < sheet.width, rect.y < sheet.height else { continue }
            let cropped = sheet.cropped(x: rect.x, y: rect.y, width: rect.width, height: rect.height)
            sprites[id] = cropped
        }

        // MARK: Slice the frame strips

        var strips: [SpriteStripID: [RasterImage]] = [:]

        if let volume = sheets["volume.bmp"] {
            strips[.volumeBackground] = sliderFrames(from: volume, using: ClassicSpriteTable.volumeFrame)
        }
        if let balance = sheets["balance.bmp"] {
            strips[.balanceBackground] = sliderFrames(from: balance, using: ClassicSpriteTable.balanceFrame)
        } else if let volume = sheets["volume.bmp"] {
            // Skins routinely omit balance.bmp and Winamp falls back to the
            // volume strip, narrowed to the balance slider's width.
            strips[.balanceBackground] = sliderFrames(from: volume, using: ClassicSpriteTable.balanceFrame)
        }

        // nums_ex.bmp is preferred: it carries the extra blank glyph the time
        // display needs when nothing is playing.
        if let numbers = sheets["nums_ex.bmp"] ?? sheets["numbers.bmp"] {
            let frameCount = numbers.width >= 108 ? 11 : 10
            strips[.digits] = (0 ..< frameCount).map { index in
                let rect = ClassicSpriteTable.digitFrame(index)
                return numbers.cropped(x: rect.x, y: rect.y, width: rect.width, height: rect.height)
            }
        }

        var fontColumns = 31
        if let text = sheets["text.bmp"] {
            strips[.font] = fontGlyphs(from: text)
            // Almost every sheet is 155px wide (31 glyphs), but read it off the
            // asset so an oversized sheet still indexes correctly.
            fontColumns = max(1, text.width / BitmapFontLayout.glyphWidth)
        }

        // MARK: Text configuration

        var playlistStyle = PlaylistStyle.default
        if let data = try source.data(named: "pledit.txt"), let string = decodeText(data) {
            playlistStyle = PlaylistStyle.parse(string)
        }

        var palette = VisualizerPalette.default
        if let data = try source.data(named: "viscolor.txt"), let string = decodeText(data) {
            palette = VisualizerPalette.parse(string)
        }

        var regions: [String: SkinRegion] = [:]
        if let data = try source.data(named: "region.txt"), let string = decodeText(data) {
            regions = SkinRegion.parse(string)
        }

        var skin = Skin(
            metadata: Skin.Metadata(
                name: name,
                author: nil,
                format: .classic,
                sourceURL: sourceURL
            ),
            layout: .classic,
            assetScale: 1,
            sprites: sprites,
            strips: strips,
            playlistStyle: playlistStyle,
            visualizerPalette: palette,
            regions: regions
        )
        skin.fontColumns = fontColumns
        skin.measureFontBackground()
        // Derived here rather than lazily: sampling the faceplate is a
        // one-time cost and callers treat `Skin` as a plain value.
        skin.theme = SkinThemeDerivation.derive(from: skin)
        return skin
    }

    // MARK: - Slicing helpers

    private static func sliderFrames(
        from sheet: RasterImage,
        using frame: (Int) -> PixelRect
    ) -> [RasterImage] {
        (0 ..< ClassicSpriteTable.sliderFrameCount).compactMap { index in
            let rect = frame(index)
            guard rect.y < sheet.height else { return nil }
            return sheet.cropped(x: rect.x, y: rect.y, width: rect.width, height: rect.height)
        }
    }

    /// Slices `text.bmp` into a flat grid of 5x6 glyphs in reading order.
    private static func fontGlyphs(from sheet: RasterImage) -> [RasterImage] {
        let width = BitmapFontLayout.glyphWidth
        let height = BitmapFontLayout.glyphHeight
        let columns = max(1, sheet.width / width)
        let rows = max(1, sheet.height / height)
        var glyphs: [RasterImage] = []
        glyphs.reserveCapacity(columns * rows)
        for row in 0 ..< rows {
            for column in 0 ..< columns {
                glyphs.append(sheet.cropped(
                    x: column * width,
                    y: row * height,
                    width: width,
                    height: height
                ))
            }
        }
        return glyphs
    }

    /// Skin text files are ancient: mostly ASCII, sometimes Windows-1252.
    private static func decodeText(_ data: Data) -> String? {
        String(data: data, encoding: .utf8)
            ?? String(data: data, encoding: .windowsCP1252)
            ?? String(data: data, encoding: .isoLatin1)
    }
}

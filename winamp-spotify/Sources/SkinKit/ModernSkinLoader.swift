import Foundation

/// Loads a modern `.wskin` skin: a folder or zip holding `skin.json` plus
/// PNG (or any ImageIO-readable) sheets.
public enum ModernSkinLoader {

    public enum Error: Swift.Error, LocalizedError {
        case missingManifest
        case unsupportedFormat(String)
        case unsupportedVersion(Int)
        case missingSheet(String)

        public var errorDescription: String? {
            switch self {
            case .missingManifest:
                return "This skin has no skin.json at its root."
            case .unsupportedFormat(let format):
                return "Unrecognised skin format \"\(format)\"."
            case .unsupportedVersion(let version):
                return "This skin needs version \(version) of the skin format; this build reads version \(ModernSkinManifest.currentVersion)."
            case .missingSheet(let name):
                return "The skin references a sheet named \"\(name)\" that is not in the bundle."
            }
        }
    }

    public static func load(url: URL) throws -> Skin {
        let isDirectory = (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
        let source: ClassicSkinLoader.Source = isDirectory
            ? .directory(url)
            : .archive(try ZipArchive(url: url))
        return try load(source: source, sourceURL: url)
    }

    static func load(source: ClassicSkinLoader.Source, sourceURL: URL?) throws -> Skin {
        guard let manifestData = try source.data(named: "skin.json") else {
            throw Error.missingManifest
        }
        let manifest = try JSONDecoder().decode(ModernSkinManifest.self, from: manifestData)
        guard manifest.format == ModernSkinManifest.formatIdentifier else {
            throw Error.unsupportedFormat(manifest.format)
        }
        guard manifest.version <= ModernSkinManifest.currentVersion else {
            throw Error.unsupportedVersion(manifest.version)
        }

        // MARK: Load sheets

        let key = manifest.transparentColor.flatMap { SkinColor(parsing: $0) }
        var sheets: [String: RasterImage] = [:]
        for (logicalName, fileName) in manifest.sheets {
            guard let data = try source.data(named: fileName) else {
                throw Error.missingSheet(fileName)
            }
            guard var image = RasterImage.decode(data) else {
                throw Error.missingSheet(fileName)
            }
            if let key { image = image.keyingOut(r: key.r, g: key.g, b: key.b) }
            sheets[logicalName] = image
        }

        // MARK: Sprites

        var sprites: [SpriteID: RasterImage] = [:]
        for (id, rect) in manifest.sprites ?? [:] {
            guard let sheet = sheets[rect.sheet] else { throw Error.missingSheet(rect.sheet) }
            sprites[id] = sheet.cropped(x: rect.x, y: rect.y, width: rect.width, height: rect.height)
        }

        // MARK: Strips

        var strips: [SpriteStripID: [RasterImage]] = [:]
        var fontColumns = 31
        for (id, strip) in manifest.strips ?? [:] {
            guard let sheet = sheets[strip.sheet] else { throw Error.missingSheet(strip.sheet) }
            let columns = strip.columns ?? strip.count
            var frames: [RasterImage] = []
            frames.reserveCapacity(strip.count)
            for index in 0 ..< max(0, strip.count) {
                let column = columns > 0 ? index % columns : index
                let row = columns > 0 ? index / columns : 0
                // A strip is either a single run (stepX/stepY) or a grid
                // (columns set, advancing by frame size).
                let x: Int
                let y: Int
                if let stepY = strip.stepY, strip.columns == nil {
                    x = strip.x
                    y = strip.y + index * stepY
                } else if let stepX = strip.stepX, strip.columns == nil {
                    x = strip.x + index * stepX
                    y = strip.y
                } else {
                    x = strip.x + column * (strip.stepX ?? strip.width)
                    y = strip.y + row * (strip.stepY ?? strip.height)
                }
                frames.append(sheet.cropped(x: x, y: y, width: strip.width, height: strip.height))
            }
            strips[id] = frames
            if id == .font { fontColumns = max(1, columns) }
        }

        // MARK: Colours, layout, regions

        var playlistStyle = PlaylistStyle.default
        if let colors = manifest.playlist {
            playlistStyle.normalText = colors.normalText.flatMap(SkinColor.init(parsing:)) ?? playlistStyle.normalText
            playlistStyle.currentText = colors.currentText.flatMap(SkinColor.init(parsing:)) ?? playlistStyle.currentText
            playlistStyle.background = colors.background.flatMap(SkinColor.init(parsing:)) ?? playlistStyle.background
            playlistStyle.selectedBackground = colors.selectedBackground.flatMap(SkinColor.init(parsing:)) ?? playlistStyle.selectedBackground
            playlistStyle.fontName = colors.fontName ?? playlistStyle.fontName
        }

        var palette = VisualizerPalette.default
        if let hexColors = manifest.visualizerColors {
            palette = VisualizerPalette(colors: hexColors.compactMap(SkinColor.init(parsing:)))
        }

        var regions: [String: SkinRegion] = [:]
        for (name, polygons) in manifest.regions ?? [:] {
            // Each polygon is a flat x,y stream, same shape as region.txt.
            let parsed: [[SkinRegion.Point]] = polygons.map { flat in
                stride(from: 0, to: flat.count - 1, by: 2).map {
                    SkinRegion.Point(x: flat[$0], y: flat[$0 + 1])
                }
            }.filter { $0.count >= 3 }
            if !parsed.isEmpty { regions[name.lowercased()] = SkinRegion(polygons: parsed) }
        }

        var skin = Skin(
            metadata: Skin.Metadata(
                name: manifest.name,
                author: manifest.author,
                format: .modern,
                sourceURL: sourceURL
            ),
            layout: manifest.layout ?? .classic,
            assetScale: max(1, manifest.assetScale ?? 1),
            sprites: sprites,
            strips: strips,
            playlistStyle: playlistStyle,
            visualizerPalette: palette,
            regions: regions
        )
        skin.fontColumns = fontColumns
        return skin
    }
}

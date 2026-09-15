import Foundation

/// A fully loaded skin: every sprite sliced out, every colour resolved, ready
/// for the renderer to blit.
///
/// Both skin formats produce this same type, which is the whole point — the
/// renderer never branches on where a skin came from. A classic `.wsz` is
/// interpreted through `ClassicSpriteTable`; a modern `.wskin` declares its own
/// sprite rectangles in a manifest. After loading they are indistinguishable.
public struct Skin: Sendable {

    public enum Format: String, Codable, Sendable {
        /// Winamp 2.x `.wsz` / `.wsp` archive of BMP sheets.
        case classic
        /// This app's `.wskin`: a JSON manifest plus PNG sheets.
        case modern
    }

    public struct Metadata: Sendable {
        public var name: String
        public var author: String?
        public var format: Format
        /// Where the skin was loaded from, for the skin browser.
        public var sourceURL: URL?

        public init(name: String, author: String? = nil, format: Format, sourceURL: URL? = nil) {
            self.name = name
            self.author = author
            self.format = format
            self.sourceURL = sourceURL
        }
    }

    public var metadata: Metadata
    public var layout: SkinLayout

    /// How many asset pixels make up one layout pixel. Classic skins are
    /// always 1; a modern skin can ship 2x or 3x art and stay crisp.
    public var assetScale: Int

    public var sprites: [SpriteID: RasterImage]
    public var strips: [SpriteStripID: [RasterImage]]

    public var playlistStyle: PlaylistStyle
    public var visualizerPalette: VisualizerPalette
    /// Keyed by lowercased `region.txt` section name: `normal`, `windowshade`.
    public var regions: [String: SkinRegion]

    /// Number of glyph columns in the font sheet; classic sheets are 31 wide.
    public var fontColumns: Int = 31

    /// Luminance of the font sheet's background, so glyphs can be re-coloured.
    ///
    /// A classic `text.bmp` bakes its colour in. The media library needs the
    /// same glyphs in the derived theme's colours, and tinting needs to know
    /// which tone is "off". Computed at load; see `measureFontBackground()`.
    public var fontBackgroundLuminance: Double = 0

    /// Palette for the parts of the app the skin has no sprites for — the media
    /// library, chiefly. A modern skin may declare one; for everything else the
    /// loader derives it from the faceplate and the text configs. Read it
    /// through `effectiveTheme`, which falls back to deriving on demand.
    public var theme: SkinTheme?

    public init(
        metadata: Metadata,
        layout: SkinLayout = .classic,
        assetScale: Int = 1,
        sprites: [SpriteID: RasterImage] = [:],
        strips: [SpriteStripID: [RasterImage]] = [:],
        playlistStyle: PlaylistStyle = .default,
        visualizerPalette: VisualizerPalette = .default,
        regions: [String: SkinRegion] = [:],
        theme: SkinTheme? = nil
    ) {
        self.metadata = metadata
        self.layout = layout
        self.assetScale = assetScale
        self.sprites = sprites
        self.strips = strips
        self.playlistStyle = playlistStyle
        self.visualizerPalette = visualizerPalette
        self.regions = regions
        self.theme = theme
    }

    // MARK: - Sprite access

    /// A sprite, or nil when the skin omits it.
    ///
    /// Partial skins are the norm — a skin that only re-themes the main window
    /// is perfectly valid — so callers are expected to fall back. `SkinLibrary`
    /// does that automatically by merging over the base skin at load time.
    public func sprite(_ id: SpriteID) -> RasterImage? {
        sprites[id]
    }

    public func strip(_ id: SpriteStripID) -> [RasterImage] {
        strips[id] ?? []
    }

    /// Volume/balance backgrounds, clamped to the frames the skin actually has.
    public func sliderFrame(_ id: SpriteStripID, forValue value: Double) -> RasterImage? {
        let frames = strip(id)
        guard !frames.isEmpty else { return nil }
        let clamped = min(max(value, 0), 1)
        let index = Int((clamped * Double(frames.count - 1)).rounded())
        return frames[index]
    }

    public func digit(_ value: Int) -> RasterImage? {
        let frames = strip(.digits)
        guard value >= 0, value < frames.count else { return nil }
        return frames[value]
    }

    /// The blank glyph for the time display. `nums_ex.bmp` provides an 11th
    /// frame for it; plain `numbers.bmp` skins get nothing and the renderer
    /// leaves the slot empty.
    public var blankDigit: RasterImage? {
        let frames = strip(.digits)
        return frames.count > 10 ? frames[10] : nil
    }

    public func glyph(for character: Character) -> RasterImage? {
        let frames = strip(.font)
        guard !frames.isEmpty else { return nil }
        let rect = BitmapFontLayout.rect(for: character)
        // The font strip is stored as a flat grid in reading order.
        let columns = max(1, fontColumns)
        let column = rect.x / BitmapFontLayout.glyphWidth
        let row = rect.y / BitmapFontLayout.glyphHeight
        let index = row * columns + column
        guard index >= 0, index < frames.count else { return nil }
        return frames[index]
    }

    // MARK: - Merging

    /// Overlays `self` on top of `base`, so a skin that ships only `main.bmp`
    /// still gets working buttons and digits.
    public func merged(over base: Skin) -> Skin {
        var result = base
        result.metadata = metadata
        result.layout = layout
        result.assetScale = assetScale
        result.fontColumns = fontColumns
        result.fontBackgroundLuminance = fontBackgroundLuminance
        result.sprites.merge(sprites) { _, new in new }
        for (id, frames) in strips where !frames.isEmpty {
            result.strips[id] = frames
        }
        if playlistStyle != .default { result.playlistStyle = playlistStyle }
        if visualizerPalette != .default { result.visualizerPalette = visualizerPalette }
        if !regions.isEmpty { result.regions = regions }
        // Derive from the merged skin, not from `self`: a partial skin that
        // ships no main.bmp should still be sampled against the faceplate it
        // will actually be drawn with.
        result.theme = theme ?? SkinThemeDerivation.derive(from: result)
        return result
    }

    /// True when the skin has enough to draw a main window on its own.
    public var isRenderable: Bool {
        sprites[.mainBackground] != nil
    }

    /// Estimates the font sheet's background tone.
    ///
    /// Glyphs are sparse — a 5x6 cell is mostly empty — so the mean luminance
    /// across the whole sheet sits close to the background rather than to the
    /// ink. That is good enough to tint against, and far more robust than
    /// sampling a corner pixel, which some sheets leave as stray ink.
    public mutating func measureFontBackground() {
        let glyphs = strip(.font)
        guard !glyphs.isEmpty else {
            fontBackgroundLuminance = 0
            return
        }
        // A sample of the sheet is plenty and keeps skin loading quick.
        let sampled = glyphs.prefix(40)
        let total = sampled.reduce(0.0) { $0 + $1.meanLuminance }
        fontBackgroundLuminance = total / Double(sampled.count)
    }
}

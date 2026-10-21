import Foundation

/// The `skin.json` at the root of a modern `.wskin` skin.
///
/// The modern format exists because the classic one is a straitjacket: fixed
/// 275x116 geometry, 1x art, sprite rectangles hard-coded since 1997. Here the
/// skin declares its own sprite rectangles and, optionally, its own layout — so
/// it can ship retina art and move controls — while still resolving to the same
/// `Skin` the renderer already knows how to draw.
///
/// Every field except `name` and `sheets` is optional, and anything omitted
/// falls back to the classic layout and the base skin's sprites.
public struct ModernSkinManifest: Codable, Sendable {

    public static let formatIdentifier = "winamp-spotify-skin"
    public static let currentVersion = 1

    /// A rectangle in *asset* pixels within a named sheet.
    public struct SpriteRect: Codable, Sendable {
        public var sheet: String
        public var x: Int
        public var y: Int
        public var width: Int
        public var height: Int
    }

    /// A run of equally spaced frames — volume strips, digit rows, font grids.
    public struct StripRect: Codable, Sendable {
        public var sheet: String
        public var x: Int
        public var y: Int
        public var width: Int
        public var height: Int
        public var count: Int
        /// Distance between successive frames. Exactly one of these is used;
        /// `stepY` wins when both are given.
        public var stepX: Int?
        public var stepY: Int?
        /// For grid-shaped strips such as the bitmap font: frames per row.
        public var columns: Int?
    }

    /// Overrides for the generated-widget palette. Every field is optional and
    /// overlays the theme derived from the skin's own art, so a manifest can
    /// correct one colour without restating all fifteen.
    public struct ThemeColors: Codable, Sendable {
        public var faceBase: String?
        public var faceHighlight: String?
        public var faceShadow: String?
        public var bevelLight: String?
        public var bevelDark: String?
        public var faceText: String?
        public var faceTextDim: String?
        public var displayBackground: String?
        public var displayText: String?
        public var displayDim: String?
        public var listBackground: String?
        public var listText: String?
        public var listAlternate: String?
        public var selectionBackground: String?
        public var selectionText: String?
        public var accent: String?
        public var accentText: String?
        public var listFontName: String?
    }

    public struct PlaylistColors: Codable, Sendable {
        public var normalText: String?
        public var currentText: String?
        public var background: String?
        public var selectedBackground: String?
        public var fontName: String?
    }

    public var format: String
    public var version: Int
    public var name: String
    public var author: String?

    /// Asset pixels per layout pixel. 2 for retina art on a classic layout.
    public var assetScale: Int?

    /// Logical sheet name -> file name inside the skin.
    public var sheets: [String: String]

    public var sprites: [SpriteID: SpriteRect]?
    public var strips: [SpriteStripID: StripRect]?

    public var layout: SkinLayout?
    public var playlist: PlaylistColors?
    /// 24 hex colours, in `viscolor.txt` order.
    public var visualizerColors: [String]?
    /// Window shapes in layout pixels, keyed `normal` / `windowshade`.
    public var regions: [String: [[Int]]]?

    /// Chroma key applied to every sheet, as a hex colour. Useful when
    /// converting classic art that relied on magenta.
    public var transparentColor: String?

    /// Palette for the media library and anything else drawn rather than
    /// blitted. Omit it and one is derived from the skin's own artwork.
    public var theme: ThemeColors?

    public init(
        format: String = ModernSkinManifest.formatIdentifier,
        version: Int = ModernSkinManifest.currentVersion,
        name: String,
        author: String? = nil,
        assetScale: Int? = nil,
        sheets: [String: String],
        sprites: [SpriteID: SpriteRect]? = nil,
        strips: [SpriteStripID: StripRect]? = nil,
        layout: SkinLayout? = nil,
        playlist: PlaylistColors? = nil,
        visualizerColors: [String]? = nil,
        regions: [String: [[Int]]]? = nil,
        transparentColor: String? = nil,
        theme: ThemeColors? = nil
    ) {
        self.format = format
        self.version = version
        self.name = name
        self.author = author
        self.assetScale = assetScale
        self.sheets = sheets
        self.sprites = sprites
        self.strips = strips
        self.layout = layout
        self.playlist = playlist
        self.visualizerColors = visualizerColors
        self.regions = regions
        self.transparentColor = transparentColor
        self.theme = theme
    }
}

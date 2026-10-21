import Foundation

/// An integer pixel rectangle. Skin work is all exact pixel arithmetic, and
/// keeping it out of `CGRect`'s floating point avoids a class of half-pixel
/// bugs that show up as seams between tiled sprites.
public struct PixelRect: Equatable, Codable, Sendable {
    public var x: Int
    public var y: Int
    public var width: Int
    public var height: Int

    public init(x: Int, y: Int, width: Int, height: Int) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }

    public static let zero = PixelRect(x: 0, y: 0, width: 0, height: 0)

    public var maxX: Int { x + width }
    public var maxY: Int { y + height }

    public func contains(x px: Int, y py: Int) -> Bool {
        px >= x && py >= y && px < maxX && py < maxY
    }

    public func offsetBy(dx: Int, dy: Int) -> PixelRect {
        PixelRect(x: x + dx, y: y + dy, width: width, height: height)
    }

    /// Scales by an integer factor — the only scaling a pixel-art skin should
    /// ever see, so that "double size" mode stays crisp.
    public func scaled(by factor: Int) -> PixelRect {
        PixelRect(x: x * factor, y: y * factor, width: width * factor, height: height * factor)
    }
}

/// A named position in a window's layout. Where `SpriteID` says *what* to draw,
/// this says *where*, which is what lets a modern skin reposition controls while
/// reusing the same renderer.
public enum LayoutSlot: String, CaseIterable, Codable, Sendable {
    case titleBar = "TITLE_BAR"
    case buttonMenu = "BUTTON_MENU"
    case buttonMinimize = "BUTTON_MINIMIZE"
    case buttonShade = "BUTTON_SHADE"
    case buttonClose = "BUTTON_CLOSE"
    case clutterBar = "CLUTTER_BAR"

    case statusIndicator = "STATUS_INDICATOR"
    case timeDisplay = "TIME_DISPLAY"
    case timeMinusSign = "TIME_MINUS_SIGN"
    case songTitle = "SONG_TITLE"
    case visualizer = "VISUALIZER"
    case bitrate = "BITRATE"
    case sampleRate = "SAMPLE_RATE"
    case monoIndicator = "MONO_INDICATOR"
    case stereoIndicator = "STEREO_INDICATOR"

    case volumeSlider = "VOLUME_SLIDER"
    case balanceSlider = "BALANCE_SLIDER"
    case positionBar = "POSITION_BAR"

    case buttonPrevious = "BUTTON_PREVIOUS"
    case buttonPlay = "BUTTON_PLAY"
    case buttonPause = "BUTTON_PAUSE"
    case buttonStop = "BUTTON_STOP"
    case buttonNext = "BUTTON_NEXT"
    case buttonEject = "BUTTON_EJECT"

    case buttonShuffle = "BUTTON_SHUFFLE"
    case buttonRepeat = "BUTTON_REPEAT"
    case buttonEqualizer = "BUTTON_EQUALIZER"
    case buttonPlaylist = "BUTTON_PLAYLIST"
}

/// The geometry of a skinned window.
public struct SkinLayout: Codable, Sendable {
    /// Size of the main window in layout pixels, before the size multiplier.
    public var mainSize: PixelRect
    /// Height of the main window in "windowshade" mode.
    public var shadeHeight: Int
    public var slots: [LayoutSlot: PixelRect]

    public init(mainSize: PixelRect, shadeHeight: Int, slots: [LayoutSlot: PixelRect]) {
        self.mainSize = mainSize
        self.shadeHeight = shadeHeight
        self.slots = slots
    }

    public func rect(_ slot: LayoutSlot) -> PixelRect {
        slots[slot] ?? .zero
    }

    /// Hit-test helper: the topmost slot containing the point, preferring
    /// smaller targets so a button wins over the title bar it sits on.
    public func slot(at x: Int, y: Int, among candidates: [LayoutSlot]) -> LayoutSlot? {
        candidates
            .filter { rect($0).contains(x: x, y: y) }
            .min { lhs, rhs in
                let l = rect(lhs), r = rect(rhs)
                return l.width * l.height < r.width * r.height
            }
    }
}

public extension SkinLayout {
    /// The canonical Winamp 2.x main-window geometry: a 275x116 window whose
    /// every control sits at a coordinate that has not moved since 1997.
    static let classic = SkinLayout(
        mainSize: PixelRect(x: 0, y: 0, width: 275, height: 116),
        shadeHeight: 14,
        slots: [
            .titleBar: PixelRect(x: 0, y: 0, width: 275, height: 14),
            .buttonMenu: PixelRect(x: 6, y: 3, width: 9, height: 9),
            .buttonMinimize: PixelRect(x: 244, y: 3, width: 9, height: 9),
            .buttonShade: PixelRect(x: 254, y: 3, width: 9, height: 9),
            .buttonClose: PixelRect(x: 264, y: 3, width: 9, height: 9),
            .clutterBar: PixelRect(x: 10, y: 22, width: 8, height: 43),

            .statusIndicator: PixelRect(x: 24, y: 28, width: 9, height: 9),
            // Four 9x13 digits; the colon between them is painted into
            // main.bmp, which is why the pairs are not evenly spaced.
            .timeDisplay: PixelRect(x: 48, y: 26, width: 51, height: 13),
            .timeMinusSign: PixelRect(x: 36, y: 26, width: 9, height: 13),
            .songTitle: PixelRect(x: 111, y: 27, width: 154, height: 6),
            .visualizer: PixelRect(x: 24, y: 43, width: 76, height: 16),
            .bitrate: PixelRect(x: 111, y: 43, width: 15, height: 6),
            .sampleRate: PixelRect(x: 156, y: 43, width: 10, height: 6),
            .monoIndicator: PixelRect(x: 212, y: 41, width: 27, height: 12),
            .stereoIndicator: PixelRect(x: 239, y: 41, width: 29, height: 12),

            .volumeSlider: PixelRect(x: 107, y: 57, width: 68, height: 13),
            .balanceSlider: PixelRect(x: 177, y: 57, width: 38, height: 13),
            .positionBar: PixelRect(x: 16, y: 72, width: 248, height: 10),

            .buttonPrevious: PixelRect(x: 16, y: 88, width: 23, height: 18),
            .buttonPlay: PixelRect(x: 39, y: 88, width: 23, height: 18),
            .buttonPause: PixelRect(x: 62, y: 88, width: 23, height: 18),
            .buttonStop: PixelRect(x: 85, y: 88, width: 23, height: 18),
            .buttonNext: PixelRect(x: 108, y: 88, width: 22, height: 18),
            .buttonEject: PixelRect(x: 136, y: 89, width: 22, height: 16),

            .buttonShuffle: PixelRect(x: 164, y: 89, width: 47, height: 15),
            .buttonRepeat: PixelRect(x: 210, y: 89, width: 28, height: 15),
            .buttonEqualizer: PixelRect(x: 219, y: 58, width: 23, height: 12),
            .buttonPlaylist: PixelRect(x: 242, y: 58, width: 23, height: 12),
        ]
    )

    /// The x offsets of the four time digits, relative to the window.
    static let classicTimeDigitOffsets = [48, 60, 78, 90]
}

// Encode `[LayoutSlot: PixelRect]` as a JSON object keyed by the raw strings
// instead of a flat alternating array.
extension LayoutSlot: CodingKeyRepresentable {}

import Foundation

/// A palette for the parts of the app a skin has no artwork for.
///
/// Classic Winamp skins ship sprites for exactly three windows. There is no
/// `search-field.bmp`, no tab strip, no artist list — and there never will be,
/// because the format froze in 1997. So anything beyond the main and playlist
/// windows cannot be blitted from a downloaded skin; it has to be *generated*
/// in that skin's colours.
///
/// This is the palette that generation works from. Every classic skin yields
/// one (see `SkinTheme.derived(from:)`), and a modern `.wskin` can declare one
/// outright. Either way the media library ends up looking like it belongs to
/// whatever skin is loaded.
///
/// Every text/background pair here is contrast-checked at construction, so a
/// skin with an unfortunate palette produces something readable rather than
/// black-on-black.
public struct SkinTheme: Equatable, Codable, Sendable {

    // MARK: Chrome — the faceplate the widgets are cut from

    public var faceBase: SkinColor
    public var faceHighlight: SkinColor
    public var faceShadow: SkinColor
    public var bevelLight: SkinColor
    public var bevelDark: SkinColor
    /// Text drawn directly on the faceplate — header titles, breadcrumbs, the
    /// status line. Separate from `displayText` because the faceplate is a
    /// different surface: a skin can have a dark well and a bright faceplate,
    /// and a colour legible on one is invisible on the other.
    public var faceText: SkinColor
    public var faceTextDim: SkinColor

    // MARK: Sunken displays — text wells, search fields, list backgrounds

    public var displayBackground: SkinColor
    public var displayText: SkinColor
    public var displayDim: SkinColor

    // MARK: Lists

    public var listBackground: SkinColor
    public var listText: SkinColor
    /// Alternating row tint. Subtle by design; a hard stripe fights the art.
    public var listAlternate: SkinColor
    public var selectionBackground: SkinColor
    public var selectionText: SkinColor

    // MARK: Emphasis

    public var accent: SkinColor
    /// Text drawn on top of `accent`.
    public var accentText: SkinColor

    /// Font the skin asked for, from `pledit.txt`'s `Font=` key. Nil means the
    /// system's small font.
    public var listFontName: String?

    public init(
        faceBase: SkinColor,
        faceHighlight: SkinColor,
        faceShadow: SkinColor,
        bevelLight: SkinColor,
        bevelDark: SkinColor,
        faceText: SkinColor,
        faceTextDim: SkinColor,
        displayBackground: SkinColor,
        displayText: SkinColor,
        displayDim: SkinColor,
        listBackground: SkinColor,
        listText: SkinColor,
        listAlternate: SkinColor,
        selectionBackground: SkinColor,
        selectionText: SkinColor,
        accent: SkinColor,
        accentText: SkinColor,
        listFontName: String? = nil
    ) {
        self.faceBase = faceBase
        self.faceHighlight = faceHighlight
        self.faceShadow = faceShadow
        self.bevelLight = bevelLight
        self.bevelDark = bevelDark
        self.faceText = faceText
        self.faceTextDim = faceTextDim
        self.displayBackground = displayBackground
        self.displayText = displayText
        self.displayDim = displayDim
        self.listBackground = listBackground
        self.listText = listText
        self.listAlternate = listAlternate
        self.selectionBackground = selectionBackground
        self.selectionText = selectionText
        self.accent = accent
        self.accentText = accentText
        self.listFontName = listFontName
    }

    /// Forces every text colour to be legible on the surface it is drawn on.
    ///
    /// Run on every theme, derived or declared: skin authors chose these
    /// colours for sprites, not for a widget set, and a `pledit.txt` with
    /// `Normal` barely distinguishable from `NormalBG` is not unusual.
    public func contrastChecked() -> SkinTheme {
        var theme = self
        theme.displayText = SkinColor.legible(theme.displayText, on: theme.displayBackground)

        // Faceplate panels are gradients, so a label sits on a range of tones
        // and checking only the lightest one leaves it unreadable at the dark
        // end. The range is highlight-to-base: that is what `ThemedChrome.panel`
        // draws, and it is the only surface faceplate text lands on. Tabs and
        // buttons reach `faceShadow`, and their labels are checked separately
        // against the tone they actually sit on.
        let faceSurfaces = [theme.faceHighlight, theme.faceBase]
        theme.faceText = SkinColor.legible(theme.faceText, onAnyOf: faceSurfaces)
        theme.faceTextDim = SkinColor.legible(theme.faceTextDim, onAnyOf: faceSurfaces, minimum: 2.5)
        theme.listText = SkinColor.legible(theme.listText, on: theme.listBackground)
        theme.selectionText = SkinColor.legible(theme.selectionText, on: theme.selectionBackground)
        theme.accentText = SkinColor.legible(theme.accentText, on: theme.accent)
        // Dim text only needs to be readable, not prominent.
        theme.displayDim = SkinColor.legible(theme.displayDim, on: theme.displayBackground, minimum: 2.5)

        // A selection that reads the same as the background defeats its whole
        // purpose, so push it apart from the list background specifically.
        if SkinColor.contrastRatio(theme.selectionBackground, theme.listBackground) < 1.25 {
            theme.selectionBackground = theme.listBackground.isDark
                ? theme.selectionBackground.lightened(by: 0.35)
                : theme.selectionBackground.darkened(by: 0.35)
            theme.selectionText = SkinColor.legible(theme.selectionText, on: theme.selectionBackground)
        }
        return theme
    }

    /// The theme used when nothing better is available: the built-in skin's.
    public static let fallback = SkinTheme(
        faceBase: SkinColor(r: 54, g: 58, b: 64),
        faceHighlight: SkinColor(r: 86, g: 92, b: 99),
        faceShadow: SkinColor(r: 18, g: 19, b: 21),
        bevelLight: SkinColor(r: 122, g: 130, b: 139),
        bevelDark: SkinColor(r: 14, g: 15, b: 17),
        faceText: SkinColor(r: 226, g: 232, b: 238),
        faceTextDim: SkinColor(r: 150, g: 158, b: 166),
        displayBackground: SkinColor(r: 8, g: 14, b: 11),
        displayText: SkinColor(r: 66, g: 255, b: 122),
        displayDim: SkinColor(r: 22, g: 86, b: 44),
        listBackground: SkinColor(r: 8, g: 14, b: 11),
        listText: SkinColor(r: 66, g: 255, b: 122),
        listAlternate: SkinColor(r: 12, g: 20, b: 16),
        selectionBackground: SkinColor(r: 26, g: 62, b: 44),
        selectionText: .white,
        accent: SkinColor(r: 0, g: 214, b: 96),
        accentText: SkinColor(r: 8, g: 14, b: 11)
    )
}

// MARK: - Colour maths

public extension SkinColor {

    /// WCAG relative luminance.
    var relativeLuminance: Double {
        func channel(_ value: UInt8) -> Double {
            let normalised = Double(value) / 255
            return normalised <= 0.03928
                ? normalised / 12.92
                : pow((normalised + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }

    var isDark: Bool { relativeLuminance < 0.22 }

    /// WCAG contrast ratio, 1...21.
    static func contrastRatio(_ first: SkinColor, _ second: SkinColor) -> Double {
        let a = first.relativeLuminance
        let b = second.relativeLuminance
        return (max(a, b) + 0.05) / (min(a, b) + 0.05)
    }

    func mixed(with other: SkinColor, amount: Double) -> SkinColor {
        let t = min(1, max(0, amount))
        func blend(_ a: UInt8, _ b: UInt8) -> UInt8 {
            UInt8(min(255, max(0, (Double(a) + (Double(b) - Double(a)) * t).rounded())))
        }
        return SkinColor(r: blend(r, other.r), g: blend(g, other.g), b: blend(b, other.b))
    }

    func lightened(by amount: Double) -> SkinColor { mixed(with: .white, amount: amount) }
    func darkened(by amount: Double) -> SkinColor { mixed(with: .black, amount: amount) }

    /// Nudges `color` until it is readable on `background`, keeping its hue
    /// where it can.
    static func legible(
        _ color: SkinColor,
        on background: SkinColor,
        minimum: Double = 4.0
    ) -> SkinColor {
        legible(color, onAnyOf: [background], minimum: minimum)
    }

    /// Nudges `color` until it is readable on *every* surface in `surfaces`.
    ///
    /// Panels are gradients, so a label sits on a range of tones rather than
    /// one. Optimising the worst case is what keeps text legible at both ends;
    /// optimising the average leaves it invisible at one.
    ///
    /// Both directions are tried, and the one with the better worst case wins.
    /// Picking a direction from luminance alone gets saturated colours wrong:
    /// hot pink has a low relative luminance but takes dark text far better
    /// than light, and a threshold would send it the wrong way.
    ///
    /// When no colour clears `minimum` — a faceplate spanning near-black to
    /// near-white leaves no room — the best available worst case is returned
    /// rather than failing. That is the honest outcome: some skins simply have
    /// no legible option, and the least-bad one is what to draw.
    static func legible(
        _ color: SkinColor,
        onAnyOf surfaces: [SkinColor],
        minimum: Double = 4.0
    ) -> SkinColor {
        guard !surfaces.isEmpty else { return color }

        func worstCase(_ candidate: SkinColor) -> Double {
            surfaces.map { contrastRatio(candidate, $0) }.min() ?? 0
        }

        var best = color
        var bestWorstCase = worstCase(color)
        if bestWorstCase >= minimum { return color }

        // Coarse steps are enough: this runs once per skin load, and the eye
        // cannot tell a 5% mix difference.
        for target in [SkinColor.white, SkinColor.black] {
            for step in stride(from: 0.1, through: 1.0, by: 0.1) {
                let candidate = color.mixed(with: target, amount: step)
                let ratio = worstCase(candidate)
                if ratio > bestWorstCase {
                    best = candidate
                    bestWorstCase = ratio
                }
                // Keep searching the other direction only if this one failed:
                // the first colour that clears the floor also keeps the most
                // of the original hue.
                if ratio >= minimum { return candidate }
            }
        }
        return best
    }
}

import Foundation

/// Extracts a `SkinTheme` from a skin that was never designed to have one.
///
/// A classic `.wsz` carries no theme block, but it does carry enough evidence:
/// `pledit.txt` describes a list view, `viscolor.txt` an accent ramp, and
/// `main.bmp` is a picture of the skin's own faceplate. Sampling the chrome
/// bands of that bitmap — the strips between the controls, which are always
/// faceplate and never a sunken display — recovers the base colour and the
/// bevel pair the author used.
///
/// The result is always run through `contrastChecked()`, because these colours
/// were chosen to sit under sprites, not behind text.
public enum SkinThemeDerivation {

    /// Bands of `main.bmp` that are faceplate in every classic skin.
    ///
    /// Derived from `SkinLayout.classic`: the strip under the title bar, the
    /// gap between the position bar and the transport row, the margin below
    /// the buttons, and the two side edges. Deliberately avoids the LCD wells,
    /// the visualiser, the sliders and every button.
    static let chromeSampleRects: [PixelRect] = [
        PixelRect(x: 4, y: 15, width: 267, height: 6),
        PixelRect(x: 4, y: 83, width: 267, height: 4),
        PixelRect(x: 4, y: 107, width: 267, height: 7),
        PixelRect(x: 1, y: 22, width: 8, height: 60),
        PixelRect(x: 267, y: 22, width: 7, height: 30),
    ]

    public static func derive(from skin: Skin) -> SkinTheme {
        let playlist = skin.playlistStyle
        let palette = skin.visualizerPalette

        // MARK: Chrome, from the faceplate bitmap

        let samples = sampleChrome(skin)
        let chrome = chromeColors(from: samples)

        // MARK: Displays and lists
        //
        // A skin that themed Winamp's minibrowser told us exactly what an
        // in-app browser should look like, so prefer that when present.
        let listBackground = playlist.declaresMiniBrowserColors
            ? playlist.miniBrowserBackground
            : playlist.background
        let listText = playlist.declaresMiniBrowserColors
            ? playlist.miniBrowserText
            : playlist.normalText

        // viscolor's first entry is the visualiser well; it is the skin's own
        // idea of "inset display", which is what a search field is. Ignore it
        // when it just repeats the faceplate.
        let visualiserWell = palette.background
        let displayBackground = SkinColor.contrastRatio(visualiserWell, chrome.base) > 1.3
            ? visualiserWell
            : playlist.background

        let brightestSpectrum = palette.spectrum.max {
            $0.relativeLuminance < $1.relativeLuminance
        } ?? playlist.normalText

        // The now-playing colour is the skin's deliberate emphasis choice, so
        // it makes the best accent — unless it vanishes against the faceplate.
        let accent = SkinColor.contrastRatio(playlist.currentText, chrome.base) > 1.6
            ? playlist.currentText
            : brightestSpectrum

        let theme = SkinTheme(
            faceBase: chrome.base,
            faceHighlight: chrome.highlight,
            faceShadow: chrome.shadow,
            bevelLight: chrome.bevelLight,
            bevelDark: chrome.bevelDark,
            // Start from the skin's own display colour so a green-phosphor skin
            // keeps green lettering on its faceplate too; contrastChecked()
            // rescues it when the faceplate is too close in tone.
            faceText: brightestSpectrum,
            faceTextDim: brightestSpectrum.mixed(with: chrome.base, amount: 0.4),
            displayBackground: displayBackground,
            displayText: brightestSpectrum,
            displayDim: brightestSpectrum.mixed(with: displayBackground, amount: 0.55),
            listBackground: listBackground,
            listText: listText,
            // A 7% tint: enough to guide the eye down a long list, not enough
            // to read as a stripe.
            listAlternate: listBackground.mixed(
                with: listBackground.isDark ? .white : .black,
                amount: 0.07
            ),
            selectionBackground: playlist.selectedBackground,
            selectionText: playlist.currentText,
            accent: accent,
            accentText: accent.isDark ? .white : .black,
            listFontName: playlist.fontName
        )
        return theme.contrastChecked()
    }

    // MARK: - Sampling

    private static func sampleChrome(_ skin: Skin) -> [SkinColor] {
        // The sample rects are coordinates in the classic 275x116 faceplate.
        // A modern skin with its own geometry gets no useful reading from them.
        guard skin.layout.mainSize == SkinLayout.classic.mainSize,
              let background = skin.sprite(.mainBackground),
              background.width >= 275, background.height >= 116
        else { return [] }

        var colors: [SkinColor] = []
        colors.reserveCapacity(4_000)
        for rect in chromeSampleRects {
            for y in rect.y ..< rect.maxY {
                for x in rect.x ..< rect.maxX {
                    guard let pixel = background.pixel(x: x, y: y), pixel.a > 128 else { continue }
                    colors.append(SkinColor(r: pixel.r, g: pixel.g, b: pixel.b))
                }
            }
        }
        return colors
    }

    struct ChromeColors {
        var base: SkinColor
        var highlight: SkinColor
        var shadow: SkinColor
        var bevelLight: SkinColor
        var bevelDark: SkinColor
    }

    static func chromeColors(from samples: [SkinColor]) -> ChromeColors {
        guard !samples.isEmpty else {
            let fallback = SkinTheme.fallback
            return ChromeColors(
                base: fallback.faceBase,
                highlight: fallback.faceHighlight,
                shadow: fallback.faceShadow,
                bevelLight: fallback.bevelLight,
                bevelDark: fallback.bevelDark
            )
        }

        // MARK: Base — the most common colour
        //
        // Quantised to 5 bits per channel before counting, so a gradient
        // faceplate resolves to one dominant band instead of a thousand
        // near-identical singletons. The bucket's average is then used, which
        // recovers the real colour rather than the quantised one.
        var buckets: [UInt32: (count: Int, r: Int, g: Int, b: Int)] = [:]
        for color in samples {
            let key = UInt32(color.r >> 3) << 10 | UInt32(color.g >> 3) << 5 | UInt32(color.b >> 3)
            var entry = buckets[key] ?? (0, 0, 0, 0)
            entry.count += 1
            entry.r += Int(color.r)
            entry.g += Int(color.g)
            entry.b += Int(color.b)
            buckets[key] = entry
        }
        let dominant = buckets.values.max { $0.count < $1.count }!
        let base = SkinColor(
            r: UInt8(dominant.r / dominant.count),
            g: UInt8(dominant.g / dominant.count),
            b: UInt8(dominant.b / dominant.count)
        )

        // MARK: Bevels — the extremes the author actually drew with
        let sorted = samples.sorted { $0.relativeLuminance < $1.relativeLuminance }
        func percentile(_ fraction: Double) -> SkinColor {
            let index = min(sorted.count - 1, max(0, Int(Double(sorted.count - 1) * fraction)))
            return sorted[index]
        }

        var bevelDark = percentile(0.04)
        var bevelLight = percentile(0.96)

        // A flat faceplate gives no bevel pair to find, so synthesise one.
        // 1.6 is roughly the point below which an edge stops reading as an edge.
        if SkinColor.contrastRatio(bevelLight, bevelDark) < 1.6 {
            bevelLight = base.lightened(by: 0.45)
            bevelDark = base.darkened(by: 0.55)
        }

        return ChromeColors(
            base: base,
            // Mid-tones for gradients, pulled toward the bevels rather than
            // invented, so a coloured faceplate keeps its hue.
            highlight: base.mixed(with: bevelLight, amount: 0.45),
            shadow: base.mixed(with: bevelDark, amount: 0.45),
            bevelLight: bevelLight,
            bevelDark: bevelDark
        )
    }
}

public extension Skin {
    /// The skin's theme: declared by a modern manifest, or derived.
    ///
    /// Cached on the value at load time by the loaders, so widget generation
    /// never re-samples the faceplate.
    var effectiveTheme: SkinTheme {
        theme ?? SkinThemeDerivation.derive(from: self)
    }
}

import XCTest
@testable import SkinKit

/// Tests for the theme a skin is reduced to.
///
/// This is the load-bearing claim behind the media library — that *any*
/// downloaded skin yields a usable palette — so the interesting cases are the
/// hostile ones: skins whose colours were chosen for sprites and are actively
/// unsuitable for text.
final class SkinThemeTests: XCTestCase {

    // MARK: - Colour maths

    func testContrastRatioMatchesKnownValues() {
        // Black on white is the maximum, 21:1.
        XCTAssertEqual(SkinColor.contrastRatio(.black, .white), 21, accuracy: 0.01)
        XCTAssertEqual(SkinColor.contrastRatio(.white, .white), 1, accuracy: 0.01)
        // Order must not matter.
        XCTAssertEqual(
            SkinColor.contrastRatio(.black, .white),
            SkinColor.contrastRatio(.white, .black),
            accuracy: 0.001
        )
    }

    func testLegibleLeavesAdequateColoursAlone() {
        let green = SkinColor(r: 0, g: 255, b: 0)
        XCTAssertEqual(SkinColor.legible(green, on: .black), green)
    }

    func testLegibleRescuesInvisibleText() {
        // The pathological case: a skin whose list text is its background.
        let background = SkinColor(r: 20, g: 20, b: 24)
        let rescued = SkinColor.legible(background, on: background)
        XCTAssertGreaterThanOrEqual(
            SkinColor.contrastRatio(rescued, background), 4.0,
            "text identical to its background must be pushed apart"
        )
    }

    func testLegiblePushesAwayFromTheBackgroundNotTowardIt() {
        // Dark background: the fix should brighten, not darken further.
        let dark = SkinColor(r: 10, g: 10, b: 10)
        let barely = SkinColor(r: 25, g: 25, b: 25)
        let fixed = SkinColor.legible(barely, on: dark)
        XCTAssertGreaterThan(fixed.relativeLuminance, barely.relativeLuminance)

        // Light background: it should darken.
        let light = SkinColor(r: 245, g: 245, b: 245)
        let washed = SkinColor(r: 225, g: 225, b: 225)
        XCTAssertLessThan(
            SkinColor.legible(washed, on: light).relativeLuminance,
            washed.relativeLuminance
        )
    }

    func testLegibleKeepsHueWhenItCan() {
        // A dim red on black should stay recognisably red, not go white.
        let dimRed = SkinColor(r: 90, g: 10, b: 10)
        let fixed = SkinColor.legible(dimRed, on: .black)
        XCTAssertGreaterThan(fixed.r, fixed.g)
        XCTAssertGreaterThan(fixed.r, fixed.b)
    }

    // MARK: - Contrast checking a whole theme

    /// Every text/surface pair a theme defines, as the widgets use them.
    private func textPairs(of theme: SkinTheme) -> [(String, SkinColor, SkinColor)] {
        [
            ("display", theme.displayText, theme.displayBackground),
            ("list", theme.listText, theme.listBackground),
            ("selection", theme.selectionText, theme.selectionBackground),
            ("accent", theme.accentText, theme.accent),
            // The faceplate is a different surface from the display well, and
            // the header, breadcrumb and status line all draw on it.
            ("faceplate", theme.faceText, theme.faceHighlight),
        ]
    }

    func testContrastCheckedFixesAnUnreadableTheme() {
        // A skin that set every colour to nearly the same dark grey. This is
        // not hypothetical: monochrome skins do this.
        let mush = SkinColor(r: 34, g: 34, b: 38)
        let hostile = SkinTheme(
            faceBase: mush,
            faceHighlight: mush,
            faceShadow: mush,
            bevelLight: mush,
            bevelDark: mush,
            faceText: mush,
            faceTextDim: mush,
            displayBackground: mush,
            displayText: mush,
            displayDim: mush,
            listBackground: mush,
            listText: mush,
            listAlternate: mush,
            selectionBackground: mush,
            selectionText: mush,
            accent: mush,
            accentText: mush
        )

        let fixed = hostile.contrastChecked()
        for (name, text, background) in textPairs(of: fixed) {
            XCTAssertGreaterThanOrEqual(
                SkinColor.contrastRatio(text, background), 4.0,
                "\(name) text is unreadable after contrast checking"
            )
        }
    }

    func testContrastCheckedSeparatesSelectionFromTheList() {
        let background = SkinColor(r: 12, g: 16, b: 14)
        var theme = SkinTheme.fallback
        theme.listBackground = background
        // A skin whose SelectedBG equals its NormalBG — the selection would be
        // invisible.
        theme.selectionBackground = background

        let fixed = theme.contrastChecked()
        XCTAssertGreaterThan(
            SkinColor.contrastRatio(fixed.selectionBackground, fixed.listBackground), 1.25,
            "a selected row must be distinguishable from an unselected one"
        )
    }

    func testContrastCheckingIsIdempotent() {
        // Running it twice must not keep drifting the colours.
        let once = SkinTheme.fallback.contrastChecked()
        XCTAssertEqual(once, once.contrastChecked())
    }

    // MARK: - Chrome sampling

    func testFlatFaceplateGetsSynthesisedBevels() {
        // A single flat colour offers no light/dark pair to discover.
        let flat = SkinColor(r: 70, g: 70, b: 80)
        let chrome = SkinThemeDerivation.chromeColors(from: Array(repeating: flat, count: 500))

        XCTAssertEqual(chrome.base, flat)
        XCTAssertGreaterThan(
            SkinColor.contrastRatio(chrome.bevelLight, chrome.bevelDark), 1.6,
            "a flat faceplate still needs an edge that reads as an edge"
        )
        XCTAssertGreaterThan(chrome.bevelLight.relativeLuminance, chrome.bevelDark.relativeLuminance)
    }

    func testDominantColourWinsOverOutliers() {
        // 400 pixels of faceplate plus a handful of stray highlights: the base
        // must be the faceplate, and the strays should inform the bevels.
        var samples = [SkinColor](repeating: SkinColor(r: 60, g: 62, b: 66), count: 400)
        samples += [SkinColor](repeating: .white, count: 8)
        samples += [SkinColor](repeating: .black, count: 8)

        let chrome = SkinThemeDerivation.chromeColors(from: samples)
        assertClose(chrome.base.r, 60, tolerance: 2)
        assertClose(chrome.base.g, 62, tolerance: 2)
        XCTAssertGreaterThan(chrome.bevelLight.relativeLuminance, chrome.base.relativeLuminance)
        XCTAssertLessThan(chrome.bevelDark.relativeLuminance, chrome.base.relativeLuminance)
    }

    func testGradientFaceplateResolvesToItsDominantBand() {
        // Quantising before counting is what makes this work: without it every
        // gradient row is its own singleton and the mode is meaningless.
        var samples: [SkinColor] = []
        for row in 0 ..< 40 {
            let value = UInt8(50 + row / 8)
            // Weight the middle of the gradient, as a real faceplate does.
            let count = row > 10 && row < 30 ? 20 : 2
            samples += [SkinColor](repeating: SkinColor(r: value, g: value, b: value + 4), count: count)
        }
        let chrome = SkinThemeDerivation.chromeColors(from: samples)
        XCTAssertGreaterThanOrEqual(chrome.base.r, 50)
        XCTAssertLessThanOrEqual(chrome.base.r, 55)
    }

    func testEmptySamplesFallBack() {
        let chrome = SkinThemeDerivation.chromeColors(from: [])
        XCTAssertEqual(chrome.base, SkinTheme.fallback.faceBase)
    }

    // MARK: - End to end

    func testBuiltInSkinDeclaresItsOwnTheme() {
        // No sampling needed: the built-in skin is drawn from this palette.
        XCTAssertEqual(DefaultSkin.make().effectiveTheme, SkinTheme.fallback)
    }

    func testDerivationFromAGarishSkinStaysReadable() {
        // A deliberately awful skin: hot pink faceplate, near-black text on a
        // near-black list, and a selection the same colour as the background.
        var skin = DefaultSkin.make()
        skin.theme = nil
        skin.sprites[.mainBackground] = solid(
            width: 275, height: 116,
            color: SkinColor(r: 255, g: 0, b: 200)
        )
        skin.playlistStyle = PlaylistStyle(
            normalText: SkinColor(r: 8, g: 8, b: 8),
            currentText: SkinColor(r: 10, g: 10, b: 10),
            background: SkinColor(r: 6, g: 6, b: 6),
            selectedBackground: SkinColor(r: 6, g: 6, b: 6),
            miniBrowserText: SkinColor(r: 0, g: 255, b: 0),
            miniBrowserBackground: .black,
            fontName: nil,
            declaresMiniBrowserColors: false
        )

        let theme = SkinThemeDerivation.derive(from: skin)
        for (name, text, background) in textPairs(of: theme) {
            XCTAssertGreaterThanOrEqual(
                SkinColor.contrastRatio(text, background), 4.0,
                "\(name) text is unreadable in the derived theme"
            )
        }
        XCTAssertGreaterThan(
            SkinColor.contrastRatio(theme.selectionBackground, theme.listBackground), 1.25
        )
        // The faceplate should still be the skin's own colour, garish or not:
        // legibility fixes text, it does not repaint the skin.
        XCTAssertEqual(theme.faceBase, SkinColor(r: 255, g: 0, b: 200))
    }

    func testMiniBrowserColoursWinWhenTheSkinDeclaresThem() {
        // A skin that themed Winamp's minibrowser told us what an in-app
        // browser should look like, so those colours should drive the library.
        var skin = DefaultSkin.make()
        skin.theme = nil
        let browserBackground = SkinColor(r: 16, g: 24, b: 48)
        skin.playlistStyle = PlaylistStyle(
            normalText: SkinColor(r: 0, g: 255, b: 0),
            currentText: .white,
            background: .black,
            selectedBackground: SkinColor(r: 0, g: 0, b: 198),
            miniBrowserText: SkinColor(r: 190, g: 210, b: 255),
            miniBrowserBackground: browserBackground,
            fontName: nil,
            declaresMiniBrowserColors: true
        )

        let theme = SkinThemeDerivation.derive(from: skin)
        XCTAssertEqual(theme.listBackground, browserBackground)
    }

    func testPleditFontRequestReachesTheTheme() {
        var skin = DefaultSkin.make()
        skin.theme = nil
        skin.playlistStyle.fontName = "Arial"
        XCTAssertEqual(SkinThemeDerivation.derive(from: skin).listFontName, "Arial")
    }

    // MARK: - Widget generation

    func testGeneratedWidgetsAreTheRequestedSize() {
        let chrome = ThemedChrome(theme: .fallback)
        XCTAssertEqual(chrome.button(width: 40, height: 14, state: .normal).width, 40)
        XCTAssertEqual(chrome.button(width: 40, height: 14, state: .normal).height, 14)
        XCTAssertEqual(chrome.well(width: 120, height: 16).width, 120)
        XCTAssertEqual(chrome.tab(width: 50, height: 14, selected: true).height, 14)
        XCTAssertEqual(chrome.divider(width: 200).height, 2)
        XCTAssertEqual(chrome.artworkFrame(size: 40, hasImage: false).width, 40)
    }

    func testGeneratedWidgetsAreOpaqueWhereTheyShouldBe() {
        let chrome = ThemedChrome(theme: .fallback)
        let button = chrome.button(width: 20, height: 12, state: .normal)
        // A button with transparent pixels would let the window behind show
        // through its face.
        for y in 0 ..< button.height {
            for x in 0 ..< button.width {
                XCTAssertEqual(button.pixel(x: x, y: y)?.a, 255, "button hole at \(x),\(y)")
            }
        }
    }

    func testActivityBarSweepStaysInsideItsBounds() {
        let chrome = ThemedChrome(theme: .fallback)
        // The sweep bounces rather than wrapping, so no phase may overflow.
        for phase in stride(from: 0.0, through: 1.0, by: 0.05) {
            let bar = chrome.activityBar(width: 60, height: 8, phase: phase)
            XCTAssertEqual(bar.width, 60)
            XCTAssertEqual(bar.height, 8)
        }
    }

    // MARK: - Helpers

    private func solid(width: Int, height: Int, color: SkinColor) -> RasterImage {
        var pixels: [UInt8] = []
        pixels.reserveCapacity(width * height * 4)
        for _ in 0 ..< width * height {
            pixels += [color.r, color.g, color.b, 255]
        }
        return RasterImage(width: width, height: height, pixels: pixels)
    }
}

private extension XCTestCase {
    /// Byte comparison with a tolerance.
    ///
    /// `XCTAssertEqual(_:_:accuracy:)` needs a `FloatingPoint`, and these are
    /// bytes. Deliberately *not* named `XCTAssertEqual`: overloading an XCTest
    /// global with a member is a reliable way to produce overload-resolution
    /// errors in every other assertion in the file.
    func assertClose(
        _ actual: UInt8,
        _ expected: UInt8,
        tolerance: UInt8,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let difference = actual > expected ? actual - expected : expected - actual
        XCTAssertLessThanOrEqual(
            difference, tolerance,
            "\(actual) differs from \(expected) by more than \(tolerance)",
            file: file, line: line
        )
    }
}

extension SkinThemeTests {

    /// The artwork frame is drawn *over* the cover it frames, so a filled
    /// interior would hide the image. Only the bevel may be opaque.
    func testArtworkFrameLeavesItsInteriorTransparentForRealImages() {
        let chrome = ThemedChrome(theme: .fallback)
        let framed = chrome.artworkFrame(size: 20, hasImage: true)
        // Interior transparent.
        for y in 1 ..< 19 {
            for x in 1 ..< 19 {
                XCTAssertEqual(
                    framed.pixel(x: x, y: y)?.a, 0,
                    "artwork frame covers the image at \(x),\(y)"
                )
            }
        }
        // Bevel still drawn.
        XCTAssertEqual(framed.pixel(x: 0, y: 0)?.a, 255)
        XCTAssertEqual(framed.pixel(x: 19, y: 19)?.a, 255)
    }

    func testArtworkPlaceholderIsOpaque() {
        let chrome = ThemedChrome(theme: .fallback)
        let placeholder = chrome.artworkFrame(size: 20, hasImage: false)
        for y in 0 ..< 20 {
            for x in 0 ..< 20 {
                XCTAssertEqual(placeholder.pixel(x: x, y: y)?.a, 255)
            }
        }
    }

    /// Bitmap glyphs are re-coloured by treating distance from the sheet's
    /// background as coverage, so a tint must survive both a dark-background
    /// sheet and a light-background one.
    func testGlyphTintingWorksForEitherSheetPolarity() {
        // Dark sheet, bright ink.
        let darkSheet = RasterImage(width: 2, height: 1, pixels: [
            0, 0, 0, 255,          // background
            255, 255, 255, 255,    // ink
        ])
        let tintedDark = darkSheet.tinted(to: (255, 0, 0), backgroundLuminance: 0)
        XCTAssertEqual(tintedDark.pixel(x: 0, y: 0)?.a, 0, "background must become transparent")
        XCTAssertEqual(tintedDark.pixel(x: 1, y: 0)?.a, 255, "ink must stay opaque")
        XCTAssertEqual(tintedDark.pixel(x: 1, y: 0)?.r, 255, "ink must take the tint")

        // Light sheet, dark ink — rarer, but it exists.
        let lightSheet = RasterImage(width: 2, height: 1, pixels: [
            255, 255, 255, 255,    // background
            0, 0, 0, 255,          // ink
        ])
        let tintedLight = lightSheet.tinted(to: (0, 255, 0), backgroundLuminance: 1)
        XCTAssertEqual(tintedLight.pixel(x: 0, y: 0)?.a, 0)
        XCTAssertEqual(tintedLight.pixel(x: 1, y: 0)?.a, 255)
        XCTAssertEqual(tintedLight.pixel(x: 1, y: 0)?.g, 255)
    }

    func testBothContrastDirectionsAreTried() {
        // A saturated mid-luminance surface: hot pink has a low relative
        // luminance but takes dark text far better than light. Picking the
        // direction from a luminance threshold gets this wrong.
        let pink = SkinColor(r: 236, g: 0, b: 200)
        let fixed = SkinColor.legible(SkinColor(r: 240, g: 20, b: 210), on: pink)
        XCTAssertGreaterThanOrEqual(SkinColor.contrastRatio(fixed, pink), 4.0)
        XCTAssertLessThan(
            fixed.relativeLuminance, pink.relativeLuminance,
            "dark text is the only thing that contrasts with hot pink"
        )
    }

    func testWorstCaseIsOptimisedAcrossAGradient() {
        // A panel running from mid-grey to near-black: the chosen colour must
        // work at both ends, not just on average.
        let surfaces = [SkinColor(r: 130, g: 130, b: 130), SkinColor(r: 30, g: 30, b: 30)]
        let fixed = SkinColor.legible(SkinColor(r: 100, g: 100, b: 100), onAnyOf: surfaces, minimum: 3.0)
        let worst = surfaces.map { SkinColor.contrastRatio(fixed, $0) }.min() ?? 0
        let naive = surfaces.map { SkinColor.contrastRatio(SkinColor(r: 100, g: 100, b: 100), $0) }.min() ?? 0
        XCTAssertGreaterThan(worst, naive)
    }
}

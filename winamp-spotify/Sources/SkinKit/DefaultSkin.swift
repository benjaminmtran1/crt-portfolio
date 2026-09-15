import Foundation

/// The skin the app ships with, synthesised in code at launch.
///
/// Winamp's own artwork is not ours to redistribute, so the built-in look is
/// drawn from scratch: a brushed charcoal faceplate, recessed LCD panels, a
/// green seven-segment clock. It follows the classic 275x116 layout exactly, so
/// it also serves as the fallback that fills in whatever a partial third-party
/// skin leaves out.
public enum DefaultSkin {

    // MARK: - Palette

    enum Palette {
        static let faceHigh = SkinColor(r: 86, g: 92, b: 99)
        static let faceMid = SkinColor(r: 54, g: 58, b: 64)
        static let faceLow = SkinColor(r: 34, g: 37, b: 41)
        static let faceShadow = SkinColor(r: 18, g: 19, b: 21)

        static let bevelLight = SkinColor(r: 122, g: 130, b: 139)
        static let bevelDark = SkinColor(r: 14, g: 15, b: 17)

        static let lcdBackground = SkinColor(r: 8, g: 14, b: 11)
        static let lcdBright = SkinColor(r: 66, g: 255, b: 122)
        static let lcdDim = SkinColor(r: 22, g: 86, b: 44)

        static let titleActiveTop = SkinColor(r: 74, g: 82, b: 90)
        static let titleActiveBottom = SkinColor(r: 38, g: 42, b: 47)
        static let titleInactiveTop = SkinColor(r: 48, g: 51, b: 55)
        static let titleInactiveBottom = SkinColor(r: 30, g: 32, b: 35)

        static let accent = SkinColor(r: 0, g: 214, b: 96)
    }

    // MARK: - Entry point

    /// Builds the skin. Cheap enough to do eagerly — the whole thing is a few
    /// hundred kilobytes of pixels — but callers should cache it.
    public static func make() -> Skin {
        var sprites: [SpriteID: RasterImage] = [:]
        var strips: [SpriteStripID: [RasterImage]] = [:]

        sprites[.mainBackground] = makeMainBackground()

        sprites[.titleBarActive] = makeTitleBar(active: true)
        sprites[.titleBarInactive] = makeTitleBar(active: false)
        sprites[.titleBarEasterEggActive] = sprites[.titleBarActive]
        sprites[.titleBarEasterEggInactive] = sprites[.titleBarInactive]
        sprites[.shadeBackgroundActive] = makeShadeBar(active: true)
        sprites[.shadeBackgroundInactive] = makeShadeBar(active: false)

        for (id, glyph, pressed) in titleButtonSpecs {
            sprites[id] = makeTitleButton(glyph: glyph, pressed: pressed)
        }

        for (id, icon, size, pressed) in transportButtonSpecs {
            sprites[id] = makeTransportButton(icon: icon, size: size, pressed: pressed)
        }

        sprites[.shuffleOff] = makeLabelButton("SHUFFLE", width: 47, height: 15, on: false, pressed: false)
        sprites[.shuffleOffPressed] = makeLabelButton("SHUFFLE", width: 47, height: 15, on: false, pressed: true)
        sprites[.shuffleOn] = makeLabelButton("SHUFFLE", width: 47, height: 15, on: true, pressed: false)
        sprites[.shuffleOnPressed] = makeLabelButton("SHUFFLE", width: 47, height: 15, on: true, pressed: true)
        // "REPEAT" needs 30px at full pitch and crammed to 4px it reads as one
        // smudged word, so the 28px button gets the abbreviation instead.
        sprites[.repeatOff] = makeLabelButton("RPT", width: 28, height: 15, on: false, pressed: false)
        sprites[.repeatOffPressed] = makeLabelButton("RPT", width: 28, height: 15, on: false, pressed: true)
        sprites[.repeatOn] = makeLabelButton("RPT", width: 28, height: 15, on: true, pressed: false)
        sprites[.repeatOnPressed] = makeLabelButton("RPT", width: 28, height: 15, on: true, pressed: true)

        sprites[.buttonEqualizerOff] = makeLabelButton("EQ", width: 23, height: 12, on: false, pressed: false)
        sprites[.buttonEqualizerOn] = makeLabelButton("EQ", width: 23, height: 12, on: true, pressed: false)
        sprites[.buttonPlaylistOff] = makeLabelButton("PL", width: 23, height: 12, on: false, pressed: false)
        sprites[.buttonPlaylistOn] = makeLabelButton("PL", width: 23, height: 12, on: true, pressed: false)

        sprites[.positionBarBackground] = makePositionTrack()
        sprites[.positionBarThumb] = makeSliderThumb(width: 29, height: 10, pressed: false)
        sprites[.positionBarThumbPressed] = makeSliderThumb(width: 29, height: 10, pressed: true)
        sprites[.volumeThumb] = makeSliderThumb(width: 14, height: 11, pressed: false)
        sprites[.volumeThumbPressed] = makeSliderThumb(width: 14, height: 11, pressed: true)
        sprites[.balanceThumb] = sprites[.volumeThumb]
        sprites[.balanceThumbPressed] = sprites[.volumeThumbPressed]

        sprites[.statusPlaying] = makeStatusIndicator(.playing)
        sprites[.statusPaused] = makeStatusIndicator(.paused)
        sprites[.statusStopped] = makeStatusIndicator(.stopped)
        sprites[.statusWorking] = makeWorkIndicator(working: true)
        sprites[.statusNotWorking] = makeWorkIndicator(working: false)

        sprites[.monoOn] = makeChannelLabel("MONO", width: 27, on: true)
        sprites[.monoOff] = makeChannelLabel("MONO", width: 27, on: false)
        sprites[.stereoOn] = makeChannelLabel("STEREO", width: 29, on: true)
        sprites[.stereoOff] = makeChannelLabel("STEREO", width: 29, on: false)

        sprites[.clutterBar] = makeClutterBar(enabled: true)
        sprites[.clutterBarDisabled] = makeClutterBar(enabled: false)

        for (id, image) in makePlaylistSprites() { sprites[id] = image }

        strips[.volumeBackground] = makeSliderTrack(width: 68, height: 13)
        strips[.balanceBackground] = makeSliderTrack(width: 38, height: 13, centered: true)
        strips[.digits] = makeDigits()
        strips[.font] = makeFontGlyphs()

        var skin = Skin(
            metadata: Skin.Metadata(name: "Nightshade", author: "Built in", format: .modern),
            layout: .classic,
            assetScale: 1,
            sprites: sprites,
            strips: strips,
            playlistStyle: PlaylistStyle(
                normalText: Palette.lcdBright,
                currentText: .white,
                background: Palette.lcdBackground,
                selectedBackground: SkinColor(r: 26, g: 62, b: 44),
                miniBrowserText: Palette.lcdBright,
                miniBrowserBackground: Palette.lcdBackground,
                fontName: nil
            ),
            visualizerPalette: .default,
            regions: [:]
        )
        skin.fontColumns = 31
        return skin
    }

    // MARK: - Main background

    static func makeMainBackground() -> RasterImage {
        var canvas = RasterCanvas(width: 275, height: 116)
        canvas.verticalGradient(
            rect: PixelRect(x: 0, y: 0, width: 275, height: 116),
            from: Palette.faceMid,
            to: Palette.faceLow
        )
        // Outer case edge.
        canvas.bevel(
            rect: PixelRect(x: 0, y: 0, width: 275, height: 116),
            light: Palette.bevelLight,
            dark: Palette.bevelDark
        )

        // The title bar is part of the background too; the titlebar sprite
        // overlays it so focus changes do not force a full repaint.
        canvas.draw(makeTitleBar(active: true), atX: 0, y: 0)

        // Left LCD: status light, clock, visualiser.
        recess(&canvas, PixelRect(x: 20, y: 24, width: 84, height: 38))
        // Right LCD: scrolling title, bitrate, channel indicators. Two pixels
        // wider than the controls need, so the stereo indicator's last letter
        // does not sit against the bevel.
        recess(&canvas, PixelRect(x: 105, y: 24, width: 165, height: 30))

        // Raised strip carrying the volume and balance sliders.
        raised(&canvas, PixelRect(x: 105, y: 55, width: 164, height: 17))
        // Raised strip carrying the transport buttons.
        raised(&canvas, PixelRect(x: 12, y: 85, width: 251, height: 24))

        // Position-bar well, sunk into the faceplate between the two strips.
        recess(&canvas, PixelRect(x: 14, y: 70, width: 252, height: 14))

        // Colon between the clock's minute and second pairs, at the 9px gap
        // the digit offsets leave for it.
        canvas.set(x: 73, y: 29, Palette.lcdDim)
        canvas.set(x: 73, y: 30, Palette.lcdDim)
        canvas.set(x: 73, y: 34, Palette.lcdDim)
        canvas.set(x: 73, y: 35, Palette.lcdDim)

        // "KBPS" / "KHZ" etchings next to their readouts.
        stampText(&canvas, "KBPS", atX: 128, y: 43, color: Palette.faceHigh, pitch: 5)
        stampText(&canvas, "KHZ", atX: 168, y: 43, color: Palette.faceHigh, pitch: 5)

        return canvas.image
    }

    /// A sunken well with a dark interior — the LCD look.
    static func recess(_ canvas: inout RasterCanvas, _ rect: PixelRect) {
        canvas.fill(rect: rect, with: Palette.lcdBackground)
        canvas.bevel(rect: rect, light: Palette.bevelLight, dark: Palette.bevelDark, raised: false)
    }

    /// A slightly proud panel, for the rows the controls sit on.
    static func raised(_ canvas: inout RasterCanvas, _ rect: PixelRect) {
        canvas.verticalGradient(rect: rect, from: Palette.faceHigh, to: Palette.faceMid)
        canvas.bevel(rect: rect, light: Palette.bevelLight, dark: Palette.bevelDark, raised: true)
    }

    // MARK: - Title bars

    static func makeTitleBar(active: Bool) -> RasterImage {
        var canvas = RasterCanvas(width: 275, height: 14)
        canvas.verticalGradient(
            rect: PixelRect(x: 0, y: 0, width: 275, height: 14),
            from: active ? Palette.titleActiveTop : Palette.titleInactiveTop,
            to: active ? Palette.titleActiveBottom : Palette.titleInactiveBottom
        )
        canvas.bevel(
            rect: PixelRect(x: 0, y: 0, width: 275, height: 14),
            light: Palette.bevelLight,
            dark: Palette.bevelDark
        )
        let title = "WINAMP SPOTIFY"
        let width = title.count * 5
        stampText(
            &canvas, title,
            atX: (275 - width) / 2, y: 4,
            color: active ? Palette.lcdBright : Palette.faceHigh,
            pitch: 5
        )
        // Grab-texture hatching either side of the title, the classic cue that
        // a bar is draggable.
        for x in stride(from: 24, to: (275 - width) / 2 - 6, by: 2) {
            for y in stride(from: 4, to: 10, by: 2) {
                canvas.set(x: x, y: y, active ? Palette.faceHigh : Palette.faceMid)
            }
        }
        for x in stride(from: (275 + width) / 2 + 6, to: 238, by: 2) {
            for y in stride(from: 4, to: 10, by: 2) {
                canvas.set(x: x, y: y, active ? Palette.faceHigh : Palette.faceMid)
            }
        }
        return canvas.image
    }

    /// Windowshade mode: a 14px sliver showing the clock and nothing else.
    static func makeShadeBar(active: Bool) -> RasterImage {
        var canvas = RasterCanvas(width: 275, height: 14)
        canvas.draw(makeTitleBar(active: active), atX: 0, y: 0)
        recess(&canvas, PixelRect(x: 78, y: 3, width: 62, height: 9))
        return canvas.image
    }

    // MARK: - Buttons

    static let titleButtonSpecs: [(SpriteID, [String], Bool)] = [
        (.buttonMenu, ["###", "...", "###"], false),
        (.buttonMenuPressed, ["###", "...", "###"], true),
        (.buttonMinimize, ["...", "...", "###"], false),
        (.buttonMinimizePressed, ["...", "...", "###"], true),
        (.buttonShade, ["###", "...", "..."], false),
        (.buttonShadePressed, ["###", "...", "..."], true),
        (.buttonClose, ["#.#", ".#.", "#.#"], false),
        (.buttonClosePressed, ["#.#", ".#.", "#.#"], true),
    ]

    static func makeTitleButton(glyph: [String], pressed: Bool) -> RasterImage {
        var canvas = RasterCanvas(width: 9, height: 9)
        canvas.fill(rect: PixelRect(x: 0, y: 0, width: 9, height: 9), with: pressed ? Palette.faceLow : Palette.faceMid)
        canvas.bevel(
            rect: PixelRect(x: 0, y: 0, width: 9, height: 9),
            light: Palette.bevelLight,
            dark: Palette.bevelDark,
            raised: !pressed
        )
        let offset = pressed ? 1 : 0
        canvas.stamp(glyph, atX: 3 + offset, y: 3 + offset, with: pressed ? Palette.lcdBright : Palette.faceHigh)
        return canvas.image
    }

    /// 7x7 transport glyphs. Drawn rather than described so the triangles have
    /// clean edges at this size.
    enum TransportIcon {
        case previous, play, pause, stop, next, eject
    }

    static let transportButtonSpecs: [(SpriteID, TransportIcon, PixelRect, Bool)] = [
        (.buttonPrevious, .previous, PixelRect(x: 0, y: 0, width: 23, height: 18), false),
        (.buttonPreviousPressed, .previous, PixelRect(x: 0, y: 0, width: 23, height: 18), true),
        (.buttonPlay, .play, PixelRect(x: 0, y: 0, width: 23, height: 18), false),
        (.buttonPlayPressed, .play, PixelRect(x: 0, y: 0, width: 23, height: 18), true),
        (.buttonPause, .pause, PixelRect(x: 0, y: 0, width: 23, height: 18), false),
        (.buttonPausePressed, .pause, PixelRect(x: 0, y: 0, width: 23, height: 18), true),
        (.buttonStop, .stop, PixelRect(x: 0, y: 0, width: 23, height: 18), false),
        (.buttonStopPressed, .stop, PixelRect(x: 0, y: 0, width: 23, height: 18), true),
        (.buttonNext, .next, PixelRect(x: 0, y: 0, width: 22, height: 18), false),
        (.buttonNextPressed, .next, PixelRect(x: 0, y: 0, width: 22, height: 18), true),
        (.buttonEject, .eject, PixelRect(x: 0, y: 0, width: 22, height: 16), false),
        (.buttonEjectPressed, .eject, PixelRect(x: 0, y: 0, width: 22, height: 16), true),
    ]

    static func makeTransportButton(icon: TransportIcon, size: PixelRect, pressed: Bool) -> RasterImage {
        var canvas = RasterCanvas(width: size.width, height: size.height)
        let bounds = PixelRect(x: 0, y: 0, width: size.width, height: size.height)
        canvas.verticalGradient(
            rect: bounds,
            from: pressed ? Palette.faceLow : Palette.faceHigh,
            to: pressed ? Palette.faceShadow : Palette.faceMid
        )
        canvas.bevel(rect: bounds, light: Palette.bevelLight, dark: Palette.bevelDark, raised: !pressed)

        let art = transportArt(icon)
        let artWidth = art.first?.count ?? 0
        let x = (size.width - artWidth) / 2 + (pressed ? 1 : 0)
        let y = (size.height - art.count) / 2 + (pressed ? 1 : 0)
        canvas.stamp(art, atX: x, y: y, with: pressed ? Palette.accent : Palette.lcdBright)
        return canvas.image
    }

    static func transportArt(_ icon: TransportIcon) -> [String] {
        switch icon {
        case .play:
            return ["#....", "##...", "###..", "####.", "###..", "##...", "#...."]
        case .pause:
            return ["##.##", "##.##", "##.##", "##.##", "##.##", "##.##", "##.##"]
        case .stop:
            return ["#####", "#####", "#####", "#####", "#####", "#####", "#####"]
        case .previous:
            return [
                "#...#....#",
                "#..##...##",
                "#.###..###",
                "#####.####",
                "#.###..###",
                "#..##...##",
                "#...#....#",
            ]
        case .next:
            return [
                "#....#...#",
                "##...##..#",
                "###..###.#",
                "####.#####",
                "###..###.#",
                "##...##..#",
                "#....#...#",
            ]
        case .eject:
            return ["..#..", ".###.", "#####", ".....", "#####"]
        }
    }

    static func makeLabelButton(
        _ label: String,
        width: Int,
        height: Int,
        on: Bool,
        pressed: Bool,
        pitch: Int = 5
    ) -> RasterImage {
        var canvas = RasterCanvas(width: width, height: height)
        let bounds = PixelRect(x: 0, y: 0, width: width, height: height)
        canvas.verticalGradient(
            rect: bounds,
            from: pressed ? Palette.faceLow : Palette.faceHigh,
            to: pressed ? Palette.faceShadow : Palette.faceMid
        )
        canvas.bevel(rect: bounds, light: Palette.bevelLight, dark: Palette.bevelDark, raised: !pressed)

        let textWidth = label.count * pitch
        let x = max(1, (width - textWidth) / 2 + (pressed ? 1 : 0))
        let y = (height - BitmapFontLayout.glyphHeight) / 2 + (pressed ? 1 : 0)
        stampText(&canvas, label, atX: x, y: y, color: on ? Palette.accent : Palette.faceShadow, pitch: pitch)
        // An "on" toggle gets a lit pip so state reads at a glance even when
        // the label colour is subtle.
        if on, width >= 20 {
            canvas.set(x: width - 4, y: 2, Palette.accent)
            canvas.set(x: width - 3, y: 2, Palette.accent)
        }
        return canvas.image
    }

    // MARK: - Sliders

    static func makePositionTrack() -> RasterImage {
        var canvas = RasterCanvas(width: 248, height: 10)
        canvas.fill(rect: PixelRect(x: 0, y: 0, width: 248, height: 10), with: Palette.faceLow)
        canvas.bevel(
            rect: PixelRect(x: 0, y: 3, width: 248, height: 4),
            light: Palette.bevelDark,
            dark: Palette.bevelLight,
            raised: false
        )
        canvas.fill(rect: PixelRect(x: 1, y: 4, width: 246, height: 2), with: Palette.lcdBackground)
        return canvas.image
    }

    static func makeSliderThumb(width: Int, height: Int, pressed: Bool) -> RasterImage {
        var canvas = RasterCanvas(width: width, height: height)
        let bounds = PixelRect(x: 0, y: 0, width: width, height: height)
        canvas.verticalGradient(
            rect: bounds,
            from: pressed ? Palette.faceMid : Palette.bevelLight,
            to: pressed ? Palette.faceShadow : Palette.faceMid
        )
        canvas.bevel(rect: bounds, light: Palette.bevelLight, dark: Palette.bevelDark, raised: !pressed)
        // Centre grip line.
        let midX = width / 2
        for y in 2 ..< height - 2 {
            canvas.set(x: midX, y: y, pressed ? Palette.accent : Palette.faceShadow)
        }
        return canvas.image
    }

    /// The 28-frame background strip: a level meter that fills as the value
    /// rises, exactly as `volume.bmp` does.
    static func makeSliderTrack(width: Int, height: Int, centered: Bool = false) -> [RasterImage] {
        (0 ..< ClassicSpriteTable.sliderFrameCount).map { frame in
            var canvas = RasterCanvas(width: width, height: height)
            canvas.fill(rect: PixelRect(x: 0, y: 0, width: width, height: height), with: Palette.faceLow)
            canvas.bevel(
                rect: PixelRect(x: 0, y: 0, width: width, height: height),
                light: Palette.bevelLight,
                dark: Palette.bevelDark,
                raised: false
            )
            let track = PixelRect(x: 2, y: 4, width: width - 4, height: height - 8)
            canvas.fill(rect: track, with: Palette.lcdBackground)

            let fraction = Double(frame) / Double(ClassicSpriteTable.sliderFrameCount - 1)
            if centered {
                // Balance: fills outward from the middle in whichever direction.
                let half = track.width / 2
                let extent = Int((abs(fraction - 0.5) * 2 * Double(half)).rounded())
                let origin = fraction < 0.5 ? track.x + half - extent : track.x + half
                canvas.fill(
                    rect: PixelRect(x: origin, y: track.y, width: max(1, extent), height: track.height),
                    with: Palette.lcdDim
                )
            } else {
                let filled = Int((fraction * Double(track.width)).rounded())
                if filled > 0 {
                    canvas.fill(
                        rect: PixelRect(x: track.x, y: track.y, width: filled, height: track.height),
                        with: fraction > 0.85 ? SkinColor(r: 214, g: 118, b: 48) : Palette.lcdDim
                    )
                }
            }
            return canvas.image
        }
    }

    // MARK: - Indicators

    enum StatusKind { case playing, paused, stopped }

    static func makeStatusIndicator(_ kind: StatusKind) -> RasterImage {
        var canvas = RasterCanvas(width: 9, height: 9)
        let art: [String]
        switch kind {
        case .playing: art = ["#..", "##.", "###", "##.", "#.."]
        case .paused: art = ["#.#", "#.#", "#.#", "#.#", "#.#"]
        case .stopped: art = ["###", "###", "###", "###", "###"]
        }
        canvas.stamp(art, atX: 2, y: 2, with: kind == .stopped ? Palette.lcdDim : Palette.lcdBright)
        return canvas.image
    }

    static func makeWorkIndicator(working: Bool) -> RasterImage {
        var canvas = RasterCanvas(width: 3, height: 9)
        if working {
            canvas.fill(rect: PixelRect(x: 0, y: 1, width: 3, height: 7), with: Palette.accent)
        }
        return canvas.image
    }

    static func makeChannelLabel(_ label: String, width: Int, on: Bool) -> RasterImage {
        var canvas = RasterCanvas(width: width, height: 12)
        // Full pitch, even for "STEREO": six glyphs span 30px in a 29px
        // sprite, but the final O's right column is empty so the ink lands at
        // x+28 and nothing is lost. Tightening the pitch instead would merge
        // the letters that use all five columns.
        stampText(
            &canvas, label,
            atX: 0, y: 3,
            color: on ? Palette.lcdBright : Palette.lcdDim,
            pitch: 5
        )
        return canvas.image
    }

    static func makeClutterBar(enabled: Bool) -> RasterImage {
        var canvas = RasterCanvas(width: 8, height: 43)
        canvas.fill(rect: PixelRect(x: 0, y: 0, width: 8, height: 43), with: Palette.faceLow)
        canvas.bevel(
            rect: PixelRect(x: 0, y: 0, width: 8, height: 43),
            light: Palette.bevelLight,
            dark: Palette.bevelDark,
            raised: false
        )
        // Winamp's O A I D V column; ours reads the same but only the skin
        // chooser and visualiser entries do anything.
        let color = enabled ? Palette.lcdDim : Palette.faceShadow
        for (index, letter) in ["O", "A", "I", "D", "V"].enumerated() {
            stampText(&canvas, letter, atX: 1, y: 2 + index * 8, color: color, pitch: 5)
        }
        return canvas.image
    }

    // MARK: - Digits

    /// Segment order: A top, B top-right, C bottom-right, D bottom,
    /// E bottom-left, F top-left, G middle.
    static let segmentPatterns: [Int: String] = [
        0: "ABCDEF", 1: "BC", 2: "ABDEG", 3: "ABCDG", 4: "BCFG",
        5: "ACDFG", 6: "ACDEFG", 7: "ABC", 8: "ABCDEFG", 9: "ABCDFG",
    ]

    static func makeDigits() -> [RasterImage] {
        var frames: [RasterImage] = (0 ... 9).map { makeSevenSegment(segmentPatterns[$0] ?? "") }
        // The eleventh frame is the blank the clock shows when stopped, the
        // same role nums_ex.bmp's extra glyph plays.
        frames.append(makeSevenSegment(""))
        return frames
    }

    static func makeSevenSegment(_ segments: String) -> RasterImage {
        var canvas = RasterCanvas(width: 9, height: 13)
        let lit = Set(segments)

        func bar(_ rect: PixelRect, _ on: Bool) {
            canvas.fill(rect: rect, with: on ? Palette.lcdBright : Palette.lcdBackground)
        }

        bar(PixelRect(x: 1, y: 0, width: 7, height: 2), lit.contains("A"))
        bar(PixelRect(x: 7, y: 1, width: 2, height: 6), lit.contains("B"))
        bar(PixelRect(x: 7, y: 7, width: 2, height: 6), lit.contains("C"))
        bar(PixelRect(x: 1, y: 11, width: 7, height: 2), lit.contains("D"))
        bar(PixelRect(x: 0, y: 7, width: 2, height: 6), lit.contains("E"))
        bar(PixelRect(x: 0, y: 1, width: 2, height: 6), lit.contains("F"))
        bar(PixelRect(x: 1, y: 6, width: 7, height: 2), lit.contains("G"))
        return canvas.image
    }

    // MARK: - Font

    /// Builds the 31x3 glyph grid so it indexes identically to a classic
    /// `text.bmp`.
    static func makeFontGlyphs() -> [RasterImage] {
        var glyphs: [RasterImage] = []
        glyphs.reserveCapacity(31 * 3)
        for row in 0 ..< 3 {
            let characters = Array(BitmapFontLayout.rows[row])
            for column in 0 ..< 31 {
                var canvas = RasterCanvas(
                    width: BitmapFontLayout.glyphWidth,
                    height: BitmapFontLayout.glyphHeight
                )
                if column < characters.count,
                   let art = DefaultFontArt.glyphs[characters[column]] {
                    canvas.stamp(art, atX: 0, y: 0, with: Palette.lcdBright)
                }
                glyphs.append(canvas.image)
            }
        }
        return glyphs
    }

    /// Stamps a string using the built-in glyph art. Used for the parts of the
    /// skin that are baked into sprites rather than drawn at runtime.
    static func stampText(
        _ canvas: inout RasterCanvas,
        _ text: String,
        atX x: Int,
        y: Int,
        color: SkinColor,
        pitch: Int
    ) {
        for (index, character) in text.enumerated() {
            let normalised = BitmapFontLayout.normalise(character)
            guard let art = DefaultFontArt.glyphs[normalised] else { continue }
            canvas.stamp(art, atX: x + index * pitch, y: y, with: color)
        }
    }

    // MARK: - Playlist window

    static func makePlaylistSprites() -> [SpriteID: RasterImage] {
        var result: [SpriteID: RasterImage] = [:]

        func titleTile(width: Int, active: Bool, label: String?) -> RasterImage {
            var canvas = RasterCanvas(width: width, height: 20)
            canvas.verticalGradient(
                rect: PixelRect(x: 0, y: 0, width: width, height: 20),
                from: active ? Palette.titleActiveTop : Palette.titleInactiveTop,
                to: active ? Palette.titleActiveBottom : Palette.titleInactiveBottom
            )
            canvas.bevel(
                rect: PixelRect(x: 0, y: 0, width: width, height: 20),
                light: Palette.bevelLight,
                dark: Palette.bevelDark
            )
            if let label {
                let textWidth = label.count * 5
                stampText(
                    &canvas, label,
                    atX: (width - textWidth) / 2, y: 7,
                    color: active ? Palette.lcdBright : Palette.faceHigh,
                    pitch: 5
                )
            }
            return canvas.image
        }

        result[.playlistTopLeftActive] = titleTile(width: 25, active: true, label: nil)
        result[.playlistTopLeftInactive] = titleTile(width: 25, active: false, label: nil)
        result[.playlistTitleBarActive] = titleTile(width: 100, active: true, label: "PLAYLIST")
        result[.playlistTitleBarInactive] = titleTile(width: 100, active: false, label: "PLAYLIST")
        result[.playlistTopTileActive] = titleTile(width: 25, active: true, label: nil)
        result[.playlistTopTileInactive] = titleTile(width: 25, active: false, label: nil)
        result[.playlistTopRightActive] = titleTile(width: 25, active: true, label: nil)
        result[.playlistTopRightInactive] = titleTile(width: 25, active: false, label: nil)

        func edgeTile(width: Int) -> RasterImage {
            var canvas = RasterCanvas(width: width, height: 29)
            canvas.fill(rect: PixelRect(x: 0, y: 0, width: width, height: 29), with: Palette.faceMid)
            canvas.bevel(
                rect: PixelRect(x: 0, y: 0, width: width, height: 29),
                light: Palette.bevelLight,
                dark: Palette.bevelDark
            )
            return canvas.image
        }
        result[.playlistLeftTile] = edgeTile(width: 12)
        result[.playlistRightTile] = edgeTile(width: 20)

        func bottomPanel(width: Int) -> RasterImage {
            var canvas = RasterCanvas(width: width, height: 38)
            canvas.verticalGradient(
                rect: PixelRect(x: 0, y: 0, width: width, height: 38),
                from: Palette.faceMid,
                to: Palette.faceLow
            )
            canvas.bevel(
                rect: PixelRect(x: 0, y: 0, width: width, height: 38),
                light: Palette.bevelLight,
                dark: Palette.bevelDark
            )
            return canvas.image
        }
        result[.playlistBottomLeft] = bottomPanel(width: 125)
        result[.playlistBottomTile] = bottomPanel(width: 25)
        result[.playlistBottomRight] = bottomPanel(width: 150)

        result[.playlistScrollThumb] = makeSliderThumb(width: 8, height: 18, pressed: false)
        result[.playlistScrollThumbPressed] = makeSliderThumb(width: 8, height: 18, pressed: true)
        result[.playlistCloseButton] = makeTitleButton(glyph: ["#.#", ".#.", "#.#"], pressed: false)
        result[.playlistShadeButton] = makeTitleButton(glyph: ["###", "...", "..."], pressed: false)

        return result
    }
}

import Foundation

/// Where every sprite lives inside a classic Winamp skin's bitmap sheets.
///
/// These coordinates come from the Winamp 2.x skinning specification and have
/// been fixed for the entire life of the format, which is what makes thousands
/// of third-party skins interchangeable. They are laid out here as data rather
/// than baked into the loader so a wrong offset is a one-line fix.
///
/// Sheet names are matched case-insensitively by basename — see
/// `ZipArchive.contents(of:)` — because skin authors were never consistent.
enum ClassicSpriteTable {

    struct SpriteRef {
        let sheet: String
        let rect: PixelRect

        init(_ sheet: String, _ x: Int, _ y: Int, _ width: Int, _ height: Int) {
            self.sheet = sheet
            self.rect = PixelRect(x: x, y: y, width: width, height: height)
        }
    }

    /// Sheets a classic skin may contain. A skin that omits one simply
    /// inherits that part of the base skin.
    static let sheetNames = [
        "main.bmp", "titlebar.bmp", "cbuttons.bmp", "shufrep.bmp", "posbar.bmp",
        "volume.bmp", "balance.bmp", "monoster.bmp", "playpaus.bmp",
        "numbers.bmp", "nums_ex.bmp", "text.bmp", "pledit.bmp", "eqmain.bmp",
    ]

    static let sprites: [SpriteID: SpriteRef] = [
        .mainBackground: SpriteRef("main.bmp", 0, 0, 275, 116),

        // MARK: titlebar.bmp (344x87)
        .titleBarActive: SpriteRef("titlebar.bmp", 27, 0, 275, 14),
        .titleBarInactive: SpriteRef("titlebar.bmp", 27, 15, 275, 14),
        .shadeBackgroundActive: SpriteRef("titlebar.bmp", 27, 29, 275, 14),
        .shadeBackgroundInactive: SpriteRef("titlebar.bmp", 27, 42, 275, 14),
        .titleBarEasterEggActive: SpriteRef("titlebar.bmp", 27, 72, 275, 14),
        .titleBarEasterEggInactive: SpriteRef("titlebar.bmp", 27, 57, 275, 14),

        .buttonMenu: SpriteRef("titlebar.bmp", 0, 0, 9, 9),
        .buttonMenuPressed: SpriteRef("titlebar.bmp", 0, 9, 9, 9),
        .buttonMinimize: SpriteRef("titlebar.bmp", 9, 0, 9, 9),
        .buttonMinimizePressed: SpriteRef("titlebar.bmp", 9, 9, 9, 9),
        .buttonShade: SpriteRef("titlebar.bmp", 0, 18, 9, 9),
        .buttonShadePressed: SpriteRef("titlebar.bmp", 9, 18, 9, 9),
        .buttonClose: SpriteRef("titlebar.bmp", 18, 0, 9, 9),
        .buttonClosePressed: SpriteRef("titlebar.bmp", 18, 9, 9, 9),

        .clutterBar: SpriteRef("titlebar.bmp", 304, 0, 8, 43),
        .clutterBarDisabled: SpriteRef("titlebar.bmp", 312, 0, 8, 43),

        // MARK: cbuttons.bmp (136x36)
        .buttonPrevious: SpriteRef("cbuttons.bmp", 0, 0, 23, 18),
        .buttonPreviousPressed: SpriteRef("cbuttons.bmp", 0, 18, 23, 18),
        .buttonPlay: SpriteRef("cbuttons.bmp", 23, 0, 23, 18),
        .buttonPlayPressed: SpriteRef("cbuttons.bmp", 23, 18, 23, 18),
        .buttonPause: SpriteRef("cbuttons.bmp", 46, 0, 23, 18),
        .buttonPausePressed: SpriteRef("cbuttons.bmp", 46, 18, 23, 18),
        .buttonStop: SpriteRef("cbuttons.bmp", 69, 0, 23, 18),
        .buttonStopPressed: SpriteRef("cbuttons.bmp", 69, 18, 23, 18),
        .buttonNext: SpriteRef("cbuttons.bmp", 92, 0, 22, 18),
        .buttonNextPressed: SpriteRef("cbuttons.bmp", 92, 18, 22, 18),
        .buttonEject: SpriteRef("cbuttons.bmp", 114, 0, 22, 16),
        .buttonEjectPressed: SpriteRef("cbuttons.bmp", 114, 16, 22, 16),

        // MARK: shufrep.bmp (92x85)
        .repeatOff: SpriteRef("shufrep.bmp", 0, 0, 28, 15),
        .repeatOffPressed: SpriteRef("shufrep.bmp", 0, 15, 28, 15),
        .repeatOn: SpriteRef("shufrep.bmp", 0, 30, 28, 15),
        .repeatOnPressed: SpriteRef("shufrep.bmp", 0, 45, 28, 15),
        .shuffleOff: SpriteRef("shufrep.bmp", 28, 0, 47, 15),
        .shuffleOffPressed: SpriteRef("shufrep.bmp", 28, 15, 47, 15),
        .shuffleOn: SpriteRef("shufrep.bmp", 28, 30, 47, 15),
        .shuffleOnPressed: SpriteRef("shufrep.bmp", 28, 45, 47, 15),
        .buttonEqualizerOff: SpriteRef("shufrep.bmp", 0, 61, 23, 12),
        .buttonEqualizerOn: SpriteRef("shufrep.bmp", 0, 73, 23, 12),
        .buttonPlaylistOff: SpriteRef("shufrep.bmp", 23, 61, 23, 12),
        .buttonPlaylistOn: SpriteRef("shufrep.bmp", 23, 73, 23, 12),

        // MARK: posbar.bmp (307x10)
        .positionBarBackground: SpriteRef("posbar.bmp", 0, 0, 248, 10),
        .positionBarThumb: SpriteRef("posbar.bmp", 248, 0, 29, 10),
        .positionBarThumbPressed: SpriteRef("posbar.bmp", 278, 0, 29, 10),

        // MARK: volume.bmp / balance.bmp (both 433 tall: 28 frames + thumbs)
        .volumeThumb: SpriteRef("volume.bmp", 15, 422, 14, 11),
        .volumeThumbPressed: SpriteRef("volume.bmp", 0, 422, 14, 11),
        .balanceThumb: SpriteRef("balance.bmp", 15, 422, 14, 11),
        .balanceThumbPressed: SpriteRef("balance.bmp", 0, 422, 14, 11),

        // MARK: monoster.bmp (56x24)
        .stereoOn: SpriteRef("monoster.bmp", 0, 0, 29, 12),
        .stereoOff: SpriteRef("monoster.bmp", 0, 12, 29, 12),
        .monoOn: SpriteRef("monoster.bmp", 29, 0, 27, 12),
        .monoOff: SpriteRef("monoster.bmp", 29, 12, 27, 12),

        // MARK: playpaus.bmp (42x9)
        .statusPlaying: SpriteRef("playpaus.bmp", 0, 0, 9, 9),
        .statusPaused: SpriteRef("playpaus.bmp", 9, 0, 9, 9),
        .statusStopped: SpriteRef("playpaus.bmp", 18, 0, 9, 9),
        .statusNotWorking: SpriteRef("playpaus.bmp", 36, 0, 3, 9),
        .statusWorking: SpriteRef("playpaus.bmp", 39, 0, 3, 9),

        // MARK: pledit.bmp (280x186)
        .playlistTopLeftActive: SpriteRef("pledit.bmp", 0, 0, 25, 20),
        .playlistTitleBarActive: SpriteRef("pledit.bmp", 26, 0, 100, 20),
        .playlistTopTileActive: SpriteRef("pledit.bmp", 127, 0, 25, 20),
        .playlistTopRightActive: SpriteRef("pledit.bmp", 153, 0, 25, 20),
        .playlistTopLeftInactive: SpriteRef("pledit.bmp", 0, 21, 25, 20),
        .playlistTitleBarInactive: SpriteRef("pledit.bmp", 26, 21, 100, 20),
        .playlistTopTileInactive: SpriteRef("pledit.bmp", 127, 21, 25, 20),
        .playlistTopRightInactive: SpriteRef("pledit.bmp", 153, 21, 25, 20),
        .playlistLeftTile: SpriteRef("pledit.bmp", 0, 42, 12, 29),
        .playlistRightTile: SpriteRef("pledit.bmp", 32, 42, 20, 29),
        .playlistBottomLeft: SpriteRef("pledit.bmp", 0, 72, 125, 38),
        .playlistBottomTile: SpriteRef("pledit.bmp", 179, 0, 25, 38),
        .playlistBottomRight: SpriteRef("pledit.bmp", 126, 72, 150, 38),
        .playlistScrollThumb: SpriteRef("pledit.bmp", 52, 53, 8, 18),
        .playlistScrollThumbPressed: SpriteRef("pledit.bmp", 61, 53, 8, 18),
        .playlistCloseButton: SpriteRef("pledit.bmp", 167, 3, 9, 9),
        .playlistShadeButton: SpriteRef("pledit.bmp", 157, 3, 9, 9),
    ]

    // MARK: - Frame strips

    /// Volume and balance backgrounds are 28 stacked 13px frames on a 15px
    /// pitch, so frame N starts at y = N * 15.
    static let sliderFrameCount = 28
    static let sliderFramePitch = 15
    static let sliderFrameHeight = 13

    static func volumeFrame(_ index: Int) -> PixelRect {
        PixelRect(x: 0, y: index * sliderFramePitch, width: 68, height: sliderFrameHeight)
    }

    static func balanceFrame(_ index: Int) -> PixelRect {
        // The balance strip is 47px wide but only the left 38px are used; the
        // slider is narrower than the volume one.
        PixelRect(x: 9, y: index * sliderFramePitch, width: 38, height: sliderFrameHeight)
    }

    /// Time digits: ten 9x13 glyphs in a row. `nums_ex.bmp` adds an eleventh
    /// blank/minus glyph, which is why it is preferred when present.
    static let digitSize = PixelRect(x: 0, y: 0, width: 9, height: 13)

    static func digitFrame(_ index: Int) -> PixelRect {
        PixelRect(x: index * 9, y: 0, width: 9, height: 13)
    }
}

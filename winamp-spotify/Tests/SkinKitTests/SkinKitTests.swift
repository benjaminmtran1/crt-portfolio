import XCTest
@testable import SkinKit

/// Tests for the parts of the skin engine that are pure logic, and therefore
/// the parts most likely to be silently wrong: archive parsing, the bitmap
/// decoder, the text config formats, and sprite slicing.
final class SkinKitTests: XCTestCase {

    // MARK: - ZIP

    func testReadsStoredZipEntry() throws {
        let payload = Data("main.bmp contents".utf8)
        let archive = try ZipArchive(data: makeZip(entries: [("main.bmp", payload)]))
        XCTAssertEqual(try archive.contents(of: "main.bmp"), payload)
    }

    func testMatchesEntryNamesCaseInsensitively() throws {
        let payload = Data("x".utf8)
        let archive = try ZipArchive(data: makeZip(entries: [("MAIN.BMP", payload)]))
        XCTAssertTrue(archive.contains("main.bmp"))
        XCTAssertEqual(try archive.contents(of: "Main.Bmp"), payload)
    }

    func testFindsEntriesInsideAContainingFolder() throws {
        // Plenty of skins are packed with a wrapper directory.
        let payload = Data("y".utf8)
        let archive = try ZipArchive(data: makeZip(entries: [("My Skin/cbuttons.bmp", payload)]))
        XCTAssertEqual(try archive.contents(of: "cbuttons.bmp"), payload)
    }

    func testRejectsNonZipData() {
        XCTAssertThrowsError(try ZipArchive(data: Data(repeating: 0, count: 64)))
    }

    // MARK: - BMP

    func testDecodes24BitBottomUpBMP() throws {
        // 2x2: red, green on the bottom row; blue, white on the top.
        let bmp = make24BitBMP(
            width: 2,
            height: 2,
            bottomUpRows: [
                [(0, 0, 255), (0, 255, 0)],   // stored first = bottom row
                [(255, 0, 0), (255, 255, 255)],
            ]
        )
        let image = try XCTUnwrap(BMPDecoder.decode(bmp))
        XCTAssertEqual(image.width, 2)
        XCTAssertEqual(image.height, 2)
        // Top-left of the decoded image should be the last stored row.
        let topLeft = try XCTUnwrap(image.pixel(x: 0, y: 0))
        XCTAssertEqual([topLeft.r, topLeft.g, topLeft.b], [255, 0, 0])
        let bottomRight = try XCTUnwrap(image.pixel(x: 1, y: 1))
        XCTAssertEqual([bottomRight.r, bottomRight.g, bottomRight.b], [0, 255, 0])
    }

    func testCroppingPadsOutOfBoundsWithTransparency() {
        let image = RasterImage(width: 1, height: 1, pixels: [255, 255, 255, 255])
        let cropped = image.cropped(x: 0, y: 0, width: 2, height: 2)
        XCTAssertEqual(cropped.width, 2)
        XCTAssertEqual(cropped.pixel(x: 1, y: 1)?.a, 0)
    }

    // MARK: - Text config

    func testParsesPleditColours() {
        let style = PlaylistStyle.parse("""
        [Text]
        Normal=#00FF00
        Current=#FFFFFF
        NormalBG=#000000
        SelectedBG=#0000C6
        Font=Arial
        """)
        XCTAssertEqual(style.normalText, SkinColor(r: 0, g: 255, b: 0))
        XCTAssertEqual(style.selectedBackground, SkinColor(r: 0, g: 0, b: 198))
        XCTAssertEqual(style.fontName, "Arial")
    }

    func testParsesVisColorsAndAlwaysReturns24() {
        let palette = VisualizerPalette.parse("""
        0,0,0       // background
        24,33,41    // grid
        255,0,0     // spectrum bottom
        """)
        XCTAssertEqual(palette.colors.count, 24)
        XCTAssertEqual(palette.background, SkinColor(r: 0, g: 0, b: 0))
        XCTAssertEqual(palette.colors[2], SkinColor(r: 255, g: 0, b: 0))
    }

    func testParsesRegionPolygons() {
        let regions = SkinRegion.parse("""
        [Normal]
        NumPoints=4
        PointList=0,0,275,0,275,116,0,116
        """)
        let normal = regions["normal"]
        XCTAssertEqual(normal?.polygons.count, 1)
        XCTAssertEqual(normal?.polygons.first?.count, 4)
        XCTAssertEqual(normal?.polygons.first?.last, SkinRegion.Point(x: 0, y: 116))
    }

    func testParsesMultiplePolygonsFromOnePointList() {
        let regions = SkinRegion.parse("""
        [Normal]
        NumPoints=3,3
        PointList=0,0,10,0,0,10,20,20,30,20,20,30
        """)
        XCTAssertEqual(regions["normal"]?.polygons.count, 2)
    }

    func testParsesShorthandHexColour() {
        XCTAssertEqual(SkinColor(parsing: "#0f0"), SkinColor(r: 0, g: 255, b: 0))
    }

    // MARK: - Font and marquee

    func testFontMapsCharactersToTheClassicGrid() {
        // 'A' is the first glyph of row 0; '0' the first of row 1.
        XCTAssertEqual(BitmapFontLayout.rect(for: "A"), PixelRect(x: 0, y: 0, width: 5, height: 6))
        XCTAssertEqual(BitmapFontLayout.rect(for: "0"), PixelRect(x: 0, y: 6, width: 5, height: 6))
        // Lowercase folds to uppercase; unmapped characters fall back to space.
        XCTAssertEqual(BitmapFontLayout.rect(for: "a"), BitmapFontLayout.rect(for: "A"))
        XCTAssertEqual(BitmapFontLayout.rect(for: "\u{2014}"), BitmapFontLayout.rect(for: "-"))
    }

    func testMarqueeOnlyScrollsWhenTooLong() {
        let short = MarqueeText(text: "ABC", visibleCharacters: 10)
        XCTAssertFalse(short.needsScrolling)
        XCTAssertEqual(short.frame(at: 5).count, 10)

        let long = MarqueeText(text: String(repeating: "X", count: 40), visibleCharacters: 10)
        XCTAssertTrue(long.needsScrolling)
        XCTAssertEqual(long.frame(at: 0).count, 10)
        // Wrapping is continuous, so any step yields a full window.
        XCTAssertEqual(long.frame(at: 1_000).count, 10)
    }

    // MARK: - Default skin

    func testDefaultSkinIsRenderableAndComplete() {
        let skin = DefaultSkin.make()
        XCTAssertTrue(skin.isRenderable)
        // The built-in skin is also the fallback for partial skins, so every
        // sprite the renderer asks for must exist.
        for id in SpriteID.allCases {
            XCTAssertNotNil(skin.sprite(id), "built-in skin is missing \(id.rawValue)")
        }
        XCTAssertEqual(skin.strip(.digits).count, 11)
        XCTAssertEqual(skin.strip(.volumeBackground).count, 28)
        XCTAssertEqual(skin.strip(.font).count, 93)
        XCTAssertEqual(skin.sprite(.mainBackground)?.width, 275)
        XCTAssertEqual(skin.sprite(.mainBackground)?.height, 116)
    }

    func testMergingFillsGapsFromTheBaseSkin() {
        let base = DefaultSkin.make()
        var partial = Skin(metadata: Skin.Metadata(name: "Partial", format: .classic))
        partial.sprites[.mainBackground] = RasterImage(width: 1, height: 1, pixels: [1, 2, 3, 4])

        let merged = partial.merged(over: base)
        XCTAssertEqual(merged.metadata.name, "Partial")
        XCTAssertEqual(merged.sprite(.mainBackground)?.width, 1)
        // Untouched sprites come from the base.
        XCTAssertNotNil(merged.sprite(.buttonPlay))
        XCTAssertEqual(merged.strip(.digits).count, 11)
    }

    // MARK: - Layout

    func testClassicLayoutControlsDoNotOverlap() {
        // A wrong coordinate in the layout table shows up as two controls
        // fighting over the same pixels, which is hard to spot by eye.
        let layout = SkinLayout.classic
        let slots: [LayoutSlot] = [
            .buttonPrevious, .buttonPlay, .buttonPause, .buttonStop, .buttonNext, .buttonEject,
            .buttonShuffle, .buttonRepeat,
        ]
        for (index, first) in slots.enumerated() {
            for second in slots[(index + 1)...] {
                let a = layout.rect(first)
                let b = layout.rect(second)
                guard a.y < b.maxY, b.y < a.maxY else { continue }
                let horizontalOverlap = min(a.maxX, b.maxX) - max(a.x, b.x)
                // Adjacent buttons in the classic layout abut, and the shuffle
                // and repeat sprites share their edge column outright — so one
                // pixel is expected. More than that is a table error.
                XCTAssertLessThanOrEqual(
                    horizontalOverlap, 1,
                    "\(first.rawValue) overlaps \(second.rawValue) by \(horizontalOverlap)px"
                )
            }
        }
    }

    func testHitTestingPrefersTheSmallerTarget() {
        let layout = SkinLayout.classic
        // The close button sits on the title bar; a click there must be the
        // button, not a window drag.
        let close = layout.rect(.buttonClose)
        let slot = layout.slot(
            at: close.x + 1, y: close.y + 1,
            among: [.titleBar, .buttonClose]
        )
        XCTAssertEqual(slot, .buttonClose)
    }

    // MARK: - Helpers

    /// Builds a minimal ZIP with stored (uncompressed) entries.
    private func makeZip(entries: [(String, Data)]) -> Data {
        var output = Data()
        var directory = Data()
        var offsets: [Int] = []

        func append32(_ value: UInt32, to data: inout Data) {
            data.append(UInt8(value & 0xFF))
            data.append(UInt8((value >> 8) & 0xFF))
            data.append(UInt8((value >> 16) & 0xFF))
            data.append(UInt8((value >> 24) & 0xFF))
        }
        func append16(_ value: UInt16, to data: inout Data) {
            data.append(UInt8(value & 0xFF))
            data.append(UInt8((value >> 8) & 0xFF))
        }

        for (name, payload) in entries {
            offsets.append(output.count)
            let nameData = Data(name.utf8)
            append32(0x0403_4b50, to: &output)
            append16(20, to: &output)          // version needed
            append16(0, to: &output)           // flags
            append16(0, to: &output)           // stored
            append16(0, to: &output)           // mod time
            append16(0, to: &output)           // mod date
            append32(0, to: &output)           // crc (unchecked by the reader)
            append32(UInt32(payload.count), to: &output)
            append32(UInt32(payload.count), to: &output)
            append16(UInt16(nameData.count), to: &output)
            append16(0, to: &output)           // extra length
            output.append(nameData)
            output.append(payload)
        }

        for (index, (name, payload)) in entries.enumerated() {
            let nameData = Data(name.utf8)
            append32(0x0201_4b50, to: &directory)
            append16(20, to: &directory)       // version made by
            append16(20, to: &directory)       // version needed
            append16(0, to: &directory)        // flags
            append16(0, to: &directory)        // stored
            append16(0, to: &directory)        // mod time
            append16(0, to: &directory)        // mod date
            append32(0, to: &directory)        // crc
            append32(UInt32(payload.count), to: &directory)
            append32(UInt32(payload.count), to: &directory)
            append16(UInt16(nameData.count), to: &directory)
            append16(0, to: &directory)        // extra
            append16(0, to: &directory)        // comment
            append16(0, to: &directory)        // disk number
            append16(0, to: &directory)        // internal attributes
            append32(0, to: &directory)        // external attributes
            append32(UInt32(offsets[index]), to: &directory)
            directory.append(nameData)
        }

        let directoryOffset = output.count
        output.append(directory)

        append32(0x0605_4b50, to: &output)
        append16(0, to: &output)               // disk number
        append16(0, to: &output)               // start disk
        append16(UInt16(entries.count), to: &output)
        append16(UInt16(entries.count), to: &output)
        append32(UInt32(directory.count), to: &output)
        append32(UInt32(directoryOffset), to: &output)
        append16(0, to: &output)               // comment length
        return output
    }

    /// Builds an uncompressed 24-bit BMP. Rows are given bottom-up, the order
    /// the format stores them in.
    private func make24BitBMP(
        width: Int,
        height: Int,
        bottomUpRows: [[(UInt8, UInt8, UInt8)]]
    ) -> Data {
        let rowStride = ((width * 24 + 31) / 32) * 4
        var pixels = Data()
        for row in bottomUpRows {
            var rowData = Data()
            for (r, g, b) in row {
                rowData.append(b)
                rowData.append(g)
                rowData.append(r)
            }
            while rowData.count < rowStride { rowData.append(0) }
            pixels.append(rowData)
        }

        var header = Data()
        func append32(_ value: UInt32) {
            header.append(UInt8(value & 0xFF))
            header.append(UInt8((value >> 8) & 0xFF))
            header.append(UInt8((value >> 16) & 0xFF))
            header.append(UInt8((value >> 24) & 0xFF))
        }
        func append16(_ value: UInt16) {
            header.append(UInt8(value & 0xFF))
            header.append(UInt8((value >> 8) & 0xFF))
        }

        header.append(0x42) // 'B'
        header.append(0x4D) // 'M'
        append32(UInt32(14 + 40 + pixels.count))
        append16(0)
        append16(0)
        append32(14 + 40)   // pixel data offset
        append32(40)        // BITMAPINFOHEADER
        append32(UInt32(width))
        append32(UInt32(height))
        append16(1)         // planes
        append16(24)        // bits per pixel
        append32(0)         // BI_RGB
        append32(UInt32(pixels.count))
        append32(2835)      // x pixels per metre
        append32(2835)      // y pixels per metre
        append32(0)         // palette colours
        append32(0)         // important colours

        return header + pixels
    }
}

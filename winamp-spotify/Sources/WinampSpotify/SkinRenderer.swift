import AppKit
import CoreGraphics
import SkinKit

/// Blits skin sprites into a `CGContext` at an exact integer scale.
///
/// Everything here is deliberately pixel-exact: nearest-neighbour sampling, no
/// interpolation, no fractional coordinates. A skinned player that smooths its
/// own artwork looks wrong in a way that is hard to name but impossible to
/// unsee.
final class SkinRenderer {

    private(set) var skin: Skin
    /// Integer size multiplier. 1 is the original 275x116; 2 is Winamp's
    /// classic "double size" mode.
    var scale: Int

    /// Height of the surface being drawn into, in layout pixels.
    ///
    /// Sprite tables address pixels from the top-left, but CoreGraphics draws
    /// images upright only in a bottom-left coordinate space. Rather than use a
    /// flipped view — which would mirror every sprite — the views stay
    /// unflipped and this converts between the two. Each view sets it before
    /// drawing, because the main window changes height in windowshade mode.
    var canvasHeight: Int = 116

    /// `CGImage`s are what CoreGraphics actually draws, and converting a
    /// `RasterImage` is not free, so they are built once per skin.
    private var imageCache: [SpriteID: CGImage] = [:]
    private var stripCache: [SpriteStripID: [CGImage]] = [:]

    init(skin: Skin, scale: Int = 1) {
        self.skin = skin
        self.scale = max(1, scale)
    }

    func apply(skin: Skin) {
        self.skin = skin
        imageCache.removeAll(keepingCapacity: true)
        stripCache.removeAll(keepingCapacity: true)
    }

    // MARK: - Sizing

    /// The main window's size in points at the current scale.
    var mainSize: NSSize {
        let layout = skin.layout.mainSize
        return NSSize(width: layout.width * scale, height: layout.height * scale)
    }

    var shadeSize: NSSize {
        NSSize(width: skin.layout.mainSize.width * scale, height: skin.layout.shadeHeight * scale)
    }

    /// Converts a point in view coordinates to skin-layout pixels, flipping y
    /// so it runs downwards like the sprite tables do.
    func layoutPoint(from point: NSPoint) -> (x: Int, y: Int) {
        let x = Int(floor(point.x)) / scale
        let fromBottom = Int(floor(point.y)) / scale
        return (x, max(0, canvasHeight - 1 - fromBottom))
    }

    // MARK: - Image access

    func image(_ id: SpriteID) -> CGImage? {
        if let cached = imageCache[id] { return cached }
        guard let raster = skin.sprite(id), let image = raster.makeCGImage() else { return nil }
        imageCache[id] = image
        return image
    }

    func strip(_ id: SpriteStripID) -> [CGImage] {
        if let cached = stripCache[id] { return cached }
        let images = skin.strip(id).compactMap { $0.makeCGImage() }
        stripCache[id] = images
        return images
    }

    // MARK: - Drawing

    /// Draws a sprite with its top-left corner at a layout coordinate.
    func draw(_ id: SpriteID, at x: Int, y: Int, in context: CGContext) {
        guard let image = image(id) else { return }
        draw(image, at: x, y: y, in: context)
    }

    /// Draws a sprite scaled to fill a layout rect, for tiled frame pieces.
    func draw(_ id: SpriteID, filling rect: PixelRect, in context: CGContext) {
        guard let image = image(id) else { return }
        context.draw(image, in: deviceRect(rect))
    }

    func draw(_ image: CGImage, at x: Int, y: Int, in context: CGContext) {
        let rect = PixelRect(x: x, y: y, width: image.width, height: image.height)
        context.draw(image, in: deviceRect(rect))
    }

    /// Repeats a sprite horizontally across a rect, the way a classic playlist
    /// window tiles its edges.
    func tileHorizontally(_ id: SpriteID, across rect: PixelRect, in context: CGContext) {
        guard let image = image(id), image.width > 0 else { return }
        var x = rect.x
        while x < rect.maxX {
            let width = min(image.width, rect.maxX - x)
            let source = width == image.width
                ? image
                : image.cropping(to: CGRect(x: 0, y: 0, width: width, height: image.height))
            guard let source else { break }
            context.draw(source, in: deviceRect(PixelRect(x: x, y: rect.y, width: width, height: image.height)))
            x += image.width
        }
    }

    func tileVertically(_ id: SpriteID, across rect: PixelRect, in context: CGContext) {
        guard let image = image(id), image.height > 0 else { return }
        var y = rect.y
        while y < rect.maxY {
            let height = min(image.height, rect.maxY - y)
            let source = height == image.height
                ? image
                : image.cropping(to: CGRect(x: 0, y: 0, width: image.width, height: height))
            guard let source else { break }
            context.draw(source, in: deviceRect(PixelRect(x: rect.x, y: y, width: image.width, height: height)))
            y += image.height
        }
    }

    /// Converts a top-left layout rect into the bottom-left device rect
    /// CoreGraphics draws into.
    func deviceRect(_ rect: PixelRect) -> CGRect {
        CGRect(
            x: CGFloat(rect.x * scale),
            y: CGFloat((canvasHeight - rect.maxY) * scale),
            width: CGFloat(rect.width * scale),
            height: CGFloat(rect.height * scale)
        )
    }

    // MARK: - Text

    /// Draws a string with the skin's bitmap font. Returns the width drawn.
    @discardableResult
    func drawText(
        _ text: String,
        at x: Int,
        y: Int,
        in context: CGContext,
        maxCharacters: Int? = nil,
        pitch: Int = BitmapFontLayout.glyphWidth
    ) -> Int {
        let glyphs = strip(.font)
        guard !glyphs.isEmpty else { return 0 }

        var drawn = 0
        for character in text {
            if let maxCharacters, drawn >= maxCharacters { break }
            if let glyph = glyphImage(for: character, in: glyphs) {
                draw(glyph, at: x + drawn * pitch, y: y, in: context)
            }
            drawn += 1
        }
        return drawn * pitch
    }

    private func glyphImage(for character: Character, in glyphs: [CGImage]) -> CGImage? {
        let rect = BitmapFontLayout.rect(for: character)
        let column = rect.x / BitmapFontLayout.glyphWidth
        let row = rect.y / BitmapFontLayout.glyphHeight
        let index = row * skin.fontColumns + column
        guard glyphs.indices.contains(index) else { return nil }
        return glyphs[index]
    }

    /// Draws the four-digit clock. `nil` blanks the display, which is what the
    /// skin's eleventh digit frame is for.
    func drawClock(minutes: Int?, seconds: Int?, at offsets: [Int], y: Int, in context: CGContext) {
        let digits = strip(.digits)
        guard digits.count >= 10, offsets.count >= 4 else { return }

        let blank: CGImage? = digits.count > 10 ? digits[10] : nil
        let values: [Int?]
        if let minutes, let seconds {
            // Winamp clamps rather than rolling over past 99 minutes.
            let m = min(99, max(0, minutes))
            let s = min(59, max(0, seconds))
            values = [m / 10, m % 10, s / 10, s % 10]
        } else {
            values = [nil, nil, nil, nil]
        }

        for (index, value) in values.enumerated() {
            let image = value.map { digits[$0] } ?? blank
            guard let image else { continue }
            draw(image, at: offsets[index], y: y, in: context)
        }
    }

    // MARK: - Colours

    func nsColor(_ color: SkinColor) -> NSColor {
        NSColor(
            srgbRed: CGFloat(color.r) / 255,
            green: CGFloat(color.g) / 255,
            blue: CGFloat(color.b) / 255,
            alpha: 1
        )
    }

    func cgColor(_ color: SkinColor) -> CGColor {
        CGColor(
            srgbRed: CGFloat(color.r) / 255,
            green: CGFloat(color.g) / 255,
            blue: CGFloat(color.b) / 255,
            alpha: 1
        )
    }
}

extension CGContext {
    /// Turns off every kind of smoothing, so sprites land as exact pixels.
    func configureForPixelArt() {
        interpolationQuality = .none
        setShouldAntialias(false)
        setAllowsAntialiasing(false)
        setShouldSmoothFonts(false)
    }
}

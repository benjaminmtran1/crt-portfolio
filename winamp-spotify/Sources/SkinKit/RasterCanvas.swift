import Foundation

/// A tiny mutable pixel surface.
///
/// Used to synthesise the built-in skin at launch. Skins are pixel art, so the
/// primitives here are deliberately crude and integer-only: no antialiasing, no
/// subpixel anything, just the bevels and dithered gradients that made the
/// original look the way it did.
public struct RasterCanvas {
    public let width: Int
    public let height: Int
    private var pixels: [UInt8]

    public init(width: Int, height: Int, fill: SkinColor? = nil) {
        self.width = max(0, width)
        self.height = max(0, height)
        self.pixels = [UInt8](repeating: 0, count: self.width * self.height * 4)
        if let fill { self.fill(rect: PixelRect(x: 0, y: 0, width: self.width, height: self.height), with: fill) }
    }

    public var image: RasterImage {
        RasterImage(width: width, height: height, pixels: pixels)
    }

    // MARK: - Primitives

    public mutating func set(x: Int, y: Int, _ color: SkinColor, alpha: UInt8 = 255) {
        guard x >= 0, y >= 0, x < width, y < height else { return }
        let i = (y * width + x) * 4
        // Premultiplied, to match RasterImage's contract.
        let scale = Int(alpha)
        pixels[i] = UInt8(Int(color.r) * scale / 255)
        pixels[i + 1] = UInt8(Int(color.g) * scale / 255)
        pixels[i + 2] = UInt8(Int(color.b) * scale / 255)
        pixels[i + 3] = alpha
    }

    public mutating func fill(rect: PixelRect, with color: SkinColor, alpha: UInt8 = 255) {
        for y in rect.y ..< rect.maxY {
            for x in rect.x ..< rect.maxX {
                set(x: x, y: y, color, alpha: alpha)
            }
        }
    }

    public mutating func stroke(rect: PixelRect, with color: SkinColor) {
        guard rect.width > 0, rect.height > 0 else { return }
        for x in rect.x ..< rect.maxX {
            set(x: x, y: rect.y, color)
            set(x: x, y: rect.maxY - 1, color)
        }
        for y in rect.y ..< rect.maxY {
            set(x: rect.x, y: y, color)
            set(x: rect.maxX - 1, y: y, color)
        }
    }

    /// Vertical gradient, rounded per row — the look of a 256-colour era
    /// faceplate rather than a smooth modern one.
    public mutating func verticalGradient(rect: PixelRect, from top: SkinColor, to bottom: SkinColor) {
        guard rect.height > 0 else { return }
        for row in 0 ..< rect.height {
            let t = rect.height == 1 ? 0.0 : Double(row) / Double(rect.height - 1)
            let color = SkinColor(
                r: UInt8(Double(top.r) + (Double(bottom.r) - Double(top.r)) * t),
                g: UInt8(Double(top.g) + (Double(bottom.g) - Double(top.g)) * t),
                b: UInt8(Double(top.b) + (Double(bottom.b) - Double(top.b)) * t)
            )
            for x in rect.x ..< rect.maxX {
                set(x: x, y: rect.y + row, color)
            }
        }
    }

    /// A one-pixel raised or sunken border, the single most Winamp-looking
    /// thing you can draw.
    public mutating func bevel(rect: PixelRect, light: SkinColor, dark: SkinColor, raised: Bool = true) {
        let topLeft = raised ? light : dark
        let bottomRight = raised ? dark : light
        for x in rect.x ..< rect.maxX {
            set(x: x, y: rect.y, topLeft)
            set(x: x, y: rect.maxY - 1, bottomRight)
        }
        for y in rect.y ..< rect.maxY {
            set(x: rect.x, y: y, topLeft)
            set(x: rect.maxX - 1, y: y, bottomRight)
        }
    }

    /// Composites a sprite at a position, honouring its alpha.
    public mutating func draw(_ sprite: RasterImage, atX x: Int, y: Int) {
        for row in 0 ..< sprite.height {
            for column in 0 ..< sprite.width {
                guard let pixel = sprite.pixel(x: column, y: row), pixel.a > 0 else { continue }
                // Sprite pixels are premultiplied; over an opaque destination
                // a simple source-over is exact.
                let dx = x + column
                let dy = y + row
                guard dx >= 0, dy >= 0, dx < width, dy < height else { continue }
                let i = (dy * width + dx) * 4
                let inverse = 255 - Int(pixel.a)
                pixels[i] = UInt8(Int(pixel.r) + Int(pixels[i]) * inverse / 255)
                pixels[i + 1] = UInt8(Int(pixel.g) + Int(pixels[i + 1]) * inverse / 255)
                pixels[i + 2] = UInt8(Int(pixel.b) + Int(pixels[i + 2]) * inverse / 255)
                pixels[i + 3] = UInt8(min(255, Int(pixel.a) + Int(pixels[i + 3]) * inverse / 255))
            }
        }
    }

    /// Paints a monochrome bitmap described as rows of `#` (on) and anything
    /// else (off). This is how the built-in skin's glyphs and icons are drawn.
    public mutating func stamp(_ rows: [String], atX x: Int, y: Int, with color: SkinColor) {
        for (rowIndex, row) in rows.enumerated() {
            for (columnIndex, character) in row.enumerated() where character == "#" {
                set(x: x + columnIndex, y: y + rowIndex, color)
            }
        }
    }
}

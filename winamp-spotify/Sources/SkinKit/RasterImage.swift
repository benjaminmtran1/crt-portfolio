import Foundation
import CoreGraphics
import ImageIO

/// A decoded RGBA8 bitmap.
///
/// Skin assets are tiny (the largest classic sheet is 280x186) and get sliced
/// into dozens of sprites, so keeping them as plain byte buffers is both cheap
/// and lets `SkinKit` stay independent of AppKit/UIKit.
///
/// Alpha is premultiplied, because that is the only 8-bit RGBA layout
/// `CGBitmapContext` will render into; every producer and consumer here agrees
/// on it. Skin sprites are almost entirely opaque, so it rarely matters — but
/// modern skins may carry soft edges, and those stay correct.
public struct RasterImage: Sendable {
    public let width: Int
    public let height: Int
    /// Row-major, 4 bytes per pixel, R G B A, premultiplied alpha.
    public let pixels: [UInt8]

    public init(width: Int, height: Int, pixels: [UInt8]) {
        precondition(pixels.count == width * height * 4, "pixel buffer size mismatch")
        self.width = width
        self.height = height
        self.pixels = pixels
    }

    public var isEmpty: Bool { width == 0 || height == 0 }

    public func pixel(x: Int, y: Int) -> (r: UInt8, g: UInt8, b: UInt8, a: UInt8)? {
        guard x >= 0, y >= 0, x < width, y < height else { return nil }
        let i = (y * width + x) * 4
        return (pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
    }

    /// Replaces every pixel matching `key` with transparency.
    ///
    /// Classic skins mask the main window with `region.txt`, but a fair number
    /// of sprite sheets also lean on magenta as a chroma key, so the loader
    /// offers this per-sheet.
    public func keyingOut(r kr: UInt8, g kg: UInt8, b kb: UInt8) -> RasterImage {
        var out = pixels
        var i = 0
        while i < out.count {
            if out[i] == kr, out[i + 1] == kg, out[i + 2] == kb {
                // Zero all four channels: with premultiplied alpha, a colour
                // riding on zero alpha is undefined data.
                out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0
            }
            i += 4
        }
        return RasterImage(width: width, height: height, pixels: out)
    }

    /// Crops to `rect`, clamped to bounds. Out-of-range sprite rectangles are
    /// common in hand-made skins, so this pads with transparency rather than
    /// failing the whole skin load.
    public func cropped(x: Int, y: Int, width cw: Int, height ch: Int) -> RasterImage {
        guard cw > 0, ch > 0 else { return RasterImage(width: 0, height: 0, pixels: []) }
        var out = [UInt8](repeating: 0, count: cw * ch * 4)
        for row in 0 ..< ch {
            let sy = y + row
            guard sy >= 0, sy < height else { continue }
            for col in 0 ..< cw {
                let sx = x + col
                guard sx >= 0, sx < width else { continue }
                let src = (sy * width + sx) * 4
                let dst = (row * cw + col) * 4
                out[dst] = pixels[src]
                out[dst + 1] = pixels[src + 1]
                out[dst + 2] = pixels[src + 2]
                out[dst + 3] = pixels[src + 3]
            }
        }
        return RasterImage(width: cw, height: ch, pixels: out)
    }

    /// Re-colours a glyph, treating distance from `backgroundLuminance` as
    /// coverage.
    ///
    /// Needed because a classic skin's `text.bmp` has its colour baked in — the
    /// font is bright green because the skin is — but the media library draws
    /// labels on generated widgets whose colours come from the derived theme.
    /// An untinted glyph there can be invisible.
    ///
    /// The font sheet's background is whatever the author used (usually black,
    /// occasionally light), so coverage is the *absolute* distance from it,
    /// normalised by how much room that leaves. Anti-aliased glyph edges come
    /// out as partial alpha, which is what keeps tinted text from looking
    /// chunkier than the original.
    public func tinted(to color: (r: UInt8, g: UInt8, b: UInt8), backgroundLuminance: Double) -> RasterImage {
        guard !isEmpty else { return self }
        let headroom = max(0.08, max(backgroundLuminance, 1 - backgroundLuminance))
        var out = [UInt8](repeating: 0, count: pixels.count)

        var i = 0
        while i < pixels.count {
            // Rec. 709 luma on the raw bytes: this is a coverage estimate, not
            // a colour conversion, so gamma-correctness would be wasted work.
            let luma = (0.2126 * Double(pixels[i])
                + 0.7152 * Double(pixels[i + 1])
                + 0.0722 * Double(pixels[i + 2])) / 255
            let sourceAlpha = Double(pixels[i + 3]) / 255
            let coverage = min(1, abs(luma - backgroundLuminance) / headroom) * sourceAlpha

            let alpha = UInt8((coverage * 255).rounded())
            // Premultiplied, matching this type's contract.
            out[i] = UInt8((Double(color.r) * coverage).rounded())
            out[i + 1] = UInt8((Double(color.g) * coverage).rounded())
            out[i + 2] = UInt8((Double(color.b) * coverage).rounded())
            out[i + 3] = alpha
            i += 4
        }
        return RasterImage(width: width, height: height, pixels: out)
    }

    /// Mean luminance, used to find a font sheet's background tone.
    public var meanLuminance: Double {
        guard !isEmpty else { return 0 }
        var total = 0.0
        var i = 0
        while i < pixels.count {
            total += (0.2126 * Double(pixels[i])
                + 0.7152 * Double(pixels[i + 1])
                + 0.0722 * Double(pixels[i + 2])) / 255
            i += 4
        }
        return total / Double(pixels.count / 4)
    }

    // MARK: - CoreGraphics bridging

    public func makeCGImage() -> CGImage? {
        guard !isEmpty else { return nil }
        guard let provider = CGDataProvider(data: Data(pixels) as CFData) else { return nil }
        return CGImage(
            width: width,
            height: height,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider,
            decode: nil,
            shouldInterpolate: false,
            intent: .defaultIntent
        )
    }

    // MARK: - Decoding

    /// Decodes PNG, BMP, JPEG — anything ImageIO handles — into RGBA8.
    public static func decode(_ data: Data) -> RasterImage? {
        if let viaImageIO = decodeWithImageIO(data) { return viaImageIO }
        // ImageIO rejects a surprising number of skin BMPs (OS/2 headers,
        // top-down rows, bogus header sizes), so fall back to our own decoder.
        return BMPDecoder.decode(data)
    }

    static func decodeWithImageIO(_ data: Data) -> RasterImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return nil }
        return from(cgImage: image)
    }

    public static func from(cgImage image: CGImage) -> RasterImage? {
        let width = image.width
        let height = image.height
        guard width > 0, height > 0 else { return nil }
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        let success = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let base = buffer.baseAddress,
                  let context = CGContext(
                      data: base,
                      width: width,
                      height: height,
                      bitsPerComponent: 8,
                      bytesPerRow: width * 4,
                      space: CGColorSpaceCreateDeviceRGB(),
                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                  ) else { return false }
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard success else { return nil }
        return RasterImage(width: width, height: height, pixels: pixels)
    }
}

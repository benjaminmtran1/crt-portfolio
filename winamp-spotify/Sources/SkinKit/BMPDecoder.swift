import Foundation

/// A small, forgiving Windows BMP decoder.
///
/// ImageIO handles most classic skin bitmaps, but not all of them: skins have
/// been hand-packed since 1997 with OS/2 core headers, top-down row order,
/// palettes shorter than the bit depth implies, and header sizes that disagree
/// with reality. Those skins load fine in Winamp, so they should load here too.
///
/// Supported: 1/4/8-bit palettised, 24-bit BGR, 32-bit BGRX/BGRA, uncompressed
/// (`BI_RGB`) or `BI_BITFIELDS`. RLE-compressed BMPs are not supported — they
/// do not occur in skins.
public enum BMPDecoder {

    public static func decode(_ data: Data) -> RasterImage? {
        guard data.count >= 26 else { return nil }
        // "BM" file magic.
        guard data[data.startIndex] == 0x42, data[data.startIndex + 1] == 0x4D else { return nil }

        let pixelDataOffset = Int(data.le32(10))
        let headerSize = Int(data.le32(14))
        guard headerSize >= 12, 14 + headerSize <= data.count else { return nil }

        let width: Int
        let rawHeight: Int
        let bitsPerPixel: Int
        let compression: Int
        var paletteEntrySize = 4
        var declaredPaletteCount = 0

        if headerSize == 12 {
            // BITMAPCOREHEADER: 16-bit dimensions, 3-byte palette entries.
            width = Int(data.le16(18))
            rawHeight = Int(Int16(bitPattern: data.le16(20)))
            bitsPerPixel = Int(data.le16(24))
            compression = 0
            paletteEntrySize = 3
        } else {
            width = Int(Int32(bitPattern: data.le32(18)))
            rawHeight = Int(Int32(bitPattern: data.le32(22)))
            bitsPerPixel = Int(data.le16(28))
            compression = Int(data.le32(30))
            declaredPaletteCount = Int(data.le32(46))
        }

        guard width > 0, rawHeight != 0, width < 1 << 16, abs(rawHeight) < 1 << 16 else { return nil }
        guard compression == 0 || compression == 3 else { return nil }

        let height = abs(rawHeight)
        // A negative height means rows are stored top-down.
        let isTopDown = rawHeight < 0

        // MARK: Palette

        var palette: [(UInt8, UInt8, UInt8)] = []
        if bitsPerPixel <= 8 {
            let implied = 1 << bitsPerPixel
            let count = declaredPaletteCount > 0 ? min(declaredPaletteCount, implied) : implied
            let paletteStart = 14 + headerSize
            palette.reserveCapacity(count)
            for i in 0 ..< count {
                let p = paletteStart + i * paletteEntrySize
                guard p + 2 < data.count else { break }
                // BMP palettes are stored B, G, R.
                palette.append((data.byte(p + 2), data.byte(p + 1), data.byte(p)))
            }
            // Some skins under-declare the palette; pad so an out-of-range
            // index renders black instead of aborting the load.
            while palette.count < implied { palette.append((0, 0, 0)) }
        }

        // MARK: Pixel data

        // Trust the declared offset, but fall back to "straight after the
        // header and palette" when it is obviously wrong.
        var start = pixelDataOffset
        if start <= 0 || start >= data.count {
            start = 14 + headerSize + palette.count * paletteEntrySize
        }
        guard start < data.count else { return nil }

        // Rows are padded to a 4-byte boundary.
        let rowStride = ((width * bitsPerPixel + 31) / 32) * 4
        var out = [UInt8](repeating: 0, count: width * height * 4)

        for row in 0 ..< height {
            let sourceRow = isTopDown ? row : (height - 1 - row)
            let rowStart = start + sourceRow * rowStride
            guard rowStart < data.count else { continue }

            for col in 0 ..< width {
                var r: UInt8 = 0, g: UInt8 = 0, b: UInt8 = 0, a: UInt8 = 255

                switch bitsPerPixel {
                case 1:
                    let byteIndex = rowStart + col / 8
                    guard byteIndex < data.count else { continue }
                    let bit = (data.byte(byteIndex) >> (7 - UInt8(col % 8))) & 1
                    (r, g, b) = palette[Int(bit)]

                case 4:
                    let byteIndex = rowStart + col / 2
                    guard byteIndex < data.count else { continue }
                    let byte = data.byte(byteIndex)
                    let nibble = col % 2 == 0 ? (byte >> 4) : (byte & 0x0F)
                    (r, g, b) = palette[Int(nibble)]

                case 8:
                    let byteIndex = rowStart + col
                    guard byteIndex < data.count else { continue }
                    (r, g, b) = palette[Int(data.byte(byteIndex))]

                case 24:
                    let p = rowStart + col * 3
                    guard p + 2 < data.count else { continue }
                    b = data.byte(p); g = data.byte(p + 1); r = data.byte(p + 2)

                case 32:
                    let p = rowStart + col * 4
                    guard p + 3 < data.count else { continue }
                    b = data.byte(p); g = data.byte(p + 1); r = data.byte(p + 2)
                    // In BI_RGB the high byte is undefined padding, and plenty
                    // of writers leave it zero — treating that as alpha would
                    // make the whole sheet invisible.
                    a = compression == 3 ? data.byte(p + 3) : 255

                default:
                    return nil
                }

                let dst = (row * width + col) * 4
                if a == 255 {
                    out[dst] = r; out[dst + 1] = g; out[dst + 2] = b; out[dst + 3] = 255
                } else {
                    // Premultiply to match RasterImage's contract.
                    let scale = Int(a)
                    out[dst] = UInt8(Int(r) * scale / 255)
                    out[dst + 1] = UInt8(Int(g) * scale / 255)
                    out[dst + 2] = UInt8(Int(b) * scale / 255)
                    out[dst + 3] = a
                }
            }
        }

        return RasterImage(width: width, height: height, pixels: out)
    }
}

extension Data {
    fileprivate func byte(_ offset: Int) -> UInt8 {
        guard offset >= 0, offset < count else { return 0 }
        return self[startIndex + offset]
    }

    fileprivate func le16(_ offset: Int) -> UInt16 {
        UInt16(byte(offset)) | UInt16(byte(offset + 1)) << 8
    }

    fileprivate func le32(_ offset: Int) -> UInt32 {
        UInt32(byte(offset))
            | UInt32(byte(offset + 1)) << 8
            | UInt32(byte(offset + 2)) << 16
            | UInt32(byte(offset + 3)) << 24
    }
}

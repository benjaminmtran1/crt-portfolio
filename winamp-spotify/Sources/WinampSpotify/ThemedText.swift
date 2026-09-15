import AppKit
import SkinKit

/// Draws text in a skin's colours, either with the skin's bitmap font or with a
/// real system font.
///
/// Both are needed, and Winamp itself proves the point: `pledit.txt` has a
/// `Font=` key, because a 5x6 uppercase-only bitmap font is wrong for a list of
/// album titles. So headers, tabs and short labels use the skin's own glyphs —
/// which is what makes the window feel skinned — and content rows use the font
/// the skin asked for, tinted to match.
struct ThemedText {

    enum Face {
        /// The skin's `text.bmp`. Uppercase only, exactly 5x6 per character.
        case bitmap
        /// The font named in `pledit.txt`, or the system's, at a scaled size.
        case system(weight: NSFont.Weight, monospacedDigits: Bool)

        static let body = Face.system(weight: .regular, monospacedDigits: false)
        static let emphasis = Face.system(weight: .semibold, monospacedDigits: false)
        static let numeric = Face.system(weight: .regular, monospacedDigits: true)
    }

    enum Alignment {
        case left
        case right
        case center
    }

    let renderer: SkinRenderer
    let theme: SkinTheme

    /// Font size in layout pixels. Scales with the window, like everything else.
    var baseFontSize: CGFloat = 10

    // MARK: - Drawing

    /// Draws `text` inside `rect` (layout pixels, top-left origin), truncating
    /// with an ellipsis rather than overflowing into the next column.
    func draw(
        _ text: String,
        in rect: PixelRect,
        color: SkinColor,
        face: Face = .body,
        alignment: Alignment = .left,
        context: CGContext
    ) {
        guard rect.width > 0, rect.height > 0, !text.isEmpty else { return }

        switch face {
        case .bitmap:
            drawBitmap(text, in: rect, color: color, alignment: alignment, context: context)
        case .system(let weight, let monospacedDigits):
            drawSystem(
                text,
                in: rect,
                color: color,
                weight: weight,
                monospacedDigits: monospacedDigits,
                alignment: alignment,
                context: context
            )
        }
    }

    private func drawBitmap(
        _ text: String,
        in rect: PixelRect,
        color: SkinColor,
        alignment: Alignment,
        context: CGContext
    ) {
        let maxCharacters = rect.width / BitmapFontLayout.glyphWidth
        guard maxCharacters > 0 else { return }

        var content = text.uppercased()
        if content.count > maxCharacters {
            content = String(content.prefix(max(0, maxCharacters - 1))) + "\u{2026}"
        }
        let drawnWidth = content.count * BitmapFontLayout.glyphWidth

        let x: Int
        switch alignment {
        case .left: x = rect.x
        case .right: x = rect.maxX - drawnWidth
        case .center: x = rect.x + (rect.width - drawnWidth) / 2
        }
        let y = rect.y + max(0, (rect.height - BitmapFontLayout.glyphHeight) / 2)
        // Tinted: text.bmp bakes the skin's own colour in, which is right for
        // the main window but can be invisible on a generated widget.
        renderer.drawText(
            content,
            at: x, y: y,
            in: context,
            maxCharacters: maxCharacters,
            tint: color
        )
    }

    private func drawSystem(
        _ text: String,
        in rect: PixelRect,
        color: SkinColor,
        weight: NSFont.Weight,
        monospacedDigits: Bool,
        alignment: Alignment,
        context: CGContext
    ) {
        let scale = CGFloat(renderer.scale)
        let size = baseFontSize * scale
        let font = resolveFont(size: size, weight: weight, monospacedDigits: monospacedDigits)

        let paragraph = NSMutableParagraphStyle()
        paragraph.lineBreakMode = .byTruncatingTail
        switch alignment {
        case .left: paragraph.alignment = .left
        case .right: paragraph.alignment = .right
        case .center: paragraph.alignment = .center
        }

        let attributed = NSAttributedString(string: text, attributes: [
            .font: font,
            .foregroundColor: renderer.nsColor(color),
            .paragraphStyle: paragraph,
        ])

        // Sprites are drawn with antialiasing off; text is not readable that
        // way, so it is turned back on for the duration of this draw only.
        context.saveGState()
        context.setShouldAntialias(true)
        context.setShouldSmoothFonts(true)

        let device = renderer.deviceRect(rect)
        // Centre the line box vertically: the rect is a row, not a text frame.
        let lineHeight = font.ascender - font.descender
        let inset = max(0, (device.height - lineHeight) / 2)
        let frame = CGRect(
            x: device.minX,
            y: device.minY + inset,
            width: device.width,
            height: min(device.height, lineHeight)
        )

        let graphicsContext = NSGraphicsContext(cgContext: context, flipped: false)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = graphicsContext
        attributed.draw(with: frame, options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine])
        NSGraphicsContext.restoreGraphicsState()

        context.restoreGState()
    }

    /// Honours the skin's `Font=` request, falling back to the system font when
    /// the name is absent or the font is not installed — which is usual, since
    /// most skins name a Windows font.
    private func resolveFont(
        size: CGFloat,
        weight: NSFont.Weight,
        monospacedDigits: Bool
    ) -> NSFont {
        if let name = theme.listFontName,
           !name.isEmpty,
           let requested = NSFont(name: name, size: size) {
            return requested
        }
        if monospacedDigits {
            return NSFont.monospacedDigitSystemFont(ofSize: size, weight: weight)
        }
        return NSFont.systemFont(ofSize: size, weight: weight)
    }

    /// Height a row needs for the given face, in layout pixels.
    func rowHeight(for face: Face) -> Int {
        switch face {
        case .bitmap:
            return BitmapFontLayout.glyphHeight + 4
        case .system:
            // Two lines (title + subtitle) plus padding, in layout pixels.
            return Int((baseFontSize * 1.35).rounded()) + 2
        }
    }
}

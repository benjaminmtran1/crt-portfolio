import Foundation

/// The classic 5x6 bitmap font packed into `text.bmp`.
///
/// Three rows of glyphs, each glyph 5px wide and 6px tall, in a fixed order
/// that every classic skin follows. Anything outside the table renders as a
/// space, which is what Winamp does too.
public struct BitmapFontLayout: Sendable {
    public static let glyphWidth = 5
    public static let glyphHeight = 6

    /// Row order as defined by the skinning spec. Row 2 is mostly unused by
    /// Western skins but present in the sheet.
    static let rows: [String] = [
        #"ABCDEFGHIJKLMNOPQRSTUVWXYZ"@ "#,
        #"0123456789…:()-'!_+\/[]^&%.=$#"#,
        #"ÅÖÄ?* "#,
    ]

    /// Character -> (row, column) in the sheet, built once.
    static let index: [Character: (row: Int, column: Int)] = {
        var map: [Character: (Int, Int)] = [:]
        for (rowIndex, row) in rows.enumerated() {
            for (columnIndex, character) in row.enumerated() {
                // First occurrence wins; the space in row 0 is the canonical one.
                if map[character] == nil { map[character] = (rowIndex, columnIndex) }
            }
        }
        return map
    }()

    /// The rectangle in `text.bmp` for a character, or the space glyph.
    public static func rect(for character: Character) -> PixelRect {
        let normalised = normalise(character)
        let position = index[normalised] ?? index[" "] ?? (0, 28)
        return PixelRect(
            x: position.1 * glyphWidth,
            y: position.0 * glyphHeight,
            width: glyphWidth,
            height: glyphHeight
        )
    }

    /// Folds a character onto something the sheet can actually draw.
    static func normalise(_ character: Character) -> Character {
        if index[character] != nil { return character }
        // The sheet is uppercase-only.
        let upper = Character(character.uppercased())
        if index[upper] != nil { return upper }
        // Map the punctuation skins omit onto near-equivalents rather than
        // dropping it; track titles are full of smart quotes and dashes.
        switch character {
        case "\u{2018}", "\u{2019}", "`", "\u{00B4}": return "'"
        case "\u{201C}", "\u{201D}": return "\""
        case "\u{2013}", "\u{2014}", "\u{2212}": return "-"
        case ",", ";": return "."
        case "?": return "?"
        case "{": return "["
        case "}": return "]"
        case "|", "\t": return " "
        default: return " "
        }
    }

    public static func width(of text: String) -> Int {
        text.count * glyphWidth
    }
}

/// Text the marquee can draw, scrolled to a character offset.
///
/// Winamp scrolls the song title one character at a time with a separator, and
/// only when the title is too long for its 154px slot — 30 characters at 5px
/// plus the trailing margin.
public struct MarqueeText: Sendable {
    public let text: String
    public let visibleCharacters: Int
    public let separator: String

    public init(text: String, visibleCharacters: Int, separator: String = " *** ") {
        self.text = text
        self.visibleCharacters = max(1, visibleCharacters)
        self.separator = separator
    }

    public var needsScrolling: Bool { text.count > visibleCharacters }

    /// The window of characters to draw at a given scroll step.
    public func frame(at step: Int) -> String {
        guard needsScrolling else {
            return text.padding(toLength: visibleCharacters, withPad: " ", startingAt: 0)
        }
        let loop = Array(text + separator)
        let offset = ((step % loop.count) + loop.count) % loop.count
        var out = ""
        out.reserveCapacity(visibleCharacters)
        for i in 0 ..< visibleCharacters {
            out.append(loop[(offset + i) % loop.count])
        }
        return out
    }
}

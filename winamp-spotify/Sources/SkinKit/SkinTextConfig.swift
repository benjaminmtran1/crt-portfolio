import Foundation

/// An 8-bit-per-channel colour, kept independent of AppKit/UIKit.
public struct SkinColor: Hashable, Codable, Sendable {
    public var r: UInt8
    public var g: UInt8
    public var b: UInt8

    public init(r: UInt8, g: UInt8, b: UInt8) {
        self.r = r
        self.g = g
        self.b = b
    }

    public static let black = SkinColor(r: 0, g: 0, b: 0)
    public static let green = SkinColor(r: 0, g: 255, b: 0)
    public static let white = SkinColor(r: 255, g: 255, b: 255)

    /// Parses `#RRGGBB`, `RRGGBB`, or `r,g,b`.
    public init?(parsing raw: String) {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.contains(",") {
            let parts = trimmed.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
            guard parts.count >= 3 else { return nil }
            self.init(
                r: UInt8(clamping: parts[0]),
                g: UInt8(clamping: parts[1]),
                b: UInt8(clamping: parts[2])
            )
            return
        }
        var hex = trimmed.hasPrefix("#") ? String(trimmed.dropFirst()) : trimmed
        // Skins in the wild write 3-digit shorthand and stray trailing junk.
        if hex.count == 3 {
            hex = hex.map { "\($0)\($0)" }.joined()
        }
        guard hex.count >= 6, let value = UInt32(hex.prefix(6), radix: 16) else { return nil }
        self.init(
            r: UInt8((value >> 16) & 0xFF),
            g: UInt8((value >> 8) & 0xFF),
            b: UInt8(value & 0xFF)
        )
    }
}

/// Colours and the font name for the playlist window, from `pledit.txt`.
public struct PlaylistStyle: Equatable, Codable, Sendable {
    public var normalText: SkinColor
    public var currentText: SkinColor
    public var background: SkinColor
    public var selectedBackground: SkinColor
    /// The "mini browser" colours; some skins set them, most do not.
    public var miniBrowserText: SkinColor
    public var miniBrowserBackground: SkinColor
    public var fontName: String?

    /// Whether the skin actually wrote `mbFG`/`mbBG`, as opposed to these
    /// carrying the default. Winamp's minibrowser was its in-app browser, so
    /// when a skin themed it, that is the most authoritative source for the
    /// media library's colours — but only if it really said so.
    public var declaresMiniBrowserColors: Bool = false

    public static let `default` = PlaylistStyle(
        normalText: SkinColor(r: 0, g: 255, b: 0),
        currentText: .white,
        background: .black,
        selectedBackground: SkinColor(r: 0, g: 0, b: 198),
        miniBrowserText: SkinColor(r: 0, g: 255, b: 0),
        miniBrowserBackground: .black,
        fontName: nil,
        declaresMiniBrowserColors: false
    )

    /// `pledit.txt` is an INI file with a single `[Text]` section.
    public static func parse(_ text: String) -> PlaylistStyle {
        var style = PlaylistStyle.default
        for line in text.split(whereSeparator: \.isNewline) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard let equals = trimmed.firstIndex(of: "=") else { continue }
            let key = trimmed[trimmed.startIndex ..< equals]
                .trimmingCharacters(in: .whitespaces)
                .lowercased()
            let value = String(trimmed[trimmed.index(after: equals)...])
                .trimmingCharacters(in: .whitespaces)

            switch key {
            case "normal": style.normalText = SkinColor(parsing: value) ?? style.normalText
            case "current": style.currentText = SkinColor(parsing: value) ?? style.currentText
            case "normalbg": style.background = SkinColor(parsing: value) ?? style.background
            case "selectedbg": style.selectedBackground = SkinColor(parsing: value) ?? style.selectedBackground
            case "mbfg":
                if let color = SkinColor(parsing: value) {
                    style.miniBrowserText = color
                    style.declaresMiniBrowserColors = true
                }
            case "mbbg":
                if let color = SkinColor(parsing: value) {
                    style.miniBrowserBackground = color
                    style.declaresMiniBrowserColors = true
                }
            case "font": style.fontName = value.isEmpty ? nil : value
            default: break
            }
        }
        return style
    }
}

/// The 24-entry visualiser palette from `viscolor.txt`.
///
/// Index 0 is the background, 1 the grid dots, 2...17 the spectrum-analyser
/// gradient from bottom to top, 18...22 the oscilloscope line, and 23 the
/// peak marker.
public struct VisualizerPalette: Equatable, Codable, Sendable {
    public var colors: [SkinColor]

    public init(colors: [SkinColor]) {
        // Always exactly 24 so index maths never needs a bounds check.
        var padded = colors
        let fallback = VisualizerPalette.defaultColors
        while padded.count < 24 { padded.append(fallback[padded.count]) }
        self.colors = Array(padded.prefix(24))
    }

    public var background: SkinColor { colors[0] }
    public var grid: SkinColor { colors[1] }
    public var peak: SkinColor { colors[23] }

    /// Spectrum gradient, bottom of the bar to the top.
    public var spectrum: [SkinColor] { Array(colors[2 ... 17]) }
    /// Oscilloscope colours, used by distance from the centre line.
    public var oscilloscope: [SkinColor] { Array(colors[18 ... 22]) }

    public static func parse(_ text: String) -> VisualizerPalette {
        var parsed: [SkinColor] = []
        for line in text.split(whereSeparator: \.isNewline) {
            // Entries look like "255,255,255 // comment".
            let payload = line.components(separatedBy: "//")[0]
                .trimmingCharacters(in: .whitespaces)
            guard !payload.isEmpty else { continue }
            guard let color = SkinColor(parsing: payload) else { continue }
            parsed.append(color)
            if parsed.count == 24 { break }
        }
        return VisualizerPalette(colors: parsed)
    }

    /// Winamp's stock palette: black background, grey grid, a green-to-red
    /// spectrum ramp, and a white peak cap.
    public static let defaultColors: [SkinColor] = {
        var colors: [SkinColor] = [
            SkinColor(r: 0, g: 0, b: 0),
            SkinColor(r: 24, g: 33, b: 41),
        ]
        // 16-step ramp: green -> yellow -> red, matching the classic look.
        let ramp: [(UInt8, UInt8, UInt8)] = [
            (239, 49, 16), (206, 41, 16), (214, 90, 0), (214, 102, 0),
            (214, 115, 0), (198, 123, 8), (222, 165, 24), (214, 181, 33),
            (189, 222, 41), (148, 222, 33), (41, 206, 16), (50, 190, 16),
            (57, 181, 16), (49, 156, 8), (41, 148, 0), (24, 132, 8),
        ]
        for entry in ramp { colors.append(SkinColor(r: entry.0, g: entry.1, b: entry.2)) }
        // Oscilloscope.
        for entry in [(57, 181, 16), (41, 165, 16), (50, 190, 16), (57, 181, 16), (49, 156, 8)] {
            colors.append(SkinColor(r: UInt8(entry.0), g: UInt8(entry.1), b: UInt8(entry.2)))
        }
        colors.append(SkinColor(r: 255, g: 255, b: 255))
        return colors
    }()

    public static let `default` = VisualizerPalette(colors: defaultColors)
}

/// Non-rectangular window shapes from `region.txt`.
///
/// Each section holds `NumPoints` — a comma-separated list of vertex counts,
/// one per polygon — and `PointList`, a flat x,y stream covering all of them.
public struct SkinRegion: Equatable, Sendable {
    public struct Point: Equatable, Sendable {
        public var x: Int
        public var y: Int

        public init(x: Int, y: Int) {
            self.x = x
            self.y = y
        }
    }

    /// One entry per polygon; the window shape is their union.
    public var polygons: [[Point]]

    public init(polygons: [[Point]]) {
        self.polygons = polygons
    }

    public var isEmpty: Bool { polygons.allSatisfy { $0.count < 3 } }

    public static func parse(_ text: String) -> [String: SkinRegion] {
        var sections: [String: [String: String]] = [:]
        var current = ""
        for rawLine in text.split(whereSeparator: \.isNewline) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.hasPrefix("[") && line.hasSuffix("]") {
                current = String(line.dropFirst().dropLast()).lowercased()
                sections[current] = [:]
                continue
            }
            guard let equals = line.firstIndex(of: "="), !current.isEmpty else { continue }
            let key = line[line.startIndex ..< equals].trimmingCharacters(in: .whitespaces).lowercased()
            let value = String(line[line.index(after: equals)...]).trimmingCharacters(in: .whitespaces)
            // Values are sometimes split over continuation lines; append.
            sections[current]?[key, default: ""] += value
        }

        var regions: [String: SkinRegion] = [:]
        for (name, keys) in sections {
            guard let counts = keys["numpoints"], let points = keys["pointlist"] else { continue }
            let vertexCounts = counts.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
            let flat = points.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }

            var polygons: [[Point]] = []
            var cursor = 0
            for count in vertexCounts {
                var polygon: [Point] = []
                polygon.reserveCapacity(count)
                for _ in 0 ..< count {
                    guard cursor + 1 < flat.count else { break }
                    polygon.append(Point(x: flat[cursor], y: flat[cursor + 1]))
                    cursor += 2
                }
                if polygon.count >= 3 { polygons.append(polygon) }
            }
            if !polygons.isEmpty { regions[name] = SkinRegion(polygons: polygons) }
        }
        return regions
    }
}

import Foundation

/// Generates widget artwork in a skin's colours.
///
/// This is the other half of the answer to "how do you theme a window the skin
/// has no art for". `SkinTheme` says what colours to use; this draws the
/// controls with them, in the same bevel-and-recess idiom the original skins
/// were built from — a raised faceplate with a light top-left edge and a dark
/// bottom-right one, and sunken wells with that inverted.
///
/// Everything is size-parametric, because a browser window resizes and a
/// classic skin's fixed-size sprites cannot stretch without smearing. Callers
/// are expected to cache the results; generation is cheap but not free.
public struct ThemedChrome {

    public enum ControlState: Hashable, Sendable {
        case normal
        case hovered
        case pressed
        case disabled
        /// A toggle that is on — a selected tab, an engaged button.
        case active
    }

    public let theme: SkinTheme

    public init(theme: SkinTheme) {
        self.theme = theme
    }

    // MARK: - Panels

    /// A raised faceplate panel: the surface everything else sits on.
    public func panel(width: Int, height: Int, bevelled: Bool = true) -> RasterImage {
        var canvas = RasterCanvas(width: width, height: height)
        canvas.verticalGradient(
            rect: PixelRect(x: 0, y: 0, width: width, height: height),
            from: theme.faceHighlight,
            to: theme.faceBase
        )
        if bevelled {
            canvas.bevel(
                rect: PixelRect(x: 0, y: 0, width: width, height: height),
                light: theme.bevelLight,
                dark: theme.bevelDark,
                raised: true
            )
        }
        return canvas.image
    }

    /// A sunken well — a search field, a list background, an artwork frame.
    ///
    /// `interior` defaults to the display background; list views pass their own
    /// so the well matches what is drawn inside it.
    public func well(width: Int, height: Int, interior: SkinColor? = nil) -> RasterImage {
        var canvas = RasterCanvas(width: width, height: height)
        let bounds = PixelRect(x: 0, y: 0, width: width, height: height)
        canvas.fill(rect: bounds, with: interior ?? theme.displayBackground)
        canvas.bevel(rect: bounds, light: theme.bevelLight, dark: theme.bevelDark, raised: false)
        return canvas.image
    }

    // MARK: - Buttons

    public func button(width: Int, height: Int, state: ControlState = .normal) -> RasterImage {
        var canvas = RasterCanvas(width: width, height: height)
        let bounds = PixelRect(x: 0, y: 0, width: width, height: height)

        let top: SkinColor
        let bottom: SkinColor
        switch state {
        case .normal:
            top = theme.faceHighlight
            bottom = theme.faceBase
        case .hovered:
            // A small lift rather than a colour change: skins have no hover
            // artwork, so anything louder looks foreign.
            top = theme.faceHighlight.lightened(by: 0.12)
            bottom = theme.faceBase.lightened(by: 0.12)
        case .pressed:
            top = theme.faceShadow
            bottom = theme.faceBase.darkened(by: 0.2)
        case .disabled:
            top = theme.faceBase
            bottom = theme.faceBase
        case .active:
            top = theme.accent
            bottom = theme.accent.darkened(by: 0.25)
        }

        canvas.verticalGradient(rect: bounds, from: top, to: bottom)
        canvas.bevel(
            rect: bounds,
            light: theme.bevelLight,
            dark: theme.bevelDark,
            raised: state != .pressed
        )
        return canvas.image
    }

    /// Text colour to draw on a button in a given state.
    public func buttonTextColor(_ state: ControlState) -> SkinColor {
        switch state {
        case .active:
            return theme.accentText
        case .disabled:
            return theme.faceBase.mixed(with: theme.bevelDark, amount: 0.5)
        case .normal, .hovered, .pressed:
            return SkinColor.legible(theme.displayText, on: theme.faceBase, minimum: 3.0)
        }
    }

    // MARK: - Tabs

    /// One tab in a strip. Selected tabs lose their bottom edge so they read as
    /// continuous with the panel below.
    public func tab(width: Int, height: Int, selected: Bool, hovered: Bool = false) -> RasterImage {
        var canvas = RasterCanvas(width: width, height: height)
        let bounds = PixelRect(x: 0, y: 0, width: width, height: height)

        if selected {
            canvas.verticalGradient(rect: bounds, from: theme.faceHighlight, to: theme.faceBase)
        } else {
            let shade = hovered ? theme.faceBase : theme.faceShadow
            canvas.verticalGradient(rect: bounds, from: theme.faceBase, to: shade)
        }

        // Top and side edges only.
        for x in 0 ..< width {
            canvas.set(x: x, y: 0, theme.bevelLight)
        }
        for y in 0 ..< height {
            canvas.set(x: 0, y: y, theme.bevelLight)
            canvas.set(x: width - 1, y: y, theme.bevelDark)
        }
        if !selected {
            for x in 0 ..< width {
                canvas.set(x: x, y: height - 1, theme.bevelDark)
            }
        } else {
            // A lit sliver under a selected tab, the cheapest possible
            // "you are here" without inventing artwork.
            for x in 1 ..< max(1, width - 1) {
                canvas.set(x: x, y: height - 1, theme.accent)
                canvas.set(x: x, y: height - 2, theme.accent)
            }
        }
        return canvas.image
    }

    public func tabTextColor(selected: Bool) -> SkinColor {
        let background = selected ? theme.faceHighlight : theme.faceShadow
        return SkinColor.legible(theme.displayText, on: background, minimum: 3.0)
    }

    // MARK: - Scrollbars

    public func scrollTrack(width: Int, height: Int) -> RasterImage {
        var canvas = RasterCanvas(width: width, height: height)
        let bounds = PixelRect(x: 0, y: 0, width: width, height: height)
        canvas.fill(rect: bounds, with: theme.faceShadow)
        canvas.bevel(rect: bounds, light: theme.bevelLight, dark: theme.bevelDark, raised: false)
        return canvas.image
    }

    public func scrollThumb(width: Int, height: Int, pressed: Bool = false) -> RasterImage {
        var canvas = RasterCanvas(width: width, height: height)
        let bounds = PixelRect(x: 0, y: 0, width: width, height: height)
        canvas.verticalGradient(
            rect: bounds,
            from: pressed ? theme.faceBase : theme.bevelLight,
            to: pressed ? theme.faceShadow : theme.faceBase
        )
        canvas.bevel(rect: bounds, light: theme.bevelLight, dark: theme.bevelDark, raised: !pressed)
        // Grip ridges, if there is room for them.
        if height >= 12 {
            let middle = height / 2
            for offset in [-3, 0, 3] {
                for x in 2 ..< max(2, width - 2) {
                    canvas.set(x: x, y: middle + offset, theme.faceShadow)
                }
            }
        }
        return canvas.image
    }

    // MARK: - Miscellany

    /// A horizontal rule.
    public func divider(width: Int) -> RasterImage {
        var canvas = RasterCanvas(width: width, height: 2)
        for x in 0 ..< width {
            canvas.set(x: x, y: 0, theme.bevelDark)
            canvas.set(x: x, y: 1, theme.bevelLight)
        }
        return canvas.image
    }

    /// An indeterminate progress bar at a given phase, 0...1.
    ///
    /// Drawn rather than animated with a sprite sheet so it inherits the accent
    /// colour of whatever skin is loaded.
    public func activityBar(width: Int, height: Int, phase: Double) -> RasterImage {
        var canvas = RasterCanvas(width: width, height: height)
        let bounds = PixelRect(x: 0, y: 0, width: width, height: height)
        canvas.fill(rect: bounds, with: theme.displayBackground)
        canvas.bevel(rect: bounds, light: theme.bevelLight, dark: theme.bevelDark, raised: false)

        let sweepWidth = max(6, width / 4)
        // The sweep travels out and back, so it never jumps at the wrap.
        let travel = Double(max(1, width - sweepWidth - 2))
        let bounced = phase <= 0.5 ? phase * 2 : (1 - phase) * 2
        let x = 1 + Int(bounced * travel)
        canvas.fill(
            rect: PixelRect(x: x, y: 1, width: sweepWidth, height: max(1, height - 2)),
            with: theme.accent
        )
        return canvas.image
    }

    /// A bevel frame for album artwork.
    ///
    /// With `hasImage` true this is **only** the bevel — the interior stays
    /// transparent, because the caller draws it over the artwork it is framing.
    /// Filling it would hide the cover. With `hasImage` false the interior gets
    /// a dim diagonal hatch, which reads as "nothing here yet" without needing
    /// an icon no skin provides.
    public func artworkFrame(size: Int, hasImage: Bool) -> RasterImage {
        var canvas = RasterCanvas(width: size, height: size)
        let bounds = PixelRect(x: 0, y: 0, width: size, height: size)

        if !hasImage {
            canvas.fill(rect: bounds, with: theme.displayBackground)
            var offset = 0
            while offset < size * 2 {
                for y in 0 ..< size {
                    let x = offset - y
                    if x >= 0, x < size { canvas.set(x: x, y: y, theme.displayDim) }
                }
                offset += 6
            }
        }
        canvas.bevel(rect: bounds, light: theme.bevelLight, dark: theme.bevelDark, raised: false)
        return canvas.image
    }
}

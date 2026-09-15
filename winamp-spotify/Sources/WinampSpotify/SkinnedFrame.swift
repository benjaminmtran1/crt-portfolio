import AppKit
import SkinKit

/// Draws the classic resizable window frame at any size.
///
/// The insight this rests on: `pledit.bmp`'s corner and tile sprites are not
/// playlist-specific. They are a general-purpose window chrome — a 20px top
/// edge, tiling side rails, and a 38px bottom panel — and every classic skin
/// has them. So any window this app needs can be framed in a downloaded skin's
/// own artwork, not just the two Winamp itself shipped.
///
/// Shared by the playlist window and the media library so there is one frame
/// implementation to get right. Each window passes its own `SkinRenderer`,
/// because the renderer holds the canvas height used for coordinate flipping.
struct SkinnedFrame {

    /// How the title bar is labelled.
    enum Title {
        /// Use the skin's baked-in `PLAYLIST` sprite.
        case playlistSprite
        /// Draw text with the bitmap font over the generic top tile, tinted so
        /// it is legible against whatever colour that tile is. Used for windows
        /// the skin has no title art for.
        case text(String, tint: SkinColor)
    }

    // Sprite dimensions from ClassicSpriteTable; the frame is assembled from
    // fixed-size pieces, which is also why these windows resize in steps.
    static let topHeight = 20
    static let bottomHeight = 38
    static let leftWidth = 12
    static let rightWidth = 20
    /// Width of the scrollbar gutter inside the right rail.
    static let scrollbarWidth = 15

    let renderer: SkinRenderer
    /// Supplied by windows that letter their own title. The skin's top tile is
    /// artwork of unknown colour, so a title drawn straight onto it can be
    /// illegible; a generated plate gives the text a known background. The
    /// playlist window passes nil, because its title is baked into the sprite.
    let chrome: ThemedChromeCache?

    init(renderer: SkinRenderer, chrome: ThemedChromeCache? = nil) {
        self.renderer = renderer
        self.chrome = chrome
    }

    /// The interior, in layout pixels, for a window of the given layout size.
    func contentRect(width: Int, height: Int) -> PixelRect {
        PixelRect(
            x: Self.leftWidth,
            y: Self.topHeight,
            width: max(0, width - Self.leftWidth - Self.rightWidth),
            height: max(0, height - Self.topHeight - Self.bottomHeight)
        )
    }

    func closeButtonRect(width: Int) -> PixelRect {
        PixelRect(x: width - 12, y: 3, width: 9, height: 9)
    }

    func shadeButtonRect(width: Int) -> PixelRect {
        PixelRect(x: width - 22, y: 3, width: 9, height: 9)
    }

    // MARK: - Drawing

    func draw(
        in context: CGContext,
        width: Int,
        height: Int,
        isActive: Bool,
        title: Title
    ) {
        let topLeft: SpriteID = isActive ? .playlistTopLeftActive : .playlistTopLeftInactive
        let topRight: SpriteID = isActive ? .playlistTopRightActive : .playlistTopRightInactive
        let topTile: SpriteID = isActive ? .playlistTopTileActive : .playlistTopTileInactive

        // Top edge: tile the whole span first, then lay the corners over it, so
        // a tile width that does not divide evenly never leaves a seam.
        renderer.tileHorizontally(
            topTile,
            across: PixelRect(x: 0, y: 0, width: width, height: Self.topHeight),
            in: context
        )
        renderer.draw(topLeft, at: 0, y: 0, in: context)
        renderer.draw(topRight, at: max(25, width - 25), y: 0, in: context)

        switch title {
        case .playlistSprite:
            let sprite: SpriteID = isActive ? .playlistTitleBarActive : .playlistTitleBarInactive
            let spriteWidth = renderer.image(sprite)?.width ?? 100
            renderer.draw(sprite, at: max(25, (width - spriteWidth) / 2), y: 0, in: context)

        case .text(let label, let tint):
            // The skin's title sprite says "PLAYLIST", so a different window
            // has to letter its own — on a generated plate, so the text has a
            // background whose colour is known rather than whatever the skin's
            // tile happens to be.
            let textWidth = label.count * BitmapFontLayout.glyphWidth
            let plateWidth = textWidth + 16
            let plateX = max(26, (width - plateWidth) / 2)
            if let plate = chrome?.panel(width: plateWidth, height: 14, bevelled: true) {
                renderer.draw(plate, at: plateX, y: 3, in: context)
            }
            renderer.drawText(
                label,
                at: plateX + 8,
                y: 7,
                in: context,
                tint: tint
            )
        }

        // Side rails.
        renderer.tileVertically(
            .playlistLeftTile,
            across: PixelRect(
                x: 0, y: Self.topHeight,
                width: Self.leftWidth,
                height: max(0, height - Self.topHeight - Self.bottomHeight)
            ),
            in: context
        )
        renderer.tileVertically(
            .playlistRightTile,
            across: PixelRect(
                x: max(0, width - Self.rightWidth), y: Self.topHeight,
                width: Self.rightWidth,
                height: max(0, height - Self.topHeight - Self.bottomHeight)
            ),
            in: context
        )

        // Bottom panel: same tile-then-overlay order as the top.
        let bottomY = height - Self.bottomHeight
        renderer.tileHorizontally(
            .playlistBottomTile,
            across: PixelRect(x: 0, y: bottomY, width: width, height: Self.bottomHeight),
            in: context
        )
        renderer.draw(.playlistBottomLeft, at: 0, y: bottomY, in: context)
        let bottomRightWidth = renderer.image(.playlistBottomRight)?.width ?? 150
        renderer.draw(
            .playlistBottomRight,
            at: max(0, width - bottomRightWidth), y: bottomY,
            in: context
        )

        renderer.draw(.playlistShadeButton, at: width - 22, y: 3, in: context)
        renderer.draw(.playlistCloseButton, at: width - 12, y: 3, in: context)
    }

    /// Draws the scrollbar in the right rail, using the skin's own thumb sprite.
    ///
    /// Returns the thumb's rect so the caller can hit-test it.
    @discardableResult
    func drawScrollbar(
        in context: CGContext,
        width: Int,
        content: PixelRect,
        fraction: Double,
        pressed: Bool
    ) -> PixelRect? {
        guard let thumb = renderer.image(
            pressed ? .playlistScrollThumbPressed : .playlistScrollThumb
        ) else { return nil }

        let x = width - Self.scrollbarWidth
        let travel = max(0, content.height - thumb.height)
        let y = content.y + Int((min(1, max(0, fraction)) * Double(travel)).rounded())
        renderer.draw(thumb, at: x, y: y, in: context)
        return PixelRect(x: x, y: y, width: thumb.width, height: thumb.height)
    }
}

/// Caches the generated widget art so resizing a window does not redraw every
/// bevel from scratch on every frame.
///
/// Keyed by kind, size and state. A `SkinTheme` change clears the lot, which is
/// what happens on a skin switch.
final class ThemedChromeCache {

    private enum Key: Hashable {
        case panel(width: Int, height: Int, bevelled: Bool)
        case well(width: Int, height: Int, interior: SkinColor?)
        case button(width: Int, height: Int, state: ThemedChrome.ControlState)
        case tab(width: Int, height: Int, selected: Bool, hovered: Bool)
        case scrollTrack(width: Int, height: Int)
        case divider(width: Int)
        case artworkFrame(size: Int, hasImage: Bool)
    }

    private(set) var chrome: ThemedChrome
    private var cache: [Key: CGImage] = [:]

    init(theme: SkinTheme) {
        self.chrome = ThemedChrome(theme: theme)
    }

    var theme: SkinTheme { chrome.theme }

    func apply(theme: SkinTheme) {
        guard theme != chrome.theme else { return }
        chrome = ThemedChrome(theme: theme)
        cache.removeAll(keepingCapacity: true)
    }

    private func image(_ key: Key, _ build: () -> RasterImage) -> CGImage? {
        if let cached = cache[key] { return cached }
        guard let image = build().makeCGImage() else { return nil }
        // Bounded so that dragging a resize handle cannot grow this without
        // limit: every distinct width produces a new entry.
        if cache.count > 400 { cache.removeAll(keepingCapacity: true) }
        cache[key] = image
        return image
    }

    func panel(width: Int, height: Int, bevelled: Bool = true) -> CGImage? {
        image(.panel(width: width, height: height, bevelled: bevelled)) {
            chrome.panel(width: width, height: height, bevelled: bevelled)
        }
    }

    func well(width: Int, height: Int, interior: SkinColor? = nil) -> CGImage? {
        image(.well(width: width, height: height, interior: interior)) {
            chrome.well(width: width, height: height, interior: interior)
        }
    }

    func button(width: Int, height: Int, state: ThemedChrome.ControlState) -> CGImage? {
        image(.button(width: width, height: height, state: state)) {
            chrome.button(width: width, height: height, state: state)
        }
    }

    func tab(width: Int, height: Int, selected: Bool, hovered: Bool) -> CGImage? {
        image(.tab(width: width, height: height, selected: selected, hovered: hovered)) {
            chrome.tab(width: width, height: height, selected: selected, hovered: hovered)
        }
    }

    func scrollTrack(width: Int, height: Int) -> CGImage? {
        image(.scrollTrack(width: width, height: height)) {
            chrome.scrollTrack(width: width, height: height)
        }
    }

    func divider(width: Int) -> CGImage? {
        image(.divider(width: width)) { chrome.divider(width: width) }
    }

    func artworkFrame(size: Int, hasImage: Bool) -> CGImage? {
        image(.artworkFrame(size: size, hasImage: hasImage)) {
            chrome.artworkFrame(size: size, hasImage: hasImage)
        }
    }

    // Passthroughs, so callers never have to reach through two levels of
    // "chrome" to ask what colour a label should be.
    func buttonTextColor(_ state: ThemedChrome.ControlState) -> SkinColor {
        chrome.buttonTextColor(state)
    }

    func tabTextColor(selected: Bool) -> SkinColor {
        chrome.tabTextColor(selected: selected)
    }
}

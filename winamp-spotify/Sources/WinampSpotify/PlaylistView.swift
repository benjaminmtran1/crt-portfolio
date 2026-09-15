import AppKit
import SkinKit
import PlayerCore

protocol PlaylistViewDelegate: AnyObject {
    func playlistView(_ view: PlaylistView, didActivate entry: PlaylistEntry)
    func playlistView(_ view: PlaylistView, didChangeSelection selection: Set<UUID>)
    func playlistViewDidRequestClose(_ view: PlaylistView)
    func playlistViewDidToggleShade(_ view: PlaylistView)
    func playlistView(_ view: PlaylistView, didPressMenuButton button: PlaylistView.MenuButton, at point: NSPoint)
}

/// The playlist window's contents, drawn from the skin's `pledit.bmp` frame
/// pieces and `pledit.txt` colours.
///
/// Resizable, unlike the main window — and like Winamp, only in 25-pixel steps,
/// because the frame is built from fixed-width tiles.
final class PlaylistView: NSView {

    /// The four menu buttons along the bottom edge.
    enum MenuButton: String, CaseIterable {
        case add = "ADD"
        case remove = "REM"
        case select = "SEL"
        case misc = "MISC"
        case list = "LIST"
    }

    weak var delegate: PlaylistViewDelegate?

    private let renderer: SkinRenderer

    var playlist = Playlist() {
        didSet { needsDisplay = true }
    }

    var nowPlayingURI: String? {
        didSet { if nowPlayingURI != oldValue { needsDisplay = true } }
    }

    /// First visible row.
    private var scrollRow = 0
    /// Anchor for shift-click range selection.
    private var selectionAnchor: Int?
    private var isDraggingScrollbar = false

    // MARK: Geometry constants
    //
    // The classic frame is assembled from fixed-size tiles, so these are not
    // arbitrary: they are the sprite dimensions in `ClassicSpriteTable`.

    private let topHeight = 20
    private let bottomHeight = 38
    private let leftWidth = 12
    private let rightWidth = 20
    /// Tuned for the 6px bitmap font: enough leading to be readable without
    /// wasting rows.
    private let rowHeight = 10

    init(renderer: SkinRenderer) {
        self.renderer = renderer
        super.init(frame: NSRect(x: 0, y: 0, width: 275, height: 232))
        wantsLayer = true
        layer?.magnificationFilter = .nearest
    }

    required init?(coder: NSCoder) {
        fatalError("PlaylistView is created in code only")
    }

    override var isFlipped: Bool { false }

    // MARK: - Layout maths

    /// Window size in layout pixels at the current scale.
    private var layoutSize: (width: Int, height: Int) {
        (Int(bounds.width) / renderer.scale, Int(bounds.height) / renderer.scale)
    }

    private var contentRect: PixelRect {
        let size = layoutSize
        return PixelRect(
            x: leftWidth,
            y: topHeight,
            width: max(0, size.width - leftWidth - rightWidth),
            height: max(0, size.height - topHeight - bottomHeight)
        )
    }

    private var visibleRowCount: Int {
        max(1, contentRect.height / rowHeight)
    }

    private var maximumScrollRow: Int {
        max(0, playlist.count - visibleRowCount)
    }

    // MARK: - Drawing

    override func draw(_ dirtyRect: NSRect) {
        guard let context = NSGraphicsContext.current?.cgContext else { return }
        context.configureForPixelArt()

        let size = layoutSize
        renderer.canvasHeight = size.height
        let isActive = window?.isKeyWindow ?? false

        drawFrame(in: context, size: size, isActive: isActive)
        drawEntries(in: context)
        drawScrollbar(in: context, size: size)
        drawBottomBar(in: context, size: size)
    }

    private func drawFrame(in context: CGContext, size: (width: Int, height: Int), isActive: Bool) {
        let style = renderer.skin.playlistStyle

        // Interior first, so the tiles overlap it rather than the reverse.
        context.setFillColor(renderer.cgColor(style.background))
        context.fill(renderer.deviceRect(contentRect))

        // Top edge: left corner, title block, filler tiles, right corner.
        let topLeft: SpriteID = isActive ? .playlistTopLeftActive : .playlistTopLeftInactive
        let topRight: SpriteID = isActive ? .playlistTopRightActive : .playlistTopRightInactive
        let topTile: SpriteID = isActive ? .playlistTopTileActive : .playlistTopTileInactive
        let titleBar: SpriteID = isActive ? .playlistTitleBarActive : .playlistTitleBarInactive

        renderer.draw(topLeft, at: 0, y: 0, in: context)
        let titleWidth = renderer.image(titleBar)?.width ?? 100
        let titleX = max(25, (size.width - titleWidth) / 2)
        renderer.tileHorizontally(
            topTile,
            across: PixelRect(x: 25, y: 0, width: max(0, size.width - 50), height: topHeight),
            in: context
        )
        renderer.draw(titleBar, at: titleX, y: 0, in: context)
        renderer.draw(topRight, at: max(25, size.width - 25), y: 0, in: context)

        // Side edges.
        renderer.tileVertically(
            .playlistLeftTile,
            across: PixelRect(x: 0, y: topHeight, width: leftWidth, height: contentRect.height),
            in: context
        )
        renderer.tileVertically(
            .playlistRightTile,
            across: PixelRect(x: max(0, size.width - rightWidth), y: topHeight, width: rightWidth, height: contentRect.height),
            in: context
        )

        // Bottom edge.
        let bottomY = size.height - bottomHeight
        renderer.tileHorizontally(
            .playlistBottomTile,
            across: PixelRect(x: 0, y: bottomY, width: size.width, height: bottomHeight),
            in: context
        )
        renderer.draw(.playlistBottomLeft, at: 0, y: bottomY, in: context)
        let bottomRightWidth = renderer.image(.playlistBottomRight)?.width ?? 150
        renderer.draw(.playlistBottomRight, at: max(0, size.width - bottomRightWidth), y: bottomY, in: context)

        // Title-bar buttons.
        renderer.draw(.playlistShadeButton, at: size.width - 22, y: 3, in: context)
        renderer.draw(.playlistCloseButton, at: size.width - 12, y: 3, in: context)
    }

    private func drawEntries(in context: CGContext) {
        let style = renderer.skin.playlistStyle
        let rect = contentRect
        guard rect.width > 0, rect.height > 0, !playlist.isEmpty else { return }

        let numberColumnWidth = 4 * BitmapFontLayout.glyphWidth
        let durationColumnWidth = 6 * BitmapFontLayout.glyphWidth
        let titleWidth = max(0, rect.width - numberColumnWidth - durationColumnWidth - 4)
        let titleCharacters = titleWidth / BitmapFontLayout.glyphWidth

        for offset in 0 ..< visibleRowCount {
            let index = scrollRow + offset
            guard playlist.entries.indices.contains(index) else { break }
            let entry = playlist.entries[index]
            let y = rect.y + offset * rowHeight

            if playlist.selection.contains(entry.id) {
                context.setFillColor(renderer.cgColor(style.selectedBackground))
                context.fill(renderer.deviceRect(
                    PixelRect(x: rect.x, y: y, width: rect.width, height: rowHeight)
                ))
            }

            // Text is drawn with the skin's bitmap font, which carries its own
            // colour. pledit.txt drives the background and selection instead,
            // which is how most classic skins actually look.
            let textY = y + (rowHeight - BitmapFontLayout.glyphHeight) / 2

            renderer.drawText(
                "\(index + 1).",
                at: rect.x + 2, y: textY, in: context,
                maxCharacters: 4
            )
            renderer.drawText(
                entry.displayTitle.uppercased(),
                at: rect.x + 2 + numberColumnWidth, y: textY, in: context,
                maxCharacters: titleCharacters
            )
            renderer.drawText(
                entry.durationText,
                at: rect.maxX - durationColumnWidth, y: textY, in: context,
                maxCharacters: 6
            )

            // Mark the playing row with a leading caret, since recolouring a
            // bitmap font is not something a classic skin supports.
            if let nowPlayingURI, entry.uri == nowPlayingURI {
                renderer.drawText(">", at: rect.x - 4, y: textY, in: context, maxCharacters: 1)
            }
        }
    }

    private func drawScrollbar(in context: CGContext, size: (width: Int, height: Int)) {
        guard playlist.count > visibleRowCount else { return }
        guard let thumb = renderer.image(
            isDraggingScrollbar ? .playlistScrollThumbPressed : .playlistScrollThumb
        ) else { return }

        let trackX = size.width - 15
        let trackTop = topHeight
        let trackHeight = contentRect.height
        let travel = max(0, trackHeight - thumb.height)
        let fraction = Double(scrollRow) / Double(max(1, maximumScrollRow))
        let y = trackTop + Int((fraction * Double(travel)).rounded())
        renderer.draw(thumb, at: trackX, y: y, in: context)
    }

    private func drawBottomBar(in context: CGContext, size: (width: Int, height: Int)) {
        let y = size.height - bottomHeight + 12

        for (index, button) in MenuButton.allCases.enumerated() where button != .list {
            renderer.drawText(button.rawValue, at: 6 + index * 26, y: y, in: context)
        }
        renderer.drawText(MenuButton.list.rawValue, at: max(0, size.width - 30), y: y, in: context)

        // Winamp shows "selected / total" durations here; with one playlist we
        // show the total and the count, which is the useful half.
        let summary = "\(playlist.count) TRACKS  \(PlaylistEntry.formatDuration(playlist.totalDuration))"
        let maxCharacters = max(0, (size.width - 140) / BitmapFontLayout.glyphWidth)
        renderer.drawText(summary, at: 112, y: y, in: context, maxCharacters: maxCharacters)
    }

    // MARK: - Interaction

    private func row(at point: NSPoint) -> Int? {
        let (_, y) = renderer.layoutPoint(from: point)
        let rect = contentRect
        guard y >= rect.y, y < rect.maxY else { return nil }
        let index = scrollRow + (y - rect.y) / rowHeight
        return playlist.entries.indices.contains(index) ? index : nil
    }

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let (x, y) = renderer.layoutPoint(from: point)
        let size = layoutSize

        // Title-bar buttons.
        if y < topHeight {
            if x >= size.width - 12 {
                delegate?.playlistViewDidRequestClose(self)
                return
            }
            if x >= size.width - 22 {
                delegate?.playlistViewDidToggleShade(self)
                return
            }
            window?.performDrag(with: event)
            return
        }

        // Bottom bar.
        if y >= size.height - bottomHeight {
            if let button = menuButton(atX: x, size: size) {
                delegate?.playlistView(self, didPressMenuButton: button, at: point)
                return
            }
            window?.performDrag(with: event)
            return
        }

        // Scrollbar.
        if x >= size.width - rightWidth, playlist.count > visibleRowCount {
            isDraggingScrollbar = true
            updateScroll(forPointAtY: y)
            return
        }

        guard let index = row(at: point) else {
            window?.performDrag(with: event)
            return
        }

        if event.clickCount >= 2 {
            delegate?.playlistView(self, didActivate: playlist.entries[index])
            return
        }
        updateSelection(index: index, modifiers: event.modifierFlags)
    }

    override func mouseDragged(with event: NSEvent) {
        guard isDraggingScrollbar else { return }
        let point = convert(event.locationInWindow, from: nil)
        let (_, y) = renderer.layoutPoint(from: point)
        updateScroll(forPointAtY: y)
    }

    override func mouseUp(with event: NSEvent) {
        if isDraggingScrollbar {
            isDraggingScrollbar = false
            needsDisplay = true
        }
    }

    override func scrollWheel(with event: NSEvent) {
        guard playlist.count > visibleRowCount else { return }
        let lines = event.hasPreciseScrollingDeltas
            ? Int((event.scrollingDeltaY / 10).rounded())
            : Int(event.scrollingDeltaY.rounded())
        guard lines != 0 else { return }
        scrollRow = min(maximumScrollRow, max(0, scrollRow - lines))
        needsDisplay = true
    }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: // Down arrow
            moveSelection(by: 1)
        case 126: // Up arrow
            moveSelection(by: -1)
        case 36, 76: // Return, keypad Enter
            if let id = playlist.selection.first,
               let entry = playlist.entries.first(where: { $0.id == id }) {
                delegate?.playlistView(self, didActivate: entry)
            }
        case 51, 117: // Delete, forward delete
            var updated = playlist
            updated.removeSelected()
            playlist = updated
            delegate?.playlistView(self, didChangeSelection: playlist.selection)
        default:
            super.keyDown(with: event)
        }
    }

    override var acceptsFirstResponder: Bool { true }

    private func menuButton(atX x: Int, size: (width: Int, height: Int)) -> MenuButton? {
        if x >= size.width - 34 { return .list }
        let buttons = MenuButton.allCases.filter { $0 != .list }
        for (index, button) in buttons.enumerated() {
            let start = 6 + index * 26
            if x >= start, x < start + 22 { return button }
        }
        return nil
    }

    private func updateScroll(forPointAtY y: Int) {
        let rect = contentRect
        let thumbHeight = renderer.image(.playlistScrollThumb)?.height ?? 18
        let travel = max(1, rect.height - thumbHeight)
        let offset = y - rect.y - thumbHeight / 2
        let fraction = min(1, max(0, Double(offset) / Double(travel)))
        scrollRow = Int((fraction * Double(maximumScrollRow)).rounded())
        needsDisplay = true
    }

    private func updateSelection(index: Int, modifiers: NSEvent.ModifierFlags) {
        let entry = playlist.entries[index]
        var selection = playlist.selection

        if modifiers.contains(.shift), let anchor = selectionAnchor {
            let range = min(anchor, index) ... max(anchor, index)
            selection = Set(range.compactMap { playlist.entries.indices.contains($0) ? playlist.entries[$0].id : nil })
        } else if modifiers.contains(.command) {
            if selection.contains(entry.id) {
                selection.remove(entry.id)
            } else {
                selection.insert(entry.id)
            }
            selectionAnchor = index
        } else {
            selection = [entry.id]
            selectionAnchor = index
        }

        playlist.selection = selection
        delegate?.playlistView(self, didChangeSelection: selection)
        needsDisplay = true
    }

    private func moveSelection(by delta: Int) {
        let current = selectionAnchor ?? scrollRow
        let next = min(playlist.count - 1, max(0, current + delta))
        guard playlist.entries.indices.contains(next) else { return }
        selectionAnchor = next
        playlist.selection = [playlist.entries[next].id]
        // Keep the selection on screen.
        if next < scrollRow { scrollRow = next }
        if next >= scrollRow + visibleRowCount { scrollRow = next - visibleRowCount + 1 }
        delegate?.playlistView(self, didChangeSelection: playlist.selection)
        needsDisplay = true
    }

    /// Scrolls so the given URI is visible, used when playback moves on.
    func scrollToTrack(uri: String) {
        guard let index = playlist.entries.firstIndex(where: { $0.uri == uri }) else { return }
        if index < scrollRow || index >= scrollRow + visibleRowCount {
            scrollRow = min(maximumScrollRow, max(0, index - visibleRowCount / 2))
            needsDisplay = true
        }
    }
}

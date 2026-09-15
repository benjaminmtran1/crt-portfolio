import AppKit
import SkinKit

/// A borderless window that is exactly the size of the skin it draws.
///
/// No title bar, no traffic lights, no resize handles — the skin supplies all
/// of that. `region.txt` shapes are honoured with a layer mask, so a skin with
/// rounded or notched edges really has them rather than showing background
/// through square corners.
final class SkinnedWindow: NSWindow {

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }

    init(contentRect: NSRect) {
        super.init(
            contentRect: contentRect,
            styleMask: [.borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        // The view handles dragging itself, so that clicks on controls are not
        // swallowed by a window-wide drag region.
        isMovableByWindowBackground = false
        // A compact player is a utility, so it floats above document windows
        // but is not a global always-on-top nuisance.
        level = .normal
        collectionBehavior = [.managed, .participatesInCycle, .fullScreenAuxiliary]
        animationBehavior = .utilityWindow
    }

    /// Resizes around the top-left corner.
    ///
    /// Cocoa anchors windows at the bottom-left, so a naive `setContentSize`
    /// makes windowshade mode and double-size mode appear to grow downwards
    /// out of the title bar.
    func setContentSizeKeepingTopLeft(_ size: NSSize) {
        let currentFrame = frame
        let newFrame = NSRect(
            x: currentFrame.origin.x,
            y: currentFrame.maxY - size.height,
            width: size.width,
            height: size.height
        )
        setFrame(newFrame, display: true)
    }

    /// Applies a `region.txt` shape, in layout pixels, at the given scale.
    ///
    /// Passing an empty region clears any previous mask, which matters when
    /// switching from a shaped skin back to a rectangular one.
    func applyRegion(_ region: SkinRegion?, scale: Int, canvasHeight: Int) {
        guard let contentView, let layer = contentView.layer else { return }

        guard let region, !region.isEmpty else {
            layer.mask = nil
            return
        }

        let path = CGMutablePath()
        for polygon in region.polygons {
            guard let first = polygon.first else { continue }
            // region.txt is top-left origin; the layer is bottom-left.
            func convert(_ point: SkinRegion.Point) -> CGPoint {
                CGPoint(
                    x: CGFloat(point.x * scale),
                    y: CGFloat((canvasHeight - point.y) * scale)
                )
            }
            path.move(to: convert(first))
            for point in polygon.dropFirst() { path.addLine(to: convert(point)) }
            path.closeSubpath()
        }

        let mask = CAShapeLayer()
        mask.path = path
        mask.frame = layer.bounds
        // Winamp regions are unions of overlapping polygons, which is exactly
        // what the non-zero winding rule gives.
        mask.fillRule = .nonZero
        layer.mask = mask
    }
}

/// Owns the main window and wires the view's taps to the player.
///
/// The controller layer is where "what the button means" lives; the view knows
/// only which pixels were clicked, and the coordinator knows only about
/// playback. Keeping those three apart is what makes the skin swappable.
final class MainWindowController: NSWindowController {

    let playerView: MainPlayerView
    private let skinnedWindow: SkinnedWindow

    var isShaded: Bool { playerView.isShaded }

    init(playerView: MainPlayerView) {
        self.playerView = playerView
        let size = playerView.renderer.mainSize
        self.skinnedWindow = SkinnedWindow(contentRect: NSRect(origin: .zero, size: size))
        super.init(window: skinnedWindow)

        skinnedWindow.contentView = playerView
        playerView.wantsLayer = true
        skinnedWindow.title = "Winamp Spotify"
        // Remembered across launches by frame autosave, so the player comes
        // back where it was left.
        skinnedWindow.setFrameAutosaveName("MainPlayerWindow")
        if skinnedWindow.frame.origin == .zero {
            skinnedWindow.center()
        }
        applyCurrentSkinShape()
    }

    required init?(coder: NSCoder) {
        fatalError("MainWindowController is created in code only")
    }

    // MARK: - Appearance

    func setScale(_ scale: Int) {
        playerView.renderer.scale = max(1, scale)
        resizeToFitSkin()
    }

    func applySkin(_ skin: Skin) {
        playerView.renderer.apply(skin: skin)
        resizeToFitSkin()
        playerView.needsDisplay = true
    }

    func toggleShade() {
        playerView.isShaded.toggle()
        resizeToFitSkin()
    }

    private func resizeToFitSkin() {
        let renderer = playerView.renderer
        let size = playerView.isShaded ? renderer.shadeSize : renderer.mainSize
        skinnedWindow.setContentSizeKeepingTopLeft(size)
        playerView.frame = NSRect(origin: .zero, size: size)
        applyCurrentSkinShape()
        playerView.needsDisplay = true
    }

    private func applyCurrentSkinShape() {
        let renderer = playerView.renderer
        let layout = renderer.skin.layout
        let canvasHeight = playerView.isShaded ? layout.shadeHeight : layout.mainSize.height
        let key = playerView.isShaded ? "windowshade" : "normal"
        skinnedWindow.applyRegion(
            renderer.skin.regions[key],
            scale: renderer.scale,
            canvasHeight: canvasHeight
        )
    }
}

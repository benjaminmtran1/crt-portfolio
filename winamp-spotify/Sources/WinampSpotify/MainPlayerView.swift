import AppKit
import SkinKit
import PlayerCore
import AudioVis

/// What the user just pressed. The window controller turns these into playback
/// commands so the view stays a pure renderer plus hit-tester.
protocol MainPlayerViewDelegate: AnyObject {
    func playerViewDidTapPrevious(_ view: MainPlayerView)
    func playerViewDidTapPlay(_ view: MainPlayerView)
    func playerViewDidTapPause(_ view: MainPlayerView)
    func playerViewDidTapStop(_ view: MainPlayerView)
    func playerViewDidTapNext(_ view: MainPlayerView)
    func playerViewDidTapEject(_ view: MainPlayerView)
    func playerViewDidToggleShuffle(_ view: MainPlayerView)
    func playerViewDidCycleRepeat(_ view: MainPlayerView)
    func playerViewDidTogglePlaylist(_ view: MainPlayerView)
    func playerViewDidTapEqualizer(_ view: MainPlayerView)
    func playerViewDidCycleVisualizer(_ view: MainPlayerView)
    func playerViewDidToggleTimeMode(_ view: MainPlayerView)
    func playerViewDidRequestClose(_ view: MainPlayerView)
    func playerViewDidRequestMinimize(_ view: MainPlayerView)
    func playerViewDidToggleShade(_ view: MainPlayerView)
    func playerViewDidOpenMenu(_ view: MainPlayerView, at point: NSPoint)

    func playerView(_ view: MainPlayerView, didBeginSeekAt fraction: Double)
    func playerView(_ view: MainPlayerView, didUpdateSeekTo fraction: Double)
    func playerViewDidEndSeek(_ view: MainPlayerView)
    func playerView(_ view: MainPlayerView, didSetVolume volume: Double)
    func playerView(_ view: MainPlayerView, didSetBalance balance: Double)
}

/// The main window's contents: one view that draws the entire skin and turns
/// clicks into transport commands.
///
/// AppKit rather than SwiftUI, deliberately. This is a fixed grid of sprites
/// blitted at integer coordinates with pixel-exact hit regions; a declarative
/// layout system has nothing to contribute and a lot of rounding to get wrong.
final class MainPlayerView: NSView {

    weak var delegate: MainPlayerViewDelegate?

    let renderer: SkinRenderer
    private let visualizer: VisualizerFeed

    var snapshot: PlayerSnapshot = .empty {
        didSet { if snapshot != oldValue { needsDisplay = true } }
    }

    /// Windowshade mode: the 14px title-bar-only form.
    var isShaded = false {
        didSet { needsDisplay = true }
    }

    var isPlaylistVisible = false {
        didSet { needsDisplay = true }
    }

    /// Clock shows time remaining instead of elapsed. Clicking it toggles,
    /// exactly as it always has.
    var showsRemainingTime = false {
        didSet { needsDisplay = true }
    }

    // MARK: Interaction state

    /// The control currently held down, so it can be drawn pressed and so the
    /// drag goes to the right place.
    private enum Interaction: Equatable {
        case none
        case button(LayoutSlot)
        case seeking
        case volume
        case balance
        case dragWindow(origin: NSPoint)
    }

    private var interaction: Interaction = .none
    /// Marquee scroll offset, advanced by the animation timer.
    private var marqueeStep = 0
    private var marqueeTimer: Timer?
    private var visualizerTimer: Timer?

    init(renderer: SkinRenderer, visualizer: VisualizerFeed) {
        self.renderer = renderer
        self.visualizer = visualizer
        super.init(frame: NSRect(origin: .zero, size: renderer.mainSize))
        wantsLayer = true
        layer?.magnificationFilter = .nearest
        startTimers()
    }

    required init?(coder: NSCoder) {
        fatalError("MainPlayerView is created in code only")
    }

    deinit {
        marqueeTimer?.invalidate()
        visualizerTimer?.invalidate()
    }

    /// Unflipped: `SkinRenderer` converts top-left layout pixels itself, which
    /// keeps sprites from being drawn upside down.
    override var isFlipped: Bool { false }

    override var intrinsicContentSize: NSSize {
        isShaded ? renderer.shadeSize : renderer.mainSize
    }

    private func startTimers() {
        // Winamp scrolls the title about three characters a second.
        marqueeTimer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { [weak self] _ in
            guard let self, !self.isShaded else { return }
            self.marqueeStep += 1
            self.setNeedsDisplay(self.renderer.deviceRect(self.renderer.skin.layout.rect(.songTitle)))
        }
        // The visualiser is the only part that needs a real frame rate.
        visualizerTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] _ in
            guard let self, !self.isShaded, self.visualizer.mode != .off else { return }
            self.setNeedsDisplay(self.renderer.deviceRect(self.renderer.skin.layout.rect(.visualizer)))
        }
    }

    // MARK: - Drawing

    override func draw(_ dirtyRect: NSRect) {
        guard let context = NSGraphicsContext.current?.cgContext else { return }
        context.configureForPixelArt()

        let layout = renderer.skin.layout
        renderer.canvasHeight = isShaded ? layout.shadeHeight : layout.mainSize.height

        let isActive = window?.isKeyWindow ?? false

        if isShaded {
            drawShade(in: context, isActive: isActive)
            return
        }

        renderer.draw(.mainBackground, at: 0, y: 0, in: context)
        renderer.draw(isActive ? .titleBarActive : .titleBarInactive, at: 0, y: 0, in: context)

        drawTitleButtons(in: context)
        drawStatusIndicator(in: context, layout: layout)
        drawClock(in: context, layout: layout)
        drawMarquee(in: context, layout: layout)
        drawReadouts(in: context, layout: layout)
        drawVisualizer(in: context, layout: layout)
        drawPositionBar(in: context, layout: layout)
        drawSliders(in: context, layout: layout)
        drawTransport(in: context, layout: layout)
        drawToggles(in: context, layout: layout)
    }

    private func drawShade(in context: CGContext, isActive: Bool) {
        renderer.draw(isActive ? .shadeBackgroundActive : .shadeBackgroundInactive, at: 0, y: 0, in: context)
        drawTitleButtons(in: context)
        // A compressed clock is the whole point of shade mode.
        let (minutes, seconds) = clockComponents()
        renderer.drawClock(
            minutes: minutes, seconds: seconds,
            at: [79, 88, 100, 109], y: 3,
            in: context
        )
    }

    private func drawTitleButtons(in context: CGContext) {
        let layout = renderer.skin.layout
        func button(_ slot: LayoutSlot, _ normal: SpriteID, _ pressed: SpriteID) {
            let rect = layout.rect(slot)
            let isPressed = interaction == .button(slot)
            renderer.draw(isPressed ? pressed : normal, at: rect.x, y: rect.y, in: context)
        }
        button(.buttonMenu, .buttonMenu, .buttonMenuPressed)
        button(.buttonMinimize, .buttonMinimize, .buttonMinimizePressed)
        button(.buttonShade, .buttonShade, .buttonShadePressed)
        button(.buttonClose, .buttonClose, .buttonClosePressed)
    }

    private func drawStatusIndicator(in context: CGContext, layout: SkinLayout) {
        let rect = layout.rect(.statusIndicator)
        let id: SpriteID
        switch snapshot.state {
        case .playing: id = .statusPlaying
        case .paused: id = .statusPaused
        case .stopped: id = .statusStopped
        }
        renderer.draw(id, at: rect.x, y: rect.y, in: context)
    }

    private func clockComponents() -> (Int?, Int?) {
        guard snapshot.state != .stopped, snapshot.duration > 0 || snapshot.position > 0 else {
            return (nil, nil)
        }
        let value = showsRemainingTime ? snapshot.remaining : snapshot.position
        let total = Int(value.rounded(.down))
        return (total / 60, total % 60)
    }

    private func drawClock(in context: CGContext, layout: SkinLayout) {
        let (minutes, seconds) = clockComponents()
        let rect = layout.rect(.timeDisplay)
        renderer.drawClock(
            minutes: minutes,
            seconds: seconds,
            at: SkinLayout.classicTimeDigitOffsets,
            y: rect.y,
            in: context
        )
        // The minus sign marks remaining-time mode.
        if showsRemainingTime, minutes != nil {
            let minus = layout.rect(.timeMinusSign)
            renderer.drawText("-", at: minus.x, y: minus.y + 4, in: context)
        }
    }

    private func drawMarquee(in context: CGContext, layout: SkinLayout) {
        let rect = layout.rect(.songTitle)
        let visibleCharacters = rect.width / BitmapFontLayout.glyphWidth
        var text = snapshot.marqueeText.uppercased()

        // Show what is blocking playback rather than an empty display.
        if snapshot.source == .none {
            text = "SPOTIFY NOT CONNECTED"
        }

        let marquee = MarqueeText(text: text, visibleCharacters: visibleCharacters)
        renderer.drawText(
            marquee.frame(at: marquee.needsScrolling ? marqueeStep : 0),
            at: rect.x,
            y: rect.y,
            in: context,
            maxCharacters: visibleCharacters
        )
    }

    private func drawReadouts(in context: CGContext, layout: SkinLayout) {
        // KBPS / KHZ, drawn only when actually known — a hardcoded "128" would
        // be a lie about someone's stream.
        if let bitrate = snapshot.bitrateKbps {
            let rect = layout.rect(.bitrate)
            renderer.drawText("\(bitrate)", at: rect.x, y: rect.y, in: context, maxCharacters: 3)
        }
        if let sampleRate = snapshot.sampleRateKHz {
            let rect = layout.rect(.sampleRate)
            renderer.drawText("\(sampleRate)", at: rect.x, y: rect.y, in: context, maxCharacters: 2)
        }

        let mono = layout.rect(.monoIndicator)
        let stereo = layout.rect(.stereoIndicator)
        let isPlaying = snapshot.state != .stopped
        renderer.draw(
            isPlaying && !snapshot.isStereo ? .monoOn : .monoOff,
            at: mono.x, y: mono.y, in: context
        )
        renderer.draw(
            isPlaying && snapshot.isStereo ? .stereoOn : .stereoOff,
            at: stereo.x, y: stereo.y, in: context
        )
    }

    private func drawVisualizer(in context: CGContext, layout: SkinLayout) {
        let rect = layout.rect(.visualizer)
        let palette = renderer.skin.visualizerPalette

        context.setFillColor(renderer.cgColor(palette.background))
        context.fill(renderer.deviceRect(rect))

        guard visualizer.mode != .off else { return }

        let frame = visualizer.frame(isPlaying: snapshot.state == .playing)

        // No tap means no honest data, so say so rather than animating noise.
        guard visualizer.status.isRunning else {
            let flat = PixelRect(x: rect.x, y: rect.y + rect.height / 2, width: rect.width, height: 1)
            context.setFillColor(renderer.cgColor(palette.oscilloscope.first ?? palette.grid))
            context.fill(renderer.deviceRect(flat))
            return
        }

        switch visualizer.mode {
        case .spectrum:
            drawSpectrum(frame, in: rect, context: context, palette: palette)
        case .oscilloscope:
            drawOscilloscope(frame, in: rect, context: context, palette: palette)
        case .off:
            break
        }
    }

    private func drawSpectrum(
        _ frame: SpectrumAnalyzer.Frame,
        in rect: PixelRect,
        context: CGContext,
        palette: VisualizerPalette
    ) {
        let bandCount = frame.bands.count
        guard bandCount > 0 else { return }
        // Classic spacing: 3px bar, 1px gap.
        let barWidth = max(1, (rect.width + 1) / bandCount - 1)
        let gradient = palette.spectrum

        for (index, level) in frame.bands.enumerated() {
            let x = rect.x + index * (barWidth + 1)
            guard x < rect.maxX else { break }
            let height = Int((Double(level) * Double(rect.height)).rounded())

            // Colour by row, bottom upwards, so a tall bar runs through the
            // whole gradient the way viscolor.txt intends.
            for row in 0 ..< height {
                let y = rect.maxY - 1 - row
                let position = Double(row) / Double(max(1, rect.height - 1))
                let colorIndex = min(gradient.count - 1, Int(position * Double(gradient.count - 1)))
                context.setFillColor(renderer.cgColor(gradient[gradient.count - 1 - colorIndex]))
                context.fill(renderer.deviceRect(
                    PixelRect(x: x, y: y, width: min(barWidth, rect.maxX - x), height: 1)
                ))
            }

            // Peak cap.
            let peak = Int((Double(frame.peaks[index]) * Double(rect.height)).rounded())
            if peak > 0, peak <= rect.height {
                context.setFillColor(renderer.cgColor(palette.peak))
                context.fill(renderer.deviceRect(
                    PixelRect(x: x, y: rect.maxY - peak, width: min(barWidth, rect.maxX - x), height: 1)
                ))
            }
        }
    }

    private func drawOscilloscope(
        _ frame: SpectrumAnalyzer.Frame,
        in rect: PixelRect,
        context: CGContext,
        palette: VisualizerPalette
    ) {
        let centre = rect.y + rect.height / 2
        let colors = palette.oscilloscope
        let samples = frame.scope
        guard !samples.isEmpty else { return }

        for column in 0 ..< rect.width {
            let sampleIndex = column * samples.count / rect.width
            let value = Double(samples[min(sampleIndex, samples.count - 1)])
            let offset = Int((value * Double(rect.height / 2)).rounded())
            let y = max(rect.y, min(rect.maxY - 1, centre - offset))

            // Winamp colours the trace by distance from the centre line.
            let distance = abs(y - centre)
            let colorIndex = min(colors.count - 1, distance * colors.count / max(1, rect.height / 2))
            context.setFillColor(renderer.cgColor(colors[colorIndex]))

            // Fill from the centre so the trace reads as a solid waveform.
            let top = min(y, centre)
            let height = max(1, abs(y - centre))
            context.fill(renderer.deviceRect(
                PixelRect(x: rect.x + column, y: top, width: 1, height: height)
            ))
        }
    }

    private func drawPositionBar(in context: CGContext, layout: SkinLayout) {
        let rect = layout.rect(.positionBar)
        renderer.draw(.positionBarBackground, at: rect.x, y: rect.y, in: context)

        // No thumb when there is nothing to seek through — the classic
        // behaviour and a useful signal that playback has not started.
        guard snapshot.duration > 0, snapshot.state != .stopped else { return }
        guard let thumb = renderer.image(interaction == .seeking ? .positionBarThumbPressed : .positionBarThumb)
        else { return }

        let travel = max(0, rect.width - thumb.width)
        let x = rect.x + Int((snapshot.progress * Double(travel)).rounded())
        renderer.draw(thumb, at: x, y: rect.y, in: context)
    }

    private func drawSliders(in context: CGContext, layout: SkinLayout) {
        let volumeRect = layout.rect(.volumeSlider)
        if let background = renderer.skin.sliderFrame(.volumeBackground, forValue: snapshot.volume)?.makeCGImage() {
            renderer.draw(background, at: volumeRect.x, y: volumeRect.y, in: context)
        }
        if let thumb = renderer.image(interaction == .volume ? .volumeThumbPressed : .volumeThumb) {
            let travel = max(0, volumeRect.width - thumb.width)
            let x = volumeRect.x + Int((snapshot.volume * Double(travel)).rounded())
            renderer.draw(thumb, at: x, y: volumeRect.y + 1, in: context)
        }

        let balanceRect = layout.rect(.balanceSlider)
        let balanceValue = (snapshot.balance + 1) / 2
        if let background = renderer.skin.sliderFrame(.balanceBackground, forValue: balanceValue)?.makeCGImage() {
            renderer.draw(background, at: balanceRect.x, y: balanceRect.y, in: context)
        }
        if let thumb = renderer.image(interaction == .balance ? .balanceThumbPressed : .balanceThumb) {
            let travel = max(0, balanceRect.width - thumb.width)
            let x = balanceRect.x + Int((balanceValue * Double(travel)).rounded())
            renderer.draw(thumb, at: x, y: balanceRect.y + 1, in: context)
        }
    }

    private func drawTransport(in context: CGContext, layout: SkinLayout) {
        let buttons: [(LayoutSlot, SpriteID, SpriteID)] = [
            (.buttonPrevious, .buttonPrevious, .buttonPreviousPressed),
            (.buttonPlay, .buttonPlay, .buttonPlayPressed),
            (.buttonPause, .buttonPause, .buttonPausePressed),
            (.buttonStop, .buttonStop, .buttonStopPressed),
            (.buttonNext, .buttonNext, .buttonNextPressed),
            (.buttonEject, .buttonEject, .buttonEjectPressed),
        ]
        for (slot, normal, pressed) in buttons {
            let rect = layout.rect(slot)
            let isPressed = interaction == .button(slot)
            renderer.draw(isPressed ? pressed : normal, at: rect.x, y: rect.y, in: context)
        }
    }

    private func drawToggles(in context: CGContext, layout: SkinLayout) {
        let shuffleRect = layout.rect(.buttonShuffle)
        let shufflePressed = interaction == .button(.buttonShuffle)
        renderer.draw(
            snapshot.shuffle
                ? (shufflePressed ? .shuffleOnPressed : .shuffleOn)
                : (shufflePressed ? .shuffleOffPressed : .shuffleOff),
            at: shuffleRect.x, y: shuffleRect.y, in: context
        )

        let repeatRect = layout.rect(.buttonRepeat)
        let repeatPressed = interaction == .button(.buttonRepeat)
        renderer.draw(
            snapshot.repeatMode != .off
                ? (repeatPressed ? .repeatOnPressed : .repeatOn)
                : (repeatPressed ? .repeatOffPressed : .repeatOff),
            at: repeatRect.x, y: repeatRect.y, in: context
        )

        let equalizerRect = layout.rect(.buttonEqualizer)
        renderer.draw(
            visualizer.mode == .off ? .buttonEqualizerOff : .buttonEqualizerOn,
            at: equalizerRect.x, y: equalizerRect.y, in: context
        )

        let playlistRect = layout.rect(.buttonPlaylist)
        renderer.draw(
            isPlaylistVisible ? .buttonPlaylistOn : .buttonPlaylistOff,
            at: playlistRect.x, y: playlistRect.y, in: context
        )
    }

    // MARK: - Hit testing

    /// Slots that behave like buttons, smallest-first so a button on the title
    /// bar wins over the bar itself.
    private static let buttonSlots: [LayoutSlot] = [
        .buttonMenu, .buttonMinimize, .buttonShade, .buttonClose,
        .buttonPrevious, .buttonPlay, .buttonPause, .buttonStop, .buttonNext, .buttonEject,
        .buttonShuffle, .buttonRepeat, .buttonEqualizer, .buttonPlaylist,
    ]

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let (x, y) = renderer.layoutPoint(from: point)
        let layout = renderer.skin.layout

        if isShaded {
            // In shade mode only the title-bar controls exist.
            if let slot = layout.slot(at: x, y: y, among: [.buttonMenu, .buttonMinimize, .buttonShade, .buttonClose]) {
                interaction = .button(slot)
                needsDisplay = true
                return
            }
            beginWindowDrag(with: event)
            return
        }

        if let slot = layout.slot(at: x, y: y, among: Self.buttonSlots) {
            interaction = .button(slot)
            needsDisplay = true
            return
        }

        if layout.rect(.positionBar).contains(x: x, y: y) {
            interaction = .seeking
            delegate?.playerView(self, didBeginSeekAt: seekFraction(atX: x))
            needsDisplay = true
            return
        }

        if layout.rect(.volumeSlider).contains(x: x, y: y) {
            interaction = .volume
            delegate?.playerView(self, didSetVolume: sliderFraction(atX: x, slot: .volumeSlider))
            needsDisplay = true
            return
        }

        if layout.rect(.balanceSlider).contains(x: x, y: y) {
            interaction = .balance
            delegate?.playerView(self, didSetBalance: sliderFraction(atX: x, slot: .balanceSlider) * 2 - 1)
            needsDisplay = true
            return
        }

        if layout.rect(.visualizer).contains(x: x, y: y) {
            delegate?.playerViewDidCycleVisualizer(self)
            needsDisplay = true
            return
        }

        if layout.rect(.timeDisplay).contains(x: x, y: y) || layout.rect(.timeMinusSign).contains(x: x, y: y) {
            delegate?.playerViewDidToggleTimeMode(self)
            return
        }

        // Anything else on the chrome drags the window, which is how a
        // borderless skinned window is meant to behave.
        if event.clickCount == 2, layout.rect(.titleBar).contains(x: x, y: y) {
            delegate?.playerViewDidToggleShade(self)
            return
        }
        beginWindowDrag(with: event)
    }

    override func mouseDragged(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let (x, _) = renderer.layoutPoint(from: point)

        switch interaction {
        case .seeking:
            delegate?.playerView(self, didUpdateSeekTo: seekFraction(atX: x))
        case .volume:
            delegate?.playerView(self, didSetVolume: sliderFraction(atX: x, slot: .volumeSlider))
        case .balance:
            delegate?.playerView(self, didSetBalance: sliderFraction(atX: x, slot: .balanceSlider) * 2 - 1)
        case .button, .none, .dragWindow:
            break
        }
    }

    override func mouseUp(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let (x, y) = renderer.layoutPoint(from: point)

        defer {
            interaction = .none
            needsDisplay = true
        }

        switch interaction {
        case .seeking:
            delegate?.playerViewDidEndSeek(self)

        case .button(let slot):
            // Only fire if the mouse is still inside the button, matching every
            // other button on the platform.
            guard renderer.skin.layout.rect(slot).contains(x: x, y: y) else { return }
            handleButtonTap(slot: slot, at: point)

        case .volume, .balance, .none, .dragWindow:
            break
        }
    }

    override func rightMouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let (x, y) = renderer.layoutPoint(from: point)
        // Right-clicking repeat cycles through single-track repeat, as it does
        // in Winamp; anywhere else opens the menu.
        if renderer.skin.layout.rect(.buttonRepeat).contains(x: x, y: y) {
            delegate?.playerViewDidCycleRepeat(self)
            return
        }
        delegate?.playerViewDidOpenMenu(self, at: point)
    }

    override func scrollWheel(with event: NSEvent) {
        // Scrolling anywhere over the window nudges the volume, which is the
        // single most useful gesture a compact player can offer.
        let delta = event.hasPreciseScrollingDeltas
            ? event.scrollingDeltaY / 200
            : event.scrollingDeltaY / 20
        delegate?.playerView(self, didSetVolume: min(1, max(0, snapshot.volume + delta)))
    }

    private func handleButtonTap(slot: LayoutSlot, at point: NSPoint) {
        switch slot {
        case .buttonPrevious: delegate?.playerViewDidTapPrevious(self)
        case .buttonPlay: delegate?.playerViewDidTapPlay(self)
        case .buttonPause: delegate?.playerViewDidTapPause(self)
        case .buttonStop: delegate?.playerViewDidTapStop(self)
        case .buttonNext: delegate?.playerViewDidTapNext(self)
        case .buttonEject: delegate?.playerViewDidTapEject(self)
        case .buttonShuffle: delegate?.playerViewDidToggleShuffle(self)
        case .buttonRepeat: delegate?.playerViewDidCycleRepeat(self)
        case .buttonPlaylist: delegate?.playerViewDidTogglePlaylist(self)
        case .buttonEqualizer: delegate?.playerViewDidTapEqualizer(self)
        case .buttonClose: delegate?.playerViewDidRequestClose(self)
        case .buttonMinimize: delegate?.playerViewDidRequestMinimize(self)
        case .buttonShade: delegate?.playerViewDidToggleShade(self)
        case .buttonMenu: delegate?.playerViewDidOpenMenu(self, at: point)
        default: break
        }
    }

    private func beginWindowDrag(with event: NSEvent) {
        interaction = .dragWindow(origin: event.locationInWindow)
        // AppKit does the work, including snapping and multi-display edges.
        window?.performDrag(with: event)
        interaction = .none
    }

    private func seekFraction(atX x: Int) -> Double {
        let rect = renderer.skin.layout.rect(.positionBar)
        let thumbWidth = renderer.image(.positionBarThumb)?.width ?? 29
        let travel = max(1, rect.width - thumbWidth)
        // The thumb's centre should land under the cursor.
        let offset = x - rect.x - thumbWidth / 2
        return min(1, max(0, Double(offset) / Double(travel)))
    }

    private func sliderFraction(atX x: Int, slot: LayoutSlot) -> Double {
        let rect = renderer.skin.layout.rect(slot)
        let thumbWidth = renderer.image(.volumeThumb)?.width ?? 14
        let travel = max(1, rect.width - thumbWidth)
        let offset = x - rect.x - thumbWidth / 2
        return min(1, max(0, Double(offset) / Double(travel)))
    }
}

import Foundation

/// Every drawable piece of a skin, named once so the renderer never has to know
/// whether a skin came from a 1998 `.wsz` or a modern `.wskin` manifest.
///
/// The raw values double as the keys in a modern skin's `sprites` dictionary,
/// which is why they are stable, screaming-snake strings rather than Swift-y
/// camelCase.
public enum SpriteID: String, CaseIterable, Codable, Sendable, Hashable {

    // MARK: Main window

    case mainBackground = "MAIN_BACKGROUND"

    case titleBarActive = "TITLE_BAR_ACTIVE"
    case titleBarInactive = "TITLE_BAR_INACTIVE"
    case titleBarEasterEggActive = "TITLE_BAR_EASTER_EGG_ACTIVE"
    case titleBarEasterEggInactive = "TITLE_BAR_EASTER_EGG_INACTIVE"

    case shadeBackgroundActive = "SHADE_BACKGROUND_ACTIVE"
    case shadeBackgroundInactive = "SHADE_BACKGROUND_INACTIVE"

    // MARK: Title bar buttons

    case buttonMenu = "BUTTON_MENU"
    case buttonMenuPressed = "BUTTON_MENU_PRESSED"
    case buttonMinimize = "BUTTON_MINIMIZE"
    case buttonMinimizePressed = "BUTTON_MINIMIZE_PRESSED"
    case buttonShade = "BUTTON_SHADE"
    case buttonShadePressed = "BUTTON_SHADE_PRESSED"
    case buttonClose = "BUTTON_CLOSE"
    case buttonClosePressed = "BUTTON_CLOSE_PRESSED"

    // MARK: Transport

    case buttonPrevious = "BUTTON_PREVIOUS"
    case buttonPreviousPressed = "BUTTON_PREVIOUS_PRESSED"
    case buttonPlay = "BUTTON_PLAY"
    case buttonPlayPressed = "BUTTON_PLAY_PRESSED"
    case buttonPause = "BUTTON_PAUSE"
    case buttonPausePressed = "BUTTON_PAUSE_PRESSED"
    case buttonStop = "BUTTON_STOP"
    case buttonStopPressed = "BUTTON_STOP_PRESSED"
    case buttonNext = "BUTTON_NEXT"
    case buttonNextPressed = "BUTTON_NEXT_PRESSED"
    case buttonEject = "BUTTON_EJECT"
    case buttonEjectPressed = "BUTTON_EJECT_PRESSED"

    // MARK: Toggles

    case shuffleOff = "SHUFFLE_OFF"
    case shuffleOffPressed = "SHUFFLE_OFF_PRESSED"
    case shuffleOn = "SHUFFLE_ON"
    case shuffleOnPressed = "SHUFFLE_ON_PRESSED"
    case repeatOff = "REPEAT_OFF"
    case repeatOffPressed = "REPEAT_OFF_PRESSED"
    case repeatOn = "REPEAT_ON"
    case repeatOnPressed = "REPEAT_ON_PRESSED"

    /// Winamp's EQ toggle. We keep the sprite so classic skins still render
    /// pixel-correct, and repurpose the button to open the visualizer options.
    case buttonEqualizerOff = "BUTTON_EQUALIZER_OFF"
    case buttonEqualizerOn = "BUTTON_EQUALIZER_ON"
    case buttonPlaylistOff = "BUTTON_PLAYLIST_OFF"
    case buttonPlaylistOn = "BUTTON_PLAYLIST_ON"

    // MARK: Sliders

    case positionBarBackground = "POSITION_BAR_BACKGROUND"
    case positionBarThumb = "POSITION_BAR_THUMB"
    case positionBarThumbPressed = "POSITION_BAR_THUMB_PRESSED"

    /// Volume and balance backgrounds are 28-frame strips; the frame index is
    /// the value, so these are addressed via `Skin.volumeBackground(frame:)`.
    case volumeThumb = "VOLUME_THUMB"
    case volumeThumbPressed = "VOLUME_THUMB_PRESSED"
    case balanceThumb = "BALANCE_THUMB"
    case balanceThumbPressed = "BALANCE_THUMB_PRESSED"

    // MARK: Indicators

    case statusPlaying = "STATUS_PLAYING"
    case statusPaused = "STATUS_PAUSED"
    case statusStopped = "STATUS_STOPPED"
    case statusWorking = "STATUS_WORKING"
    case statusNotWorking = "STATUS_NOT_WORKING"

    case monoOn = "MONO_ON"
    case monoOff = "MONO_OFF"
    case stereoOn = "STEREO_ON"
    case stereoOff = "STEREO_OFF"

    case clutterBar = "CLUTTER_BAR"
    case clutterBarDisabled = "CLUTTER_BAR_DISABLED"

    // MARK: Playlist window

    case playlistTitleBarActive = "PLAYLIST_TITLE_BAR_ACTIVE"
    case playlistTitleBarInactive = "PLAYLIST_TITLE_BAR_INACTIVE"
    case playlistTopLeftActive = "PLAYLIST_TOP_LEFT_ACTIVE"
    case playlistTopLeftInactive = "PLAYLIST_TOP_LEFT_INACTIVE"
    case playlistTopRightActive = "PLAYLIST_TOP_RIGHT_ACTIVE"
    case playlistTopRightInactive = "PLAYLIST_TOP_RIGHT_INACTIVE"
    case playlistTopTileActive = "PLAYLIST_TOP_TILE_ACTIVE"
    case playlistTopTileInactive = "PLAYLIST_TOP_TILE_INACTIVE"
    case playlistLeftTile = "PLAYLIST_LEFT_TILE"
    case playlistRightTile = "PLAYLIST_RIGHT_TILE"
    case playlistBottomLeft = "PLAYLIST_BOTTOM_LEFT"
    case playlistBottomTile = "PLAYLIST_BOTTOM_TILE"
    case playlistBottomRight = "PLAYLIST_BOTTOM_RIGHT"
    case playlistScrollThumb = "PLAYLIST_SCROLL_THUMB"
    case playlistScrollThumbPressed = "PLAYLIST_SCROLL_THUMB_PRESSED"
    case playlistCloseButton = "PLAYLIST_CLOSE_BUTTON"
    case playlistShadeButton = "PLAYLIST_SHADE_BUTTON"
}

/// The frame strips that are indexed by value rather than named individually.
public enum SpriteStripID: String, CaseIterable, Codable, Sendable, Hashable {
    /// 28 frames, drawn behind the volume thumb.
    case volumeBackground = "VOLUME_BACKGROUND"
    /// 28 frames, drawn behind the balance thumb.
    case balanceBackground = "BALANCE_BACKGROUND"
    /// 10 frames: the digits 0-9, plus an 11th blank frame when present.
    case digits = "DIGITS"
    /// The 5x6 bitmap font, laid out as a grid; see `BitmapFontLayout`.
    case font = "FONT"
}

extension SpriteID: CodingKeyRepresentable {}
extension SpriteStripID: CodingKeyRepresentable {}

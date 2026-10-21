import AppKit

// A plain AppKit entry point rather than @main on an App: the player's main
// window is a borderless, non-resizable, pixel-exact NSWindow, and SwiftUI's
// scene machinery only gets in the way of that. SwiftUI is still used where it
// earns its place — preferences and the library browser.

let application = NSApplication.shared
let controller = AppController()
application.delegate = controller
// Regular rather than accessory: the player has a Dock icon and a menu bar,
// and shows up in the app switcher like anything else.
application.setActivationPolicy(.regular)
application.run()

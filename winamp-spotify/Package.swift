// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "WinampSpotify",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "WinampSpotify", targets: ["WinampSpotify"]),
        .library(name: "SkinKit", targets: ["SkinKit"]),
        .library(name: "SpotifyKit", targets: ["SpotifyKit"]),
        .library(name: "PlayerCore", targets: ["PlayerCore"]),
        .library(name: "AudioVis", targets: ["AudioVis"]),
    ],
    targets: [
        // Skin parsing and sprite resolution. Deliberately free of AppKit so the
        // same engine can back an iOS/iPadOS variant later.
        .target(name: "SkinKit"),

        // Spotify Web API: OAuth PKCE, token storage, endpoints, models.
        .target(name: "SpotifyKit"),

        // Platform-agnostic player state and the engine protocol that both the
        // local (ScriptingBridge) and remote (Web API) backends implement.
        .target(name: "PlayerCore", dependencies: ["SpotifyKit"]),

        // Core Audio process tap + FFT for the visualizer.
        .target(name: "AudioVis"),

        // The macOS app: AppKit windows, sprite renderer, ScriptingBridge.
        .executableTarget(
            name: "WinampSpotify",
            dependencies: ["SkinKit", "SpotifyKit", "PlayerCore", "AudioVis"],
            linkerSettings: [
                // Embed Info.plist into the executable's __TEXT segment.
                //
                // SwiftPM builds a bare Mach-O, but macOS reads the usage
                // strings for the Automation and audio-capture prompts out of
                // an Info.plist. Embedding it means `swift run` gets the same
                // prompts as the assembled .app, which makes debugging those
                // permission paths possible at all. The real bundle
                // (Scripts/build-app.sh) still needs the file on disk, for the
                // OAuth URL scheme and document types LaunchServices reads.
                .unsafeFlags([
                    "-Xlinker", "-sectcreate",
                    "-Xlinker", "__TEXT",
                    "-Xlinker", "__info_plist",
                    "-Xlinker", "Resources/Info.plist",
                ])
            ]
        ),

        .testTarget(name: "SkinKitTests", dependencies: ["SkinKit"]),
    ]
)

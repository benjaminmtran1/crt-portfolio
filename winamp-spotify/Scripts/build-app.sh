#!/bin/bash
#
# Builds WinampSpotify.app from the SwiftPM executable.
#
# SwiftPM produces a bare Mach-O binary, but this app needs a real bundle: the
# Automation and audio-capture permission prompts read Info.plist, the OAuth
# redirect needs a registered URL scheme, and a code signature is what TCC
# remembers a grant against. So we assemble the bundle ourselves and ad-hoc
# sign it, which is enough for local use.
#
# Usage:
#   Scripts/build-app.sh [debug|release]      # build and assemble
#   SIGN_IDENTITY="Developer ID Application: …" Scripts/build-app.sh release
#
set -euo pipefail

CONFIGURATION="${1:-release}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "error: this app is macOS-only; it cannot be built on $(uname -s)." >&2
    exit 1
fi

APP_NAME="Winamp Spotify"
BUNDLE="build/${APP_NAME}.app"
EXECUTABLE_NAME="WinampSpotify"

echo "==> swift build -c $CONFIGURATION"
swift build -c "$CONFIGURATION" --product "$EXECUTABLE_NAME"

BINARY="$(swift build -c "$CONFIGURATION" --show-bin-path)/$EXECUTABLE_NAME"
if [[ ! -f "$BINARY" ]]; then
    echo "error: built binary not found at $BINARY" >&2
    exit 1
fi

echo "==> Assembling $BUNDLE"
rm -rf "$BUNDLE"
mkdir -p "$BUNDLE/Contents/MacOS" "$BUNDLE/Contents/Resources"

cp "$BINARY" "$BUNDLE/Contents/MacOS/$EXECUTABLE_NAME"
cp Resources/Info.plist "$BUNDLE/Contents/Info.plist"
printf 'APPL????' > "$BUNDLE/Contents/PkgInfo"

# Any skins shipped with the app land here and show up in the skin browser
# alongside the user's own.
if [[ -d Skins ]] && compgen -G "Skins/*" > /dev/null; then
    mkdir -p "$BUNDLE/Contents/Resources/Skins"
    cp -R Skins/* "$BUNDLE/Contents/Resources/Skins/" 2>/dev/null || true
fi

echo "==> Signing"
# A stable signature matters more than it looks: macOS ties the Automation and
# audio-capture grants to it, so an unsigned rebuild re-prompts every time.
IDENTITY="${SIGN_IDENTITY:--}"
codesign --force --deep \
    --sign "$IDENTITY" \
    --options runtime \
    --entitlements Resources/WinampSpotify.entitlements \
    --timestamp=none \
    "$BUNDLE"

codesign --verify --verbose=2 "$BUNDLE" 2>&1 | sed 's/^/    /'

echo
echo "Built $BUNDLE"
echo
echo "Next steps:"
echo "  open \"$BUNDLE\""
echo
echo "On first launch macOS will ask twice:"
echo "  • Automation — to control Spotify (required for local playback)"
echo "  • Audio Recording — for the spectrum analyzer (optional; decline and"
echo "    the visualizer shows a flat line instead of guessing)"
echo
echo "If you ad-hoc signed (the default) and later rebuild, macOS may re-ask."
echo "Signing with a Developer ID keeps the grants stable."

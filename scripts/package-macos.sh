#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ "$(node -p 'process.platform')" != "darwin" ]]; then
  echo 'This packaging script must run on macOS.' >&2
  exit 1
fi
node_major="$(node -p "process.versions.node.split('.')[0]")"
if (( node_major < 22 )); then
  echo "Node.js 22 or newer is required; found $(node --version)." >&2
  exit 1
fi

if [[ $# -gt 1 ]]; then
  echo "Usage: bash scripts/package-macos.sh [X.Y.Z]" >&2
  exit 1
fi
if [[ $# -eq 1 ]]; then
  if [[ ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
    echo "Invalid semantic version: $1" >&2
    exit 1
  fi
  existing_version="$(node -p "require('./package.json').version")"
  if [[ "$1" != "$existing_version" ]]; then npm version "$1" --no-git-tag-version; fi
fi

version="$(node -p "require('./package.json').version")"
lock_version="$(node -p "require('./package-lock.json').version")"
if [[ "$version" != "$lock_version" ]]; then
  echo "package.json ($version) and package-lock.json ($lock_version) do not match." >&2
  exit 1
fi

echo "Packaging PDFuck $version for macOS"
npm ci
npm run build
npm run test:i18n-ui
node scripts/workflow-state-ui-smoke.cjs
node scripts/lab-features-ui-smoke.cjs
npm run test:print-native
npm run test:print-ui
npm run test:window-tabs
npm run test:bookmarks-ui
npm run test:bookmark-recognition-papers
npm run test:page-text-edit-ui
npm run test:page-manager-input-ui
npm run test:selection-scheduling
npm run test:selection-scheduling-ui
npm run test:selection-scheduling-0826
npm run test:selection-scheduling-0826-ui
npm run test:selection-test2
npm run test:selection-test2-ui
npm run test:citations-scheduling-0826
npm run test:reading-navigation-ui
npm run test:selection-chinese
npm run test:selection-chinese-ui
git diff --check

# Build the application bundle first so the exact bundle placed into the DMG is
# the one that is verified and signed below.
# npm ci has already installed this exact Electron version. Reuse its local
# distribution so packaging does not perform a second GitHub download.
npx --no-install electron-builder --mac dir --config.electronDist=node_modules/electron/dist
case "$(uname -m)" in
  arm64) app_bundle='release/mac-arm64/PDFuck.app' ;;
  x86_64) app_bundle='release/mac/PDFuck.app' ;;
  *) app_bundle='' ;;
esac
if [[ ! -d "$app_bundle" && -d 'release/mac-universal/PDFuck.app' ]]; then app_bundle='release/mac-universal/PDFuck.app'; fi
if [[ -z "$app_bundle" ]]; then
  echo 'electron-builder did not produce PDFuck.app in a known output directory.' >&2
  exit 1
fi

signing_mode='configured identity'
if codesign --verify --deep --strict "$app_bundle" >/dev/null 2>&1; then
  if codesign -dv --verbose=4 "$app_bundle" 2>&1 | grep -q 'Signature=adhoc'; then signing_mode='ad-hoc (internal testing only)'; fi
else
  codesign --force --deep --sign - "$app_bundle"
  signing_mode='ad-hoc (internal testing only)'
fi
codesign --verify --deep --strict "$app_bundle"

dmg="release/PDFuck-$version-macOS.dmg"
zip="release/PDFuck-$version-macOS.zip"
rm -f "$dmg" "$zip"
npx --no-install electron-builder --prepackaged "$app_bundle" --mac dmg
ditto -c -k --keepParent "$app_bundle" "$zip"

[[ -f "$dmg" ]] || { echo "Missing DMG: $dmg" >&2; exit 1; }
[[ -f "$zip" ]] || { echo "Missing ZIP: $zip" >&2; exit 1; }
hdiutil verify "$dmg"

plist_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app_bundle/Contents/Info.plist")"
[[ "$plist_version" == "$version" ]] || { echo "Info.plist version is $plist_version, expected $version." >&2; exit 1; }
asar_path="$app_bundle/Contents/Resources/app.asar"
asar_version="$(node -e "const asar=require('@electron/asar'); process.stdout.write(JSON.parse(asar.extractFile(process.argv[1], 'package.json').toString()).version)" "$asar_path")"
[[ "$asar_version" == "$version" ]] || { echo "app.asar version is $asar_version, expected $version." >&2; exit 1; }

mount_dir="$(mktemp -d "${TMPDIR:-/tmp}/pdfuck-dmg.XXXXXX")"
mounted=0
cleanup_mount() {
  if (( mounted )); then hdiutil detach "$mount_dir" -quiet || true; fi
  rmdir "$mount_dir" 2>/dev/null || true
}
trap cleanup_mount EXIT
hdiutil attach "$dmg" -readonly -nobrowse -mountpoint "$mount_dir" >/dev/null
mounted=1
[[ -d "$mount_dir/PDFuck.app" ]] || { echo 'DMG does not contain PDFuck.app at its top level.' >&2; exit 1; }
[[ -L "$mount_dir/Applications" ]] || { echo 'DMG does not contain the Applications shortcut.' >&2; exit 1; }
[[ ! -d "$mount_dir/PDFuck.app/PDFuck.app" ]] || { echo 'DMG contains a nested PDFuck.app/PDFuck.app.' >&2; exit 1; }
hdiutil detach "$mount_dir" -quiet
mounted=0
rmdir "$mount_dir"
trap - EXIT

release_executable="$repo_root/$app_bundle/Contents/MacOS/PDFuck"
PDFUCK_RELEASE_EXECUTABLE="$release_executable" PDFUCK_RELEASE_VERSION="$version" node scripts/release-ui-smoke.cjs
PDFUCK_SMOKE_EXECUTABLE="$release_executable" PDFUCK_RELEASE_VERSION="$version" node scripts/workflow-state-ui-smoke.cjs
PDFUCK_SMOKE_EXECUTABLE="$release_executable" PDFUCK_RELEASE_VERSION="$version" node scripts/lab-features-ui-smoke.cjs
PDFUCK_SMOKE_EXECUTABLE="$release_executable" node scripts/print-ui-smoke.cjs
PDFUCK_SMOKE_EXECUTABLE="$release_executable" node scripts/window-tabs-smoke.cjs
PDFUCK_SMOKE_EXECUTABLE="$release_executable" node scripts/bookmark-ui-smoke.cjs
PDFUCK_SMOKE_EXECUTABLE="$release_executable" node scripts/bookmark-recognition-papers-smoke.cjs
PDFUCK_SMOKE_EXECUTABLE="$release_executable" node scripts/page-manager-input-ui-smoke.cjs
PDFUCK_SMOKE_EXECUTABLE="$release_executable" node scripts/selection-scheduling-0826-ui-smoke.cjs
PDFUCK_SMOKE_EXECUTABLE="$release_executable" node scripts/selection-test2-ui-smoke.cjs
PDFUCK_SMOKE_EXECUTABLE="$release_executable" node scripts/reading-navigation-ui-smoke.cjs
PDFUCK_SMOKE_EXECUTABLE="$release_executable" node scripts/selection-chinese-alignment-ui-smoke.cjs

dmg_hash="$(shasum -a 256 "$dmg" | awk '{print $1}')"
zip_hash="$(shasum -a 256 "$zip" | awk '{print $1}')"
notarization='not notarized or not accepted by Gatekeeper'
if spctl --assess --type execute --verbose=2 "$app_bundle" >/dev/null 2>&1; then notarization='accepted by Gatekeeper'; fi
if [[ "${REQUIRE_NOTARIZATION:-0}" == '1' && "$notarization" != 'accepted by Gatekeeper' ]]; then
  echo 'REQUIRE_NOTARIZATION=1, but Gatekeeper did not accept the app bundle.' >&2
  exit 1
fi

manifest="release/PDFuck-$version-macOS-release.json"
node -e "const fs=require('node:fs'); const [file,version,arch,app,dmg,zip,dmgHash,zipHash,signing,notarization]=process.argv.slice(1); fs.writeFileSync(file, JSON.stringify({product:'PDFuck',version,platform:'macOS',architecture:arch,generatedAt:new Date().toISOString(),appBundle:app,packagedAsarVersion:version,signing,notarization,artifacts:[{file:dmg,bytes:fs.statSync(dmg).size,sha256:dmgHash},{file:zip,bytes:fs.statSync(zip).size,sha256:zipHash}],tests:['typecheck','unit','i18n-catalogue','i18n-ui','workflow-state-ui','lab-features-ui','print-native-cjs','print-ui','window-tabs','bookmarks-ui','bookmark-recognition-papers','page-text-edit-ui','page-manager-input-ui','selection-scheduling','selection-scheduling-ui','selection-scheduling-0826','selection-scheduling-0826-ui','selection-test2','selection-test2-ui','citations-scheduling-0826','reading-navigation-ui','selection-chinese','selection-chinese-ui','packaged-release-ui','packaged-workflow-state-ui','packaged-lab-features-ui','packaged-print-ui','packaged-window-tabs','packaged-bookmarks-ui','packaged-bookmark-recognition-papers','packaged-page-manager-input-ui','packaged-selection-scheduling-0826-ui','packaged-selection-test2-ui','packaged-reading-navigation-ui','packaged-selection-chinese-ui']},null,2)+'\n')" "$manifest" "$version" "$(uname -m)" "$app_bundle" "$dmg" "$zip" "$dmg_hash" "$zip_hash" "$signing_mode" "$notarization"

echo 'macOS release passed build, regression, bundle, DMG layout, packaged-app, version and hash checks.'
echo "App:      $repo_root/$app_bundle"
echo "DMG:      $repo_root/$dmg"
echo "ZIP:      $repo_root/$zip"
echo "Manifest: $repo_root/$manifest"
echo "$dmg_hash  $dmg"
echo "$zip_hash  $zip"
echo "Signing: $signing_mode; $notarization"

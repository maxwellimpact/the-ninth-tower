#!/bin/sh
# Package the game for tiiny.host (the host Tales of Lumen uses): build, then
# zip index.html + the scripts it loads, with index.html at the zip's root.
#   sh tools/make-tiiny.sh
# Upload dist/ninth-tower-tiiny.zip in the tiiny.host dashboard: a new site the
# first time, then that site's Update so the link stays the same.
# dist/tiiny/ holds the same files unzipped, for a local check before uploading.
set -e
cd "$(dirname "$0")/.."
npm run build >/dev/null
rm -rf dist/tiiny dist/ninth-tower-tiiny.zip
mkdir -p dist/tiiny/assets
cp dist/index.html dist/lab.html dist/tiiny/ # the title screen points to /lab.html, so it ships too
cp dist/assets/*.js dist/tiiny/assets/
node tools/make-artifact.mjs >/dev/null # the build cleared dist/full.html (the phone server's and artifact's page)
(cd dist/tiiny && zip -qr ../ninth-tower-tiiny.zip index.html lab.html assets)
echo "dist/ninth-tower-tiiny.zip ($(du -h dist/ninth-tower-tiiny.zip | cut -f1)):"
unzip -l dist/ninth-tower-tiiny.zip | tail -n +4 | sed '$d' | sed '$d'

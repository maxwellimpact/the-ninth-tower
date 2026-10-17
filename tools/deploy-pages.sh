#!/bin/sh
# Publish the built game to GitHub Pages: https://maxwellimpact.github.io/ninth-tower/
#   sh tools/deploy-pages.sh
# The public repo maxwellimpact/ninth-tower holds only the built files (the
# same set as the tiiny.host zip); the source never leaves this machine. Its
# local copy lives in site/ (its own git repo, ignored by this one). Pages
# serves the main branch; the site updates about a minute after the push.
set -e
cd "$(dirname "$0")/.."
REPO=maxwellimpact/ninth-tower
sh tools/make-tiiny.sh >/dev/null # build + package into dist/tiiny
if [ ! -d site/.git ]; then
  gh repo clone "$REPO" site -- --quiet
  git -C site config user.name "Jonathan Cox"
  git -C site config user.email "5667622+maxwellimpact@users.noreply.github.com"
fi
git -C site pull --quiet --ff-only || true
# mirror the build into the site (keeping its git folder and README)
find site -mindepth 1 -maxdepth 1 ! -name .git ! -name README.md -exec rm -rf {} +
cp -R dist/tiiny/. site/
touch site/.nojekyll # serve files as they are (no Jekyll processing)
BUILD=$(git rev-parse --short HEAD)
git -C site add -A
if git -C site diff --cached --quiet; then echo "nothing changed since the last deploy"; exit 0; fi
git -C site commit --quiet -m "Build $BUILD" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git -C site push --quiet origin main
echo "pushed build $BUILD -> https://maxwellimpact.github.io/ninth-tower/ (live in about a minute)"

#!/usr/bin/env bash
# Does this change need a new store build, or can it go out over the air?
# Compares the Expo fingerprint (all native code and config) of HEAD with the
# newest store-build tag (v<version>-A<android>I<ios>, e.g. v2.1.0-I45).
# Prints "same" or "changed". Exit 0 either way; the workflow decides what to say.
#
#   APP_DIR      app folder, relative to repo root   (default: .)
#   INSTALL_CMD  how to install dependencies at root (default: npm ci)
set -euo pipefail
APP_DIR=${APP_DIR:-.}
INSTALL_CMD=${INSTALL_CMD:-npm ci}
fp() { (cd "$1/$APP_DIR" && npx @expo/fingerprint . 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).hash))'); }

tag=${STORE_TAG:-}; [ -n "$tag" ] || tag=$(git tag -l 'v*' --sort=-creatordate | grep -E -- '-(A[0-9]+)?(I[0-9]+)?$' | head -1 || true)
if [ -z "$tag" ]; then echo "no-store-tag"; exit 0; fi

store_dir=$(mktemp -d)
git worktree add -q "$store_dir" "$tag"
(cd "$store_dir" && eval "$INSTALL_CMD" >/dev/null 2>&1)
here=$(fp "$PWD"); there=$(fp "$store_dir")
git worktree remove --force "$store_dir"

echo "store_tag=$tag" >> "${GITHUB_OUTPUT:-/dev/null}"
if [ "$here" = "$there" ]; then echo same; else echo changed; fi

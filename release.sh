#!/usr/bin/env bash
set -e

# Require bash 4+ for `read -i` (macOS ships with bash 3.2).
if ((BASH_VERSINFO[0] < 4)); then
  echo "Error: bash 4+ is required (you have $BASH_VERSION)."
  echo "Install a newer bash, e.g.: brew install bash"
  exit 1
fi

# Release script for widget-frame
# Usage: ./release.sh [major|minor|patch]
#
# Examples:
#   ./release.sh patch  # 1.0.0 -> 1.0.1
#   ./release.sh minor  # 1.0.0 -> 1.1.0
#   ./release.sh major  # 1.0.0 -> 2.0.0

BUMP_TYPE=${1:-patch}

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
  echo "Usage: $0 [major|minor|patch]"
  exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "Error: You have uncommitted changes. Please commit or stash them first."
  exit 1
fi

# Sync tags with remote so version bump is based on latest published release
echo "Fetching latest tags from origin..."
git fetch --tags --prune --prune-tags origin

# Get the latest tag, default to v0.0.0 if none exists
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
LATEST_VERSION=${LATEST_TAG#v}

# Parse version components
IFS='.' read -r MAJOR MINOR PATCH <<< "$LATEST_VERSION"

# Bump version
case $BUMP_TYPE in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

echo "Current version: $LATEST_TAG"
read -e -i "$NEW_VERSION" -p "New version: v" NEW_VERSION
echo ""

# Strip any leading 'v' in case the user typed one
NEW_VERSION=${NEW_VERSION#v}

# Validate semver format
if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: '$NEW_VERSION' is not a valid semver (expected X.Y.Z)."
  exit 1
fi

NEW_TAG="v$NEW_VERSION"

# Ensure the tag doesn't already exist
if git rev-parse "$NEW_TAG" >/dev/null 2>&1; then
  echo "Error: Tag $NEW_TAG already exists."
  exit 1
fi

# Update CHANGELOG.md via Claude Code
if ! command -v claude >/dev/null 2>&1; then
  echo "Error: 'claude' CLI not found. Install Claude Code to continue."
  exit 1
fi

RELEASE_DATE=$(date +%Y-%m-%d)

echo "Updating CHANGELOG.md with Claude Code..."
claude -p --permission-mode acceptEdits "Update CHANGELOG.md in the current directory: move all entries currently under the '## [Unreleased]' section into a new version section '## [$NEW_VERSION] - $RELEASE_DATE' placed immediately below '## [Unreleased]'. Leave '## [Unreleased]' present but empty (no subsections). Preserve all existing content and formatting. Do not modify any other files. If '## [Unreleased]' has no entries, exit without changes and print a message to stderr."

echo ""
echo "--- CHANGELOG.md changes ---"
git --no-pager diff -- CHANGELOG.md
echo "----------------------------"
echo ""

if [[ -z $(git status --porcelain CHANGELOG.md) ]]; then
  echo "Error: No changes were made to CHANGELOG.md. Aborting."
  exit 1
fi

# Confirm CHANGELOG changes
read -p "Accept these CHANGELOG.md changes and continue with release $NEW_TAG? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted. Reverting CHANGELOG.md changes."
  git checkout -- CHANGELOG.md
  exit 1
fi

# Commit the CHANGELOG update
git add CHANGELOG.md
git commit -m "Update CHANGELOG for $NEW_TAG"
git push

# Create and push tag
git tag -a "$NEW_TAG" -m "Release $NEW_TAG"
git push origin "$NEW_TAG"

echo ""
echo "Released $NEW_TAG"
echo ""
echo "CDN URL:"
echo "  https://cdn.jsdelivr.net/gh/cmer/widget-frame@$NEW_TAG/widget-frame.js"

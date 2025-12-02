#!/bin/bash
set -e

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
NEW_TAG="v$NEW_VERSION"

echo "Current version: $LATEST_TAG"
echo "New version: $NEW_TAG"
echo ""

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "Error: You have uncommitted changes. Please commit or stash them first."
  exit 1
fi

# Confirm release
read -p "Create release $NEW_TAG? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# Create and push tag
git tag -a "$NEW_TAG" -m "Release $NEW_TAG"
git push origin "$NEW_TAG"

echo ""
echo "Released $NEW_TAG"
echo ""
echo "CDN URL:"
echo "  https://cdn.jsdelivr.net/gh/cmer/widget-frame@$NEW_TAG/widget-frame.js"

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WidgetFrame is a lightweight (~3KB) JavaScript library for creating embeddable widgets that work across origins. It handles form submissions, link clicks, and content updates via `fetch()` without requiring Turbo, htmx, or any other framework.

Key use case: Building widgets that need to be embedded on third-party websites where Turbo and htmx intentionally block cross-origin navigation.

## Architecture

Single-file library (`widget-frame.js`) using UMD pattern for CommonJS, AMD, and browser global support. ES5-compatible, no transpilation needed.

**Core flow:**
1. Creates a container div inside the provided element
2. Intercepts form submissions and link clicks via event delegation
3. Uses `fetch()` with `credentials: 'include'` for cross-origin requests
4. Parses response HTML looking for `<turbo-frame>` or `<body>` content
5. Manages session tokens via custom headers to work around SameSite cookie restrictions

**Key methods:**
- `_setupEventHandlers()` - Sets up submit/click interceptors
- `load(url, options)` - Fetches content with manual redirect handling
- `setContent(html)` - Directly sets frame HTML

## Development

- No build system or package manager. Edit `widget-frame.js` directly.
- When making changes (add feature, or fix issues), add to CHANGELOG.md under [Unreleased].

**Release process:**
```bash
./release.sh v0.X.Y
```
This tags the version and pushes to origin.

## Turbo Compatibility

- Supports `data-turbo-confirm` attribute on forms for confirmation dialogs
- Parses `<turbo-frame>` elements from server responses for Rails/Turbo backend compatibility

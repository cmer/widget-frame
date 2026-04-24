# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.5] - 2026-04-24

### Added

- **`scrollOffset` option**: Tells `scrollToTop` how much space to leave above the widget for a host-page fixed element (e.g. a sticky navbar). Accepts a pixel number, a CSS length string (`"80px"`, `"10vh"`, `"2rem"`, `"5%"` — resolved by the browser), or a CSS selector whose element height is measured at scroll time so responsive navbars are handled correctly. Invalid values resolve to `0` instead of throwing. Defaults to `0`.
- **Container data attributes**: A subset of options can now be configured via data attributes on the container element, so embedders can override config from HTML without touching the JS init. Supported: `data-widget-frame-base-url`, `data-widget-frame-initial-url`, `data-widget-frame-id`, `data-widget-frame-class`, `data-widget-frame-scroll-to-top`, `data-widget-frame-scroll-offset`. When both are set, the data attribute wins.

## [0.2.4] - 2026-04-24

### Added

- **`scrollToTop` option** (default `true`): After in-widget navigation, scrolls the widget into view if its top edge is above the viewport. Prevents the second step of a long form from appearing below the fold when the user submits from a scrolled position. Does not fire on initial load.

## [0.2.3] - 2025-12-03

### Removed

- **Reverted manual redirect handling**: Removed the `redirect: 'manual'` fetch option and associated redirect-following logic introduced in v0.2.1. The browser's default redirect handling is now used instead.

## [0.2.2] - 2025-12-03

### Added

- **Turbo-compatible confirmation dialogs**: Forms with `data-turbo-confirm` attribute now show a native browser confirmation dialog before submitting. If the user cancels, the form submission is aborted.

## [0.2.1] - 2025-12-03

### Fixed

- **Session tokens now preserved across HTTP redirects**: Fixed an issue where session tokens were lost during HTTP redirects.

## [0.2.0] - 2024-12-03

### Added

- **Cross-origin session support**: WidgetFrame now automatically handles session tokens via HTTP headers, enabling Rails (or other backend) sessions (flash messages, etc.) to work in cross-origin widgets where browser cookies are blocked by SameSite restrictions.
  - New `sessionHeader` option (default: `'X-Widget-Session'`) configures the header name
  - Session token is captured from response headers and sent on subsequent requests
  - Works with `WidgetSessionMiddleware` on the Rails side

### Changed

- The `load()` method now captures session tokens from response headers and includes them in subsequent requests

## [0.1.0] - 2024-12-01

### Added

- Initial release
- Cross-origin form submission handling via `fetch()`
- Cross-origin link click interception
- Turbo Frame response parsing for compatibility with Rails responses
- Configurable loading and error states
- `onLoad` and `onError` callbacks
- `widget-frame:load` custom event
- CommonJS, AMD, and browser global support

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

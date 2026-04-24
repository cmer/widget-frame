# WidgetFrame

A lightweight (~3KB) JavaScript library for creating embeddable widgets that work across origins. Handles form submissions, link clicks, and content updates via `fetch()` without requiring Turbo, htmx, or any other framework.

## Why WidgetFrame?

Both Turbo and htmx intentionally block cross-origin navigation for security reasons. If you're building widgets that need to be embedded on third-party websites, you need custom handling. WidgetFrame provides:

- **Zero cross-origin restrictions** - Works on any domain
- **Fetch-based navigation** - All forms and links handled via `fetch()` with proper credentials
- **Lightweight** - ~3KB, no dependencies
- **Framework agnostic** - Works with any backend (Rails, Django, Express, etc.)

## Installation

### Via CDN (jsdelivr)

```html
<script src="https://cdn.jsdelivr.net/gh/cmer/widget-frame@1.0.0/widget-frame.js"></script>
```

### Via CDN (latest)

```html
<script src="https://cdn.jsdelivr.net/gh/cmer/widget-frame@main/widget-frame.js"></script>
```

### Self-hosted

Download `widget-frame.js` and include it in your project.

## Quick Start

```html
<div id="my-widget"></div>

<script src="https://cdn.jsdelivr.net/gh/cmer/widget-frame@main/widget-frame.js"></script>
<script>
  var frame = WidgetFrame.create({
    container: document.querySelector('#my-widget'),
    baseUrl: 'https://app.example.com',
    initialUrl: 'https://app.example.com/widget/content'
  });
</script>
```

The frame automatically handles:
- Form submissions (GET, POST, PATCH, DELETE)
- Link clicks (except `target="_blank"` and `target="_top"`)
- Content updates via `fetch()`

## Configuration

```javascript
WidgetFrame.create({
  // Required
  container: document.querySelector('#widget'),  // Container element
  baseUrl: 'https://app.example.com',            // Base URL for resolving relative paths

  // Optional
  frameId: 'my-frame',                           // ID for the frame element
  initialUrl: '/widget/start',                   // URL to load initially
  loadingHtml: '<div>Loading...</div>',          // HTML shown while loading
  errorHtml: '<div>Error loading content</div>', // HTML shown on error
  frameClass: 'my-widget-frame',                 // CSS class for the frame
  credentials: 'include',                        // Fetch credentials mode
  scrollToTop: true,                             // Scroll widget into view on navigation if top is off-screen
  headers: { 'X-Custom': 'value' },              // Additional headers

  // Callbacks
  onLoad: function(element) { },                 // Called after content loads
  onError: function(error) { }                   // Called on error
});
```

### Options Reference

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `container` | HTMLElement | Yes | - | Container element to append frame to |
| `baseUrl` | string | Yes | - | Base URL for resolving relative paths |
| `frameId` | string | No | Auto-generated | ID for the frame element |
| `initialUrl` | string | No | - | URL to load initially |
| `loadingHtml` | string | No | `<div class="br-loading">Loading...</div>` | HTML to show while loading |
| `errorHtml` | string | No | `<div class="br-error">Failed to load...</div>` | HTML to show on error |
| `frameClass` | string | No | `widget-frame-container` | CSS class for the frame element |
| `credentials` | string | No | `include` | Fetch credentials mode |
| `scrollToTop` | boolean | No | `true` | Scroll the widget into view after navigation when its top edge is above the viewport. Skipped on initial load. |
| `headers` | object | No | See below | Additional headers for requests |
| `onLoad` | function | No | - | Callback after content loads |
| `onError` | function | No | - | Callback on error |

### Default Headers

```javascript
{
  'Accept': 'text/html, application/xhtml+xml',
  'X-Requested-With': 'XMLHttpRequest'
}
```

## API

### `WidgetFrame.create(options)`

Factory method to create a new WidgetFrame instance.

```javascript
var frame = WidgetFrame.create({
  container: document.querySelector('#widget'),
  baseUrl: 'https://app.example.com'
});
```

### `frame.load(url, options)`

Load content from a URL into the frame.

```javascript
// Simple GET request
frame.load('/widget/page');

// POST request with form data
frame.load('/widget/submit', {
  method: 'POST',
  body: new FormData(formElement)
});
```

### `frame.setContent(html)`

Directly set the frame's HTML content.

```javascript
frame.setContent('<div>New content</div>');
```

### `frame.destroy()`

Remove the frame from the DOM and clean up.

```javascript
frame.destroy();
```

## Events

### `widget-frame:load`

Fired on the frame element after content is successfully loaded.

```javascript
frame.element.addEventListener('widget-frame:load', function(e) {
  console.log('Content loaded');
});
```

## How It Works

### Form Submission

When a form is submitted within the frame:

1. Default submission is prevented
2. Form data is collected via `FormData`
3. For GET requests, data is appended to the URL
4. For POST/PATCH/DELETE, data is sent as the request body
5. Response HTML is parsed and the frame is updated

### Link Navigation

When a link is clicked within the frame:

1. Default navigation is prevented (except `target="_blank"` or `target="_top"`)
2. Relative URLs are resolved against `baseUrl`
3. Content is fetched and the frame is updated

### Response Parsing

The library parses HTML responses looking for:

1. A `<turbo-frame>` element (for compatibility with Turbo's Turbo Frames)
2. Falls back to `<body>` content if no turbo-frame found

## Server-Side Integration

### CORS Headers

Your server needs to return proper CORS headers for cross-origin requests:

```
Access-Control-Allow-Origin: https://embedding-site.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Content-Type, X-Requested-With
```

### URL Helpers

Use absolute URLs in your widget views:

```erb
<%# Good - absolute URL %>
<%= form_with url: widget_url(@widget) do |f| %>

<%# Bad - relative path won't work cross-origin %>
<%= form_with url: widget_path(@widget) do |f| %>
```

## Browser Support

- Chrome 42+
- Firefox 39+
- Safari 10.1+
- Edge 14+

Uses `fetch()`, `Promise`, `URL`, and `FormData` APIs.

## License

MIT License - see [LICENSE](LICENSE) for details.

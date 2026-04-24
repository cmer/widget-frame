/**
 * Widget Frame Library
 *
 * A lightweight (~3KB) library for creating embeddable widgets that work
 * across origins. Handles form submissions, link clicks, and content updates
 * without requiring Turbo or htmx.
 *
 * @example
 * // Create a widget frame
 * const frame = WidgetFrame.create({
 *   container: document.querySelector('#my-widget'),
 *   baseUrl: 'https://app.example.com',
 *   frameId: 'my-widget-frame',
 *   initialUrl: 'https://app.example.com/widget/content'
 * });
 *
 * // Listen for events
 * frame.element.addEventListener('widget-frame:frame-load', (e) => {
 *   console.log('Content loaded');
 * });
 *
 * // Programmatically load content
 * frame.load('/widget/other-page');
 *
 * @see /docs/frontend/widget-frame.md for full documentation
 */

/* global DOMParser, define, self */

;(function (root, factory) {
  // Support CommonJS, AMD, and browser globals
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else if (typeof define === 'function' && define.amd) {
    define(factory)
  } else {
    root.WidgetFrame = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  /**
   * Default configuration options
   */
  const DEFAULTS = {
    loadingHtml: '<div class="br-loading">Loading...</div>',
    errorHtml:
      '<div class="br-error">Failed to load content. Please try again.</div>',
    frameClass: 'widget-frame-container',
    credentials: 'include', // 'include' for cross-origin cookies, 'same-origin' otherwise
    sessionHeader: 'X-Widget-Session', // Header for session token (cross-origin session support)
    scrollToTop: true, // Scroll widget into view after navigation if its top is off-screen
    scrollOffset: 0, // Pixel offset (number) or CSS selector (string) for a fixed navbar above the widget
    headers: {
      Accept: 'text/html, application/xhtml+xml',
      'X-Requested-With': 'XMLHttpRequest'
    }
  }

  /**
   * Parse HTML and extract content from turbo-frame or body
   * @param {string} html - Raw HTML string
   * @returns {string|null} - Inner HTML content or null if parsing failed
   */
  function parseHtmlContent (html) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Look for turbo-frame in response (server may still render these)
    // or fall back to body content
    const content = doc.querySelector('turbo-frame') || doc.body

    return content ? content.innerHTML : null
  }

  /**
   * Resolve a URL against a base URL
   * @param {string} href - URL or path to resolve
   * @param {string} baseUrl - Base URL to resolve against
   * @returns {string} - Absolute URL
   */
  function resolveUrl (href, baseUrl) {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href
    }
    return new URL(href, baseUrl).toString()
  }

  /**
   * Parse a boolean-ish string. Returns undefined if the value is neither
   * true-ish nor false-ish, so callers can fall back to another source.
   * @param {string} value
   * @returns {boolean|undefined}
   */
  function parseBoolAttr (value) {
    if (value === '' || value === 'true') return true
    if (value === 'false') return false
    return undefined
  }

  /**
   * Create a WidgetFrame instance.
   *
   * Options marked [data-*] below may also be set via data attributes on the
   * container element. When both are present, the data attribute wins so that
   * embedders can override JS config from HTML without touching init code.
   *
   * @param {Object} options - Configuration options
   * @param {HTMLElement} options.container - Container element to append frame to
   * @param {string} options.baseUrl - [data-widget-frame-base-url] Base URL for resolving relative paths
   * @param {string} [options.frameId] - [data-widget-frame-id] ID for the frame element
   * @param {string} [options.initialUrl] - [data-widget-frame-initial-url] URL to load initially
   * @param {string} [options.loadingHtml] - HTML to show while loading
   * @param {string} [options.errorHtml] - HTML to show on error
   * @param {string} [options.frameClass] - [data-widget-frame-class] CSS class for the frame element
   * @param {string} [options.credentials] - Fetch credentials mode
   * @param {string} [options.sessionHeader] - Header name for session token (default: 'X-Widget-Session')
   * @param {boolean} [options.scrollToTop=true] - [data-widget-frame-scroll-to-top] Scroll widget into view on navigation if its top is off-screen
   * @param {number|string} [options.scrollOffset=0] - [data-widget-frame-scroll-offset] Pixel offset or CSS selector of a fixed element (e.g. sticky navbar) whose height should be subtracted from the scroll target
   * @param {Object} [options.headers] - Additional headers for fetch requests
   * @param {Function} [options.onLoad] - Callback after content loads
   * @param {Function} [options.onError] - Callback on error
   * @returns {WidgetFrame}
   */
  function WidgetFrame (options) {
    if (!options.container) {
      throw new Error('WidgetFrame: container is required')
    }

    const container = options.container

    // Read an option, letting a container data attribute win over the JS
    // option. If the attribute is absent or the parser rejects its value,
    // fall back to the JS option.
    function readOption (jsKey, dataAttr, parser) {
      const raw = container.getAttribute(dataAttr)
      if (raw !== null) {
        const parsed = parser ? parser(raw) : raw
        if (parsed !== undefined) return parsed
      }
      return options[jsKey]
    }

    this.container = container
    this.baseUrl = readOption('baseUrl', 'data-widget-frame-base-url')

    if (!this.baseUrl) {
      throw new Error('WidgetFrame: baseUrl is required')
    }

    const frameId = readOption('frameId', 'data-widget-frame-id')
    const frameClass = readOption('frameClass', 'data-widget-frame-class')
    const initialUrl = readOption('initialUrl', 'data-widget-frame-initial-url')
    const scrollToTop = readOption(
      'scrollToTop',
      'data-widget-frame-scroll-to-top',
      parseBoolAttr
    )
    const scrollOffset = readOption(
      'scrollOffset',
      'data-widget-frame-scroll-offset'
    )

    this.loadingHtml = options.loadingHtml || DEFAULTS.loadingHtml
    this.errorHtml = options.errorHtml || DEFAULTS.errorHtml
    this.frameClass = frameClass || DEFAULTS.frameClass
    this.credentials = options.credentials || DEFAULTS.credentials
    this.sessionHeader = options.sessionHeader || DEFAULTS.sessionHeader
    this.scrollToTop =
      scrollToTop !== undefined ? scrollToTop : DEFAULTS.scrollToTop
    this.scrollOffset = scrollOffset !== undefined ? scrollOffset : 0
    this.headers = Object.assign({}, DEFAULTS.headers, options.headers || {})
    this.onLoad = options.onLoad || null
    this.onError = options.onError || null

    // Session token for cross-origin session support
    // Stored from response headers and sent on subsequent requests
    this.sessionToken = null

    // Tracks whether the first load has completed, so scrollToTop only
    // runs on navigation within the widget, not on the initial load
    this._initialLoadComplete = false

    // Create frame element
    this.element = document.createElement('div')
    this.element.id = frameId || 'widget-frame-' + Date.now()
    this.element.className = this.frameClass
    this.element.innerHTML = this.loadingHtml
    this.container.appendChild(this.element)

    // Set up event handlers
    this._setupEventHandlers()

    // Load initial content if provided
    if (initialUrl) {
      this.load(initialUrl)
    }
  }

  /**
   * Set up form and link event handlers
   * @private
   */
  WidgetFrame.prototype._setupEventHandlers = function () {
    const self = this

    // Handle form submissions
    this.element.addEventListener('submit', function (e) {
      const form = e.target
      if (!form || form.tagName !== 'FORM') return

      e.preventDefault()

      // Check for turbo-confirm attribute (Turbo-compatible confirmation)
      const confirmMessage = form.getAttribute('data-turbo-confirm')
      if (confirmMessage && !window.confirm(confirmMessage)) {
        return // User cancelled
      }

      const method = (form.method || 'GET').toUpperCase()
      const action = form.action || self.baseUrl
      const formData = new FormData(form)

      let fetchUrl = action
      let fetchBody = null

      if (method === 'GET') {
        // For GET, append form data to URL
        const params = new URLSearchParams(formData)
        const urlObj = new URL(action)
        params.forEach(function (value, key) {
          urlObj.searchParams.set(key, value)
        })
        fetchUrl = urlObj.toString()
      } else {
        // For POST/PATCH/DELETE, send as form body
        fetchBody = formData
      }

      self.load(fetchUrl, { method, body: fetchBody })
    })

    // Handle link clicks
    this.element.addEventListener('click', function (e) {
      const link = e.target.closest('a[href]')
      if (!link) return

      // Skip links with target="_top" or target="_blank"
      const target = link.getAttribute('target')
      if (target === '_top' || target === '_blank') return

      const href = link.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return
      }

      e.preventDefault()
      self.load(resolveUrl(href, self.baseUrl))
    })
  }

  /**
   * Load content into the frame
   * @param {string} url - URL to load
   * @param {Object} [options] - Fetch options
   * @param {string} [options.method='GET'] - HTTP method
   * @param {FormData|string} [options.body] - Request body
   * @returns {Promise}
   */
  WidgetFrame.prototype.load = function (url, options) {
    const self = this
    options = options || {}
    const method = options.method || 'GET'
    const body = options.body || null

    // Show loading state
    this.element.setAttribute('aria-busy', 'true')

    // Build headers, including session token if we have one
    const headers = Object.assign({}, this.headers)
    if (this.sessionToken && this.sessionHeader) {
      headers[this.sessionHeader] = this.sessionToken
    }

    const fetchOptions = {
      method,
      headers: headers,
      credentials: this.credentials
    }

    if (body) {
      fetchOptions.body = body
    }

    return fetch(url, fetchOptions)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Network response was not ok: ' + response.status)
        }
        // Capture session token from response header for next request
        if (self.sessionHeader) {
          const sessionValue = response.headers.get(self.sessionHeader)
          if (sessionValue) {
            self.sessionToken = sessionValue
          }
        }
        return response.text()
      })
      .then(function (html) {
        const content = parseHtmlContent(html)
        if (content) {
          self.element.innerHTML = content
          if (self.scrollToTop && self._initialLoadComplete) {
            self._scrollIntoViewIfNeeded()
          }
          self._initialLoadComplete = true
          self._dispatchLoadEvent()
          if (self.onLoad) {
            self.onLoad(self.element)
          }
        } else {
          throw new Error('Failed to parse response content')
        }
      })
      .catch(function (error) {
        console.error('WidgetFrame: Request failed', error)
        self.element.innerHTML = self.errorHtml
        if (self.onError) {
          self.onError(error)
        }
      })
      .finally(function () {
        self.element.removeAttribute('aria-busy')
      })
  }

  /**
   * Update frame content directly with HTML
   * @param {string} html - HTML content to set
   */
  WidgetFrame.prototype.setContent = function (html) {
    const content = parseHtmlContent(html)
    if (content) {
      this.element.innerHTML = content
      this._dispatchLoadEvent()
    }
  }

  /**
   * Scroll the widget into view if its top edge is above the viewport
   * (or hidden behind a fixed element, per `scrollOffset`).
   * @private
   */
  WidgetFrame.prototype._scrollIntoViewIfNeeded = function () {
    if (!this.element) return
    const offset = this._resolveScrollOffset()
    const rect = this.element.getBoundingClientRect()
    if (rect.top < offset) {
      const y = rect.top + window.pageYOffset - offset
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
    }
  }

  /**
   * Resolve scrollOffset to a pixel value. Numbers pass through; strings are
   * either CSS lengths (10vh, 2rem, 5%) resolved by the browser, or CSS
   * selectors whose height is measured at call time so responsive navbars
   * are handled correctly. Invalid values resolve to 0 rather than throwing,
   * so a bad offset never wipes the frame via the load() error path.
   * @private
   * @returns {number}
   */
  WidgetFrame.prototype._resolveScrollOffset = function () {
    const offset = this.scrollOffset
    if (!offset) return 0
    if (typeof offset === 'number') return offset

    // Bare numeric string ("80") → pixels
    if (/^-?[\d.]+$/.test(offset)) {
      const n = parseFloat(offset)
      return isNaN(n) ? 0 : n
    }

    // CSS length: hand the value to the browser via a hidden probe element
    if (/^-?[\d.]+(px|vh|vw|rem|em|%|ch|ex|vmin|vmax)$/i.test(offset)) {
      const probe = document.createElement('div')
      probe.style.cssText =
        'position:absolute;visibility:hidden;height:' + offset
      document.body.appendChild(probe)
      const px = probe.getBoundingClientRect().height
      document.body.removeChild(probe)
      return px
    }

    // Otherwise treat as a CSS selector; swallow invalid-selector errors
    try {
      const el = document.querySelector(offset)
      return el ? el.getBoundingClientRect().height : 0
    } catch (e) {
      return 0
    }
  }

  /**
   * Dispatch frame load event
   * @private
   */
  WidgetFrame.prototype._dispatchLoadEvent = function () {
    this.element.dispatchEvent(
      new CustomEvent('widget-frame:load', { bubbles: true })
    )
  }

  /**
   * Destroy the frame and clean up
   */
  WidgetFrame.prototype.destroy = function () {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
    this.element = null
    this.container = null
  }

  // Factory function for convenience
  WidgetFrame.create = function (options) {
    return new WidgetFrame(options)
  }

  return WidgetFrame
})

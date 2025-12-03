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
   * Create a WidgetFrame instance
   * @param {Object} options - Configuration options
   * @param {HTMLElement} options.container - Container element to append frame to
   * @param {string} options.baseUrl - Base URL for resolving relative paths
   * @param {string} [options.frameId] - ID for the frame element
   * @param {string} [options.initialUrl] - URL to load initially
   * @param {string} [options.loadingHtml] - HTML to show while loading
   * @param {string} [options.errorHtml] - HTML to show on error
   * @param {string} [options.frameClass] - CSS class for the frame element
   * @param {string} [options.credentials] - Fetch credentials mode
   * @param {string} [options.sessionHeader] - Header name for session token (default: 'X-Widget-Session')
   * @param {Object} [options.headers] - Additional headers for fetch requests
   * @param {Function} [options.onLoad] - Callback after content loads
   * @param {Function} [options.onError] - Callback on error
   * @returns {WidgetFrame}
   */
  function WidgetFrame (options) {
    if (!options.container) {
      throw new Error('WidgetFrame: container is required')
    }
    if (!options.baseUrl) {
      throw new Error('WidgetFrame: baseUrl is required')
    }

    this.container = options.container
    this.baseUrl = options.baseUrl
    this.loadingHtml = options.loadingHtml || DEFAULTS.loadingHtml
    this.errorHtml = options.errorHtml || DEFAULTS.errorHtml
    this.frameClass = options.frameClass || DEFAULTS.frameClass
    this.credentials = options.credentials || DEFAULTS.credentials
    this.sessionHeader = options.sessionHeader || DEFAULTS.sessionHeader
    this.headers = Object.assign({}, DEFAULTS.headers, options.headers || {})
    this.onLoad = options.onLoad || null
    this.onError = options.onError || null

    // Session token for cross-origin session support
    // Stored from response headers and sent on subsequent requests
    this.sessionToken = null

    // Create frame element
    this.element = document.createElement('div')
    this.element.id = options.frameId || 'widget-frame-' + Date.now()
    this.element.className = this.frameClass
    this.element.innerHTML = this.loadingHtml
    this.container.appendChild(this.element)

    // Set up event handlers
    this._setupEventHandlers()

    // Load initial content if provided
    if (options.initialUrl) {
      this.load(options.initialUrl)
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

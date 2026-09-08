import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest globals are off, so React Testing Library's automatic cleanup does not
// register itself. Unmount between tests explicitly instead.
afterEach(cleanup)

// jsdom has no layout, so it does not implement scrollIntoView. The
// autocomplete calls it to keep the highlighted row visible.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// jsdom implements neither the legacy copy command nor a clipboard; the share
// button falls back to execCommand when the async Clipboard API is unavailable.
if (!document.execCommand) {
  document.execCommand = () => false
}

// jsdom has no layout engine, so it ships no ResizeObserver. The map measures
// its container with one.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

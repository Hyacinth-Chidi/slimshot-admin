import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver; Radix measures form controls with it (e.g. a
// Switch inside a <form>). Browsers have it, so a no-op stand-in is enough here.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

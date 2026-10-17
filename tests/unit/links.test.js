/**
 * Unit and property-based tests for LinkModule pure operations:
 *   isValidUrl, addLink, deleteLink
 *
 * Feature: todo-life-dashboard
 *
 * Validates: Requirements 10.2, 10.5, 10.6, 11.2
 *
 * Run with:
 *   npx vitest --run
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';

// js/app.js is a CommonJS IIFE that uses `module.exports` for test exports.
const require = createRequire(import.meta.url);
const { isValidUrl, addLink, deleteLink, saveLinks, loadLinks } = require('../../js/app.js');

// ── localStorage mock for Node environment ────────────────────────────────────
// The test environment is Node (no browser), so we provide a minimal in-memory
// localStorage shim that matches the browser API used by StorageService.
function makeLocalStorageMock() {
  let store = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { store = {}; },
  };
}

// ── Shared arbitraries ────────────────────────────────────────────────────────

// A valid http:// URL (arbitrary path after the scheme)
const arbHttpUrl = fc
  .string({ minLength: 0, maxLength: 50 })
  .map((s) => 'http://' + s);

// A valid https:// URL
const arbHttpsUrl = fc
  .string({ minLength: 0, maxLength: 50 })
  .map((s) => 'https://' + s);

// A valid URL — either http or https
const arbValidUrl = fc.oneof(arbHttpUrl, arbHttpsUrl);

// An invalid URL — does not start with http:// or https://
// We use strings that are guaranteed not to start with either scheme.
const arbInvalidUrl = fc
  .string({ minLength: 0, maxLength: 100 })
  .filter((s) => !s.startsWith('http://') && !s.startsWith('https://'));

// A non-empty, non-whitespace-only string (valid label)
const arbValidLabel = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

// A whitespace-only string (invalid label)
const arbWhitespaceLabel = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 })
  .map((chars) => chars.join(''));

// A single Link object with arbitrary values
const arbLink = fc.record({
  id:    fc.uuid(),
  label: arbValidLabel,
  url:   arbValidUrl,
});

// An array of links (possibly empty)
const arbLinks = fc.array(arbLink, { minLength: 0, maxLength: 20 });

// An array of at least one link (for delete)
const arbNonEmptyLinks = fc.array(arbLink, { minLength: 1, maxLength: 20 });

// ── Property 15: URL validation accepts only http/https schemes ───────────────

describe('isValidUrl', () => {
  // Feature: todo-life-dashboard, Property 15: isValidUrl returns true for http:// and https:// URLs, false for all others

  it('Property 15a — returns true for any string starting with "http://"', () => {
    fc.assert(
      fc.property(arbHttpUrl, (url) => {
        expect(isValidUrl(url)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('Property 15b — returns true for any string starting with "https://"', () => {
    fc.assert(
      fc.property(arbHttpsUrl, (url) => {
        expect(isValidUrl(url)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('Property 15c — returns false for any string that does not start with "http://" or "https://"', () => {
    fc.assert(
      fc.property(arbInvalidUrl, (url) => {
        expect(isValidUrl(url)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // Unit tests — specific cases
  it('returns true for "http://example.com"', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('returns true for "https://example.com"', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('returns true for bare "http://"', () => {
    expect(isValidUrl('http://')).toBe(true);
  });

  it('returns true for bare "https://"', () => {
    expect(isValidUrl('https://')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('returns false for "ftp://example.com"', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });

  it('returns false for "//example.com" (protocol-relative)', () => {
    expect(isValidUrl('//example.com')).toBe(false);
  });

  it('returns false for a relative path', () => {
    expect(isValidUrl('/about')).toBe(false);
  });

  it('returns false for plain domain without scheme', () => {
    expect(isValidUrl('example.com')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidUrl(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidUrl(undefined)).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isValidUrl(42)).toBe(false);
  });

  it('is case-sensitive — "HTTP://" is rejected', () => {
    expect(isValidUrl('HTTP://example.com')).toBe(false);
  });

  it('is case-sensitive — "HTTPS://" is rejected', () => {
    expect(isValidUrl('HTTPS://example.com')).toBe(false);
  });
});

// ── Property 16: Adding a valid link grows the list by one with correct shape ─

describe('addLink', () => {
  // Feature: todo-life-dashboard, Property 16: addLink(L, label, url) returns L.length + 1 array with correct label and url; returns null for whitespace label or invalid URL

  it('Property 16a — grows list by one; last element has trimmed label, correct url, and a string id', () => {
    fc.assert(
      fc.property(arbLinks, arbValidLabel, arbValidUrl, (links, label, url) => {
        const result = addLink(links, label, url);

        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);

        // Length must grow by exactly one
        expect(result.length).toBe(links.length + 1);

        // Last element must have the correct shape
        const last = result[result.length - 1];
        expect(last.label).toBe(label.trim());
        expect(last.url).toBe(url.trim());
        expect(typeof last.id).toBe('string');
        expect(last.id.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('Property 16b — returns null for whitespace-only label', () => {
    // Feature: todo-life-dashboard, Property 16: addLink returns null for whitespace-only label
    fc.assert(
      fc.property(arbLinks, arbWhitespaceLabel, arbValidUrl, (links, label, url) => {
        const result = addLink(links, label, url);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('Property 16c — returns null for invalid URL', () => {
    // Feature: todo-life-dashboard, Property 16: addLink returns null for invalid URL
    fc.assert(
      fc.property(arbLinks, arbValidLabel, arbInvalidUrl, (links, label, url) => {
        const result = addLink(links, label, url);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  // Unit tests — specific cases
  it('returns null for empty label', () => {
    expect(addLink([], '', 'https://example.com')).toBeNull();
  });

  it('returns null for whitespace-only label', () => {
    expect(addLink([], '   ', 'https://example.com')).toBeNull();
  });

  it('returns null for empty url', () => {
    expect(addLink([], 'My Link', '')).toBeNull();
  });

  it('returns null for invalid url scheme', () => {
    expect(addLink([], 'My Link', 'ftp://example.com')).toBeNull();
  });

  it('trims whitespace from the label', () => {
    const result = addLink([], '  My Link  ', 'https://example.com');
    expect(result).not.toBeNull();
    expect(result[0].label).toBe('My Link');
  });

  it('does not mutate the original links array', () => {
    const links = [{ id: '1', label: 'Existing', url: 'https://example.com' }];
    addLink(links, 'New', 'https://new.com');
    expect(links.length).toBe(1);
  });

  it('appends to non-empty list without altering existing items', () => {
    const links = [{ id: '1', label: 'First', url: 'https://first.com' }];
    const result = addLink(links, 'Second', 'https://second.com');
    expect(result[0]).toStrictEqual(links[0]);
    expect(result[1].label).toBe('Second');
    expect(result[1].url).toBe('https://second.com');
  });

  it('generates unique IDs for successive links', () => {
    const r1 = addLink([], 'Link A', 'https://a.com');
    const r2 = addLink([], 'Link B', 'https://b.com');
    expect(r1[0].id).not.toBe(r2[0].id);
  });

  it('accepts http:// scheme', () => {
    const result = addLink([], 'Insecure', 'http://example.com');
    expect(result).not.toBeNull();
    expect(result[0].url).toBe('http://example.com');
  });
});

// ── Property 18: Link deletion removes exactly the targeted link ──────────────

describe('deleteLink', () => {
  // Feature: todo-life-dashboard, Property 18: deleteLink(L, id) returns L.length - 1 containing all links except the one with the given id

  it('Property 18 — removes only the targeted link; all others remain unchanged', () => {
    fc.assert(
      fc.property(arbNonEmptyLinks, (links) => {
        const target = links[Math.floor(Math.random() * links.length)];
        const result = deleteLink(links, target.id);

        // Length decreases by exactly one
        expect(result.length).toBe(links.length - 1);

        // Targeted link must not be present
        expect(result.find((l) => l.id === target.id)).toBeUndefined();

        // All other original links must still be present and identical
        const remaining = links.filter((l) => l.id !== target.id);
        expect(result).toStrictEqual(remaining);
      }),
      { numRuns: 100 },
    );
  });

  // Unit tests — specific cases
  it('removes the only link from a single-item array', () => {
    const links = [{ id: '1', label: 'Only', url: 'https://example.com' }];
    expect(deleteLink(links, '1')).toStrictEqual([]);
  });

  it('does not mutate the original links array', () => {
    const links = [{ id: '1', label: 'Link', url: 'https://example.com' }];
    deleteLink(links, '1');
    expect(links.length).toBe(1);
  });

  it('returns original-length array unchanged when id not found', () => {
    const links = [{ id: '1', label: 'Link', url: 'https://example.com' }];
    const result = deleteLink(links, 'nonexistent');
    expect(result.length).toBe(1);
    expect(result[0]).toStrictEqual(links[0]);
  });

  it('removes first link correctly in multi-link array', () => {
    const links = [
      { id: '1', label: 'First', url: 'https://first.com' },
      { id: '2', label: 'Second', url: 'https://second.com' },
    ];
    const result = deleteLink(links, '1');
    expect(result.length).toBe(1);
    expect(result[0]).toStrictEqual(links[1]);
  });

  it('removes last link correctly in multi-link array', () => {
    const links = [
      { id: '1', label: 'First', url: 'https://first.com' },
      { id: '2', label: 'Second', url: 'https://second.com' },
    ];
    const result = deleteLink(links, '2');
    expect(result.length).toBe(1);
    expect(result[0]).toStrictEqual(links[0]);
  });

  it('removes middle link correctly in three-link array', () => {
    const links = [
      { id: '1', label: 'First',  url: 'https://first.com' },
      { id: '2', label: 'Second', url: 'https://second.com' },
      { id: '3', label: 'Third',  url: 'https://third.com' },
    ];
    const result = deleteLink(links, '2');
    expect(result.length).toBe(2);
    expect(result[0]).toStrictEqual(links[0]);
    expect(result[1]).toStrictEqual(links[2]);
  });
});

// ── Property 17: Link persistence round-trip ──────────────────────────────────
// Feature: todo-life-dashboard, Property 17: Link persistence round-trip

describe('saveLinks / loadLinks', () => {
  let originalLocalStorage;

  beforeEach(() => {
    // Install the in-memory shim before each test
    originalLocalStorage = global.localStorage;
    global.localStorage = makeLocalStorageMock();
  });

  afterEach(() => {
    // Restore whatever was there (likely undefined in Node)
    global.localStorage = originalLocalStorage;
  });

  it('Property 17 — saveLinks then loadLinks returns an array deeply equal to the original', () => {
    // Feature: todo-life-dashboard, Property 17: Link persistence round-trip
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id:    fc.uuid(),
            label: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            url:   fc.oneof(
              fc.string({ minLength: 0, maxLength: 50 }).map(s => 'http://' + s),
              fc.string({ minLength: 0, maxLength: 50 }).map(s => 'https://' + s),
            ),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (links) => {
          saveLinks(links);
          const loaded = loadLinks();
          expect(loaded).toStrictEqual(links);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('round-trips an empty array', () => {
    saveLinks([]);
    expect(loadLinks()).toStrictEqual([]);
  });

  it('round-trips a single link', () => {
    const links = [{ id: 'abc-123', label: 'Google', url: 'https://google.com' }];
    saveLinks(links);
    expect(loadLinks()).toStrictEqual(links);
  });

  it('round-trips a link with an http:// URL', () => {
    const links = [{ id: 'def-456', label: 'Insecure Site', url: 'http://example.com' }];
    saveLinks(links);
    expect(loadLinks()).toStrictEqual(links);
  });

  it('round-trips multiple links preserving order', () => {
    const links = [
      { id: '1', label: 'First',  url: 'https://first.com' },
      { id: '2', label: 'Second', url: 'https://second.com' },
      { id: '3', label: 'Third',  url: 'http://third.com' },
    ];
    saveLinks(links);
    expect(loadLinks()).toStrictEqual(links);
  });

  it('loadLinks returns [] when nothing has been saved', () => {
    // Fresh mock — nothing saved yet
    expect(loadLinks()).toStrictEqual([]);
  });

  it('loadLinks returns [] when localStorage contains malformed JSON', () => {
    global.localStorage.setItem('tld_links', '{not valid json}');
    expect(loadLinks()).toStrictEqual([]);
  });
});

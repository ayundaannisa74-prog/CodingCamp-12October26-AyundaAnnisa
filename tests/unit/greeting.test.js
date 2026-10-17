/**
 * Property-based tests for ClockModule
 * Feature: todo-life-dashboard
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.6
 *
 * Run with:
 *   npx vitest --run
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';

// js/app.js is a CommonJS IIFE that uses `module.exports` for test exports.
// We use createRequire so Vitest (which runs as ESM) can require() it.
const require = createRequire(import.meta.url);
const { formatTime, formatDate, getGreeting } = require('../../js/app.js');

// ── Shared constants ──────────────────────────────────────────────────────────

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Arbitrary that produces any valid Date (timestamp in reasonable range).
// We clamp to ±50 years from Unix epoch to stay within sane calendar bounds.
const arbDate = fc.date({
  min: new Date('1970-01-01T00:00:00Z'),
  max: new Date('2099-12-31T23:59:59Z'),
});

// ── Property 1: Time formatting produces valid HH:MM:SS strings ──────────────
// Feature: todo-life-dashboard, Property 1: formatTime returns correctly zero-padded HH:MM:SS for any Date

describe('formatTime', () => {
  it('Property 1 — returns a string matching HH:MM:SS for any Date', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const result = formatTime(date);

        // Must be a string
        expect(typeof result).toBe('string');

        // Must match HH:MM:SS pattern exactly
        expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);

        const [hh, mm, ss] = result.split(':').map(Number);

        // Each field must be in the correct range
        expect(hh).toBeGreaterThanOrEqual(0);
        expect(hh).toBeLessThanOrEqual(23);
        expect(mm).toBeGreaterThanOrEqual(0);
        expect(mm).toBeLessThanOrEqual(59);
        expect(ss).toBeGreaterThanOrEqual(0);
        expect(ss).toBeLessThanOrEqual(59);

        // Each field must be zero-padded to exactly 2 characters
        expect(result.split(':')[0].length).toBe(2);
        expect(result.split(':')[1].length).toBe(2);
        expect(result.split(':')[2].length).toBe(2);

        // Values must match the actual Date local time
        expect(hh).toBe(date.getHours());
        expect(mm).toBe(date.getMinutes());
        expect(ss).toBe(date.getSeconds());
      }),
      { numRuns: 100 },
    );
  });

  // Unit test — specific boundary: midnight
  it('zero-pads single-digit hours, minutes, and seconds (e.g. 09:05:03)', () => {
    // Create a date at 09:05:03 local time by constructing with local parts
    const d = new Date();
    d.setHours(9, 5, 3, 0);
    expect(formatTime(d)).toBe('09:05:03');
  });
});

// ── Property 2: Date formatting produces correctly structured strings ─────────
// Feature: todo-life-dashboard, Property 2: formatDate returns "DayName, DD MonthName YYYY" for any Date

describe('formatDate', () => {
  it('Property 2 — returns a string matching "DayName, DD MonthName YYYY" for any Date', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const result = formatDate(date);

        expect(typeof result).toBe('string');

        // Split on the first comma: "DayName, DD MonthName YYYY"
        const commaIdx = result.indexOf(', ');
        expect(commaIdx).toBeGreaterThan(0);

        const dayPart  = result.slice(0, commaIdx);          // e.g. "Saturday"
        const restPart = result.slice(commaIdx + 2);          // e.g. "17 October 2026"

        // Day name must be one of the seven English names
        expect(DAY_NAMES).toContain(dayPart);

        // Day name must match the actual date's day
        expect(dayPart).toBe(DAY_NAMES[date.getDay()]);

        // restPart must match "DD MonthName YYYY"
        expect(restPart).toMatch(/^\d{2} [A-Za-z]+ \d{4}$/);

        const [dd, monthName, yyyy] = restPart.split(' ');

        // Two-digit day, in range 01–31
        const day = Number(dd);
        expect(dd.length).toBe(2);
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(31);
        expect(day).toBe(date.getDate());

        // Month name must be one of the twelve English names
        expect(MONTH_NAMES).toContain(monthName);
        expect(monthName).toBe(MONTH_NAMES[date.getMonth()]);

        // Four-digit year matching the actual year
        const year = Number(yyyy);
        expect(yyyy.length).toBe(4);
        expect(year).toBe(date.getFullYear());
      }),
      { numRuns: 100 },
    );
  });

  // Unit test — known date
  it('formats Saturday 17 October 2026 correctly', () => {
    const d = new Date(2026, 9, 17); // months are 0-indexed in JS
    expect(formatDate(d)).toBe('Saturday, 17 October 2026');
  });

  // Unit test — day and date zero-padding
  it('zero-pads single-digit dates (e.g. "01")', () => {
    const d = new Date(2024, 0, 1); // January 1 2024
    expect(formatDate(d)).toMatch(/^Monday, 01 January 2024$/);
  });
});

// ── Property 3: Greeting is correctly determined by hour ──────────────────────
// Feature: todo-life-dashboard, Property 3: getGreeting returns correct message for all hours 0–23 and "Hello" for invalid input

describe('getGreeting', () => {
  // Helper: given an integer hour [0–23], what greeting is expected?
  function expectedGreeting(h) {
    if (h >= 5  && h <= 11) return 'Good Morning';
    if (h >= 12 && h <= 17) return 'Good Afternoon';
    if (h >= 18 && h <= 20) return 'Good Evening';
    return 'Good Night'; // 21–23, 0–4
  }

  it('Property 3a — returns the correct greeting for every integer hour in [0, 23]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 23 }), (hour) => {
        expect(getGreeting(hour)).toBe(expectedGreeting(hour));
      }),
      { numRuns: 100 },
    );
  });

  it('Property 3b — returns "Hello" for null', () => {
    expect(getGreeting(null)).toBe('Hello');
  });

  it('Property 3b — returns "Hello" for undefined', () => {
    expect(getGreeting(undefined)).toBe('Hello');
  });

  it('Property 3b — returns "Hello" for any non-numeric input', () => {
    fc.assert(
      fc.property(
        // Produce arbitrary values that are NOT valid hour numbers:
        // strings, booleans, objects, arrays, NaN, Infinity, etc.
        fc.oneof(
          fc.string(),
          fc.boolean(),
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity),
          fc.object(),
          fc.array(fc.integer()),
        ),
        (nonNumeric) => {
          // Numbers that are out of the 0-23 range should also return 'Hello'
          // according to the fallback rule for non-valid hours (NaN, Infinity, etc.)
          // We skip plain valid integers here since those are covered by Property 3a.
          const result = getGreeting(nonNumeric);
          expect(result).toBe('Hello');
        },
      ),
      { numRuns: 100 },
    );
  });

  // Unit tests — boundary transitions
  it('boundary 04→05: returns "Good Night" at 04, "Good Morning" at 05', () => {
    expect(getGreeting(4)).toBe('Good Night');
    expect(getGreeting(5)).toBe('Good Morning');
  });

  it('boundary 11→12: returns "Good Morning" at 11, "Good Afternoon" at 12', () => {
    expect(getGreeting(11)).toBe('Good Morning');
    expect(getGreeting(12)).toBe('Good Afternoon');
  });

  it('boundary 17→18: returns "Good Afternoon" at 17, "Good Evening" at 18', () => {
    expect(getGreeting(17)).toBe('Good Afternoon');
    expect(getGreeting(18)).toBe('Good Evening');
  });

  it('boundary 20→21: returns "Good Evening" at 20, "Good Night" at 21', () => {
    expect(getGreeting(20)).toBe('Good Evening');
    expect(getGreeting(21)).toBe('Good Night');
  });

  it('midnight (0) and just before dawn (4) both return "Good Night"', () => {
    expect(getGreeting(0)).toBe('Good Night');
    expect(getGreeting(4)).toBe('Good Night');
  });
});

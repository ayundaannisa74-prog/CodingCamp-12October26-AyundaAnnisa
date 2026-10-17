/**
 * Property-based tests for TimerModule
 * Feature: todo-life-dashboard
 *
 * Validates: Requirements 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4
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
const { formatTimerDisplay, timerTick, timerStart, timerStop, timerReset } = require('../../js/app.js');

// ── Shared arbitraries ────────────────────────────────────────────────────────

// Any valid seconds value in [0, 1500]
const arbSeconds = fc.integer({ min: 0, max: 1500 });

// Any positive remaining value in [1, 1500]
const arbPositiveRemaining = fc.integer({ min: 1, max: 1500 });

// A valid TimerState with arbitrary remaining and running values
const arbTimerState = fc.record({
  remaining:  fc.integer({ min: 0, max: 1500 }),
  running:    fc.boolean(),
  intervalId: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 9999 })),
});

// ── Property 4: Timer tick decrements by exactly one second and never goes negative ──
// Feature: todo-life-dashboard, Property 4: timerTick reduces remaining by 1 for R > 0; for R = 0 returns remaining === 0, running === false

describe('timerTick', () => {
  it('Property 4a — decrements remaining by exactly 1 when remaining > 0', () => {
    fc.assert(
      fc.property(
        fc.record({
          remaining:  arbPositiveRemaining,
          running:    fc.boolean(),
          intervalId: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 9999 })),
        }),
        (state) => {
          const next = timerTick(state);

          // remaining decrements by exactly 1
          expect(next.remaining).toBe(state.remaining - 1);

          // remaining must never go negative
          expect(next.remaining).toBeGreaterThanOrEqual(0);

          // running is unchanged (tick does not stop an active timer mid-count)
          expect(next.running).toBe(state.running);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 4b — when remaining === 0, returns remaining === 0 and running === false', () => {
    fc.assert(
      fc.property(
        fc.record({
          remaining:  fc.constant(0),
          running:    fc.boolean(),
          intervalId: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 9999 })),
        }),
        (state) => {
          const next = timerTick(state);

          // remaining stays at 0 (never goes negative)
          expect(next.remaining).toBe(0);

          // timer must stop when it has expired
          expect(next.running).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Unit tests — boundary values
  it('boundary: remaining 1 → remaining 0, running unchanged (true)', () => {
    const state = { remaining: 1, running: true, intervalId: null };
    const next  = timerTick(state);
    expect(next.remaining).toBe(0);
    expect(next.running).toBe(true);
  });

  it('boundary: remaining 0 → remaining 0, running false', () => {
    const state = { remaining: 0, running: true, intervalId: null };
    const next  = timerTick(state);
    expect(next.remaining).toBe(0);
    expect(next.running).toBe(false);
  });

  it('does not mutate the original state object', () => {
    const state = { remaining: 10, running: true, intervalId: null };
    timerTick(state);
    expect(state.remaining).toBe(10);
  });
});

// ── Property 5: Timer display format is always valid MM:SS ───────────────────
// Feature: todo-life-dashboard, Property 5: formatTimerDisplay(S) returns valid MM:SS where MM * 60 + SS === S for all S in [0, 1500]

describe('formatTimerDisplay', () => {
  it('Property 5 — returns valid MM:SS where MM * 60 + SS === S for all S in [0, 1500]', () => {
    fc.assert(
      fc.property(arbSeconds, (seconds) => {
        const result = formatTimerDisplay(seconds);

        // Must be a string
        expect(typeof result).toBe('string');

        // Must match MM:SS pattern exactly (two digits, colon, two digits)
        expect(result).toMatch(/^\d{2}:\d{2}$/);

        const [mmStr, ssStr] = result.split(':');

        // Each part must be exactly 2 characters (zero-padded)
        expect(mmStr.length).toBe(2);
        expect(ssStr.length).toBe(2);

        const mm = Number(mmStr);
        const ss = Number(ssStr);

        // Seconds component must be in [0, 59]
        expect(ss).toBeGreaterThanOrEqual(0);
        expect(ss).toBeLessThanOrEqual(59);

        // MM * 60 + SS must equal the original seconds value
        expect(mm * 60 + ss).toBe(seconds);
      }),
      { numRuns: 100 },
    );
  });

  // Unit tests — boundary values
  it('formatTimerDisplay(1500) → "25:00"', () => {
    expect(formatTimerDisplay(1500)).toBe('25:00');
  });

  it('formatTimerDisplay(0) → "00:00"', () => {
    expect(formatTimerDisplay(0)).toBe('00:00');
  });

  it('formatTimerDisplay(90) → "01:30"', () => {
    expect(formatTimerDisplay(90)).toBe('01:30');
  });
});

// ── Property 6: Timer reset always produces initial state ────────────────────
// Feature: todo-life-dashboard, Property 6: timerReset returns {remaining: 1500, running: false} for any input state

describe('timerReset', () => {
  it('Property 6 — always returns {remaining: 1500, running: false, intervalId: null} regardless of input', () => {
    fc.assert(
      fc.property(arbTimerState, (state) => {
        const next = timerReset(state);

        expect(next.remaining).toBe(1500);
        expect(next.running).toBe(false);
        expect(next.intervalId).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('does not mutate the original state object', () => {
    const state = { remaining: 500, running: true, intervalId: 42 };
    timerReset(state);
    expect(state.remaining).toBe(500);
    expect(state.running).toBe(true);
  });
});

// ── Property 7: Timer start and stop preserve remaining time ─────────────────
// Feature: todo-life-dashboard, Property 7: timerStart sets running: true without changing remaining; timerStop sets running: false without changing remaining

describe('timerStart and timerStop', () => {
  it('Property 7a — timerStart sets running: true and leaves remaining unchanged', () => {
    fc.assert(
      fc.property(arbTimerState, (state) => {
        const next = timerStart(state);

        // running must be true after start
        expect(next.running).toBe(true);

        // remaining must be exactly preserved
        expect(next.remaining).toBe(state.remaining);
      }),
      { numRuns: 100 },
    );
  });

  it('Property 7b — timerStop sets running: false and leaves remaining unchanged', () => {
    fc.assert(
      fc.property(arbTimerState, (state) => {
        const next = timerStop(state);

        // running must be false after stop
        expect(next.running).toBe(false);

        // remaining must be exactly preserved
        expect(next.remaining).toBe(state.remaining);
      }),
      { numRuns: 100 },
    );
  });

  it('timerStart does not mutate the original state object', () => {
    const state = { remaining: 300, running: false, intervalId: null };
    timerStart(state);
    expect(state.running).toBe(false);
  });

  it('timerStop does not mutate the original state object', () => {
    const state = { remaining: 300, running: true, intervalId: null };
    timerStop(state);
    expect(state.running).toBe(true);
  });

  it('timerStart then timerStop returns running: false with same remaining', () => {
    const state = { remaining: 750, running: false, intervalId: null };
    const started = timerStart(state);
    const stopped = timerStop(started);
    expect(stopped.running).toBe(false);
    expect(stopped.remaining).toBe(750);
  });
});

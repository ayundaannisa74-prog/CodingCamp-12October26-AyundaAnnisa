/**
 * Property-based tests for renderTimer — button enable/disable state
 * Feature: todo-life-dashboard
 *
 * Validates: Requirements 4.5, 4.6, 4.7
 *
 * Run with:
 *   npx vitest --run
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';

// js/app.js is a CommonJS IIFE. We use createRequire so Vitest (ESM) can require() it.
// The module is cached after the first require(); we reload a fresh instance in beforeEach
// by deleting the cache entry so each test gets a clean module state.
const _require = createRequire(import.meta.url);

/**
 * Returns a freshly loaded app module.
 * Clearing the require cache ensures each test file load gets an independent IIFE execution.
 */
function loadApp() {
  // Resolve the absolute path so we can bust the cache by the same key Node uses.
  const appPath = _require.resolve('../../js/app.js');
  delete _require.cache[appPath];
  return _require('../../js/app.js');
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

/**
 * Creates the four timer-related DOM elements in document.body and returns them.
 * Called in beforeEach so every test starts with a clean DOM.
 */
function createTimerDOM() {
  document.body.innerHTML = `
    <span id="timer-display"></span>
    <p id="timer-complete-msg" hidden></p>
    <button id="btn-start"></button>
    <button id="btn-stop"></button>
  `;

  return {
    display:     document.getElementById('timer-display'),
    completeMsg: document.getElementById('timer-complete-msg'),
    btnStart:    document.getElementById('btn-start'),
    btnStop:     document.getElementById('btn-stop'),
  };
}

// ── Shared arbitraries ────────────────────────────────────────────────────────

// Any valid seconds value in (0, 1500] — remaining is positive
const arbPositiveRemaining = fc.integer({ min: 1, max: 1500 });

// A full TimerState with positive remaining (running may be anything)
const arbRunningState = fc.record({
  remaining:  arbPositiveRemaining,
  running:    fc.constant(true),
  intervalId: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 9999 })),
});

const arbStoppedPositiveState = fc.record({
  remaining:  arbPositiveRemaining,
  running:    fc.constant(false),
  intervalId: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 9999 })),
});

const arbZeroRemainingState = fc.record({
  remaining:  fc.constant(0),
  running:    fc.boolean(),
  intervalId: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 9999 })),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('renderTimer — Property 8: Button enable/disable state is derived from timer state', () => {
  let renderTimer;
  let els;

  beforeEach(() => {
    // Fresh DOM for each test
    els = createTimerDOM();
    // Fresh module load so the IIFE does not retain stale state
    renderTimer = loadApp().renderTimer;
  });

  // ── Property 8a: Start button is disabled when running === true ───────────

  it('Property 8a — #btn-start is disabled when running === true (any remaining > 0)', () => {
    // Feature: todo-life-dashboard, Property 8: Button enable/disable state is derived from timer state
    fc.assert(
      fc.property(arbRunningState, (state) => {
        renderTimer(state);
        expect(els.btnStart.disabled).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // ── Property 8b: Stop button is disabled when running === false ───────────

  it('Property 8b — #btn-stop is disabled when running === false (any remaining > 0)', () => {
    // Feature: todo-life-dashboard, Property 8: Button enable/disable state is derived from timer state
    fc.assert(
      fc.property(arbStoppedPositiveState, (state) => {
        renderTimer(state);
        expect(els.btnStop.disabled).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // ── Property 8c: Stop button is enabled when running === true ────────────

  it('Property 8c — #btn-stop is enabled when running === true (any remaining > 0)', () => {
    // Feature: todo-life-dashboard, Property 8: Button enable/disable state is derived from timer state
    fc.assert(
      fc.property(arbRunningState, (state) => {
        renderTimer(state);
        expect(els.btnStop.disabled).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // ── Property 8d: Start is disabled when remaining === 0 ──────────────────

  it('Property 8d — #btn-start is disabled when remaining === 0 (regardless of running)', () => {
    // Feature: todo-life-dashboard, Property 8: Button enable/disable state is derived from timer state
    fc.assert(
      fc.property(arbZeroRemainingState, (state) => {
        renderTimer(state);
        expect(els.btnStart.disabled).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // ── Unit tests — boundary values ──────────────────────────────────────────

  it('running=true, remaining=1500 → btnStart disabled, btnStop enabled', () => {
    renderTimer({ remaining: 1500, running: true, intervalId: null });
    expect(els.btnStart.disabled).toBe(true);
    expect(els.btnStop.disabled).toBe(false);
  });

  it('running=false, remaining=1500 → btnStart enabled, btnStop disabled', () => {
    renderTimer({ remaining: 1500, running: false, intervalId: null });
    expect(els.btnStart.disabled).toBe(false);
    expect(els.btnStop.disabled).toBe(true);
  });

  it('running=false, remaining=0 → btnStart disabled, btnStop disabled', () => {
    renderTimer({ remaining: 0, running: false, intervalId: null });
    expect(els.btnStart.disabled).toBe(true);
    expect(els.btnStop.disabled).toBe(true);
  });

  it('running=false, remaining=1 → btnStart enabled, btnStop disabled', () => {
    renderTimer({ remaining: 1, running: false, intervalId: null });
    expect(els.btnStart.disabled).toBe(false);
    expect(els.btnStop.disabled).toBe(true);
  });

  it('running=true, remaining=1 → btnStart disabled, btnStop enabled', () => {
    renderTimer({ remaining: 1, running: true, intervalId: null });
    expect(els.btnStart.disabled).toBe(true);
    expect(els.btnStop.disabled).toBe(false);
  });

  // ── timer-display and timer-complete-msg side-effects ────────────────────

  it('#timer-display reflects formatted remaining time', () => {
    renderTimer({ remaining: 90, running: false, intervalId: null });
    expect(document.getElementById('timer-display').textContent).toBe('01:30');
  });

  it('#timer-complete-msg is visible when remaining === 0 and not running', () => {
    renderTimer({ remaining: 0, running: false, intervalId: null });
    expect(document.getElementById('timer-complete-msg').hidden).toBe(false);
  });

  it('#timer-complete-msg is hidden when remaining > 0', () => {
    renderTimer({ remaining: 100, running: false, intervalId: null });
    expect(document.getElementById('timer-complete-msg').hidden).toBe(true);
  });

  it('#timer-complete-msg is hidden when running === true even if remaining === 0', () => {
    // Running + 0 remaining is a transitional state (tick fires and sets running:false immediately),
    // but renderTimer itself must hide the message whenever running === true.
    renderTimer({ remaining: 0, running: true, intervalId: null });
    expect(document.getElementById('timer-complete-msg').hidden).toBe(true);
  });
});

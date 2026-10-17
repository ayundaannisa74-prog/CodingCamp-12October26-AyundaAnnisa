# Implementation Plan: Todo List Life Dashboard

## Overview

Implement a self-contained single-page productivity dashboard using HTML, CSS, and Vanilla JavaScript — no build step, no external dependencies, works over `file://`. All logic lives in a single IIFE inside `js/app.js`. The implementation follows the five-module structure defined in the design: StorageService, ClockModule, TimerModule, TaskModule, and LinkModule.

## Tasks

- [x] 1. Create project file structure and HTML skeleton
  - Create `index.html` at workspace root with the full DOM skeleton for all four widgets
  - Include all required element IDs: `#greeting-message`, `#time-display`, `#date-display`, `#timer-display`, `#btn-start`, `#btn-stop`, `#btn-reset`, `#timer-complete-msg`, `#task-input`, `#btn-add-task`, `#task-list`, `#link-label-input`, `#link-url-input`, `#btn-add-link`, `#links-panel`, `#storage-error-banner`
  - Create `css/style.css` as an empty file (styling added in Task 6)
  - Create `js/app.js` as an empty IIFE wrapper: `(function() { 'use strict'; /* modules here */ })();`
  - Link `css/style.css` in `<head>` and `js/app.js` as a plain `<script>` at the end of `<body>` (no `type="module"`)
  - _Requirements: 13.1, 13.2, 13.3, 14.2_

- [x] 2. Implement StorageService
  - [x] 2.1 Implement `load(key, fallback)` and `save(key, value)` inside the IIFE
    - `load`: wraps `localStorage.getItem` + `JSON.parse` in try/catch; returns `fallback` on any error
    - `save`: wraps `localStorage.setItem` + `JSON.stringify` in try/catch; on `QuotaExceededError` or any exception, shows `#storage-error-banner` and auto-dismisses after 5 seconds
    - Banner shows message: *"Your changes could not be saved. Storage may be full or unavailable."*
    - _Requirements: 5.6, 6.6, 9.1, 9.3, 12.1, 12.3_

- [x] 3. Implement ClockModule (Greeting Widget)
  - [x] 3.1 Implement `formatTime(date)`, `formatDate(date)`, and `getGreeting(hour)`
    - `formatTime`: returns `"HH:MM:SS"` zero-padded from a `Date` object
    - `formatDate`: returns `"DayName, DD MonthName YYYY"` using English day/month names
    - `getGreeting`: pure function — accepts integer hour 0–23; returns `"Good Morning"` (5–11), `"Good Afternoon"` (12–17), `"Good Evening"` (18–20), `"Good Night"` (21–4); returns `"Hello"` for null, undefined, or non-numeric input
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 3.2 Write property tests for ClockModule
    - **Property 1: Time formatting produces valid HH:MM:SS strings** — `formatTime` returns correctly zero-padded `HH:MM:SS` for any `Date`
    - **Property 2: Date formatting produces correctly structured strings** — `formatDate` returns `"DayName, DD MonthName YYYY"` for any `Date`
    - **Property 3: Greeting is correctly determined by hour** — `getGreeting` returns correct message for all hours 0–23, and `"Hello"` for invalid input
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.6**

  - [x] 3.3 Implement `initGreeting()`
    - Sets up a 1 000 ms `setInterval` that calls `formatTime` and updates `#time-display`
    - Sets up a 60 000 ms `setInterval` that calls `getGreeting` and updates `#greeting-message`; also updates `#date-display`
    - Both run once immediately on call (no delay for first render)
    - _Requirements: 1.3, 2.5_

- [x] 4. Implement TimerModule (Focus Timer)
  - [x] 4.1 Implement pure timer state functions: `formatTimerDisplay`, `timerTick`, `timerStart`, `timerStop`, `timerReset`
    - `formatTimerDisplay(seconds)`: returns `"MM:SS"` for any integer in [0, 1500]
    - `timerTick(state)`: if `remaining > 0` returns `{...state, remaining: remaining - 1}`; if `remaining === 0` returns `{...state, running: false}`
    - `timerStart(state)`: returns `{...state, running: true}` unchanged remaining
    - `timerStop(state)`: returns `{...state, running: false}` unchanged remaining
    - `timerReset(state)`: returns `{remaining: 1500, running: false, intervalId: null}`
    - _Requirements: 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 4.4_

  - [x] 4.2 Write property tests for timer state functions
    - **Property 4: Timer tick decrements by exactly one second and never goes negative** — `timerTick` reduces `remaining` by 1 for R > 0; for R = 0 returns `remaining === 0, running === false`
    - **Property 5: Timer display format is always valid MM:SS** — `formatTimerDisplay(S)` returns valid MM:SS where `MM * 60 + SS === S` for all S in [0, 1500]
    - **Property 6: Timer reset always produces initial state** — `timerReset` returns `{remaining: 1500, running: false}` for any input state
    - **Property 7: Timer start and stop preserve remaining time** — `timerStart` sets `running: true` without changing `remaining`; `timerStop` sets `running: false` without changing `remaining`
    - **Validates: Requirements 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4**

  - [x] 4.3 Implement `renderTimer(state)` and `initTimer()`
    - `renderTimer`: updates `#timer-display` text, toggles `#timer-complete-msg` visibility, sets `disabled` on `#btn-start` (when running or remaining === 0) and `#btn-stop` (when not running)
    - `initTimer`: initialises `TimerState` to `{remaining: 1500, running: false, intervalId: null}`, wires click handlers on `#btn-start`, `#btn-stop`, `#btn-reset`; manages the `setInterval` reference for the tick
    - _Requirements: 3.3, 3.5, 3.6, 4.5, 4.6, 4.7_

  - [x] 4.4 Write property tests for button enable/disable state
    - **Property 8: Button enable/disable state is derived from timer state** — Start disabled when `running === true`; Stop disabled when `running === false`; Start also disabled when `remaining === 0`
    - **Validates: Requirements 4.5, 4.6, 4.7**

- [ ] 5. Checkpoint — Verify structure and timer
  - Ensure all previously implemented functions are wired inside the IIFE, `initGreeting()` and `initTimer()` are called at the bottom of the IIFE, and the page opens correctly over `file://` in a browser with no console errors.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement TaskModule (Todo List)
  - [x] 6.1 Implement pure task operations: `addTask`, `editTask`, `toggleTask`, `deleteTask`
    - `addTask(tasks, description)`: trims input; returns new array with appended `{id, description, done: false}` or `null` if whitespace-only. ID via `crypto.randomUUID()` with fallback to `Date.now() + Math.random().toString(36)`
    - `editTask(tasks, id, description)`: trims input; returns new array with updated description, or `null` if whitespace-only; `done` is unchanged
    - `toggleTask(tasks, id)`: returns new array with the targeted task's `done` value flipped
    - `deleteTask(tasks, id)`: returns new array with the targeted task removed
    - _Requirements: 5.2, 5.5, 6.3, 6.4, 7.2, 7.3, 8.2_

  - [x] 6.2 Write property tests for task operations
    - **Property 9: Adding a valid task grows the list by one with correct shape** — `addTask` returns array of length `T.length + 1` with `done === false` and trimmed description
    - **Property 10: Whitespace-only task descriptions are always rejected** — `addTask` returns `null` for any whitespace-only string
    - **Property 12: Task deletion removes exactly the targeted task** — `deleteTask` returns array of length `T.length - 1` without the targeted ID
    - **Property 13: Task toggle is its own inverse** — double-toggling any task restores original state
    - **Property 14: Editing a task with valid input updates description only** — `editTask` updates description, preserves `done`; returns `null` for whitespace-only
    - **Validates: Requirements 5.2, 5.5, 6.3, 6.4, 7.2, 7.3, 8.2**

  - [x] 6.3 Implement `saveTasks`, `loadTasks`
    - `saveTasks(tasks)`: calls `StorageService.save('tld_tasks', tasks)`
    - `loadTasks()`: calls `StorageService.load('tld_tasks', [])` and returns the result
    - _Requirements: 5.3, 9.1, 9.2, 9.3_

  - [x] 6.4 Write property tests for task persistence round-trip
    - **Property 11: Task persistence round-trip** — `saveTasks` then `loadTasks` returns an array deeply equal to the original
    - **Validates: Requirements 9.1, 9.2**

  - [x] 6.5 Implement `renderTaskList(tasks, container)` and `initTodoList()`
    - `renderTaskList`: full re-render of `#task-list`; each `<li>` includes a checkbox, description text, edit button, and delete button; completed tasks get strikethrough style; inline edit mode replaces text with `<input>` pre-populated with current description (cursor at end), wires Enter to confirm and Escape to cancel; shows inline error messages below inputs on validation failure
    - `initTodoList`: calls `loadTasks`, calls `renderTaskList`, wires click on `#btn-add-task` and Enter-key on `#task-input`; clears input and refocuses on successful add; shows error below `#task-input` on empty submit
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.4, 8.1, 8.2, 8.3, 9.2_

- [ ] 7. Implement LinkModule (Quick Links)
  - [x] 7.1 Implement pure link operations: `isValidUrl`, `addLink`, `deleteLink`
    - `isValidUrl(url)`: returns `true` only if url starts with `"http://"` or `"https://"`
    - `addLink(links, label, url)`: trims inputs; returns new array with appended `{id, label, url}` or `null` if label is whitespace-only or `isValidUrl(url) === false`
    - `deleteLink(links, id)`: returns new array with targeted link removed
    - _Requirements: 10.2, 10.5, 10.6, 11.2_

  - [x] 7.2 Write property tests for link operations
    - **Property 15: URL validation accepts only http/https schemes** — `isValidUrl` returns `true` for `http://` and `https://` prefixes, `false` for all others
    - **Property 16: Adding a valid link grows the list by one with correct shape** — `addLink` returns array of length `L.length + 1` with correct label and url; returns `null` for whitespace label or invalid URL
    - **Property 18: Link deletion removes exactly the targeted link** — `deleteLink` returns array of length `L.length - 1` without the targeted ID
    - **Validates: Requirements 10.2, 10.5, 10.6, 11.2**

  - [x] 7.3 Implement `saveLinks`, `loadLinks`
    - `saveLinks(links)`: calls `StorageService.save('tld_links', links)`
    - `loadLinks()`: calls `StorageService.load('tld_links', [])` and returns the result
    - _Requirements: 10.3, 12.1, 12.2, 12.3_

  - [ ] 7.4 Write property tests for link persistence round-trip
    - **Property 17: Link persistence round-trip** — `saveLinks` then `loadLinks` returns an array deeply equal to the original
    - **Validates: Requirements 12.1, 12.2**

  - [ ] 7.5 Implement `renderLinks(links, container)` and `initQuickLinks()`
    - `renderLinks`: full re-render of `#links-panel`; each link rendered as a `<button>` labelled with `link.label`; clicking the button calls `window.open(url, '_blank', 'noopener,noreferrer')`; each link has a visible delete control
    - `initQuickLinks`: calls `loadLinks`, calls `renderLinks`, wires click on `#btn-add-link`; shows inline error below `#link-label-input` for empty label, below `#link-url-input` for invalid URL; clears inputs on successful add
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.1, 11.2, 11.3, 12.2_

- [ ] 8. Checkpoint — Verify full widget functionality
  - Ensure all five init functions (`initGreeting`, `initTimer`, `initTodoList`, `initQuickLinks`, and StorageService) are called inside the IIFE, the page opens over `file://` with no console errors, and all four widgets render and interact correctly.
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement CSS styling (`css/style.css`)
  - [ ] 9.1 Implement base layout and typography
    - Set minimum body font size to 14px; establish clear visual hierarchy across the four widgets
    - Grid or flexbox layout to arrange the four widgets on a single screen
    - _Requirements: 13.5, 15.3_

  - [ ] 9.2 Implement widget-specific styles and interactive states
    - Strikethrough style for tasks with `done === true` (target the class applied by `renderTaskList`)
    - Disabled state styling for `#btn-start` and `#btn-stop` (opacity or colour change)
    - Link buttons in `#links-panel` styled as clickable shortcuts
    - Storage error banner (`#storage-error-banner`) styled as a dismissible notification (hidden by default, visible when active)
    - Inline error message styles (below inputs)
    - _Requirements: 7.2, 7.3, 4.5, 4.6, 15.2_

  - [ ] 9.3 Apply WCAG 2.1 AA contrast and responsive typography
    - Ensure text and interactive element colour pairs meet minimum contrast ratios: 4.5:1 for normal text, 3:1 for large text and UI components
    - Verify readable typography at all breakpoints
    - _Requirements: 15.4_

- [ ] 10. Final checkpoint — Full integration verification
  - Open `index.html` via `file://` in Chrome, Firefox, Edge (and Safari if available); confirm all four widgets render, all interactions work, localStorage persists across reloads, and no console errors appear.
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. They correspond to property-based and unit tests using Vitest + fast-check as specified in the design's Testing Strategy section.
- All JavaScript code must live inside a single IIFE in `js/app.js` — no `type="module"`, no ES module imports, to ensure `file://` compatibility across all four target browsers.
- Property tests require `npx vitest --run` (single execution, not watch mode).
- Each property test file should include the tag comment: `// Feature: todo-life-dashboard, Property N: <property text>`
- Task IDs use `crypto.randomUUID()` with a `Date.now() + Math.random().toString(36)` fallback for older browsers.
- The timer is intentionally **not** persisted to LocalStorage (Requirement 3.6).
- WCAG 2.1 AA contrast ratio compliance (Task 9.3 / Requirement 15.4) requires manual validation with browser dev tools or an automated auditor (e.g., axe, Lighthouse) — it cannot be fully verified by automated tests alone.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["3.1", "4.1", "6.1", "7.1"] },
    { "id": 2, "tasks": ["3.2", "4.2", "6.2", "7.2"] },
    { "id": 3, "tasks": ["3.3", "4.3", "6.3", "7.3"] },
    { "id": 4, "tasks": ["4.4", "6.4", "7.4"] },
    { "id": 5, "tasks": ["6.5", "7.5"] },
    { "id": 6, "tasks": ["9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3"] }
  ]
}
```

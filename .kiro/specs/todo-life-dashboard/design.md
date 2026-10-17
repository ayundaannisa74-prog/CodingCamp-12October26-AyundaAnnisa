# Design Document — Todo List Life Dashboard

## Overview

The Todo List Life Dashboard is a self-contained, single-page web application delivered as three files: one HTML entry point, one CSS stylesheet, and one JavaScript module. It provides four interactive widgets on a single screen:

1. **Greeting Widget** — displays live time, date, and a time-of-day greeting message.
2. **Focus Timer** — a 25-minute Pomodoro-style countdown with Start / Stop / Reset controls.
3. **Todo List** — a persistent task list supporting add, edit, complete, and delete operations.
4. **Quick Links** — a panel of user-defined shortcut buttons that open URLs in a new tab.

All data is persisted in `window.localStorage` using two keys (`tld_tasks`, `tld_links`). The app has no build step, no external dependencies, and works over the `file://` protocol in Chrome, Firefox, Edge, and Safari.

---

## Architecture

### High-Level Structure

```
index.html          ← Entry point; defines DOM skeleton for all four widgets
css/
  style.css         ← All visual styling; no inline styles in HTML
js/
  app.js            ← All client-side logic; loaded as a plain <script> at end of <body>
```

### Execution Model

The page loads synchronously. `app.js` is placed at the bottom of `<body>` so the DOM is fully parsed before any JavaScript runs — no `DOMContentLoaded` listener is required. No ES modules are used because `type="module"` is blocked on `file://` in some browsers (notably Firefox with default settings).

The entire application runs in a single global IIFE (Immediately Invoked Function Expression) to avoid polluting `window` with module-level names while remaining compatible with `file://`.

### State Model

All runtime state lives in plain JavaScript objects inside the IIFE. There is no virtual DOM or reactive framework — every mutation directly updates both the state object and the DOM. LocalStorage is the single source of truth for persistent data; it is read once on load and written after every mutation.

```
AppState {
  timer: TimerState
  tasks: Task[]
  links: Link[]
}
```

---

## Components and Interfaces

### Greeting Widget

**Responsibility:** Render the live clock, date string, and time-of-day greeting.

**DOM targets:** `#greeting-message`, `#time-display`, `#date-display`

**Functions:**

```js
// Returns "HH:MM:SS" for a given Date
formatTime(date: Date): string

// Returns "DayName, DD MonthName YYYY" for a given Date
formatDate(date: Date): string

// Returns greeting string for a given hour (0–23), or "Hello" on invalid input
getGreeting(hour: number | null | undefined): string

// Called on load; sets up two setInterval ticks:
//   - every 1 000 ms  → updates clock display
//   - every 60 000 ms → updates greeting (also runs once immediately)
initGreeting(): void
```

**Design decisions:**
- Two separate intervals are used — one at 1 s for the clock and one at 60 s for the greeting — rather than a single fast tick updating both. This avoids unnecessary greeting recalculations on every clock tick.
- `getGreeting` accepts the hour as a parameter (not `new Date()` internally) so it is a pure function and fully testable.

---

### Focus Timer

**Responsibility:** Manage a 1 500-second countdown and reflect state in the UI.

**DOM targets:** `#timer-display`, `#btn-start`, `#btn-stop`, `#btn-reset`, `#timer-complete-msg`

**State:**

```js
TimerState {
  remaining: number   // seconds left, 0–1500
  running:   boolean  // true while interval is active
  intervalId: number | null
}
```

**Functions:**

```js
// Returns "MM:SS" string for a total-seconds value in [0, 1500]
formatTimerDisplay(seconds: number): string

// Pure state transitions (return new state, do not mutate directly)
timerTick(state: TimerState): TimerState
timerStart(state: TimerState): TimerState
timerStop(state: TimerState): TimerState
timerReset(state: TimerState): TimerState

// Applies state to DOM (display, button disabled flags, completion message)
renderTimer(state: TimerState): void

// Sets up button event listeners and initialises timer to 25:00
initTimer(): void
```

**Design decisions:**
- State transitions are pure functions so they can be unit-tested without a DOM.
- The interval is managed in `initTimer` using a module-level reference; `timerTick` only updates the seconds value, and `renderTimer` always derives button state from `state.running` and `state.remaining`.
- The timer is **not** persisted to LocalStorage (Requirement 3.6 explicitly states it resets on reload).

---

### Todo List

**Responsibility:** Manage the `tld_tasks` collection with add, edit, complete, and delete operations.

**DOM targets:** `#task-input`, `#btn-add-task`, `#task-list`

**Functions:**

```js
// Pure task operations
addTask(tasks: Task[], description: string): Task[] | null
  // Returns new array with appended task, or null if description is whitespace-only

editTask(tasks: Task[], id: string, description: string): Task[] | null
  // Returns new array with updated task, or null if description is whitespace-only

toggleTask(tasks: Task[], id: string): Task[]
  // Flips done status of the identified task

deleteTask(tasks: Task[], id: string): Task[]
  // Returns new array with the identified task removed

// Persistence
saveTasks(tasks: Task[]): void
  // JSON.stringify and store under "tld_tasks"; throws if localStorage unavailable

loadTasks(): Task[]
  // Parse from "tld_tasks"; returns [] if key absent, JSON invalid, or storage error

// Rendering
renderTaskList(tasks: Task[], container: HTMLElement): void
  // Full re-render of #task-list from current tasks array

// Initialisation
initTodoList(): void
  // Loads tasks, renders list, wires up add-button and enter-key listeners
```

**Design decisions:**
- All mutation functions are pure (accept old state, return new state). `saveTasks` and `renderTaskList` are side-effect functions called at the call site after each mutation. This separation makes logic testable without a DOM or LocalStorage.
- Task IDs are generated with `crypto.randomUUID()` where available, falling back to `Date.now() + Math.random().toString(36)`. IDs are stable across sessions because they are stored with the task.
- Inline edit mode is implemented by replacing the task's `<li>` content with an `<input>` element and wiring Escape to cancel; no separate route is needed.

---

### Quick Links

**Responsibility:** Manage the `tld_links` collection with add and delete operations.

**DOM targets:** `#link-label-input`, `#link-url-input`, `#btn-add-link`, `#links-panel`

**Functions:**

```js
// Pure link operations
addLink(links: Link[], label: string, url: string): Link[] | null
  // Returns new array with appended link, or null if validation fails

deleteLink(links: Link[], id: string): Link[]
  // Returns new array with the identified link removed

isValidUrl(url: string): boolean
  // Returns true if url starts with "http://" or "https://"

// Persistence
saveLinks(links: Link[]): void
loadLinks(): Link[]

// Rendering
renderLinks(links: Link[], container: HTMLElement): void

// Initialisation
initQuickLinks(): void
```

**Design decisions:**
- URL validation is intentionally minimal: only the scheme prefix is checked (Requirement 10 specifies `http://` or `https://`). No full URL parsing is performed to keep the code dependency-free.
- Each link button element uses `window.open(url, '_blank', 'noopener,noreferrer')` to prevent tab-napping while still opening a new tab.

---

## Data Models

### Task

```js
{
  id:          string,   // unique, stable across sessions (UUID or fallback)
  description: string,   // trimmed, 1–200 chars
  done:        boolean   // false = not done, true = done
}
```

**LocalStorage key:** `tld_tasks`
**Stored as:** `JSON.stringify(Task[])`

### Link

```js
{
  id:    string,   // unique, stable across sessions
  label: string,   // trimmed, 1–50 chars
  url:   string    // starts with "http://" or "https://", max 2000 chars
}
```

**LocalStorage key:** `tld_links`
**Stored as:** `JSON.stringify(Link[])`

### TimerState (in-memory only, not persisted)

```js
{
  remaining:  number,         // 0–1500 seconds
  running:    boolean,
  intervalId: number | null   // browser interval handle
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Time formatting produces valid HH:MM:SS strings

*For any* `Date` object, `formatTime(date)` shall return a string of the form `HH:MM:SS` where HH is in [00–23], MM is in [00–59], and SS is in [00–59], with all fields zero-padded to two digits.

**Validates: Requirements 1.1**

---

### Property 2: Date formatting produces correctly structured strings

*For any* `Date` object, `formatDate(date)` shall return a string that starts with a valid English day name, followed by a comma and space, a two-digit day, a space, a valid English month name, a space, and a four-digit year — matching the pattern `"DayName, DD MonthName YYYY"`.

**Validates: Requirements 1.2**

---

### Property 3: Greeting is correctly determined by hour

*For any* integer hour value in [0–23], `getGreeting(hour)` shall return exactly:
- `"Good Morning"` when hour ∈ [5, 11]
- `"Good Afternoon"` when hour ∈ [12, 17]
- `"Good Evening"` when hour ∈ [18, 20]
- `"Good Night"` when hour ∈ {21, 22, 23, 0, 1, 2, 3, 4}

*For any* null, undefined, or non-numeric input, `getGreeting()` shall return `"Hello"`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

---

### Property 4: Timer tick decrements by exactly one second and never goes negative

*For any* timer remaining value R > 0, calling `timerTick({remaining: R, running: true})` shall return a state where `remaining === R - 1`.

*For any* timer remaining value of 0, calling `timerTick({remaining: 0, running: true})` shall return a state where `remaining === 0` and `running === false`.

**Validates: Requirements 3.2, 3.4**

---

### Property 5: Timer display format is always valid MM:SS

*For any* integer seconds S in [0, 1500], `formatTimerDisplay(S)` shall return a string matching `MM:SS` where MM ∈ [00–25] and SS ∈ [00–59], and `MM * 60 + SS === S`.

**Validates: Requirements 3.3**

---

### Property 6: Timer reset always produces initial state

*For any* timer state (any `remaining` value, any `running` value), calling `timerReset(state)` shall return `{remaining: 1500, running: false}`.

**Validates: Requirements 4.3, 4.4**

---

### Property 7: Timer start and stop preserve remaining time

*For any* stopped timer state with `remaining > 0`, calling `timerStart(state)` shall return a state where `running === true` and `remaining` is unchanged.

*For any* running timer state with any `remaining` value, calling `timerStop(state)` shall return a state where `running === false` and `remaining` is unchanged.

**Validates: Requirements 4.1, 4.2**

---

### Property 8: Button enable/disable state is derived from timer state

*For any* timer state where `running === true`, the Start button shall be disabled and the Stop button shall be enabled.

*For any* timer state where `running === false`, the Stop button shall be disabled and the Start button shall be enabled (unless `remaining === 0`, in which case Start is also disabled).

**Validates: Requirements 4.5, 4.6, 4.7**

---

### Property 9: Adding a valid task grows the list by one with correct shape

*For any* task array T and any non-whitespace-only string D (trimmed length 1–200), `addTask(T, D)` shall return a new array of length `T.length + 1` where the last element has `description === D.trim()` and `done === false`.

**Validates: Requirements 5.2**

---

### Property 10: Whitespace-only task descriptions are always rejected

*For any* string composed entirely of whitespace characters (space, tab, newline, etc.), `addTask(tasks, s)` shall return `null` and the task array shall be unchanged.

**Validates: Requirements 5.5**

---

### Property 11: Task persistence round-trip

*For any* array of `Task` objects, calling `saveTasks(tasks)` followed by `loadTasks()` shall return an array that is deeply equal to `tasks` (same IDs, descriptions, and done values in the same order).

**Validates: Requirements 9.1, 9.2**

---

### Property 12: Task deletion removes exactly the targeted task

*For any* task array T with at least one task, and any task ID `id` present in T, `deleteTask(T, id)` shall return an array of length `T.length - 1` that contains all tasks from T except the one with the given `id`.

**Validates: Requirements 8.2**

---

### Property 13: Task toggle is its own inverse

*For any* task array T and any task ID `id` present in T, calling `toggleTask(toggleTask(T, id), id)` shall return an array that is deeply equal to T (same done values for all tasks).

**Validates: Requirements 7.2, 7.3**

---

### Property 14: Editing a task with valid input updates description only

*For any* task array T, any task ID `id` present in T, and any non-whitespace-only string D, `editTask(T, id, D)` shall return a new array of the same length where the targeted task has `description === D.trim()` and `done` is unchanged, and all other tasks are identical to their originals.

*For any* whitespace-only string D, `editTask(T, id, D)` shall return `null`.

**Validates: Requirements 6.3, 6.4**

---

### Property 15: URL validation accepts only http/https schemes

*For any* string that starts with `"http://"` or `"https://"`, `isValidUrl(s)` shall return `true`.

*For any* string that does not start with `"http://"` or `"https://"` (including empty string, `"ftp://"`, relative paths, etc.), `isValidUrl(s)` shall return `false`.

**Validates: Requirements 10.6**

---

### Property 16: Adding a valid link grows the list by one with correct shape

*For any* link array L, any non-empty label string (trimmed), and any URL string where `isValidUrl(url) === true`, `addLink(L, label, url)` shall return a new array of length `L.length + 1` where the last element has the correct `label` and `url`.

*For any* whitespace-only label or invalid URL, `addLink()` shall return `null`.

**Validates: Requirements 10.2, 10.5, 10.6**

---

### Property 17: Link persistence round-trip

*For any* array of `Link` objects, calling `saveLinks(links)` followed by `loadLinks()` shall return an array deeply equal to `links`.

**Validates: Requirements 12.1, 12.2**

---

### Property 18: Link deletion removes exactly the targeted link

*For any* link array L with at least one link, and any link ID present in L, `deleteLink(L, id)` shall return an array of length `L.length - 1` containing all links from L except the targeted one.

**Validates: Requirements 11.2**

---

## Error Handling

### LocalStorage Errors

`saveTasks` and `saveLinks` wrap the `localStorage.setItem` call in a try/catch. On failure:
- The in-memory state is already updated, so the UI reflects the change for the current session.
- A visible error banner (`#storage-error-banner`) is shown with the message: *"Your changes could not be saved. Storage may be full or unavailable."*
- The banner dismisses automatically after 5 seconds or on the next successful save.

`loadTasks` and `loadLinks` wrap `localStorage.getItem` and `JSON.parse` in a try/catch. On any error (quota exceeded, JSON malformed, storage blocked by browser security settings), they return an empty array and do not display an error (a missing or corrupt save is treated as a fresh start, per Requirements 9.3, 12.3).

### Input Validation Errors

Each widget that accepts user input displays inline error messages adjacent to the relevant input field (not a global banner). Error messages are cleared on the next successful submission.

| Trigger | Error message location | Message |
|---|---|---|
| Empty task on add | Below `#task-input` | "Task description cannot be empty." |
| Empty description on edit confirm | Below the inline edit input | "Description cannot be empty." |
| Empty link label | Below `#link-label-input` | "Label is required." |
| Invalid link URL | Below `#link-url-input` | "URL must start with http:// or https://" |

### Timer Edge Cases

If `setInterval` fires slightly late due to browser throttling (e.g., background tab), the displayed time may drift by up to one tick. This is acceptable — the spec requires decrementing by 1 second per interval call, not wall-clock accuracy. No drift correction is implemented.

---

## Testing Strategy

### Approach

This project uses a dual testing approach:

- **Unit tests** verify specific examples, edge cases, and error conditions using concrete inputs.
- **Property-based tests** verify universal properties across a wide range of generated inputs.

Because the core logic (formatting functions, state transitions, collection operations) consists of pure functions, property-based testing is well-suited here and will catch edge cases that hand-written examples miss.

### Property-Based Testing Library

**[fast-check](https://github.com/dubzzz/fast-check)** (JavaScript/TypeScript). Fast-check is the most widely-used property-based testing library for the JS ecosystem, is framework-agnostic, and runs in Node.js with any test runner.

Each property test must be configured with a minimum of **100 iterations** (`numRuns: 100`).

### Test Runner

**[Vitest](https://vitest.dev/)** — fast, zero-config, compatible with ES modules and plain CommonJS, with excellent fast-check integration.

Run tests with:
```
npx vitest --run
```

### Property Test Tags

Each property-based test must include a comment in the format:

```
// Feature: todo-life-dashboard, Property N: <property text>
```

### Test File Layout

```
tests/
  unit/
    greeting.test.js      ← formatTime, formatDate, getGreeting (Properties 1–3)
    timer.test.js         ← formatTimerDisplay, timerTick, timerStart, timerStop, timerReset (Properties 4–8)
    tasks.test.js         ← addTask, editTask, toggleTask, deleteTask, saveTasks, loadTasks (Properties 9–14)
    links.test.js         ← addLink, deleteLink, isValidUrl, saveLinks, loadLinks (Properties 15–18)
  integration/
    localStorage.test.js  ← localStorage unavailability, error banner behavior
    timer-controls.test.js ← button state changes after start/stop/reset
```

### Unit Test Focus Areas

- Greeting boundary transitions (04:59 → 05:00, 11:59 → 12:00, 17:59 → 18:00, 20:59 → 21:00)
- Timer at exactly 00:00 (does not go negative, shows completion message)
- Adding a task with exactly 200 characters (accepted) and 201 characters (rejected by input maxlength)
- `loadTasks()` / `loadLinks()` with missing key, empty string, and malformed JSON — all return `[]`
- LocalStorage mock throwing `QuotaExceededError` during `saveTasks` / `saveLinks`

### WCAG 2.1 AA Note

Contrast ratio compliance (Requirement 15.4) requires manual validation using browser developer tools or an automated accessibility auditor (e.g., axe, Lighthouse). It cannot be fully verified by automated unit or property tests.

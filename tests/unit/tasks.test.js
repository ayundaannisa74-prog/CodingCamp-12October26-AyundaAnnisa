/**
 * Unit and property-based tests for TaskModule pure operations:
 *   addTask, editTask, toggleTask, deleteTask, saveTasks, loadTasks
 *
 * Feature: todo-life-dashboard
 *
 * Validates: Requirements 5.2, 5.5, 6.3, 6.4, 7.2, 7.3, 8.2, 9.1, 9.2
 *
 * Run with:
 *   npx vitest --run
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';

// js/app.js is a CommonJS IIFE that uses `module.exports` for test exports.
const require = createRequire(import.meta.url);
const { addTask, editTask, toggleTask, deleteTask, saveTasks, loadTasks } = require('../../js/app.js');

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

// A non-empty, non-whitespace-only string (valid task description)
const arbValidDescription = fc.string({ minLength: 1, maxLength: 200 }).filter(
  (s) => s.trim().length > 0,
);

// A whitespace-only string (invalid description)
const arbWhitespaceDescription = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 })
  .map((chars) => chars.join(''));

// A single Task object with arbitrary values
const arbTask = fc.record({
  id:          fc.uuid(),
  description: arbValidDescription,
  done:        fc.boolean(),
});

// An array of tasks
const arbTasks = fc.array(arbTask, { minLength: 0, maxLength: 20 });

// An array of at least one task (for delete/edit/toggle)
const arbNonEmptyTasks = fc.array(arbTask, { minLength: 1, maxLength: 20 });

// ── Property 9: Adding a valid task grows the list by one with correct shape ─
// Feature: todo-life-dashboard, Property 9: addTask(T, D) returns T.length + 1 array; last element has description === D.trim() and done === false

describe('addTask', () => {
  it('Property 9 — grows list by one, last element has trimmed description and done: false', () => {
    fc.assert(
      fc.property(arbTasks, arbValidDescription, (tasks, description) => {
        const result = addTask(tasks, description);

        // Must return a new array (not null)
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);

        // Length must grow by exactly one
        expect(result.length).toBe(tasks.length + 1);

        // Last element must have the correct shape
        const last = result[result.length - 1];
        expect(last.description).toBe(description.trim());
        expect(last.done).toBe(false);
        expect(typeof last.id).toBe('string');
        expect(last.id.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  // Property 10: Whitespace-only descriptions are always rejected
  // Feature: todo-life-dashboard, Property 10: addTask(tasks, s) returns null when s is whitespace-only

  it('Property 10 — returns null for whitespace-only descriptions', () => {
    fc.assert(
      fc.property(arbTasks, arbWhitespaceDescription, (tasks, description) => {
        const result = addTask(tasks, description);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('returns null for empty string', () => {
    expect(addTask([], '')).toBeNull();
  });

  it('returns null for string of only spaces', () => {
    expect(addTask([], '   ')).toBeNull();
  });

  it('returns null for string of only tabs and newlines', () => {
    expect(addTask([], '\t\n')).toBeNull();
  });

  it('trims leading/trailing whitespace from the description', () => {
    const result = addTask([], '  Buy milk  ');
    expect(result).not.toBeNull();
    expect(result[0].description).toBe('Buy milk');
  });

  it('does not mutate the original tasks array', () => {
    const tasks = [{ id: '1', description: 'Existing', done: false }];
    addTask(tasks, 'New task');
    expect(tasks.length).toBe(1);
  });

  it('appends to non-empty list without altering existing items', () => {
    const tasks = [{ id: '1', description: 'First', done: true }];
    const result = addTask(tasks, 'Second');
    expect(result[0]).toStrictEqual(tasks[0]);
    expect(result[1].description).toBe('Second');
  });

  it('generates unique IDs for successive tasks', () => {
    const r1 = addTask([], 'Task A');
    const r2 = addTask([], 'Task B');
    expect(r1[0].id).not.toBe(r2[0].id);
  });
});

// ── Property 14: Editing a task with valid input updates description only ────
// Feature: todo-life-dashboard, Property 14: editTask(T, id, D) updates only description; done and all other tasks unchanged. editTask returns null for whitespace-only D.

describe('editTask', () => {
  it('Property 14a — updates only description; done is unchanged; other tasks are identical', () => {
    fc.assert(
      fc.property(arbNonEmptyTasks, arbValidDescription, (tasks, description) => {
        // Pick a random task's id as the target
        const target = tasks[Math.floor(Math.random() * tasks.length)];
        const result = editTask(tasks, target.id, description);

        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);

        // Length must stay the same
        expect(result.length).toBe(tasks.length);

        result.forEach((task, i) => {
          if (task.id === target.id) {
            // Description updated to trimmed value
            expect(task.description).toBe(description.trim());
            // done is unchanged
            expect(task.done).toBe(target.done);
          } else {
            // All other tasks are identical to the originals
            expect(task).toStrictEqual(tasks[i]);
          }
        });
      }),
      { numRuns: 100 },
    );
  });

  it('Property 14b — returns null for whitespace-only description', () => {
    fc.assert(
      fc.property(arbNonEmptyTasks, arbWhitespaceDescription, (tasks, description) => {
        const target = tasks[0];
        const result = editTask(tasks, target.id, description);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('returns null for empty string', () => {
    const tasks = [{ id: '1', description: 'Buy milk', done: false }];
    expect(editTask(tasks, '1', '')).toBeNull();
  });

  it('trims description whitespace', () => {
    const tasks = [{ id: '1', description: 'Old', done: false }];
    const result = editTask(tasks, '1', '  New  ');
    expect(result[0].description).toBe('New');
  });

  it('preserves done: true when editing description', () => {
    const tasks = [{ id: '1', description: 'Task', done: true }];
    const result = editTask(tasks, '1', 'Updated task');
    expect(result[0].done).toBe(true);
  });

  it('does not mutate the original tasks array', () => {
    const tasks = [{ id: '1', description: 'Original', done: false }];
    editTask(tasks, '1', 'Changed');
    expect(tasks[0].description).toBe('Original');
  });

  it('leaves non-targeted tasks untouched in a multi-task array', () => {
    const tasks = [
      { id: '1', description: 'First', done: false },
      { id: '2', description: 'Second', done: true },
    ];
    const result = editTask(tasks, '1', 'Updated First');
    expect(result[1]).toStrictEqual(tasks[1]);
  });
});

// ── Property 13: Task toggle is its own inverse ───────────────────────────────
// Feature: todo-life-dashboard, Property 13: toggleTask(toggleTask(T, id), id) deeply equals T for any T and id in T

describe('toggleTask', () => {
  it('Property 13 — double toggle returns array deeply equal to original', () => {
    fc.assert(
      fc.property(arbNonEmptyTasks, (tasks) => {
        const target = tasks[Math.floor(Math.random() * tasks.length)];
        const toggled = toggleTask(tasks, target.id);
        const restored = toggleTask(toggled, target.id);

        // Every task should be back to its original done value
        expect(restored).toStrictEqual(tasks);
      }),
      { numRuns: 100 },
    );
  });

  it('flips done: false to done: true', () => {
    const tasks = [{ id: '1', description: 'Task', done: false }];
    const result = toggleTask(tasks, '1');
    expect(result[0].done).toBe(true);
  });

  it('flips done: true to done: false', () => {
    const tasks = [{ id: '1', description: 'Task', done: true }];
    const result = toggleTask(tasks, '1');
    expect(result[0].done).toBe(false);
  });

  it('does not mutate the original tasks array', () => {
    const tasks = [{ id: '1', description: 'Task', done: false }];
    toggleTask(tasks, '1');
    expect(tasks[0].done).toBe(false);
  });

  it('leaves non-targeted tasks unchanged in a multi-task array', () => {
    const tasks = [
      { id: '1', description: 'First', done: false },
      { id: '2', description: 'Second', done: true },
    ];
    const result = toggleTask(tasks, '1');
    expect(result[0].done).toBe(true);
    expect(result[1]).toStrictEqual(tasks[1]);
  });

  it('preserves description when toggling', () => {
    const tasks = [{ id: '1', description: 'Task', done: false }];
    const result = toggleTask(tasks, '1');
    expect(result[0].description).toBe('Task');
  });
});

// ── Property 12: Task deletion removes exactly the targeted task ─────────────
// Feature: todo-life-dashboard, Property 12: deleteTask(T, id) returns T.length - 1 containing all tasks except the one with the given id

describe('deleteTask', () => {
  it('Property 12 — removes only the targeted task; all others remain', () => {
    fc.assert(
      fc.property(arbNonEmptyTasks, (tasks) => {
        const target = tasks[Math.floor(Math.random() * tasks.length)];
        const result = deleteTask(tasks, target.id);

        // Length decreases by exactly one
        expect(result.length).toBe(tasks.length - 1);

        // Targeted task must not be present
        expect(result.find((t) => t.id === target.id)).toBeUndefined();

        // All other original tasks must still be present
        const remaining = tasks.filter((t) => t.id !== target.id);
        expect(result).toStrictEqual(remaining);
      }),
      { numRuns: 100 },
    );
  });

  it('removes the only task from a single-item array', () => {
    const tasks = [{ id: '1', description: 'Task', done: false }];
    const result = deleteTask(tasks, '1');
    expect(result).toStrictEqual([]);
  });

  it('does not mutate the original tasks array', () => {
    const tasks = [{ id: '1', description: 'Task', done: false }];
    deleteTask(tasks, '1');
    expect(tasks.length).toBe(1);
  });

  it('returns original-length array unchanged when id not found', () => {
    const tasks = [{ id: '1', description: 'Task', done: false }];
    const result = deleteTask(tasks, 'nonexistent');
    expect(result.length).toBe(1);
    expect(result[0]).toStrictEqual(tasks[0]);
  });

  it('removes first task correctly in multi-task array', () => {
    const tasks = [
      { id: '1', description: 'First', done: false },
      { id: '2', description: 'Second', done: true },
    ];
    const result = deleteTask(tasks, '1');
    expect(result.length).toBe(1);
    expect(result[0]).toStrictEqual(tasks[1]);
  });

  it('removes last task correctly in multi-task array', () => {
    const tasks = [
      { id: '1', description: 'First', done: false },
      { id: '2', description: 'Second', done: true },
    ];
    const result = deleteTask(tasks, '2');
    expect(result.length).toBe(1);
    expect(result[0]).toStrictEqual(tasks[0]);
  });
});

// ── Property 11: Task persistence round-trip ─────────────────────────────────
// Feature: todo-life-dashboard, Property 11: Task persistence round-trip

describe('saveTasks / loadTasks', () => {
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

  it('Property 11 — saveTasks then loadTasks returns an array deeply equal to the original', () => {
    // Feature: todo-life-dashboard, Property 11: Task persistence round-trip
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id:          fc.uuid(),
            description: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
            done:        fc.boolean(),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (tasks) => {
          saveTasks(tasks);
          const loaded = loadTasks();
          expect(loaded).toStrictEqual(tasks);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('round-trips an empty array', () => {
    saveTasks([]);
    expect(loadTasks()).toStrictEqual([]);
  });

  it('round-trips a single task', () => {
    const tasks = [{ id: 'abc-123', description: 'Buy milk', done: false }];
    saveTasks(tasks);
    expect(loadTasks()).toStrictEqual(tasks);
  });

  it('round-trips a task with done: true', () => {
    const tasks = [{ id: 'xyz-789', description: 'Finished item', done: true }];
    saveTasks(tasks);
    expect(loadTasks()).toStrictEqual(tasks);
  });

  it('loadTasks returns [] when nothing has been saved', () => {
    // Fresh mock — nothing saved yet
    expect(loadTasks()).toStrictEqual([]);
  });

  it('loadTasks returns [] when localStorage contains malformed JSON', () => {
    global.localStorage.setItem('tld_tasks', '{not valid json}');
    expect(loadTasks()).toStrictEqual([]);
  });
});

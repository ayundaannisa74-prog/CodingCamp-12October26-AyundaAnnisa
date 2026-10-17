(function() {
  'use strict';

  // ── StorageService ────────────────────────────────────────────────────────────
  // Wraps localStorage with safe load/save helpers.
  // Requirements: 5.6, 6.6, 9.1, 9.3, 12.1, 12.3

  var StorageService = (function() {
    var bannerEl = document.getElementById('storage-error-banner');
    var bannerTimer = null;

    /**
     * Shows the storage error banner and auto-dismisses it after 5 seconds.
     * Resets the dismiss timer if the banner is already visible.
     */
    function showBanner() {
      if (bannerEl) {
        bannerEl.hidden = false;
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(function() {
          bannerEl.hidden = true;
          bannerTimer = null;
        }, 5000);
      }
    }

    /**
     * Reads a JSON value from localStorage.
     * Returns `fallback` on any error (missing key, malformed JSON, storage blocked).
     *
     * @param {string} key
     * @param {*} fallback  Value returned when the key is absent or any error occurs.
     * @returns {*}
     */
    function load(key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        if (raw === null) {
          return fallback;
        }
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    }

    /**
     * Serialises `value` to JSON and writes it to localStorage under `key`.
     * On any exception (e.g. QuotaExceededError), shows the error banner.
     *
     * @param {string} key
     * @param {*} value
     */
    function save(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        // Dismiss the banner on the next successful save (if it was visible).
        if (bannerEl && !bannerEl.hidden) {
          clearTimeout(bannerTimer);
          bannerEl.hidden = true;
          bannerTimer = null;
        }
      } catch (e) {
        showBanner();
      }
    }

    return { load: load, save: save };
  }());

  // ── ClockModule — pure helpers ────────────────────────────────────────────────
  // Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.6

  var DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

  /**
   * Returns the current time as a zero-padded "HH:MM:SS" string (24-hour).
   * @param {Date} date
   * @returns {string}  e.g. "09:05:03"
   */
  function formatTime(date) {
    var hh = String(date.getHours()).padStart(2, '0');
    var mm = String(date.getMinutes()).padStart(2, '0');
    var ss = String(date.getSeconds()).padStart(2, '0');
    return hh + ':' + mm + ':' + ss;
  }

  /**
   * Returns the date as "DayName, DD MonthName YYYY" in English.
   * @param {Date} date
   * @returns {string}  e.g. "Saturday, 17 October 2026"
   */
  function formatDate(date) {
    var dayName   = DAY_NAMES[date.getDay()];
    var dd        = String(date.getDate()).padStart(2, '0');
    var monthName = MONTH_NAMES[date.getMonth()];
    var yyyy      = date.getFullYear();
    return dayName + ', ' + dd + ' ' + monthName + ' ' + yyyy;
  }

  /**
   * Returns a time-of-day greeting for a given hour (0–23).
   * Returns "Hello" for null, undefined, or any non-numeric / out-of-range input.
   * @param {number|null|undefined} hour
   * @returns {string}
   */
  function getGreeting(hour) {
    if (hour === null || hour === undefined || typeof hour !== 'number' || isNaN(hour)) {
      return 'Hello';
    }
    var h = Math.floor(hour);
    if (h >= 5  && h <= 11) { return 'Good Morning'; }
    if (h >= 12 && h <= 17) { return 'Good Afternoon'; }
    if (h >= 18 && h <= 20) { return 'Good Evening'; }
    if ((h >= 21 && h <= 23) || (h >= 0 && h <= 4)) { return 'Good Night'; }
    return 'Hello';
  }

  // ── initGreeting — clock/greeting initialiser ─────────────────────────────────
  // Requirements: 1.3, 2.5

  /**
   * Immediately renders the time, date, and greeting, then keeps them live:
   *   - #time-display    updated every 1 000 ms via formatTime
   *   - #greeting-message updated every 60 000 ms via getGreeting
   *   - #date-display    updated alongside the greeting (every 60 000 ms)
   */
  function initGreeting() {
    var timeEl     = document.getElementById('time-display');
    var dateEl     = document.getElementById('date-display');
    var greetingEl = document.getElementById('greeting-message');

    // ── immediate first render ────────────────────────────────────────────────
    if (timeEl)     { timeEl.textContent     = formatTime(new Date()); }
    if (greetingEl) { greetingEl.textContent = getGreeting(new Date().getHours()); }
    if (dateEl)     { dateEl.textContent     = formatDate(new Date()); }

    // ── 1 s interval — clock ──────────────────────────────────────────────────
    setInterval(function() {
      if (timeEl) { timeEl.textContent = formatTime(new Date()); }
    }, 1000);

    // ── 60 s interval — greeting + date ──────────────────────────────────────
    setInterval(function() {
      if (greetingEl) { greetingEl.textContent = getGreeting(new Date().getHours()); }
      if (dateEl)     { dateEl.textContent     = formatDate(new Date()); }
    }, 60000);
  }

  // ── TimerModule — pure helpers ────────────────────────────────────────────────
  // Requirements: 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 4.4

  /**
   * Returns the remaining time as a zero-padded "MM:SS" string.
   * @param {number} seconds  Integer in [0, 1500]
   * @returns {string}  e.g. "25:00", "04:59", "00:00"
   */
  function formatTimerDisplay(seconds) {
    var mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    var ss = String(seconds % 60).padStart(2, '0');
    return mm + ':' + ss;
  }

  /**
   * Advances the timer by one tick.
   * If remaining > 0, decrements by 1.
   * If remaining === 0, sets running to false (timer has expired).
   * @param {TimerState} state
   * @returns {TimerState}  New state object (does not mutate input)
   */
  function timerTick(state) {
    if (state.remaining > 0) {
      return Object.assign({}, state, { remaining: state.remaining - 1 });
    }
    return Object.assign({}, state, { running: false });
  }

  /**
   * Marks the timer as running. Does not alter remaining time.
   * @param {TimerState} state
   * @returns {TimerState}
   */
  function timerStart(state) {
    return Object.assign({}, state, { running: true });
  }

  /**
   * Marks the timer as stopped. Does not alter remaining time.
   * @param {TimerState} state
   * @returns {TimerState}
   */
  function timerStop(state) {
    return Object.assign({}, state, { running: false });
  }

  /**
   * Resets the timer to its initial 25-minute state, clearing any interval reference.
   * @param {TimerState} _state  Current state (ignored — reset always returns canonical initial state)
   * @returns {TimerState}
   */
  function timerReset(_state) {
    return { remaining: 1500, running: false, intervalId: null };
  }

  // ── TimerModule — DOM rendering & initialisation ─────────────────────────────
  // Requirements: 3.3, 3.5, 3.6, 4.5, 4.6, 4.7

  /**
   * Reflects a TimerState onto the DOM — pure side-effects, no state mutation.
   *
   * - #timer-display      : formatted MM:SS string
   * - #timer-complete-msg : visible only when remaining === 0 and not running
   * - #btn-start.disabled : true when running or remaining === 0
   * - #btn-stop.disabled  : true when not running
   *
   * @param {TimerState} state
   */
  function renderTimer(state) {
    var displayEl  = document.getElementById('timer-display');
    var completeEl = document.getElementById('timer-complete-msg');
    var btnStart   = document.getElementById('btn-start');
    var btnStop    = document.getElementById('btn-stop');

    if (displayEl)  { displayEl.textContent = formatTimerDisplay(state.remaining); }

    if (completeEl) {
      completeEl.hidden = !(state.remaining === 0 && !state.running);
    }

    if (btnStart) { btnStart.disabled = state.running || state.remaining === 0; }
    if (btnStop)  { btnStop.disabled  = !state.running; }
  }

  /**
   * Initialises the Focus Timer widget.
   *
   * - Creates a module-level TimerState (not persisted — req 3.6)
   * - Wires click handlers for Start, Stop, and Reset buttons
   * - Manages the setInterval reference inside TimerState.intervalId
   */
  function initTimer() {
    var TimerState = { remaining: 1500, running: false, intervalId: null };

    renderTimer(TimerState);

    var btnStart = document.getElementById('btn-start');
    var btnStop  = document.getElementById('btn-stop');
    var btnReset = document.getElementById('btn-reset');

    if (btnStart) {
      btnStart.addEventListener('click', function() {
        if (TimerState.running) { return; }

        TimerState = timerStart(TimerState);
        renderTimer(TimerState);

        // Clear any stale interval before starting a new one.
        clearInterval(TimerState.intervalId);

        var id = setInterval(function() {
          TimerState = timerTick(TimerState);
          TimerState = Object.assign({}, TimerState, { intervalId: id });
          renderTimer(TimerState);

          if (TimerState.remaining === 0) {
            clearInterval(id);
            TimerState = Object.assign({}, TimerState, { intervalId: null });
          }
        }, 1000);

        TimerState = Object.assign({}, TimerState, { intervalId: id });
      });
    }

    if (btnStop) {
      btnStop.addEventListener('click', function() {
        if (!TimerState.running) { return; }

        clearInterval(TimerState.intervalId);
        TimerState = timerStop(TimerState);
        TimerState = Object.assign({}, TimerState, { intervalId: null });
        renderTimer(TimerState);
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', function() {
        clearInterval(TimerState.intervalId);
        TimerState = timerReset(TimerState);
        renderTimer(TimerState);
      });
    }
  }

  // ── TaskModule — pure task operations ────────────────────────────────────────
  // Requirements: 5.2, 5.5, 6.3, 6.4, 7.2, 7.3, 8.2

  /**
   * Generates a unique ID for a task.
   * Uses crypto.randomUUID() when available; falls back to a timestamp + random string.
   * @returns {string}
   */
  function generateTaskId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now() + Math.random().toString(36);
  }

  /**
   * Returns a new task array with the given description appended as a new task.
   * Returns null if the trimmed description is empty or whitespace-only.
   *
   * @param {Task[]} tasks        Existing task array (never mutated)
   * @param {string} description  Raw description string from user input
   * @returns {Task[]|null}       New array with appended task, or null on invalid input
   */
  function addTask(tasks, description) {
    var trimmed = description.trim();
    if (trimmed.length === 0) {
      return null;
    }
    var newTask = { id: generateTaskId(), description: trimmed, done: false };
    return tasks.concat([newTask]);
  }

  /**
   * Returns a new task array with the targeted task's description updated.
   * Returns null if the trimmed description is empty or whitespace-only.
   * The task's done status is preserved; all other tasks are unchanged.
   *
   * @param {Task[]} tasks        Existing task array (never mutated)
   * @param {string} id           ID of the task to update
   * @param {string} description  New description string
   * @returns {Task[]|null}       New array with updated task, or null on invalid input
   */
  function editTask(tasks, id, description) {
    var trimmed = description.trim();
    if (trimmed.length === 0) {
      return null;
    }
    return tasks.map(function(task) {
      if (task.id === id) {
        return Object.assign({}, task, { description: trimmed });
      }
      return task;
    });
  }

  /**
   * Returns a new task array with the targeted task's done value flipped.
   * All other tasks remain identical.
   *
   * @param {Task[]} tasks  Existing task array (never mutated)
   * @param {string} id     ID of the task to toggle
   * @returns {Task[]}      New array with toggled task
   */
  function toggleTask(tasks, id) {
    return tasks.map(function(task) {
      if (task.id === id) {
        return Object.assign({}, task, { done: !task.done });
      }
      return task;
    });
  }

  /**
   * Returns a new task array with the targeted task removed.
   * All other tasks remain identical.
   *
   * @param {Task[]} tasks  Existing task array (never mutated)
   * @param {string} id     ID of the task to remove
   * @returns {Task[]}      New array without the targeted task
   */
  function deleteTask(tasks, id) {
    return tasks.filter(function(task) {
      return task.id !== id;
    });
  }

  // ── TaskModule — persistence helpers ─────────────────────────────────────────
  // Requirements: 5.3, 9.1, 9.2, 9.3

  /**
   * Persists the tasks array to localStorage via StorageService.
   * @param {Task[]} tasks  The current task array to save.
   */
  function saveTasks(tasks) {
    StorageService.save('tld_tasks', tasks);
  }

  /**
   * Loads the tasks array from localStorage via StorageService.
   * Returns an empty array if the key is absent or data is unreadable.
   * @returns {Task[]}
   */
  function loadTasks() {
    return StorageService.load('tld_tasks', []);
  }

  // ── TaskModule — rendering & initialisation ──────────────────────────────────
  // Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.4, 8.1, 8.2, 8.3, 9.2

  /**
   * Fully re-renders `#task-list` from the current tasks array.
   * Clears the container and rebuilds every <li> from scratch.
   * Each <li> contains:
   *   - A checkbox reflecting task.done
   *   - A <span> with the description (class "task-done" when done)
   *   - An Edit button
   *   - A Delete button
   * Inline edit mode replaces the <span> with a pre-populated <input>.
   *
   * @param {Task[]} tasks
   * @param {HTMLElement} container  The <ul id="task-list"> element
   */
  function renderTaskList(tasks, container) {
    if (!container) { return; }
    container.innerHTML = '';

    tasks.forEach(function(task) {
      var li = document.createElement('li');
      li.className = 'task-item';
      li.dataset.id = task.id;

      // ── Checkbox ─────────────────────────────────────────────────────────────
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;
      checkbox.setAttribute('aria-label', 'Mark task as ' + (task.done ? 'not done' : 'done'));
      checkbox.addEventListener('change', function() {
        tasks = toggleTask(tasks, task.id);
        saveTasks(tasks);
        renderTaskList(tasks, container);
      });

      // ── Description span ─────────────────────────────────────────────────────
      var span = document.createElement('span');
      span.className = 'task-description' + (task.done ? ' task-done' : '');
      span.textContent = task.description;

      // ── Edit button ──────────────────────────────────────────────────────────
      var btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn-edit-task';
      btnEdit.textContent = 'Edit';
      btnEdit.setAttribute('aria-label', 'Edit task: ' + task.description);
      btnEdit.addEventListener('click', function() {
        enterEditMode(li, task, tasks, container);
      });

      // ── Delete button ─────────────────────────────────────────────────────────
      var btnDelete = document.createElement('button');
      btnDelete.type = 'button';
      btnDelete.className = 'btn-delete-task';
      btnDelete.textContent = 'Delete';
      btnDelete.setAttribute('aria-label', 'Delete task: ' + task.description);
      btnDelete.addEventListener('click', function() {
        tasks = deleteTask(tasks, task.id);
        saveTasks(tasks);
        renderTaskList(tasks, container);
      });

      li.appendChild(checkbox);
      li.appendChild(span);
      li.appendChild(btnEdit);
      li.appendChild(btnDelete);
      container.appendChild(li);
    });
  }

  /**
   * Switches a task list item into inline edit mode.
   * Replaces the description <span> and action buttons with an <input>,
   * Confirm and Cancel buttons, and an optional inline error message area.
   *
   * @param {HTMLLIElement} li          The list item element to transform
   * @param {Task}          task        The task being edited
   * @param {Task[]}        tasks       The current tasks array (closure reference)
   * @param {HTMLElement}   container   The <ul> container for re-rendering
   */
  function enterEditMode(li, task, tasks, container) {
    // Clear existing content and rebuild for edit mode.
    li.innerHTML = '';

    // ── Edit input ────────────────────────────────────────────────────────────
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.maxLength = 200;
    input.value = task.description;
    input.setAttribute('aria-label', 'Edit description for task: ' + task.description);

    // ── Inline error message ──────────────────────────────────────────────────
    var errorEl = document.createElement('span');
    errorEl.className = 'task-edit-error input-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.hidden = true;
    errorEl.textContent = 'Description cannot be empty.';

    // ── Confirm button ────────────────────────────────────────────────────────
    var btnConfirm = document.createElement('button');
    btnConfirm.type = 'button';
    btnConfirm.className = 'btn-confirm-edit';
    btnConfirm.textContent = 'Save';
    btnConfirm.setAttribute('aria-label', 'Save edit');

    // ── Cancel button ─────────────────────────────────────────────────────────
    var btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'btn-cancel-edit';
    btnCancel.textContent = 'Cancel';
    btnCancel.setAttribute('aria-label', 'Cancel edit');

    function confirmEdit() {
      var result = editTask(tasks, task.id, input.value);
      if (result === null) {
        // Whitespace-only — show inline error, keep edit mode active.
        errorEl.hidden = false;
        input.focus();
      } else {
        tasks = result;
        saveTasks(tasks);
        renderTaskList(tasks, container);
      }
    }

    function cancelEdit() {
      renderTaskList(tasks, container);
    }

    btnConfirm.addEventListener('click', confirmEdit);
    btnCancel.addEventListener('click', cancelEdit);

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmEdit();
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
    });

    li.appendChild(input);
    li.appendChild(errorEl);
    li.appendChild(btnConfirm);
    li.appendChild(btnCancel);

    // Focus and place cursor at end of existing text.
    input.focus();
    var len = input.value.length;
    input.setSelectionRange(len, len);
  }

  /**
   * Initialises the Todo List widget.
   * Loads persisted tasks, renders the initial list, and wires up
   * the Add button and Enter-key submission on #task-input.
   */
  function initTodoList() {
    var tasks = loadTasks();
    var container = document.getElementById('task-list');
    var taskInput = document.getElementById('task-input');
    var btnAdd    = document.getElementById('btn-add-task');

    renderTaskList(tasks, container);

    // ── Error element for the add-task input ─────────────────────────────────
    // Inserted immediately after #task-input (created once, reused).
    var addErrorEl = document.getElementById('task-input-error');
    if (!addErrorEl) {
      addErrorEl = document.createElement('span');
      addErrorEl.id = 'task-input-error';
      addErrorEl.className = 'input-error';
      addErrorEl.setAttribute('role', 'alert');
      addErrorEl.hidden = true;
      addErrorEl.textContent = 'Task description cannot be empty.';
      if (taskInput && taskInput.parentNode) {
        taskInput.parentNode.insertBefore(addErrorEl, taskInput.nextSibling);
      }
    }

    function attemptAdd() {
      if (!taskInput) { return; }
      var result = addTask(tasks, taskInput.value);
      if (result === null) {
        // Empty / whitespace-only — show error, keep focus.
        addErrorEl.hidden = false;
        taskInput.focus();
      } else {
        tasks = result;
        saveTasks(tasks);
        renderTaskList(tasks, container);
        taskInput.value = '';
        addErrorEl.hidden = true;
        taskInput.focus();
      }
    }

    if (btnAdd) {
      btnAdd.addEventListener('click', attemptAdd);
    }

    if (taskInput) {
      taskInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          attemptAdd();
        }
      });
    }
  }

  // ── LinkModule — pure link operations ────────────────────────────────────────
  // Requirements: 10.2, 10.5, 10.6, 11.2

  /**
   * Generates a unique ID for a link.
   * Uses crypto.randomUUID() when available; falls back to a timestamp + random string.
   * @returns {string}
   */
  function generateLinkId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now() + Math.random().toString(36);
  }

  /**
   * Returns true only if the url begins with "http://" or "https://".
   * All other values (including empty string, null, undefined, ftp://, etc.) return false.
   *
   * @param {string} url
   * @returns {boolean}
   */
  function isValidUrl(url) {
    if (typeof url !== 'string') { return false; }
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Returns a new links array with the given label/url pair appended.
   * Trims both inputs before validation.
   * Returns null when:
   *   - the trimmed label is whitespace-only (empty), or
   *   - isValidUrl(trimmedUrl) === false
   *
   * @param {Link[]} links  Existing links array (never mutated)
   * @param {string} label  Display label for the link
   * @param {string} url    URL the link should open
   * @returns {Link[]|null} New array with appended link, or null on invalid input
   */
  function addLink(links, label, url) {
    var trimmedLabel = (typeof label === 'string') ? label.trim() : '';
    var trimmedUrl   = (typeof url   === 'string') ? url.trim()   : '';

    if (trimmedLabel.length === 0) { return null; }
    if (!isValidUrl(trimmedUrl))   { return null; }

    var newLink = { id: generateLinkId(), label: trimmedLabel, url: trimmedUrl };
    return links.concat([newLink]);
  }

  /**
   * Returns a new links array with the targeted link removed.
   * All other links remain identical.
   *
   * @param {Link[]} links  Existing links array (never mutated)
   * @param {string} id     ID of the link to remove
   * @returns {Link[]}      New array without the targeted link
   */
  function deleteLink(links, id) {
    return links.filter(function(link) {
      return link.id !== id;
    });
  }

  // ── LinkModule — persistence helpers ─────────────────────────────────────────
  // Requirements: 10.3, 12.1, 12.2, 12.3

  /**
   * Persists the links array to localStorage via StorageService.
   * @param {Link[]} links  The current links array to save.
   */
  function saveLinks(links) {
    StorageService.save('tld_links', links);
  }

  /**
   * Loads the links array from localStorage via StorageService.
   * Returns an empty array if the key is absent or data is unreadable.
   * @returns {Link[]}
   */
  function loadLinks() {
    return StorageService.load('tld_links', []);
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────────
  initGreeting();
  initTimer();
  initTodoList();

  // ── Test export (Node / Vitest only) ──────────────────────────────────────────
  // Exposes pure functions for unit / property tests without polluting the browser
  // global scope. The `typeof module` guard is never true in the browser.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      formatTime, formatDate, getGreeting,
      formatTimerDisplay, timerTick, timerStart, timerStop, timerReset,
      renderTimer,
      addTask, editTask, toggleTask, deleteTask,
      saveTasks, loadTasks,
      renderTaskList, initTodoList,
      isValidUrl, addLink, deleteLink,
      saveLinks, loadLinks
    };
  }

})();

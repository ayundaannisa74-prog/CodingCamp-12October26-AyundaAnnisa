# Requirements Document

## Introduction

The **Todo List Life Dashboard** is a single-page, client-side web application built with HTML, CSS, and Vanilla JavaScript. It serves as a personal productivity hub that combines a time-aware greeting, a Pomodoro-style focus timer, a persistent to-do list, and a quick-access links panel — all stored in the browser's Local Storage with no backend required. The application must work as a standalone webpage or as a browser extension in modern browsers (Chrome, Firefox, Edge, Safari).

---

## Glossary

- **Dashboard**: The single HTML page that hosts all four widgets.
- **Greeting_Widget**: The UI component that displays the current time, date, and a time-based greeting message.
- **Focus_Timer**: The UI component that counts down from 25 minutes (1500 seconds) and exposes start, stop, and reset controls.
- **Todo_List**: The UI component that manages a collection of task items with add, edit, complete, and delete operations.
- **Task**: A single to-do item composed of a text description and a completion status (done / not done).
- **Quick_Links**: The UI component that displays a set of user-defined shortcut buttons that open external URLs.
- **Link**: A single quick-access entry composed of a label and a URL, persisted in Local Storage.
- **Local_Storage**: The browser's `window.localStorage` API used for all client-side data persistence.
- **Session**: The period from when the Dashboard page is loaded until it is closed or refreshed.

---

## Requirements

---

### Requirement 1: Display Current Time and Date

**User Story:** As a user, I want to see the current time and date when I open the dashboard, so that I always have an at-a-glance reference without switching tabs.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display the current time in HH:MM:SS (24-hour) format based on the user's browser local timezone.
2. THE Greeting_Widget SHALL display the current date in English using the format "Day, DD Month YYYY" (e.g., "Saturday, 17 October 2026").
3. WHILE the Dashboard is open, THE Greeting_Widget SHALL update the displayed time and date every 1 second without requiring a page reload, with the initial time and date rendered within 1 second of the Dashboard opening.

---

### Requirement 2: Time-Based Greeting Message

**User Story:** As a user, I want to see a greeting that changes based on the time of day, so that the dashboard feels personalized and contextually aware.

#### Acceptance Criteria

1. WHEN the local time is between 05:00 and 11:59, THE Greeting_Widget SHALL display the message "Good Morning".
2. WHEN the local time is between 12:00 and 17:59, THE Greeting_Widget SHALL display the message "Good Afternoon".
3. WHEN the local time is between 18:00 and 20:59, THE Greeting_Widget SHALL display the message "Good Evening".
4. WHEN the local time is between 21:00 and 04:59, THE Greeting_Widget SHALL display the message "Good Night".
5. WHILE the Dashboard is open, THE Greeting_Widget SHALL re-evaluate and update the greeting message at intervals of no greater than 60 seconds so that boundary transitions are detected within one polling cycle.
6. IF the local time cannot be determined by the browser, THEN THE Greeting_Widget SHALL display a neutral fallback message (e.g., "Hello") instead of a time-based greeting.

---

### Requirement 3: Focus Timer — Countdown

**User Story:** As a user, I want a 25-minute countdown timer, so that I can work in focused Pomodoro sessions.

#### Acceptance Criteria

1. THE Focus_Timer SHALL initialise with a countdown value of 25 minutes and 00 seconds (25:00) upon page load.
2. WHEN the timer is running, THE Focus_Timer SHALL decrement the countdown by 1 second every 1 second.
3. THE Focus_Timer SHALL display the remaining time as two zero-padded fields in MM:SS format, where MM ranges from 00 to 25 and SS ranges from 00 to 59, updating once per second while running.
4. WHEN the countdown reaches 00:00, THE Focus_Timer SHALL stop automatically and SHALL NOT decrement below 00:00.
5. WHEN the countdown reaches 00:00, THE Focus_Timer SHALL display a visible completion indicator (e.g., a message "Session complete!" or a distinct visual state change) to notify the user the session has ended.
6. WHEN the Dashboard page is reloaded, THE Focus_Timer SHALL reinitialise to 25:00 and any in-progress countdown SHALL be discarded.

---

### Requirement 4: Focus Timer — Controls

**User Story:** As a user, I want start, stop, and reset controls for the timer, so that I can manage my focus sessions flexibly.

#### Acceptance Criteria

1. WHEN the user activates the Start control and the timer is not already running, THE Focus_Timer SHALL begin the countdown.
2. WHEN the user activates the Stop control and the timer is running, THE Focus_Timer SHALL pause the countdown at the current remaining time.
3. WHEN the user activates the Reset control, THE Focus_Timer SHALL stop any running countdown.
4. WHEN the user activates the Reset control, THE Focus_Timer SHALL restore the displayed time to the configured focus duration (default 25:00).
5. WHILE the timer is running, THE Focus_Timer SHALL disable the Start control to prevent duplicate intervals.
6. WHILE the timer is stopped or reset, THE Focus_Timer SHALL disable the Stop control.
7. WHEN the countdown reaches 00:00, THE Focus_Timer SHALL stop the countdown and SHALL disable the Stop control.

---

### Requirement 5: Add a Task

**User Story:** As a user, I want to add new tasks to my to-do list, so that I can track things I need to do.

#### Acceptance Criteria

1. THE Todo_List SHALL provide a text input field with a maximum length of 200 characters and a submission control for entering a new task description.
2. WHEN the user submits a non-empty task description, THE Todo_List SHALL trim leading and trailing whitespace from the description, then append a new Task with the trimmed description and a "not done" completion status to the list.
3. WHEN the user submits a new Task, THE Todo_List SHALL persist the updated task collection to Local Storage.
4. WHEN the user submits a new Task, THE Todo_List SHALL clear the input field after the task is added.
5. IF the user attempts to submit an empty or whitespace-only task description, THEN THE Todo_List SHALL NOT add a Task and SHALL retain focus on the input field.
6. IF Local Storage is unavailable or throws an exception when saving a task, THEN THE Todo_List SHALL display a visible error message to the user and SHALL retain the task in the UI for the current session.

---

### Requirement 6: Edit a Task

**User Story:** As a user, I want to edit an existing task's description, so that I can correct mistakes or update the task details.

#### Acceptance Criteria

1. THE Todo_List SHALL provide an edit control for each Task in the list.
2. WHEN the user activates the edit control for a Task, THE Todo_List SHALL replace the task text display with a text input field pre-populated with the current description and with the cursor placed at the end of the text.
3. WHEN the user confirms the edit with a non-empty description, THE Todo_List SHALL trim leading and trailing whitespace, update the Task's description to the trimmed value, restore the task text display, and persist the change to Local Storage.
4. IF the user confirms an edit with an empty or whitespace-only description, THEN THE Todo_List SHALL NOT update the Task description, SHALL display a visible error message, and SHALL retain the edit input field with the original value.
5. WHEN the user cancels the edit by pressing the Escape key or activating a cancel control, THE Todo_List SHALL discard any unsaved changes and restore the original task text display.
6. IF Local Storage is unavailable or throws an exception when saving an edited task, THEN THE Todo_List SHALL display a visible error message and SHALL retain the updated description in the UI for the current session.

---

### Requirement 7: Mark a Task as Done

**User Story:** As a user, I want to mark tasks as done, so that I can track my progress and see what I've completed.

#### Acceptance Criteria

1. THE Todo_List SHALL provide a checkbox control for each Task in the list.
2. WHEN the user checks the checkbox on a Task with status "not done", THE Todo_List SHALL update that Task's status to "done" and SHALL apply a strikethrough style to the task description text.
3. WHEN the user unchecks the checkbox on a Task with status "done", THE Todo_List SHALL update that Task's status to "not done" and SHALL remove the strikethrough style from the task description text.
4. WHEN the completion status of a Task changes, THE Todo_List SHALL persist the updated task collection to Local Storage.

---

### Requirement 8: Delete a Task

**User Story:** As a user, I want to delete tasks from the list, so that I can remove items that are no longer relevant.

#### Acceptance Criteria

1. THE Todo_List SHALL provide a visible delete control for each Task in the list.
2. WHEN the user activates the delete control for a Task, THE Todo_List SHALL immediately remove that Task from the list without a confirmation prompt.
3. WHEN a Task is deleted, THE Todo_List SHALL persist the updated task collection to Local Storage.

---

### Requirement 9: Persist and Restore Tasks Across Sessions

**User Story:** As a user, I want my tasks to be saved automatically, so that I don't lose my to-do list when I close or refresh the browser.

#### Acceptance Criteria

1. WHEN a Task is added, edited, marked complete, or deleted, THE Todo_List SHALL save the complete task collection to Local Storage.
2. WHEN the Dashboard is loaded, THE Todo_List SHALL read the task collection from Local Storage and SHALL render all previously saved Tasks with their original description text and completion status.
3. IF no task data exists in Local Storage at load time, THEN THE Todo_List SHALL render an empty list without displaying an error.

---

### Requirement 10: Add a Quick Link

**User Story:** As a user, I want to add shortcut buttons for my favourite websites, so that I can open them quickly from the dashboard.

#### Acceptance Criteria

1. THE Quick_Links SHALL provide an input form with a label field (maximum 50 characters) and a URL field (maximum 2000 characters) for adding a new Link.
2. WHEN the user submits a new Link with a non-empty label and a URL that begins with "http://" or "https://", THE Quick_Links SHALL add a button labelled with the provided label to the panel.
3. WHEN a new Link is added, THE Quick_Links SHALL persist the updated link collection to Local Storage.
4. WHEN the user activates a Link button, THE Quick_Links SHALL open the associated URL in a new browser tab.
5. IF the user attempts to submit a Link with an empty label, THEN THE Quick_Links SHALL NOT add the Link and SHALL display a visible error message identifying the label field as missing.
6. IF the user attempts to submit a Link with an empty URL or a URL that does not begin with "http://" or "https://", THEN THE Quick_Links SHALL NOT add the Link and SHALL display a visible error message identifying the URL field as invalid.

---

### Requirement 11: Delete a Quick Link

**User Story:** As a user, I want to remove quick links I no longer need, so that the panel stays relevant and uncluttered.

#### Acceptance Criteria

1. THE Quick_Links SHALL provide a visible delete control for each Link button in the panel.
2. WHEN the user activates the delete control for a Link, THE Quick_Links SHALL remove that Link from the panel.
3. WHEN a Link is deleted, THE Quick_Links SHALL persist the updated link collection to Local Storage.

---

### Requirement 12: Persist and Restore Quick Links Across Sessions

**User Story:** As a user, I want my quick links to be saved automatically, so that they are available every time I open the dashboard.

#### Acceptance Criteria

1. WHEN a Link is added or deleted, THE Quick_Links SHALL save the complete link collection to Local Storage.
2. WHEN the Dashboard is loaded, THE Quick_Links SHALL read the link collection from Local Storage and SHALL render all previously saved Links with their original label and URL.
3. IF no link data exists in Local Storage at load time, THEN THE Quick_Links SHALL render an empty panel without displaying an error.

---

### Requirement 13: Single-File Architecture

**User Story:** As a developer, I want the project to follow a strict single-file-per-type structure, so that the codebase stays clean and maintainable.

#### Acceptance Criteria

1. THE Dashboard SHALL be structured with exactly one HTML file as the entry point.
2. THE Dashboard SHALL reference exactly one CSS file located inside a `css/` directory.
3. THE Dashboard SHALL reference exactly one JavaScript file located inside a `js/` directory.
4. THE Dashboard JavaScript file SHALL contain all client-side logic including timer management, task management, quick link management, and Local Storage operations.
5. THE Dashboard CSS file SHALL contain all visual styling rules for the Dashboard.

---

### Requirement 14: Browser Compatibility

**User Story:** As a user, I want the dashboard to work in any modern browser, so that I can use it regardless of my preferred browser.

#### Acceptance Criteria

1. THE Dashboard SHALL render and function correctly in the latest stable release of Chrome, Firefox, Edge, and Safari.
2. THE Dashboard SHALL operate as a standalone web page opened directly from the file system (via `file://` protocol) without requiring a local server.
3. THE Dashboard SHALL use only Web APIs available natively in modern browsers, with no external libraries or frameworks.

---

### Requirement 15: Responsive and Performant UI

**User Story:** As a user, I want the dashboard to load fast and respond immediately to my interactions, so that it never slows me down.

#### Acceptance Criteria

1. THE Dashboard SHALL complete initial render within 2 seconds on a machine with at least 4 GB RAM and a mid-range CPU when opened from the local file system.
2. WHEN the user interacts with any control (add task, toggle timer, click link), THE Dashboard SHALL reflect the change in the UI within 100 milliseconds.
3. THE Dashboard SHALL maintain readable typography with a minimum body font size of 14px and a clear visual hierarchy across all four widgets.
4. THE Dashboard SHALL apply a clean, minimal visual design where text and interactive elements meet WCAG 2.1 AA contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text and UI components).

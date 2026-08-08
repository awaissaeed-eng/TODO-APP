/* ==========================================================
   FEATURE CONFIG
   ========================================================== */
const CONFIG = {
  priority: true,
  dueDates: true,
  search: true,
  progressBar: true,
  clearCompleted: true,
  dragReorder: true,
  categories: true,
  keyboardShortcuts: true,
};

/* categories: id must stay stable once tasks reference it.
   color is used directly (inline style) for dots/badges. */
const CATEGORIES = [
  { id: 'personal', label: 'Personal', color: '#6D5EF0' },
  { id: 'work',     label: 'Work',     color: '#2563EB' },
  { id: 'shopping', label: 'Shopping', color: '#16A34A' },
  { id: 'health',   label: 'Health',   color: '#DB2777' },
  { id: 'other',    label: 'Other',    color: '#D97706' },
];

/* ---------------------------------------------------------
   apply feature flags to <body> classes -> 
--------------------------------------------------------- */
Object.entries(CONFIG).forEach(([key, enabled]) => {
  if (!enabled) document.body.classList.add(`feature-${key}-off`);
});

/* ---------------------------------------------------------
   DOM refs
--------------------------------------------------------- */
const taskList          = document.getElementById('taskList');
const addForm            = document.getElementById('addForm');
const taskInput           = document.getElementById('taskInput');
const prioritySelect       = document.getElementById('prioritySelect');
const categorySelect        = document.getElementById('categorySelect');
const dueDateInput            = document.getElementById('dueDateInput');
const searchInput              = document.getElementById('searchInput');
const clearCompletedBtn         = document.getElementById('clearCompleted');
const emptyState                 = document.getElementById('emptyState');
const counterText                 = document.getElementById('counterText');
const progressFill                 = document.getElementById('progressFill');
const themeToggle                   = document.getElementById('themeToggle');
const themeLabel                     = document.getElementById('themeLabel');
const greetingEl                      = document.getElementById('greeting');
const dateEl                           = document.getElementById('date');
const statsRow                          = document.getElementById('statsRow');
const categoryNav                        = document.getElementById('categoryNav');
const navItems                            = document.querySelectorAll('.nav-item[data-filter]');

let currentFilter = 'all';       // all | active | completed
let currentCategory = 'all';     // all | category id
let searchTerm = '';
let draggedId = null;

/* ---------------------------------------------------------
   data layer — localStorage
--------------------------------------------------------- */
const STORAGE_KEY = 'todo-app-tasks';
const THEME_KEY = 'todo-app-theme';

function getTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Could not read tasks from storage', e);
    return [];
  }
}

function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Could not save tasks — storage may be full or blocked', e);
  }
}

function makeId() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `t${Date.now()}${Math.random().toString(16).slice(2)}`;
}

function categoryOf(id) {
  return CATEGORIES.find(c => c.id === id);
}

/* ---------------------------------------------------------
   header: greeting + date
--------------------------------------------------------- */
function renderHeader() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  greetingEl.textContent = greeting;
  dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/* ---------------------------------------------------------
   theme
--------------------------------------------------------- */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeLabel(theme);
}

function updateThemeLabel(theme) {
  if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  updateThemeLabel(next);
});

/* ---------------------------------------------------------
   category select (add form) + sidebar category nav
--------------------------------------------------------- */
function populateCategorySelect() {
  if (!categorySelect) return;
  categorySelect.innerHTML = `<option value="none">No category</option>` +
    CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
}

function renderCategoryNav() {
  if (!categoryNav) return;
  const tasks = getTasks();

  categoryNav.innerHTML = CATEGORIES.map(c => {
    const count = tasks.filter(t => t.category === c.id).length;
    const active = currentCategory === c.id ? ' active' : '';
    return `
      <button class="category-item${active}" data-category="${c.id}">
        <span class="category-dot" style="background:${c.color}"></span>
        <span class="category-name">${c.label}</span>
        <span class="category-count">${count}</span>
      </button>`;
  }).join('');

  categoryNav.querySelectorAll('.category-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.category;
      currentCategory = (currentCategory === id) ? 'all' : id; // click again to clear
      renderTasks();
    });
  });
}

/* ---------------------------------------------------------
   nav (All / Active / Completed)
--------------------------------------------------------- */
navItems.forEach(btn => {
  btn.addEventListener('click', () => {
    navItems.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    if (currentFilter === 'all') {
      currentCategory = 'all';
    }
    renderTasks();
  });
});

/* ---------------------------------------------------------
   render
--------------------------------------------------------- */
function getFilteredTasks() {
  let tasks = getTasks();

  if (currentFilter === 'active') tasks = tasks.filter(t => !t.done);
  if (currentFilter === 'completed') tasks = tasks.filter(t => t.done);

  if (CONFIG.categories && currentCategory !== 'all') {
    tasks = tasks.filter(t => t.category === currentCategory);
  }

  if (CONFIG.search && searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();
    tasks = tasks.filter(t => t.text.toLowerCase().includes(q));
  }

  return tasks;
}

function formatDueDate(dateStr) {
  if (!dateStr) return '';
  const due = new Date(dateStr + 'T00:00:00');
  if (isNaN(due)) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isOverdue(task) {
  if (!task.dueDate || task.done) return false;
  const due = new Date(task.dueDate + 'T00:00:00');
  if (isNaN(due)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function renderStats(tasks) {
  if (!statsRow) return;
  const total = tasks.length;
  const active = tasks.filter(t => !t.done).length;
  const completed = tasks.filter(t => t.done).length;
  const overdue = tasks.filter(isOverdue).length;

  statsRow.innerHTML = `
    <div class="stat-chip total"><span class="stat-num">${total}</span><span class="stat-label">Total</span></div>
    <div class="stat-chip active"><span class="stat-num">${active}</span><span class="stat-label">Active</span></div>
    <div class="stat-chip completed"><span class="stat-num">${completed}</span><span class="stat-label">Done</span></div>
    <div class="stat-chip overdue"><span class="stat-num">${overdue}</span><span class="stat-label">Overdue</span></div>
  `;
}

function renderTasks() {
  const allTasks = getTasks();
  const visibleTasks = getFilteredTasks();

  taskList.innerHTML = '';

  visibleTasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '');
    li.dataset.id = task.id;
    li.draggable = CONFIG.dragReorder;

    const cat = CONFIG.categories && task.category && task.category !== 'none' ? categoryOf(task.category) : null;

    li.innerHTML = `
      <div class="task-checkbox" role="checkbox" aria-checked="${task.done}" tabindex="0">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="task-body">
        <div class="task-text" contenteditable="false" spellcheck="false">${escapeHtml(task.text)}</div>
        <div class="task-meta">
          ${CONFIG.priority && task.priority && task.priority !== 'none' ? `
            <span class="priority-badge ${task.priority}"><span class="priority-dot"></span>${capitalize(task.priority)}</span>` : ''}
          ${cat ? `
            <span class="category-badge" style="background:${cat.color}22; color:${cat.color}">${cat.label}</span>` : ''}
          ${CONFIG.dueDates && task.dueDate ? `
            <span class="due-chip ${isOverdue(task) ? 'overdue' : ''}">${formatDueDate(task.dueDate)}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="edit-btn" title="Edit" aria-label="Edit task">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-btn" title="Delete" aria-label="Delete task">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
        </button>
      </div>
    `;

    taskList.appendChild(li);
  });

  emptyState.classList.toggle('visible', visibleTasks.length === 0);

  const total = allTasks.length;
  const done = allTasks.filter(t => t.done).length;
  counterText.textContent = `${done} of ${total} completed`;
  progressFill.style.width = total ? `${(done / total) * 100}%` : '0%';

  renderStats(allTasks);
  renderCategoryNav();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ---------------------------------------------------------
   add task
--------------------------------------------------------- */
addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;

  const tasks = getTasks();
  tasks.unshift({
    id: makeId(),
    text,
    done: false,
    priority: CONFIG.priority ? prioritySelect.value : 'none',
    category: CONFIG.categories ? categorySelect.value : 'none',
    dueDate: CONFIG.dueDates ? (dueDateInput.value || null) : null,
    createdAt: Date.now(),
  });

  saveTasks(tasks);
  taskInput.value = '';
  prioritySelect.value = 'none';
  if (categorySelect) categorySelect.value = 'none';
  dueDateInput.value = '';
  taskInput.focus();
  renderTasks();
});

/* ---------------------------------------------------------
   task list interactions (delegated)
--------------------------------------------------------- */
taskList.addEventListener('click', (e) => {
  const li = e.target.closest('.task-item');
  if (!li) return;
  const id = li.dataset.id;

  if (e.target.closest('.task-checkbox')) {
    toggleDone(id);
  } else if (e.target.closest('.delete-btn')) {
    deleteTask(id);
  } else if (e.target.closest('.edit-btn')) {
    startEdit(li);
  }
});

taskList.addEventListener('keydown', (e) => {
  const checkbox = e.target.closest('.task-checkbox');
  if (checkbox && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    const li = e.target.closest('.task-item');
    toggleDone(li.dataset.id);
  }
});

function toggleDone(id) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveTasks(tasks);
  renderTasks();
}

function deleteTask(id) {
  const tasks = getTasks().filter(t => t.id !== id);
  saveTasks(tasks);
  renderTasks();
}

function startEdit(li) {
  const textEl = li.querySelector('.task-text');
  textEl.contentEditable = 'true';
  textEl.focus();
  document.execCommand('selectAll', false, null);

  const finish = (save) => {
    textEl.contentEditable = 'false';
    textEl.removeEventListener('blur', onBlur);
    textEl.removeEventListener('keydown', onKeydown);
    if (save) {
      const newText = textEl.textContent.trim();
      if (newText) {
        const tasks = getTasks();
        const task = tasks.find(t => t.id === li.dataset.id);
        if (task) { task.text = newText; saveTasks(tasks); }
      }
    }
    renderTasks();
  };

  const onBlur = () => finish(true);
  const onKeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  };

  textEl.addEventListener('blur', onBlur);
  textEl.addEventListener('keydown', onKeydown);
}

/* ---------------------------------------------------------
   drag reorder
--------------------------------------------------------- */
if (CONFIG.dragReorder) {
  taskList.addEventListener('dragstart', (e) => {
    const li = e.target.closest('.task-item');
    if (!li) return;
    draggedId = li.dataset.id;
    li.classList.add('dragging');
  });

  taskList.addEventListener('dragend', (e) => {
    const li = e.target.closest('.task-item');
    if (li) li.classList.remove('dragging');
    draggedId = null;
  });

  taskList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const li = e.target.closest('.task-item');
    if (!li || li.dataset.id === draggedId) return;

    const rect = li.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;
    li.parentNode.insertBefore(
      taskList.querySelector(`[data-id="${draggedId}"]`),
      before ? li : li.nextSibling
    );
  });

  taskList.addEventListener('drop', () => {
    const newOrderIds = [...taskList.querySelectorAll('.task-item')].map(el => el.dataset.id);
    const tasks = getTasks();
    const reordered = newOrderIds.map(id => tasks.find(t => t.id === id)).filter(Boolean);
    const remaining = tasks.filter(t => !newOrderIds.includes(t.id));
    saveTasks([...reordered, ...remaining]);
  });
}

/* ---------------------------------------------------------
   search
--------------------------------------------------------- */
if (CONFIG.search) {
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderTasks();
  });
}

/* ---------------------------------------------------------
   clear completed
--------------------------------------------------------- */
if (CONFIG.clearCompleted) {
  clearCompletedBtn.addEventListener('click', () => {
    const tasks = getTasks().filter(t => !t.done);
    saveTasks(tasks);
    renderTasks();
  });
}

/* ---------------------------------------------------------
   keyboard shortcuts
--------------------------------------------------------- */
if (CONFIG.keyboardShortcuts) {
  document.addEventListener('keydown', (e) => {
    const isTyping = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) ||
      document.activeElement.isContentEditable;
    if (e.key === '/' && !isTyping) {
      e.preventDefault();
      (CONFIG.search ? searchInput : taskInput).focus();
    }
    if (e.key === 'n' && !isTyping) {
      e.preventDefault();
      taskInput.focus();
    }
  });
}

/* ---------------------------------------------------------
   init
--------------------------------------------------------- */
populateCategorySelect();
initTheme();
renderHeader();
renderTasks();

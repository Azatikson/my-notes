import { el } from './utils.js';

export const state = {
  notes: [],
  activeId: null,
  query: '',
  tagFilter: null,
  loaded: false,
  saveStatus: 'saved',
  highlightId: null,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) fn(state);
}

const UNTITLED = 'Без названия';

export function createNote(init = {}) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: '',
    content: '',
    createdAt: now,
    updatedAt: now,
    pinned: false,
    ...init,
  };
}

export function renameNote(note, title) {
  return { ...note, title, updatedAt: Date.now() };
}

export function updateContent(note, content) {
  return { ...note, content, updatedAt: Date.now() };
}

export function togglePin(note) {
  return { ...note, pinned: !note.pinned, updatedAt: Date.now() };
}

export function sortByUpdated(notes) {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function sortByPinnedAndUpdated(notes) {
  return [...notes].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export function displayTitle(note) {
  return note.title.trim() || UNTITLED;
}

export function preview(note) {
  const text = note.content
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>~\-\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 80);
}

export function extractTags(note) {
  if (!note.content) return [];
  const plain = note.content.replace(/<[^>]+>/g, ' ');
  const matches = plain.match(/(^|\s)#([\p{L}\p{N}_-]{1,32})/gu) || [];
  const tags = matches.map((m) => m.trim().slice(1).toLowerCase());
  return Array.from(new Set(tags)).sort();
}

export function relativeDate(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн`;
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function findById(notes, id) {
  return notes.find((n) => n.id === id);
}

export function filterByQuery(notes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((n) => {
    const inTitle = n.title.toLowerCase().includes(q);
    const inContent = n.content.toLowerCase().includes(q);
    return inTitle || inContent;
  });
}

export function filterByTag(notes, tag) {
  if (!tag) return notes;
  const needle = `#${tag.toLowerCase()}`;
  return notes.filter((n) => {
    const plain = n.content.replace(/<[^>]+>/g, ' ').toLowerCase();
    return plain.includes(needle);
  });
}

const DB_NAME = 'my-notes';
const DB_VERSION = 1;
const STORE = 'notes';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error ?? new Error('Транзакция прервана'));
  });
}

export function createIndexedDBStorage() {
  let dbPromise = null;
  const db = () => (dbPromise ??= openDatabase());
  return {
    async list() {
      const database = await db();
      const notes = await runTx(database, 'readonly', (s) => s.getAll());
      return notes ?? [];
    },
    async get(id) {
      const database = await db();
      const note = await runTx(database, 'readonly', (s) => s.get(id));
      return note ?? null;
    },
    async save(note) {
      const database = await db();
      await runTx(database, 'readwrite', (s) => s.put(note));
    },
    async remove(id) {
      const database = await db();
      await runTx(database, 'readwrite', (s) => s.delete(id));
    },
    async clear() {
      const database = await db();
      await runTx(database, 'readwrite', (s) => s.clear());
    },
  };
}

export function createMemoryStorage() {
  const map = new Map();
  return {
    async list() { return Array.from(map.values()); },
    async get(id) { return map.get(id) ?? null; },
    async save(note) { map.set(note.id, note); },
    async remove(id) { map.delete(id); },
    async clear() { map.clear(); },
  };
}

function download(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function htmlToMarkdown(html) {
  if (window.TurndownService) {
    const td = new window.TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });
    return td.turndown(html || '');
  }
  return (html || '').replace(/<[^>]+>/g, '');
}

function markdownToHtml(md) {
  if (window.marked) {
    return window.marked.parse(md || '', { breaks: true, gfm: true });
  }
  return (md || '').replace(/\n/g, '<br>');
}

function slugify(text) {
  return (
    text.replace(/[^\wа-яёА-ЯЁ\s-]/gi, '').trim().replace(/\s+/g, '-').slice(0, 50) || 'note'
  );
}

export function exportNoteAsMarkdown(note) {
  const title = displayTitle(note);
  const md = `# ${title}\n\n${htmlToMarkdown(note.content).trim()}\n`;
  download(`${slugify(title)}.md`, md, 'text/markdown;charset=utf-8');
}

export function exportAllAsJson(notes) {
  const data = {
    app: 'my-notes',
    version: 1,
    exportedAt: new Date().toISOString(),
    count: notes.length,
    notes,
  };
  download(`my-notes-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

export function pickJsonFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export function pickMarkdownFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,text/markdown,text/plain';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export function readNotesFromJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const notes = Array.isArray(data) ? data : data.notes;
        if (!Array.isArray(notes)) throw new Error('Неверный формат JSON');
        resolve(notes);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function readNoteFromMarkdown(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const lines = text.split('\n');
        let title = '';
        let bodyStart = 0;
        if (lines[0]?.startsWith('# ')) {
          title = lines[0].slice(2).trim();
          bodyStart = 1;
        } else {
          title = file.name.replace(/\.(md|markdown)$/i, '');
        }
        const body = lines.slice(bodyStart).join('\n').trim();
        const content = markdownToHtml(body);
        resolve(createNote({ title, content }));
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) toastContainer = document.getElementById('toasts');
  return toastContainer;
}

export function showToast({ text, actionLabel, onAction, duration = 5000 }) {
  const root = getToastContainer();
  if (!root) return () => {};
  const toast = el('div', { class: 'toast' }, [
    el('span', { class: 'toast__text' }, [text]),
  ]);
  let timer = null;
  function close() {
    if (!toast.parentElement) return;
    toast.classList.add('toast--leaving');
    setTimeout(() => toast.remove(), 200);
    if (timer) clearTimeout(timer);
  }
  if (actionLabel && onAction) {
    toast.append(el('button', {
      class: 'toast__action',
      onClick: () => { close(); onAction(); },
    }, [actionLabel]));
  }
  root.append(toast);
  timer = setTimeout(close, duration);
  return close;
}

let storage = null;

export function initStorage(s) { storage = s; }

export async function loadAll() {
  const notes = await storage.list();
  const sorted = sortByPinnedAndUpdated(notes);
  setState({
    notes: sorted,
    activeId: sorted[0]?.id ?? null,
    loaded: true,
    saveStatus: 'saved',
  });
}

export async function createNewNote() {
  const note = createNote();
  await storage.save(note);
  setState({
    notes: sortByPinnedAndUpdated([note, ...state.notes]),
    activeId: note.id,
    highlightId: note.id,
    tagFilter: null,
  });
  setTimeout(() => setState({ highlightId: null }), 500);
  setTimeout(() => {
    const title = document.getElementById('note-title');
    title?.focus();
    title?.select();
  }, 0);
  return note;
}

export function selectNote(id) {
  if (state.activeId === id) return;
  setState({ activeId: id });
}

export function setQuery(q) { setState({ query: q }); }
export function setTagFilter(tag) { setState({ tagFilter: tag }); }

export async function renameActive(title) {
  const note = findById(state.notes, state.activeId);
  if (!note || note.title === title) return;
  await persist(renameNote(note, title));
}

export async function updateActiveContent(content) {
  const note = findById(state.notes, state.activeId);
  if (!note || note.content === content) return;
  await persist(updateContent(note, content));
}

export async function togglePinActive() {
  const note = findById(state.notes, state.activeId);
  if (!note) return;
  await persist(togglePin(note));
}

export async function togglePinById(id) {
  const note = findById(state.notes, id);
  if (!note) return;
  await persist(togglePin(note));
}

export async function removeNote(id) {
  const note = findById(state.notes, id);
  if (!note) return;
  await storage.remove(id);
  const notes = state.notes.filter((n) => n.id !== id);
  const activeId = state.activeId === id ? (notes[0]?.id ?? null) : state.activeId;
  setState({ notes, activeId });
  showToast({
    text: `«${displayTitle(note)}» удалена`,
    actionLabel: 'Отменить',
    onAction: async () => {
      await storage.save(note);
      setState({
        notes: sortByPinnedAndUpdated([...state.notes, note]),
        activeId: note.id,
        highlightId: note.id,
      });
      setTimeout(() => setState({ highlightId: null }), 500);
    },
  });
}

export function getActiveNote() {
  return findById(state.notes, state.activeId) ?? null;
}

export function exportCurrentAsMd() {
  const note = getActiveNote();
  if (!note) { showToast({ text: 'Нет активной заметки' }); return; }
  exportNoteAsMarkdown(note);
  showToast({ text: 'Markdown сохранён' });
}

export function exportAllJson() {
  if (state.notes.length === 0) {
    showToast({ text: 'Нет заметок для экспорта' });
    return;
  }
  exportAllAsJson(state.notes);
  showToast({ text: `Экспортировано: ${state.notes.length}` });
}

export async function importFromFile() {
  const file = await pickJsonFile();
  if (!file) return;
  let imported;
  try {
    imported = await readNotesFromJson(file);
  } catch (err) {
    showToast({ text: 'Не удалось прочитать файл' });
    return;
  }
  const existingIds = new Set(state.notes.map((n) => n.id));
  const fresh = imported.filter((n) => n && n.id && !existingIds.has(n.id));
  if (fresh.length === 0) {
    showToast({ text: 'Новых заметок нет' });
    return;
  }
  for (const note of fresh) await storage.save(note);
  const all = await storage.list();
  setState({
    notes: sortByPinnedAndUpdated(all),
    activeId: fresh[0].id,
    highlightId: fresh[0].id,
  });
  setTimeout(() => setState({ highlightId: null }), 500);
  showToast({ text: `Импортировано: ${fresh.length}` });
}

export async function importFromMarkdown() {
  const file = await pickMarkdownFile();
  if (!file) return;
  let note;
  try {
    note = await readNoteFromMarkdown(file);
  } catch (err) {
    showToast({ text: 'Не удалось прочитать файл' });
    return;
  }
  await storage.save(note);
  setState({
    notes: sortByPinnedAndUpdated([note, ...state.notes]),
    activeId: note.id,
    highlightId: note.id,
  });
  setTimeout(() => setState({ highlightId: null }), 500);
  showToast({ text: 'Импортировано из Markdown' });
}

async function persist(next) {
  setState({ saveStatus: 'saving' });
  try {
    await storage.save(next);
    setState({
      notes: sortByPinnedAndUpdated(
        state.notes.map((n) => (n.id === next.id ? next : n))
      ),
      saveStatus: 'saved',
    });
  } catch (err) {
    setState({ saveStatus: 'error' });
    throw err;
  }
}
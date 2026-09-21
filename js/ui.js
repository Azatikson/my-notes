import { qs, el, clear } from './utils.js';
import {
  state,
  subscribe,
  findById,
  displayTitle,
  preview,
  relativeDate,
  sortByUpdated,
  sortByPinnedAndUpdated,
  extractTags,
  filterByQuery,
} from './core.js';

export function renderSidebar(root, indicatorEl, st, handlers) {
  if (!st.loaded) {
    renderSkeletons(root);
    return;
  }

  let filtered = sortByPinnedAndUpdated(st.notes);
  filtered = filterByQuery(filtered, st.query);

  if (st.tagFilter) {
    const needle = `#${st.tagFilter.toLowerCase()}`;
    filtered = filtered.filter((n) => {
      const plain = n.content.replace(/<[^>]+>/g, ' ').toLowerCase();
      return plain.includes(needle);
    });
  }

  const indicator = indicatorEl;
  clear(root);
  root.append(indicator);

  if (filtered.length === 0) {
    const text = st.query || st.tagFilter
      ? 'Ничего не найдено'
      : 'Нажми + чтобы создать заметку';
    root.append(el('div', { class: 'sidebar__empty' }, [text]));
    indicator.classList.remove('is-visible');
    return;
  }

  const pinned = filtered.filter((n) => n.pinned);
  const regular = filtered.filter((n) => !n.pinned);

  if (pinned.length) {
    root.append(el('div', { class: 'sidebar__group-label' }, ['Закреплённые']));
    for (const note of pinned) root.append(makeNoteItem(note, st, handlers));
  }

  if (regular.length) {
    if (pinned.length) {
      root.append(el('div', { class: 'sidebar__group-label' }, ['Заметки']));
    }
    for (const note of regular) root.append(makeNoteItem(note, st, handlers));
  }

  if (window.lucide) window.lucide.createIcons();
  moveIndicator(root, indicator, st.activeId);
}

function makeNoteItem(note, st, handlers) {
  const classes = ['note-item'];
  if (note.id === st.activeId) classes.push('is-active');
  if (note.id === st.highlightId) classes.push('is-new');

  const tags = extractTags(note);

  const children = [
    el('div', { class: 'note-item__title' }, [displayTitle(note)]),
    el('div', { class: 'note-item__preview' }, [preview(note) || 'Пустая заметка']),
    el('div', { class: 'note-item__meta' }, [relativeDate(note.updatedAt)]),
  ];

  if (tags.length) {
    children.push(
      el('div', { class: 'note-item__tags' },
        tags.slice(0, 3).map((t) => el('span', { class: 'note-item__tag' }, [`#${t}`]))
      )
    );
  }

  const pinBtn = el('button', {
    class: 'note-item__pin' + (note.pinned ? ' is-pinned' : ''),
    title: note.pinned ? 'Открепить' : 'Закрепить',
    'aria-label': note.pinned ? 'Открепить' : 'Закрепить',
    onClick: (e) => {
      e.stopPropagation();
      pinBtn.classList.add('is-bouncing');
      setTimeout(() => pinBtn.classList.remove('is-bouncing'), 420);
      handlers.onPin(note.id);
    },
  }, [el('i', { 'data-lucide': 'pin' })]);
  children.push(pinBtn);

  children.push(
    el('button', {
      class: 'note-item__delete',
      title: 'Удалить',
      'aria-label': 'Удалить заметку',
      onClick: (e) => { e.stopPropagation(); handlers.onDelete(note.id); },
    }, [el('i', { 'data-lucide': 'trash-2' })])
  );

  return el('div', {
    class: classes.join(' '),
    dataset: { id: note.id },
    role: 'button',
    tabindex: '0',
    onClick: () => handlers.onSelect(note.id),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlers.onSelect(note.id);
      }
    },
  }, children);
}

function moveIndicator(root, indicatorEl, activeId) {
  if (!activeId) { indicatorEl.classList.remove('is-visible'); return; }
  const active = root.querySelector(`[data-id="${activeId}"]`);
  if (!active) { indicatorEl.classList.remove('is-visible'); return; }

  const rootRect = root.getBoundingClientRect();
  const itemRect = active.getBoundingClientRect();
  const offset = itemRect.top - rootRect.top + root.scrollTop;

  indicatorEl.style.transform = `translateY(${offset}px)`;
  indicatorEl.style.height = `${Math.max(itemRect.height - 12, 0)}px`;
  indicatorEl.classList.add('is-visible');
}

function renderSkeletons(root) {
  clear(root);
  for (let i = 0; i < 4; i++) {
    root.append(
      el('div', { class: 'note-skeleton' }, [
        el('div', { class: 'note-skeleton__line note-skeleton__line--title skeleton' }),
        el('div', { class: 'note-skeleton__line note-skeleton__line--preview skeleton' }),
      ])
    );
  }
}

export function setupTopbar(handlers) {
  const title = qs('#note-title');
  title.addEventListener('input', () => handlers.onRename(title.value));

  const status = qs('#save-status');
  if (!document.getElementById('word-counter')) {
    const counter = document.createElement('span');
    counter.className = 'editor__counter';
    counter.id = 'word-counter';
    status.parentElement.insertBefore(counter, status);
  }

  document.getElementById('btn-pin')?.addEventListener('click', () => handlers.onTogglePin());
}

export function renderTopbar(st) {
  const title = qs('#note-title');
  const status = qs('#save-status');
  const counter = document.getElementById('word-counter');
  const pinBtn = document.getElementById('btn-pin');
  const note = findById(st.notes, st.activeId) ?? null;

  if (document.activeElement !== title) {
    title.value = note ? note.title : '';
  }

  title.disabled = !note;
  status.dataset.state = st.saveStatus || 'saved';

  if (pinBtn) {
    pinBtn.classList.toggle('is-active', !!note?.pinned);
    pinBtn.title = note?.pinned ? 'Открепить (Ctrl+Shift+P)' : 'Закрепить (Ctrl+Shift+P)';
  }

  if (counter) {
    if (note && note.content) {
      const text = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const words = text ? text.split(' ').length : 0;
      counter.textContent = words > 0 ? `${words} сл.` : '';
    } else {
      counter.textContent = '';
    }
  }
}

let quill = null;
let suppress = false;
let saveTimer = null;
let lastId = null;

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
  ['link'],
  ['clean'],
];

export function setupEditor({ onChange }) {
  const container = qs('#quill-editor');
  quill = new Quill(container, {
    theme: 'snow',
    placeholder: 'Начни писать или введи / для команд…',
    modules: { toolbar: TOOLBAR },
    formats: [
      'header',
      'bold', 'italic', 'underline', 'strike',
      'blockquote', 'code-block', 'code',
      'list',
      'link',
      'indent',
    ],
  });

  setupSlash(quill);
  setupChecklistClick(quill);

  quill.on('text-change', () => {
    if (suppress) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => onChange(quill.root.innerHTML), 400);
  });
}

function setupChecklistClick(quillInstance) {
  quillInstance.root.addEventListener('mousedown', (e) => {
    const target = e.target;
    if (!target || !target.closest) return;

    const li = target.closest('li[data-list="checked"], li[data-list="unchecked"]');
    if (!li) return;

    const rect = li.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < 0 || x > 26) return;

    e.preventDefault();
    e.stopPropagation();

    const blot = Quill.find(li);
    if (!blot) return;

    let index;
    try {
      index = quillInstance.getIndex(blot);
    } catch {
      return;
    }

    if (index == null || index < 0) return;

    const current = li.getAttribute('data-list');
    const next = current === 'checked' ? 'unchecked' : 'checked';

    quillInstance.formatLine(index, 1, 'list', next, 'user');
  }, true);
}

export function renderEditor(st, handlers) {
  const note = findById(st.notes, st.activeId) ?? null;
  const body = qs('#editor-body');
  const empty = qs('#empty-state');
  const tagsWrap = qs('#editor-tags');

  if (!note) {
    body.classList.add('hidden');
    empty.classList.remove('hidden');
    tagsWrap.hidden = true;
    lastId = null;
    return;
  }

  body.classList.remove('hidden');
  empty.classList.add('hidden');

  if (note.id !== lastId) {
    suppress = true;
    const html = note.content && note.content.trim() ? note.content : '';
    if (html) {
      quill.clipboard.dangerouslyPasteHTML(html, 'silent');
    } else {
      quill.setText('\n', 'silent');
    }
    suppress = false;
    lastId = note.id;

    body.classList.remove('is-switching');
    void body.offsetWidth;
    body.classList.add('is-switching');
    setTimeout(() => body.classList.remove('is-switching'), 240);
  }

  renderTags(tagsWrap, note, handlers);
}

function renderTags(wrap, note, handlers) {
  const tags = extractTags(note);
  wrap.innerHTML = '';
  if (!tags.length) { wrap.hidden = true; return; }

  wrap.hidden = false;
  for (const tag of tags) {
    const chip = document.createElement('button');
    chip.className = 'editor__tag';
    chip.textContent = `#${tag}`;
    chip.addEventListener('click', () => handlers.onTagClick(tag));
    wrap.append(chip);
  }
}

const SLASH_COMMANDS = [
  { id: 'h1', icon: 'heading-1', label: 'Заголовок 1', keywords: ['h1', 'заголовок', 'header'] },
  { id: 'h2', icon: 'heading-2', label: 'Заголовок 2', keywords: ['h2'] },
  { id: 'h3', icon: 'heading-3', label: 'Заголовок 3', keywords: ['h3'] },
  { id: 'bullet', icon: 'list', label: 'Список', keywords: ['list', 'список', 'ul'] },
  { id: 'ordered', icon: 'list-ordered', label: 'Нумерованный список', keywords: ['ol', 'числа', 'numbered'] },
  { id: 'check', icon: 'check-square', label: 'Чек-лист', keywords: ['todo', 'чек', 'task', 'checkbox'] },
  { id: 'quote', icon: 'quote', label: 'Цитата', keywords: ['quote', 'цитата'] },
  { id: 'code', icon: 'code', label: 'Код', keywords: ['code', 'код'] },
  { id: 'bold', icon: 'bold', label: 'Жирный', keywords: ['bold', 'жирный'] },
  { id: 'italic', icon: 'italic', label: 'Курсив', keywords: ['italic', 'курсив'] },
  { id: 'underline', icon: 'underline', label: 'Подчёркнутый', keywords: ['underline', 'подчёркнутый'] },
  { id: 'strike', icon: 'strikethrough', label: 'Зачёркнутый', keywords: ['strike', 'зачёркнутый'] },
  { id: 'link', icon: 'link', label: 'Ссылка', keywords: ['link', 'ссылка', 'url'] },
];

let slashMenu = null;
let slashFiltered = [];
let slashSelected = 0;
let slashIndex = -1;
let slashRange = null;

function setupSlash(quillInstance) {
  slashMenu = document.createElement('div');
  slashMenu.className = 'slash-menu';
  slashMenu.hidden = true;
  document.body.append(slashMenu);

  slashMenu.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.slash-menu__item');
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    const idx = Number(item.dataset.index);
    const cmd = slashFiltered[idx];
    if (cmd) applySlashCommand(cmd);
  });

  slashMenu.addEventListener('mousemove', (e) => {
    const item = e.target.closest('.slash-menu__item');
    if (!item) return;
    const idx = Number(item.dataset.index);
    if (idx !== slashSelected) {
      slashSelected = idx;
      updateSlashHighlight();
    }
  });

  quillInstance.on('text-change', (delta, oldDelta, source) => {
    if (source !== 'user') return;
    if (!quillInstance.hasFocus()) { closeSlashMenu(); return; }

    const sel = quillInstance.getSelection();
    if (!sel) { closeSlashMenu(); return; }

    const textBefore = quillInstance.getText(0, sel.index);
    const lastNewline = textBefore.lastIndexOf('\n');
    const lineStart = lastNewline + 1;
    const lineText = textBefore.slice(lineStart);

    const slashPos = lineText.lastIndexOf('/');
    if (slashPos === -1) { closeSlashMenu(); return; }

    const query = lineText.slice(slashPos + 1);
    if (query.includes(' ')) { closeSlashMenu(); return; }

    slashIndex = lineStart + slashPos;
    slashRange = { index: sel.index };
    slashFiltered = filterSlashCommands(query);
    if (slashFiltered.length === 0) { closeSlashMenu(); return; }

    slashSelected = slashMenu.hidden ? 0 : Math.min(slashSelected, slashFiltered.length - 1);

    renderSlashMenu();
    positionSlashMenu();
  });

  quillInstance.root.addEventListener('keydown', (e) => {
    if (slashMenu.hidden) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      slashSelected = Math.min(slashSelected + 1, slashFiltered.length - 1);
      updateSlashHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      slashSelected = Math.max(slashSelected - 1, 0);
      updateSlashHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      applySlashCommand(slashFiltered[slashSelected]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSlashMenu();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      slashSelected = (slashSelected + 1) % slashFiltered.length;
      updateSlashHighlight();
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (slashMenu.hidden) return;
    if (!slashMenu.contains(e.target)) closeSlashMenu();
  }, true);
}

function filterSlashCommands(query) {
  if (!query) return SLASH_COMMANDS;
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter((c) => {
    if (c.label.toLowerCase().includes(q)) return true;
    return c.keywords.some((k) => k.includes(q));
  });
}

function renderSlashMenu() {
  slashMenu.innerHTML = '';
  slashFiltered.forEach((cmd, i) => {
    const item = el('div', {
      class: 'slash-menu__item' + (i === slashSelected ? ' is-selected' : ''),
      dataset: { index: String(i) },
    }, [
      el('i', { 'data-lucide': cmd.icon }),
      el('span', {}, [cmd.label]),
    ]);
    slashMenu.append(item);
  });
  if (window.lucide) window.lucide.createIcons();
  slashMenu.hidden = false;
}

function updateSlashHighlight() {
  const items = slashMenu.querySelectorAll('.slash-menu__item');
  items.forEach((item, i) => {
    item.classList.toggle('is-selected', i === slashSelected);
  });
  items[slashSelected]?.scrollIntoView({ block: 'nearest' });
}

function positionSlashMenu() {
  const sel = quill.getSelection();
  if (!sel) return;
  const bounds = quill.getBounds(sel.index);
  if (!bounds) return;
  const editorRect = quill.root.getBoundingClientRect();
  const menuHeight = 340;
  let top = editorRect.top + bounds.bottom + 8;
  if (top + menuHeight > window.innerHeight - 16) {
    top = editorRect.top + bounds.top - menuHeight - 8;
  }
  const left = editorRect.left + bounds.left;
  const maxLeft = window.innerWidth - 260;
  slashMenu.style.left = `${Math.min(left, maxLeft)}px`;
  slashMenu.style.top = `${Math.max(16, top)}px`;
}

function applySlashCommand(cmd) {
  if (!cmd || !slashRange) return;

  const si = slashIndex;
  const ci = slashRange.index;
  const delLen = Math.max(0, ci - si);

  closeSlashMenu();
  quill.focus();

  if (delLen > 0) {
    quill.deleteText(si, delLen, 'user');
  }

  const inlineFormats = ['bold', 'italic', 'underline', 'strike'];
  if (inlineFormats.includes(cmd.id)) {
    quill.setSelection(si, 0, 'silent');
    quill.format(cmd.id, true, 'user');
    return;
  }

  if (cmd.id === 'link') {
    quill.setSelection(si, 0, 'silent');
    const url = prompt('URL:');
    if (url) quill.format('link', url, 'user');
    return;
  }

  quill.insertText(si, ' ', 'user');

  switch (cmd.id) {
    case 'h1': quill.formatLine(si, 1, 'header', 1, 'user'); break;
    case 'h2': quill.formatLine(si, 1, 'header', 2, 'user'); break;
    case 'h3': quill.formatLine(si, 1, 'header', 3, 'user'); break;
    case 'bullet': quill.formatLine(si, 1, 'list', 'bullet', 'user'); break;
    case 'ordered': quill.formatLine(si, 1, 'list', 'ordered', 'user'); break;
    case 'check': quill.formatLine(si, 1, 'list', 'unchecked', 'user'); break;
    case 'quote': quill.formatLine(si, 1, 'blockquote', true, 'user'); break;
    case 'code': quill.formatLine(si, 1, 'code-block', true, 'user'); break;
  }

  quill.setSelection(si + 1, 0, 'silent');
}

function closeSlashMenu() {
  if (slashMenu) slashMenu.hidden = true;
  slashIndex = -1;
  slashFiltered = [];
  slashRange = null;
}

export function renderOutline(st, handlers) {
  const note = findById(st.notes, st.activeId) ?? null;
  const nav = qs('#outline-nav');
  const backlinks = qs('#backlinks-list');
  const meta = qs('#note-meta');

  nav.innerHTML = '';
  backlinks.innerHTML = '';
  meta.innerHTML = '';

  if (!note) {
    nav.append(el('div', { class: 'outline__empty' }, ['Нет активной заметки']));
    backlinks.append(el('div', { class: 'outline__empty' }, ['—']));
    return;
  }

  const tmp = document.createElement('div');
  tmp.innerHTML = note.content || '';
  const headings = Array.from(tmp.querySelectorAll('h1, h2, h3'))
    .map((h) => ({ level: h.tagName.toLowerCase(), text: h.textContent.trim() }))
    .filter((h) => h.text);

  if (headings.length === 0) {
    nav.append(el('div', { class: 'outline__empty' }, ['Нет заголовков']));
  } else {
    headings.forEach((h, i) => {
      nav.append(
        el('button', {
          class: `outline__link outline__link--${h.level}`,
          onClick: () => handlers.onScrollToHeading(i),
        }, [h.text])
      );
    });
  }

  backlinks.append(el('div', { class: 'outline__empty' }, ['Скоро']));

  const words = (note.content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean).length;

  meta.append(
    el('div', { class: 'outline__meta-row' }, [
      el('span', { class: 'outline__meta-label' }, ['Слов']),
      el('span', { class: 'outline__meta-value' }, [String(words)]),
    ]),
    el('div', { class: 'outline__meta-row' }, [
      el('span', { class: 'outline__meta-label' }, ['Создана']),
      el('span', { class: 'outline__meta-value' }, [relativeDate(note.createdAt)]),
    ]),
    el('div', { class: 'outline__meta-row' }, [
      el('span', { class: 'outline__meta-label' }, ['Изменена']),
      el('span', { class: 'outline__meta-value' }, [relativeDate(note.updatedAt)]),
    ])
  );
}

let paletteBackdrop, paletteModal, paletteInput, paletteList;
let paletteHandlers = {};
let paletteItems = [];
let paletteSelected = 0;

export function setupPalette(h) {
  paletteHandlers = h;
  paletteBackdrop = qs('#palette-backdrop');
  paletteModal = qs('#palette');
  paletteInput = qs('#palette-input');
  paletteList = qs('#palette-list');

  paletteInput.addEventListener('input', () => renderPalette(paletteInput.value));
  paletteInput.addEventListener('keydown', onPaletteKeyDown);
  paletteBackdrop.addEventListener('click', closePalette);

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isPaletteOpen() ? closePalette() : openPalette();
    } else if (e.key === 'Escape' && isPaletteOpen()) {
      e.preventDefault();
      closePalette();
    }
  });
}

function isPaletteOpen() { return !paletteModal.hidden; }

export function openPalette() {
  paletteBackdrop.hidden = false;
  paletteModal.hidden = false;
  paletteInput.value = '';
  renderPalette('');
  setTimeout(() => paletteInput.focus(), 0);
}

export function closePalette() {
  if (!isPaletteOpen()) return;
  paletteModal.classList.add('is-closing');
  paletteBackdrop.classList.add('is-closing');
  setTimeout(() => {
    paletteModal.classList.remove('is-closing');
    paletteBackdrop.classList.remove('is-closing');
    paletteModal.hidden = true;
    paletteBackdrop.hidden = true;
  }, 140);
}

function paletteCommands() {
  return [
    { icon: 'plus', label: 'Новая заметка', hint: 'Ctrl+Alt+N', run: () => paletteHandlers.onCreate() },
    { icon: 'file-down', label: 'Экспорт текущей в Markdown', hint: 'Ctrl+E', run: () => paletteHandlers.onExportCurrentMd() },
    { icon: 'download', label: 'Экспорт всех в JSON', run: () => paletteHandlers.onExportAllJson() },
    { icon: 'upload', label: 'Импорт из JSON', run: () => paletteHandlers.onImport() },
    { icon: 'file-input', label: 'Импорт из Markdown', run: () => paletteHandlers.onImportMd() },
    { icon: 'panel-left', label: 'Свернуть / показать список', hint: 'Ctrl+\\', run: () => paletteHandlers.onToggleSidebar() },
    { icon: 'panel-right', label: 'Свернуть / показать контекст', hint: 'Ctrl+Shift+O', run: () => paletteHandlers.onToggleOutline() },
  ];
}

function renderPalette(query) {
  paletteList.innerHTML = '';
  paletteItems = [];
  paletteSelected = 0;

  const q = query.trim().toLowerCase();
  const commands = paletteCommands().filter((c) => !q || c.label.toLowerCase().includes(q));
  const notes = sortByUpdated(filterByQuery(state.notes, query)).slice(0, 20);

  if (commands.length === 0 && notes.length === 0) {
    paletteList.append(el('div', { class: 'palette__empty' }, ['Ничего не найдено']));
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (commands.length) {
    paletteList.append(el('div', { class: 'palette__group-label' }, ['Команды']));
    for (const cmd of commands) {
      paletteList.append(makePaletteItem({ icon: cmd.icon, label: cmd.label, hint: cmd.hint, run: cmd.run }));
    }
  }

  if (notes.length) {
    paletteList.append(el('div', { class: 'palette__group-label' }, ['Заметки']));
    for (const note of notes) {
      paletteList.append(makePaletteItem({
        icon: 'file-text',
        label: displayTitle(note),
        run: () => paletteHandlers.onSelect(note.id),
      }));
    }
  }

  if (window.lucide) window.lucide.createIcons();
  updatePaletteSelection();
}

function makePaletteItem({ icon, label, hint, run }) {
  const item = el('div', { class: 'palette__item', role: 'option' }, [
    el('span', { class: 'palette__item-icon' }, [el('i', { 'data-lucide': icon })]),
    el('span', { class: 'palette__item-label' }, [label]),
  ]);
  if (hint) item.append(el('kbd', { class: 'palette__item-hint' }, [hint]));
  item.addEventListener('click', () => { closePalette(); setTimeout(run, 60); });
  paletteItems.push({ element: item, run });
  return item;
}

function updatePaletteSelection() {
  paletteItems.forEach((it, i) => {
    it.element.classList.toggle('is-selected', i === paletteSelected);
  });
  paletteItems[paletteSelected]?.element.scrollIntoView({ block: 'nearest' });
}

function onPaletteKeyDown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    paletteSelected = Math.min(paletteSelected + 1, paletteItems.length - 1);
    updatePaletteSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    paletteSelected = Math.max(paletteSelected - 1, 0);
    updatePaletteSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const item = paletteItems[paletteSelected];
    if (!item) return;
    closePalette();
    setTimeout(item.run, 60);
  }
}

let quickBackdrop, quickModal, quickInput, quickList;
let quickHandlers = {};
let quickItems = [];
let quickSelected = 0;

export function setupQuick(h) {
  quickHandlers = h;
  quickBackdrop = qs('#quick-backdrop');
  quickModal = qs('#quick');
  quickInput = qs('#quick-input');
  quickList = qs('#quick-list');

  quickInput.addEventListener('input', () => renderQuick(quickInput.value));
  quickInput.addEventListener('keydown', onQuickKeyDown);
  quickBackdrop.addEventListener('click', closeQuick);

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      isQuickOpen() ? closeQuick() : openQuick();
    } else if (e.key === 'Escape' && isQuickOpen()) {
      e.preventDefault();
      closeQuick();
    }
  });
}

function isQuickOpen() { return !quickModal.hidden; }

export function openQuick() {
  quickBackdrop.hidden = false;
  quickModal.hidden = false;
  quickInput.value = '';
  renderQuick('');
  setTimeout(() => quickInput.focus(), 0);
}

export function closeQuick() {
  if (!isQuickOpen()) return;
  quickModal.classList.add('is-closing');
  quickBackdrop.classList.add('is-closing');
  setTimeout(() => {
    quickModal.classList.remove('is-closing');
    quickBackdrop.classList.remove('is-closing');
    quickModal.hidden = true;
    quickBackdrop.hidden = true;
  }, 140);
}

function renderQuick(query) {
  quickList.innerHTML = '';
  quickItems = [];
  quickSelected = 0;

  const q = query.trim().toLowerCase();
  let notes = sortByUpdated(state.notes);
  if (q) {
    notes = notes.filter((n) =>
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }
  notes = notes.slice(0, 50);

  if (notes.length === 0) {
    quickList.append(el('div', { class: 'palette__empty' }, ['Ничего не найдено']));
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  for (const note of notes) {
    const item = el('div', { class: 'palette__item', role: 'option' }, [
      el('span', { class: 'palette__item-icon' }, [
        el('i', { 'data-lucide': note.pinned ? 'pin' : 'file-text' }),
      ]),
      el('span', { class: 'palette__item-label' }, [
        el('span', {}, [displayTitle(note)]),
        el('span', { class: 'palette__item-note-preview' }, [preview(note) || 'Пустая заметка']),
      ]),
    ]);
    item.addEventListener('click', () => {
      closeQuick();
      setTimeout(() => quickHandlers.onSelect(note.id), 60);
    });
    quickItems.push({ element: item, id: note.id });
    quickList.append(item);
  }

  if (window.lucide) window.lucide.createIcons();
  updateQuickSelection();
}

function updateQuickSelection() {
  quickItems.forEach((it, i) => {
    it.element.classList.toggle('is-selected', i === quickSelected);
  });
  quickItems[quickSelected]?.element.scrollIntoView({ block: 'nearest' });
}

function onQuickKeyDown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    quickSelected = Math.min(quickSelected + 1, quickItems.length - 1);
    updateQuickSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    quickSelected = Math.max(quickSelected - 1, 0);
    updateQuickSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const item = quickItems[quickSelected];
    if (!item) return;
    closeQuick();
    setTimeout(() => quickHandlers.onSelect(item.id), 60);
  }
}

let helpBackdrop, helpModal;

export function setupHelp() {
  helpBackdrop = document.getElementById('help-backdrop');
  helpModal = document.getElementById('help');

  document.getElementById('btn-help')?.addEventListener('click', openHelp);
  document.getElementById('btn-close-help')?.addEventListener('click', closeHelp);
  helpBackdrop?.addEventListener('click', closeHelp);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal && !helpModal.hidden) {
      e.preventDefault();
      closeHelp();
    }
    if (e.key === '?' && !isInInput()) {
      e.preventDefault();
      helpModal && helpModal.hidden ? openHelp() : closeHelp();
    }
  });
}

function isInInput() {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.closest('.ql-editor');
}

function openHelp() {
  helpBackdrop.hidden = false;
  helpModal.hidden = false;
}

function closeHelp() {
  if (!helpModal || helpModal.hidden) return;
  helpModal.classList.add('is-closing');
  setTimeout(() => {
    helpModal.classList.remove('is-closing');
    helpModal.hidden = true;
    helpBackdrop.hidden = true;
  }, 140);
}

export function mount(handlers) {
  const list = qs('#notes-list');
  const indicator = qs('.sidebar__indicator');

  setupTopbar(handlers);
  setupEditor({ onChange: (content) => handlers.onContent(content) });

  function rerender() {
    renderSidebar(list, indicator, state, handlers);
    renderTopbar(state);
    renderEditor(state, handlers);
    renderOutline(state, handlers);
  }

  subscribe(rerender);
  rerender();
}
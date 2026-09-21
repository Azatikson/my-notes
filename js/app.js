import {
  createIndexedDBStorage,
  createMemoryStorage,
  initStorage,
  loadAll,
  createNewNote,
  selectNote,
  removeNote,
  renameActive,
  updateActiveContent,
  togglePinActive,
  togglePinById,
  exportCurrentAsMd,
  exportAllJson,
  importFromFile,
  importFromMarkdown,
  setTagFilter,
  state,
} from './core.js';

import {
  mount,
  setupPalette,
  setupQuick,
  setupHelp,
  openPalette,
  openQuick,
} from './ui.js';

function pickStorage() {
  try {
    if (typeof indexedDB !== 'undefined') return createIndexedDBStorage();
  } catch (e) {
    console.warn('IndexedDB недоступен, использую память', e);
  }
  return createMemoryStorage();
}

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function setupPanels() {
  const app = document.getElementById('app');
  if (!app) return null;

  const savedSidebar = localStorage.getItem('ui.sidebar');
  if (savedSidebar) app.dataset.sidebar = savedSidebar;
  const savedOutline = localStorage.getItem('ui.outline');
  if (savedOutline) app.dataset.outline = savedOutline;

  const toggleSidebar = () => {
    const next = app.dataset.sidebar === 'hidden' ? 'visible' : 'hidden';
    app.dataset.sidebar = next;
    localStorage.setItem('ui.sidebar', next);
  };

  const toggleOutline = () => {
    const next = app.dataset.outline === 'hidden' ? 'visible' : 'hidden';
    app.dataset.outline = next;
    localStorage.setItem('ui.outline', next);
  };

  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', toggleSidebar);
  document.getElementById('btn-toggle-outline')?.addEventListener('click', toggleOutline);

  return { toggleSidebar, toggleOutline };
}

async function main() {
  refreshIcons();

  const storage = pickStorage();
  initStorage(storage);

  const panels = setupPanels();

  const handlers = {
    onSelect: (id) => selectNote(id),
    onCreate: () => createNewNote(),
    onRename: (title) => renameActive(title),
    onDelete: (id) => removeNote(id),
    onPin: (id) => togglePinById(id),
    onTogglePin: () => togglePinActive(),
    onContent: (content) => updateActiveContent(content),
    onExportCurrentMd: () => exportCurrentAsMd(),
    onExportAllJson: () => exportAllJson(),
    onImport: () => importFromFile(),
    onImportMd: () => importFromMarkdown(),
    onToggleSidebar: () => panels?.toggleSidebar(),
    onToggleOutline: () => panels?.toggleOutline(),
    onTagClick: (tag) => setTagFilter(tag),
    onScrollToHeading: (i) => scrollToHeading(i),
  };

  mount(handlers);
  setupPalette(handlers);
  setupQuick(handlers);
  setupHelp();

  document.getElementById('btn-new-note')?.addEventListener('click', () => createNewNote());
  document.getElementById('btn-export')?.addEventListener('click', () => exportAllJson());
  document.getElementById('btn-import')?.addEventListener('click', () => importFromFile());
  document.getElementById('btn-import-md')?.addEventListener('click', () => importFromMarkdown());
  document.getElementById('btn-search')?.addEventListener('click', openPalette);
  document.getElementById('btn-quick-switch')?.addEventListener('click', openQuick);

  document.getElementById('btn-clear-filter')?.addEventListener('click', () => {
    setTagFilter(null);
  });

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    const inInput = document.activeElement?.tagName === 'INPUT';
    const inEditor = document.activeElement?.closest('.ql-editor') != null;

    if (mod && e.altKey && key === 'n') {
      e.preventDefault();
      createNewNote();
      return;
    }

    if (mod && e.shiftKey && key === 'p') {
      e.preventDefault();
      togglePinActive();
      return;
    }

    if (mod && !e.shiftKey && key === '\\') {
      e.preventDefault();
      panels?.toggleSidebar();
      return;
    }

    if (mod && e.shiftKey && key === 'o') {
      e.preventDefault();
      panels?.toggleOutline();
      return;
    }

    if (mod && !e.shiftKey && !e.altKey && key === 'e' && !inEditor) {
      e.preventDefault();
      exportCurrentAsMd();
      return;
    }

    if ((e.key === 'Delete' || (mod && e.key === 'Backspace')) && !inInput && !inEditor) {
      if (state.activeId) {
        e.preventDefault();
        removeNote(state.activeId);
      }
      return;
    }
  });

  const filterBar = document.getElementById('sidebar-filter');
  const filterLabel = document.getElementById('sidebar-filter-label');
  setInterval(() => {
    if (!filterBar || !filterLabel) return;
    if (state.tagFilter) {
      filterBar.hidden = false;
      filterLabel.textContent = `Фильтр: #${state.tagFilter}`;
    } else {
      filterBar.hidden = true;
    }
  }, 200);

  await loadAll();
  refreshIcons();
}

function scrollToHeading(index) {
  const root = document.querySelector('#quill-editor .ql-editor');
  if (!root) return;
  const headings = root.querySelectorAll('h1, h2, h3');
  const target = headings[index];
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

main();
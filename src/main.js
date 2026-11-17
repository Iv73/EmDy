import {
  Editor, rootCtx, defaultValueCtx, editorViewCtx, nodeViewCtx, remarkStringifyOptionsCtx,
} from '@milkdown/kit/core';
import {
  commonmark, toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand,
  wrapInHeadingCommand, turnIntoTextCommand, wrapInBulletListCommand, wrapInOrderedListCommand,
  wrapInBlockquoteCommand, createCodeBlockCommand, insertHrCommand, insertImageCommand,
} from '@milkdown/kit/preset/commonmark';
import {
  gfm, toggleStrikethroughCommand, insertTableCommand, addRowAfterCommand, addColAfterCommand,
  deleteSelectedCellsCommand,
} from '@milkdown/kit/preset/gfm';
import { history, undoCommand, redoCommand } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { trailing } from '@milkdown/kit/plugin/trailing';
import { TextSelection } from '@milkdown/kit/prose/state';
import { callCommand, getMarkdown, replaceAll } from '@milkdown/kit/utils';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { t, getLang, setLang } from './i18n.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const win = getCurrentWindow();
const toolbar = $('#toolbar');
const panes = $('#panes');
const tablist = $('#tablist');

const basename = (p) => p.split(/[\\/]/).pop();
const dirname = (p) => p.replace(/[\\/][^\\/]*$/, '');
const samePath = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const mdFilters = () => [
  { name: t('mdFiles'), extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
  { name: t('allFiles'), extensions: ['*'] },
];
const okButton = () => [{ id: 'ok', label: t('btnOk'), primary: true }];

// =====================================================================
// Documents (un par onglet)
// =====================================================================
/**
 * @typedef {object} Doc
 * path, eol, baseline (markdown au dernier enregistrement), dirty,
 * sourceMode, srcOrig (texte à l'entrée du mode source), srcClean (texte propre en mode source, null = modifié),
 * editor (Milkdown), pane, el (zone visuelle), ta (zone Markdown), tab
 */
const docs = [];
let active = null;

const view = (d = active) => d.editor.ctx.get(editorViewCtx);
const getMd = (d = active) => d.editor.action(getMarkdown());
const docName = (d) => (d.path ? basename(d.path) : t('untitled'));

function isDirty(d = active) {
  if (!d?.editor) return false;
  if (d.sourceMode) return d.srcClean === null || d.ta.value !== d.srcClean;
  return getMd(d) !== d.baseline;
}

function setDirty(d, v) {
  if (v && d.preview) pin(d);
  if (v === d.dirty) return;
  d.dirty = v;
  renderTab(d);
  if (d === active) updateTitle();
}

function isPristine(d) {
  return d && !d.path && !isDirty(d) && (d.sourceMode ? d.ta.value : getMd(d)).trim() === '';
}

// Onglet éphémère (aperçu) -> onglet permanent
function pin(d) {
  if (!d.preview) return;
  d.preview = false;
  renderTab(d);
}

function makeDoc({ preview = false } = {}) {
  const pane = document.createElement('div');
  pane.className = 'pane';
  pane.hidden = true;
  const el = document.createElement('div');
  el.className = 'editor';
  el.spellcheck = true;
  const ta = document.createElement('textarea');
  ta.className = 'src-text';
  ta.spellcheck = false;
  ta.hidden = true;
  pane.append(el, ta);
  panes.append(pane);

  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.setAttribute('role', 'tab');
  tab.innerHTML = '<span class="dot">●</span><span class="name"></span><button class="close" tabindex="-1">×</button>';
  // Nouvel onglet juste après l'onglet actif (comme VS Code)
  if (active && docs.includes(active)) active.tab.after(tab); else tablist.append(tab);

  const d = {
    path: null, eol: '\n', baseline: '', dirty: false, preview,
    sourceMode: false, srcOrig: '', srcClean: null,
    editor: null, pane, el, ta, tab,
  };

  tab.addEventListener('mousedown', (e) => {
    if (e.button === 1) { e.preventDefault(); closeDoc(d); }
    else if (e.button === 0 && !e.target.closest('.close')) activate(d);
  });
  tab.addEventListener('dblclick', (e) => { if (!e.target.closest('.close')) pin(d); });
  tab.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); closeDoc(d); });

  ta.addEventListener('input', () => { setDirty(d, isDirty(d)); scheduleStatus(); });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      document.execCommand('insertText', false, '    ');
    }
  });
  attachEditorEvents(d);
  const ai = docs.indexOf(active);
  if (ai >= 0) docs.splice(ai + 1, 0, d); else docs.push(d);
  return d;
}

function renderTab(d) {
  d.tab.querySelector('.name').textContent = docName(d);
  d.tab.title = (d.path || t('untitled')) + (d.preview ? `\n${t('previewTab')}` : '');
  d.tab.classList.toggle('dirty', d.dirty);
  d.tab.classList.toggle('preview', d.preview);
  d.tab.classList.toggle('active', d === active);
}

function updateTitle() {
  if (!active) return;
  const title = `${active.dirty ? '● ' : ''}${docName(active)} — EmDy`;
  document.title = title;
  win.setTitle(title).catch(() => {});
}

// ---------- Images : chemins relatifs au fichier ----------
function resolveSrc(d, src) {
  if (!src || /^(https?|data|blob|asset):/i.test(src)) return src;
  let p = src;
  try { p = decodeURIComponent(p); } catch {}
  if (/^file:/i.test(p)) p = p.replace(/^file:\/*/i, '');
  const absolute = /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\');
  if (!absolute) {
    if (!d.path) return src;
    p = dirname(d.path) + '\\' + p.replace(/^\.[\\/]/, '');
  }
  return convertFileSrc(p.replace(/\//g, '\\'));
}

const imageView = (d) => (node) => {
  const img = document.createElement('img');
  const apply = (n) => {
    img.src = resolveSrc(d, n.attrs.src);
    img.alt = n.attrs.alt || '';
    img.title = n.attrs.title || '';
  };
  apply(node);
  return { dom: img, update: (n) => { if (n.type !== node.type) return false; apply(n); return true; } };
};

async function loadInto(d, text, path) {
  d.eol = /\r\n/.test(text) ? '\r\n' : '\n';
  text = text.replace(/\r\n?/g, '\n');
  d.path = path;
  if (d.editor) { const old = d.editor; d.editor = null; await old.destroy(); }
  d.el.innerHTML = '';
  const ed = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, d.el);
      ctx.set(defaultValueCtx, text);
      ctx.update(remarkStringifyOptionsCtx, (o) => ({
        ...o, bullet: '-', emphasis: '*', strong: '*', rule: '-', fences: true, listItemIndent: 'one',
      }));
      ctx.update(nodeViewCtx, (v) => [...v, ['image', imageView(d)]]);
      const l = ctx.get(listenerCtx);
      l.markdownUpdated((_, m) => {
        if (d.sourceMode || !d.editor) return;
        setDirty(d, m !== d.baseline);
        if (d === active) scheduleStatus();
      });
      l.selectionUpdated(() => { if (d === active && d.editor) updateTableTools(); });
    })
    .use(commonmark).use(gfm).use(history).use(listener).use(clipboard).use(trailing)
    .create();
  d.editor = ed;
  d.baseline = getMd(d);
  if (d.sourceMode) { d.ta.value = text; d.srcOrig = text; d.srcClean = text; }
  d.dirty = false;
  renderTab(d);
}

function activate(d) {
  if (!d) return;
  closeFind(false);
  active = d;
  for (const x of docs) { x.pane.hidden = x !== d; renderTab(x); }
  toolbar.classList.toggle('source', d.sourceMode);
  $('#sourceBtn').classList.toggle('on', d.sourceMode);
  d.tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  markActiveInTree();
  updateTitle();
  updateStatus();
  updateTableTools();
  focusActive();
}

function focusActive() {
  if (!active?.editor) return;
  if (active.sourceMode) active.ta.focus(); else view().focus();
}

async function newDoc() {
  const d = makeDoc();
  await loadInto(d, '', null);
  activate(d);
  return d;
}

// Ferme un onglet. Retourne false si l'utilisateur annule.
async function closeDoc(d, { keepOne = true } = {}) {
  if (isDirty(d)) {
    activate(d);
    const r = await askSave(d);
    if (r === 'cancel') return false;
    if (r === 'save' && !(await save(d))) return false;
  }
  const i = docs.indexOf(d);
  docs.splice(i, 1);
  await d.editor?.destroy();
  d.pane.remove();
  d.tab.remove();
  if (!docs.length) {
    if (keepOne) await newDoc();
  } else if (d === active) {
    activate(docs[Math.min(i, docs.length - 1)]);
  }
  return true;
}

// =====================================================================
// Fichiers
// =====================================================================
async function openPaths(paths, { preview = false } = {}) {
  let last = null;
  for (const p of paths) {
    const existing = docs.find((x) => samePath(x.path, p));
    if (existing) { if (!preview) pin(existing); last = existing; continue; }
    let text;
    try {
      text = await invoke('read_file', { path: p });
    } catch (e) {
      await modal({ msg: `${t('errOpen')}\n${p}\n\n${e}`, buttons: okButton() });
      continue;
    }
    let d;
    if (!last && isPristine(active)) d = active;
    else if (preview) d = docs.find((x) => x.preview && !isDirty(x)) || makeDoc({ preview: true });
    else d = makeDoc();
    d.preview = preview;
    await loadInto(d, text, p);
    last = d;
  }
  if (last) {
    activate(last);
    if (last.pane) last.pane.scrollTop = 0;
  }
}

function askSave(d) {
  return modal({
    msg: t('unsaved', docName(d)),
    buttons: [
      { id: 'save', label: t('btnSave'), primary: true },
      { id: 'discard', label: t('btnDiscard') },
      { id: 'cancel', label: t('btnCancel') },
    ],
  }).then((r) => r.btn);
}

async function openDoc() {
  const r = await openDialog({ multiple: true, directory: false, filters: mdFilters() });
  if (!r) return;
  await openPaths(Array.isArray(r) ? r : [r]);
}

async function save(d = active, as = false) {
  let p = d.path;
  if (!p || as) {
    p = await saveDialog({ defaultPath: d.path || `${t('untitled')}.md`, filters: mdFilters() });
    if (!p) return false;
    if (!/\.[^\\/.]+$/.test(p)) p += '.md';
  }
  const md = d.sourceMode ? d.ta.value : getMd(d);
  try {
    await invoke('write_file', { path: p, content: d.eol === '\r\n' ? md.replace(/\n/g, '\r\n') : md });
  } catch (e) {
    await modal({ msg: `${t('errSave')}\n${p}\n\n${e}`, buttons: okButton() });
    return false;
  }
  const isNewPath = !samePath(d.path, p);
  d.path = p;
  pin(d);
  if (isNewPath && folder && p.toLowerCase().startsWith(folder.toLowerCase())) renderTree();
  if (d.sourceMode) d.srcClean = md; else d.baseline = md;
  d.dirty = true;
  setDirty(d, false);
  renderTab(d);
  if (d === active) updateTitle();
  return true;
}

// =====================================================================
// Mode source (Markdown brut)
// =====================================================================
function toggleSource() {
  const d = active;
  closeFind(false);
  if (!d.sourceMode) {
    const wasDirty = isDirty(d);
    d.srcOrig = getMd(d);
    d.ta.value = d.srcOrig;
    d.srcClean = wasDirty ? null : d.srcOrig;
    d.sourceMode = true;
    d.el.hidden = true;
    d.ta.hidden = false;
    d.ta.setSelectionRange(0, 0);
  } else {
    const stillDirty = isDirty(d);
    if (d.ta.value !== d.srcOrig) d.editor.action(replaceAll(d.ta.value));
    if (!stillDirty) d.baseline = getMd(d);
    d.sourceMode = false;
    d.ta.hidden = true;
    d.el.hidden = false;
    setDirty(d, stillDirty);
  }
  toolbar.classList.toggle('source', d.sourceMode);
  $('#sourceBtn').classList.toggle('on', d.sourceMode);
  updateTableTools();
  updateStatus();
  focusActive();
}

// =====================================================================
// Commandes d'édition
// =====================================================================
function run(cmd, payload) {
  if (active.sourceMode) return;
  active.editor.action(callCommand(cmd.key, payload));
  view().focus();
}

function findListItem(state) {
  const $f = state.selection.$from;
  for (let dp = $f.depth; dp > 0; dp--) {
    if ($f.node(dp).type.name === 'list_item') return { node: $f.node(dp), pos: $f.before(dp) };
  }
  return null;
}

function toggleTask() {
  if (active.sourceMode) return;
  const v = view();
  if (!findListItem(v.state)) active.editor.action(callCommand(wrapInBulletListCommand.key));
  const li = findListItem(v.state);
  if (!li) return;
  const checked = li.node.attrs.checked == null ? false : null;
  v.dispatch(v.state.tr.setNodeMarkup(li.pos, undefined, { ...li.node.attrs, checked }));
  v.focus();
}

function attachEditorEvents(d) {
  // Clic sur la case d'une tâche
  d.el.addEventListener('mousedown', (e) => {
    const li = e.target.closest?.('li[data-item-type="task"]');
    if (!li || e.clientX >= li.getBoundingClientRect().left) return;
    e.preventDefault();
    const v = view(d);
    const $p = v.state.doc.resolve(v.posAtDOM(li, 0));
    for (let dp = $p.depth; dp > 0; dp--) {
      const n = $p.node(dp);
      if (n.type.name === 'list_item') {
        v.dispatch(v.state.tr.setNodeMarkup($p.before(dp), undefined, { ...n.attrs, checked: !n.attrs.checked }));
        return;
      }
    }
  });
  d.el.addEventListener('mouseover', (e) => {
    const a = e.target.closest?.('a');
    if (a) a.title = `${a.getAttribute('href') || ''}\n${t('ctrlClick')}`;
  });
}

// Liens : Ctrl+clic pour ouvrir dans le navigateur
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a');
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute('href');
  if (e.ctrlKey && href && /^(https?|mailto):/i.test(href)) openUrl(href).catch(() => {});
});

async function insertLink() {
  if (active.sourceMode) return;
  const v = view();
  const { from, to, empty } = v.state.selection;
  const type = v.state.schema.marks.link;
  const existing = !empty && v.state.doc.rangeHasMark(from, to, type);
  const r = await modal({
    msg: t('linkPrompt'), input: existing ? '' : 'https://',
    buttons: [{ id: 'ok', label: t('btnOk'), primary: true }, { id: 'cancel', label: t('btnCancel') }],
  });
  v.focus();
  if (r.btn !== 'ok') return;
  const url = r.value.trim();
  let tr = v.state.tr;
  if (!url || url === 'https://') {
    if (empty) return;
    tr = tr.removeMark(from, to, type);
  } else if (empty) {
    tr = tr.insert(from, v.state.schema.text(url, [type.create({ href: url })]));
  } else {
    tr = tr.removeMark(from, to, type).addMark(from, to, type.create({ href: url }));
  }
  v.dispatch(tr);
}

async function insertImage() {
  if (active.sourceMode) return;
  const d = active;
  const r = await modal({
    msg: t('imagePrompt'), input: '',
    buttons: [{ id: 'ok', label: t('btnOk'), primary: true }, { id: 'cancel', label: t('btnCancel') }],
    browse: async () => {
      const p = await openDialog({
        multiple: false,
        filters: [{ name: t('images'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] }],
      });
      if (!p) return null;
      if (d.path) {
        const dir = dirname(d.path).toLowerCase() + '\\';
        if (p.toLowerCase().startsWith(dir)) return p.slice(dir.length).replace(/\\/g, '/').replace(/ /g, '%20');
      }
      return p.replace(/\\/g, '/').replace(/ /g, '%20');
    },
  });
  view(d).focus();
  if (r.btn !== 'ok' || !r.value.trim()) return;
  const src = r.value.trim();
  let alt = basename(src).replace(/\.[^.]+$/, '');
  try { alt = decodeURIComponent(alt); } catch {}
  run(insertImageCommand, { src, alt });
}

function inTable() {
  if (!active?.editor || active.sourceMode) return false;
  let $f;
  try { $f = view().state.selection.$from; } catch { return false; }
  for (let dp = $f.depth; dp > 0; dp--) if ($f.node(dp).type.name === 'table') return true;
  return false;
}
function updateTableTools() { $('.group.tbl').hidden = !inTable(); }

const actions = {
  new: newDoc, open: openDoc, save: () => save(), find: openFind, source: toggleSource,
  saveAs: () => save(active, true), saveAll, closeTab: () => closeDoc(active), quit: () => win.close(),
  openFolder: chooseFolder, closeFolder, settings: () => openSettings(), sidebar: toggleSidebar, refresh: () => renderTree(),
  undo: () => run(undoCommand), redo: () => run(redoCommand),
  p: () => run(turnIntoTextCommand),
  h1: () => run(wrapInHeadingCommand, 1), h2: () => run(wrapInHeadingCommand, 2), h3: () => run(wrapInHeadingCommand, 3),
  bold: () => run(toggleStrongCommand), italic: () => run(toggleEmphasisCommand),
  strike: () => run(toggleStrikethroughCommand), code: () => run(toggleInlineCodeCommand),
  link: insertLink,
  ul: () => run(wrapInBulletListCommand), ol: () => run(wrapInOrderedListCommand), task: toggleTask,
  quote: () => run(wrapInBlockquoteCommand), codeblock: () => run(createCodeBlockCommand),
  image: insertImage, table: () => { run(insertTableCommand); updateTableTools(); }, hr: () => run(insertHrCommand),
  rowAfter: () => run(addRowAfterCommand), colAfter: () => run(addColAfterCommand),
  delCells: () => { run(deleteSelectedCellsCommand); updateTableTools(); },
};

async function saveAll() {
  for (const d of [...docs]) if (isDirty(d)) { activate(d); if (!(await save(d))) return; }
}

for (const bar of [toolbar, $('#tabs'), $('#fileMenu'), $('.side-head')]) {
  bar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (b) actions[b.dataset.act]?.();
  });
}
tablist.addEventListener('dblclick', (e) => { if (e.target === tablist) newDoc(); });
tablist.addEventListener('wheel', (e) => {
  if (e.deltaY) { e.preventDefault(); tablist.scrollLeft += e.deltaY; }
}, { passive: false });

// =====================================================================
// Recherche
// =====================================================================
const findbar = $('#findbar');
const findInput = $('#findInput');
const findMsg = $('#findMsg');

function openFind() {
  findbar.hidden = false;
  const ta = active.ta;
  const sel = active.sourceMode ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : window.getSelection().toString();
  if (sel && !sel.includes('\n')) findInput.value = sel;
  findInput.select();
  findInput.focus();
}

function closeFind(refocus = true) {
  if (window.CSS?.highlights) CSS.highlights.clear();
  if (findbar.hidden) return;
  findbar.hidden = true;
  findMsg.textContent = '';
  if (refocus) focusActive();
}

function findNext(back = false) {
  const q = findInput.value;
  findMsg.textContent = '';
  if (!q) return;
  const ql = q.toLowerCase();
  if (active.sourceMode) {
    const ta = active.ta;
    const text = ta.value.toLowerCase();
    let i = back ? text.lastIndexOf(ql, ta.selectionStart - 1) : text.indexOf(ql, ta.selectionEnd);
    if (i < 0) i = back ? text.lastIndexOf(ql) : text.indexOf(ql);
    if (i < 0) { findMsg.textContent = t('notFound'); return; }
    ta.focus();
    ta.setSelectionRange(i, i + q.length);
    findInput.focus();
    return;
  }
  const v = view();
  const { doc, selection } = v.state;
  const hits = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = node.textBetween(0, node.content.size, undefined, '￼').toLowerCase();
    for (let i = text.indexOf(ql); i >= 0; i = text.indexOf(ql, i + 1)) hits.push(pos + 1 + i);
    return false;
  });
  if (!hits.length) { findMsg.textContent = t('notFound'); window.CSS?.highlights?.clear(); return; }
  const h = back
    ? [...hits].reverse().find((x) => x < selection.from) ?? hits[hits.length - 1]
    : hits.find((x) => x > selection.from) ?? hits[0];
  v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, h, h + q.length)));
  findMsg.textContent = `${hits.indexOf(h) + 1}/${hits.length}`;
  try {
    const a = v.domAtPos(h), b = v.domAtPos(h + q.length);
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    if (window.CSS?.highlights) CSS.highlights.set('find', new Highlight(range));
    const sc = active.pane;
    const r = range.getBoundingClientRect();
    const sr = sc.getBoundingClientRect();
    if (r.top < sr.top + 20 || r.bottom > sr.bottom - 20) sc.scrollTop += r.top - sr.top - sc.clientHeight / 3;
  } catch {}
}

findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); findNext(e.shiftKey); }
  else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
});
findbar.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-find]');
  if (!b) return;
  if (b.dataset.find === 'close') closeFind(); else findNext(b.dataset.find === 'prev');
});

// =====================================================================
// Boîte de dialogue interne
// =====================================================================
let modalOpen = false;
function modal({ msg, input = null, buttons, browse = null }) {
  return new Promise((resolve) => {
    const m = $('#modal'), box = $('#modalBox'), inp = $('#modalInput'), btns = $('#modalBtns');
    modalOpen = true;
    $('#modalMsg').textContent = msg;
    $('#modalRow').hidden = input === null;
    inp.value = input ?? '';
    btns.innerHTML = '';
    const finish = (btn) => {
      m.hidden = true; modalOpen = false;
      box.onsubmit = null; m.onkeydown = null;
      resolve({ btn, value: inp.value });
    };
    if (browse) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'browse'; b.textContent = t('btnBrowse');
      b.onclick = async () => { const v = await browse(); if (v) inp.value = v; inp.focus(); };
      btns.appendChild(b);
    }
    for (const def of buttons) {
      const b = document.createElement('button');
      b.type = def.primary ? 'submit' : 'button';
      b.textContent = def.label;
      if (def.primary) b.className = 'primary';
      else b.onclick = () => finish(def.id);
      btns.appendChild(b);
    }
    const primary = buttons.find((x) => x.primary)?.id;
    box.onsubmit = (e) => { e.preventDefault(); finish(primary); };
    m.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); finish('cancel'); } };
    m.hidden = false;
    (input !== null ? inp : btns.querySelector('.primary'))?.focus();
    if (input !== null) inp.select();
  });
}

// =====================================================================
// Raccourcis clavier
// =====================================================================
function cycleTab(step) {
  if (docs.length < 2) return;
  const i = docs.indexOf(active);
  activate(docs[(i + step + docs.length) % docs.length]);
}

window.addEventListener('keydown', (e) => {
  if (modalOpen) return;
  if (e.key === 'F3') { e.preventDefault(); if (findbar.hidden) openFind(); else findNext(e.shiftKey); return; }
  if (e.key === 'Escape' && !findbar.hidden) { e.preventDefault(); closeFind(); return; }
  if (e.key === 'Escape' && !fileMenu.hidden) { e.preventDefault(); hideMenu(); return; }
  if (!e.ctrlKey) return;
  const k = e.key.toLowerCase();
  let fn = null;
  if (e.altKey) {
    if (k === 's') fn = saveAll;
  }
  else if (k === 'n' || k === 't') fn = newDoc;
  else if (k === 'o' && e.shiftKey) fn = chooseFolder;
  else if (k === 'e' && e.shiftKey) fn = toggleSidebar;
  else if (k === 'o') fn = openDoc;
  else if (k === 's') fn = () => save(active, e.shiftKey);
  else if (k === 'w' || k === 'f4') fn = () => closeDoc(active);
  else if (k === 'tab') fn = () => cycleTab(e.shiftKey ? -1 : 1);
  else if (k === 'pagedown') fn = () => cycleTab(1);
  else if (k === 'pageup') fn = () => cycleTab(-1);
  else if (k === 'f') fn = openFind;
  else if (k === ',') fn = () => openSettings();
  else if (k === 'k') fn = insertLink;
  else if (k === '/' || e.code === 'Slash' || (k === 'm' && e.shiftKey)) fn = toggleSource;
  else if (k === 'p' || k === 'r' || k === 'g' || k === 'j') fn = () => {}; // bloque impression/rechargement
  if (fn) { e.preventDefault(); e.stopPropagation(); fn(); }
}, true);

// Pas de menu contextuel du navigateur hors des zones de texte
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.editor, .source, input')) e.preventDefault();
});

// =====================================================================
// Barre d'état
// =====================================================================
let statusTimer = 0;
function scheduleStatus() { clearTimeout(statusTimer); statusTimer = setTimeout(updateStatus, 250); }
function updateStatus() {
  if (!active?.editor) return;
  $('#stMode').textContent = active.sourceMode ? t('modeSource') : t('modeWysiwyg');
  const doc = view().state.doc;
  const text = active.sourceMode ? active.ta.value : doc.textBetween(0, doc.content.size, ' ', ' ');
  const n = (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) || []).length;
  $('#stWords').textContent = t('words', n);
}

// =====================================================================
// Langue
// =====================================================================
function applyLang() {
  document.documentElement.lang = getLang();
  $$('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('#fileMenu kbd').forEach((el) => {
    el.dataset.fr ??= el.textContent;
    el.textContent = getLang() === 'fr' ? el.dataset.fr : el.dataset.fr.replace('Maj', 'Shift');
  });
  if (folder && !tree.querySelector('.node')) renderTree();
  findInput.placeholder = t('findPh');
  docs.forEach(renderTab);
  updateTitle();
  updateStatus();
}

// =====================================================================
// Fenêtre : fermeture, glisser-déposer, seconde instance
// =====================================================================
win.onCloseRequested(async (e) => {
  if (!docs.some((d) => isDirty(d))) return;
  e.preventDefault();
  for (const d of [...docs]) {
    if (isDirty(d) && !(await closeDoc(d, { keepOne: false }))) return;
  }
  await win.destroy();
});

getCurrentWebview().onDragDropEvent((e) => {
  if (e.payload.type === 'drop' && e.payload.paths?.length) openPaths(e.payload.paths);
});

// « Ouvrir avec » / menu contextuel alors qu'EmDy est déjà ouvert
async function handleLaunchArgs(a) {
  if (a?.folder) await openFolderPath(a.folder);
  if (a?.files?.length) await openPaths(a.files);
}
listen('open-args', (e) => handleLaunchArgs(e.payload));

// =====================================================================
// Menu Fichier
// =====================================================================
const fileMenu = $('#fileMenu');
const fileBtn = $('#fileBtn');
function hideMenu() { fileMenu.hidden = true; fileBtn.classList.remove('on'); }
fileBtn.addEventListener('click', () => {
  if (!fileMenu.hidden) return hideMenu();
  const r = fileBtn.getBoundingClientRect();
  fileMenu.style.left = `${r.left}px`;
  fileMenu.style.top = `${r.bottom + 2}px`;
  fileMenu.hidden = false;
  fileBtn.classList.add('on');
});
fileMenu.addEventListener('click', (e) => { if (e.target.closest('button')) hideMenu(); });
document.addEventListener('mousedown', (e) => {
  if (!fileMenu.hidden && !e.target.closest('#fileMenu, #fileBtn')) hideMenu();
});

// =====================================================================
// Explorateur de dossier (à gauche)
// =====================================================================
const sidebar = $('#sidebar');
const tree = $('#tree');
const resizer = $('#resizer');
let folder = null;
const expanded = new Set();
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} },
};

function showSidebar(v) {
  sidebar.hidden = !v;
  resizer.hidden = !v;
  $('#sidebarBtn').classList.toggle('on', v);
}

function toggleSidebar() {
  if (!folder) return chooseFolder();
  showSidebar(sidebar.hidden);
}

async function chooseFolder() {
  const p = await openDialog({ directory: true, multiple: false, defaultPath: folder || undefined });
  if (p) await openFolderPath(p);
}

async function openFolderPath(p) {
  try { await invoke('list_dir', { path: p }); } catch { return false; }
  folder = p.replace(/[\\/]+$/, '') || p;
  expanded.clear();
  const name = $('#folderName');
  name.textContent = basename(folder) || folder;
  name.title = folder;
  showSidebar(true);
  store.set('emdy.folder', folder);
  await renderTree();
  return true;
}

function closeFolder() {
  folder = null;
  expanded.clear();
  tree.replaceChildren();
  showSidebar(false);
  store.set('emdy.folder', null);
}

async function buildLevel(dir, depth) {
  const frag = document.createDocumentFragment();
  let entries = [];
  try { entries = await invoke('list_dir', { path: dir }); } catch { return frag; }
  for (const e of entries) {
    const row = document.createElement('div');
    row.className = `node ${e.dir ? 'dir' : 'file'}`;
    row.setAttribute('role', 'treeitem');
    row.dataset.path = e.path;
    row.dataset.depth = depth;
    row.style.paddingLeft = `${6 + depth * 14}px`;
    row.title = e.path;
    row.innerHTML = '<span class="twisty"></span><span class="label"></span>';
    row.querySelector('.label').textContent = e.name;
    frag.append(row);
    if (e.dir && expanded.has(e.path.toLowerCase())) {
      row.classList.add('open');
      frag.append(await buildLevel(e.path, depth + 1));
    }
  }
  return frag;
}

let treeBusy = null;
async function renderTree() {
  if (!folder) return;
  if (treeBusy) return treeBusy;
  treeBusy = (async () => {
    const scroll = tree.scrollTop;
    const frag = await buildLevel(folder, 0);
    tree.replaceChildren(frag);
    if (!tree.querySelector('.file')) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = t('emptyFolder');
      tree.append(p);
    }
    tree.scrollTop = scroll;
    markActiveInTree();
  })();
  try { await treeBusy; } finally { treeBusy = null; }
}

async function toggleDir(row) {
  const key = row.dataset.path.toLowerCase();
  const depth = +row.dataset.depth;
  if (expanded.has(key)) {
    expanded.delete(key);
    row.classList.remove('open');
    while (row.nextElementSibling && +row.nextElementSibling.dataset.depth > depth) row.nextElementSibling.remove();
  } else {
    expanded.add(key);
    row.classList.add('open');
    row.after(await buildLevel(row.dataset.path, depth + 1));
    markActiveInTree();
  }
}

function markActiveInTree() {
  for (const r of tree.querySelectorAll('.node.file')) {
    r.classList.toggle('selected', !!active && samePath(r.dataset.path, active.path));
  }
}

tree.addEventListener('click', (e) => {
  const row = e.target.closest('.node');
  if (!row) return;
  if (row.classList.contains('dir')) toggleDir(row);
  else openPaths([row.dataset.path], { preview: true });
});
tree.addEventListener('dblclick', (e) => {
  const row = e.target.closest('.node.file');
  if (row) openPaths([row.dataset.path]);
});
// Pas de sélection de texte au double-clic
tree.addEventListener('mousedown', (e) => { if (e.detail > 1) e.preventDefault(); });

// Redimensionnement du panneau
(() => {
  const w = +store.get('emdy.sidebarWidth');
  if (w) sidebar.style.width = `${w}px`;
  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX, startW = sidebar.offsetWidth;
    const move = (ev) => { sidebar.style.width = `${Math.min(600, Math.max(140, startW + ev.clientX - startX))}px`; };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      store.set('emdy.sidebarWidth', sidebar.offsetWidth);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
})();

// Actualise l'arborescence quand on revient dans la fenêtre
window.addEventListener('focus', () => { if (folder) renderTree(); });


// =====================================================================
// Réglages (fichier %APPDATA%\EmDy\settings.json, partagé avec l'installateur)
// =====================================================================
let settings = {};
async function loadSettings() {
  try { settings = JSON.parse(await invoke('get_settings')) || {}; } catch { settings = {}; }
}
async function saveSettings() {
  try { await invoke('save_settings', { json: JSON.stringify(settings, null, 2) }); } catch {}
}

// Réécrit les associations actives (chemin de l'exe à jour, libellé dans la bonne langue)
async function syncAssociations(st) {
  const label = t('ctxOpenWith');
  if (st.md) await invoke('set_md_assoc', { enable: true, label });
  if (st.folder) await invoke('set_folder_assoc', { enable: true, label });
}

const settingsEl = $('#settings');
function openSettings(first = false) {
  hideMenu();
  return new Promise(async (resolve) => {
    let st = { md: false, folder: false };
    try { st = await invoke('assoc_status'); } catch {}
    const form = $('#settingsBox'), md = $('#setMd'), fd = $('#setFolder'), err = $('#setError');
    $('#setLang').value = getLang();
    md.checked = first ? true : st.md;
    fd.checked = first ? true : st.folder;
    const paintTexts = () => {
      $('#setTitle').textContent = first ? t('setWelcome') : t('setTitle');
      $('#setSubtitle').textContent = first ? t('setWelcomeSub') : t('setSub');
      $('#setLater').hidden = !first;
      $('#setCancel').textContent = first ? t('btnLater') : t('btnCancel');
      $('#setOk').textContent = first ? t('btnStart') : t('btnOk');
    };
    paintTexts();
    // Aperçu immédiat de la langue choisie dans la fenêtre
    const langBefore = getLang();
    $('#setLang').onchange = () => { setLang($('#setLang').value); applyLang(); paintTexts(); };
    err.textContent = '';
    const syncBtn = () => { $('#setDefaultApps').parentElement.hidden = !md.checked; };
    syncBtn();
    md.onchange = syncBtn;
    $('#setDefaultApps').onclick = async () => {
      try {
        if (!(await invoke('assoc_status')).md) await invoke('set_md_assoc', { enable: true, label: t('ctxOpenWith') });
        await invoke('open_default_apps');
      } catch (e) { err.textContent = `${t('errSettings')} ${e}`; }
    };
    const finish = () => {
      settingsEl.hidden = true;
      modalOpen = false;
      form.onsubmit = null;
      settingsEl.onkeydown = null;
      focusActive();
      resolve();
    };
    $('#setCancel').onclick = async () => {
      if (getLang() !== langBefore) { setLang(langBefore); applyLang(); }
      if (first) { settings.setupDone = true; await saveSettings(); }
      finish();
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      setLang($('#setLang').value);
      applyLang();
      settings.lang = getLang();
      settings.setupDone = true;
      await saveSettings();
      try {
        const label = t('ctxOpenWith');
        await invoke('set_md_assoc', { enable: md.checked, label });
        await invoke('set_folder_assoc', { enable: fd.checked, label });
      } catch (x) {
        err.textContent = `${t('errSettings')} ${x}`;
        return;
      }
      finish();
    };
    settingsEl.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); $('#setCancel').click(); } };
    modalOpen = true;
    settingsEl.hidden = false;
    $('#setLang').focus();
  });
}

// =====================================================================
// Démarrage
// =====================================================================
(async () => {
  await loadSettings();
  if (settings.lang) setLang(settings.lang);
  applyLang();
  await newDoc();
  let args = null;
  try { args = await invoke('launch_args'); } catch {}
  const lastFolder = store.get('emdy.folder');
  if (lastFolder && !args?.folder) await openFolderPath(lastFolder);
  await handleLaunchArgs(args);
  if (!settings.setupDone) {
    await openSettings(true);
  } else {
    try { await syncAssociations(await invoke('assoc_status')); } catch {}
  }
})();

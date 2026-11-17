// Traductions / Translations.
// Pour ajouter une langue : copier un bloc, le traduire et ajouter une <option> dans index.html.
export const STRINGS = {
  fr: {
    new: 'Nouveau (Ctrl+N)', newTab: 'Nouvel onglet (Ctrl+N)', open: 'Ouvrir (Ctrl+O)', save: 'Enregistrer (Ctrl+S)',
    undo: 'Annuler (Ctrl+Z)', redo: 'Rétablir (Ctrl+Y)',
    paragraph: 'Texte normal', h1: 'Titre 1', h2: 'Titre 2', h3: 'Titre 3',
    bold: 'Gras (Ctrl+B)', italic: 'Italique (Ctrl+I)', strike: 'Barré', code: 'Code en ligne',
    link: 'Lien (Ctrl+K)', bulletList: 'Liste à puces', orderedList: 'Liste numérotée',
    taskList: 'Liste de tâches', quote: 'Citation', codeBlock: 'Bloc de code',
    image: 'Image', table: 'Tableau', hr: 'Ligne horizontale',
    addRow: 'Ajouter une rangée', addCol: 'Ajouter une colonne', delCells: 'Supprimer les cellules sélectionnées',
    find: 'Rechercher (Ctrl+F)', sourceMode: 'Afficher / masquer le code Markdown (Ctrl+/)', language: 'Langue',
    untitled: 'Sans titre', modeWysiwyg: 'Visuel', modeSource: 'Markdown',
    words: (n) => `${n} mot${n > 1 ? 's' : ''}`,
    unsaved: (name) => `Enregistrer les modifications apportées à « ${name} » ?`,
    btnSave: 'Enregistrer', btnDiscard: 'Ne pas enregistrer', btnCancel: 'Annuler', btnOk: 'OK', btnBrowse: 'Parcourir…',
    linkPrompt: 'Adresse du lien (URL) :', imagePrompt: 'Chemin ou URL de l’image :',
    mdFiles: 'Fichiers Markdown', images: 'Images', allFiles: 'Tous les fichiers',
    errOpen: 'Impossible d’ouvrir le fichier :', errSave: 'Impossible d’enregistrer le fichier :',
    findPh: 'Rechercher…', notFound: 'Introuvable', ctrlClick: 'Ctrl+clic pour ouvrir le lien',
    fileMenu: 'Fichier', openFolder: 'Ouvrir un dossier (Ctrl+Maj+O)', toggleSidebar: 'Afficher / masquer l’explorateur (Ctrl+Maj+E)',
    refresh: 'Actualiser', emptyFolder: 'Aucun fichier Markdown dans ce dossier.', noFolder: 'Aucun dossier ouvert.',
    mNew: 'Nouveau', mOpen: 'Ouvrir un fichier…', mOpenFolder: 'Ouvrir un dossier…', mSave: 'Enregistrer',
    mSaveAs: 'Enregistrer sous…', mSaveAll: 'Tout enregistrer', mCloseTab: 'Fermer l’onglet', mCloseFolder: 'Fermer le dossier', mQuit: 'Quitter',
    previewTab: 'Aperçu : double-cliquez ou modifiez pour garder l’onglet ouvert',
    mSettings: 'Paramètres…', setTitle: 'Paramètres',
    setWelcome: 'Bienvenue dans EmDy', setWelcomeSub: 'Quelques réglages avant de commencer.',
    setSub: 'Langue et intégration à Windows.',
    setGeneral: 'Général', setLang: 'Langue de l’interface', setWindows: 'Intégration à Windows',
    setMd: 'Ouvrir les fichiers .md avec EmDy',
    setMdDesc: 'Double-clic sur un fichier .md et « Ouvrir avec EmDy » au clic droit.',
    setFolder: 'Ouvrir un dossier avec EmDy',
    setFolderDesc: 'Ajoute « Ouvrir avec EmDy » au clic droit sur un dossier (Windows 11 : « Afficher plus d’options »).',
    setDefaultApps: 'Un autre programme ouvre déjà les .md ? Choisir EmDy dans les paramètres Windows…',
    setLater: 'Modifiable plus tard dans Fichier → Paramètres.', btnLater: 'Plus tard', btnStart: 'Commencer',
    ctxOpenWith: 'Ouvrir avec EmDy', errSettings: 'Erreur :',
  },
  en: {
    new: 'New (Ctrl+N)', newTab: 'New tab (Ctrl+N)', open: 'Open (Ctrl+O)', save: 'Save (Ctrl+S)',
    undo: 'Undo (Ctrl+Z)', redo: 'Redo (Ctrl+Y)',
    paragraph: 'Normal text', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3',
    bold: 'Bold (Ctrl+B)', italic: 'Italic (Ctrl+I)', strike: 'Strikethrough', code: 'Inline code',
    link: 'Link (Ctrl+K)', bulletList: 'Bulleted list', orderedList: 'Numbered list',
    taskList: 'Task list', quote: 'Quote', codeBlock: 'Code block',
    image: 'Image', table: 'Table', hr: 'Horizontal rule',
    addRow: 'Add row', addCol: 'Add column', delCells: 'Delete selected cells',
    find: 'Find (Ctrl+F)', sourceMode: 'Show / hide Markdown source (Ctrl+/)', language: 'Language',
    untitled: 'Untitled', modeWysiwyg: 'Visual', modeSource: 'Markdown',
    words: (n) => `${n} word${n === 1 ? '' : 's'}`,
    unsaved: (name) => `Save changes to "${name}"?`,
    btnSave: 'Save', btnDiscard: "Don't save", btnCancel: 'Cancel', btnOk: 'OK', btnBrowse: 'Browse…',
    linkPrompt: 'Link address (URL):', imagePrompt: 'Image path or URL:',
    mdFiles: 'Markdown files', images: 'Images', allFiles: 'All files',
    errOpen: 'Could not open the file:', errSave: 'Could not save the file:',
    findPh: 'Find…', notFound: 'Not found', ctrlClick: 'Ctrl+click to open link',
    fileMenu: 'File', openFolder: 'Open folder (Ctrl+Shift+O)', toggleSidebar: 'Show / hide explorer (Ctrl+Shift+E)',
    refresh: 'Refresh', emptyFolder: 'No Markdown files in this folder.', noFolder: 'No folder open.',
    mNew: 'New', mOpen: 'Open file…', mOpenFolder: 'Open folder…', mSave: 'Save',
    mSaveAs: 'Save as…', mSaveAll: 'Save all', mCloseTab: 'Close tab', mCloseFolder: 'Close folder', mQuit: 'Quit',
    previewTab: 'Preview: double-click or edit to keep this tab open',
    mSettings: 'Settings…', setTitle: 'Settings',
    setWelcome: 'Welcome to EmDy', setWelcomeSub: 'A few settings before you start.',
    setSub: 'Language and Windows integration.',
    setGeneral: 'General', setLang: 'Interface language', setWindows: 'Windows integration',
    setMd: 'Open .md files with EmDy',
    setMdDesc: 'Double-click a .md file, plus "Open with EmDy" in the right-click menu.',
    setFolder: 'Open a folder with EmDy',
    setFolderDesc: 'Adds "Open with EmDy" when right-clicking a folder (Windows 11: "Show more options").',
    setDefaultApps: 'Another program already opens .md files? Choose EmDy in Windows settings…',
    setLater: 'You can change this later in File → Settings.', btnLater: 'Later', btnStart: 'Get started',
    ctxOpenWith: 'Open with EmDy', errSettings: 'Error:',
  },
};

let lang = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';

export const getLang = () => lang;
export function setLang(l) {
  if (STRINGS[l]) lang = l;
}
export const t = (k, ...a) => {
  const v = STRINGS[lang][k] ?? STRINGS.en[k] ?? k;
  return typeof v === 'function' ? v(...a) : v;
};

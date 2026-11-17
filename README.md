# EmDy

**Un éditeur Markdown simple, à la WordPad.** / **A simple, WordPad-like Markdown editor.**

[Français](#français) · [English](#english)

---

## Français

EmDy ouvre et enregistre des fichiers `.md`, mais vous écrivez comme dans un traitement de texte : le gras est gras, les titres sont des titres, les listes sont des listes. Le code Markdown n'apparaît que si vous le demandez.

### Caractéristiques

- **Visuel (WYSIWYG)** : gras, italique, barré, code, titres, listes à puces et numérotées, listes de tâches cochables, citations, blocs de code, liens, images, tableaux, lignes horizontales.
- **Mode Markdown facultatif** : bouton **M↓** ou `Ctrl+/` pour voir et modifier le texte brut, puis revenir au mode visuel.
- **Onglets** : plusieurs fichiers ouverts à la fois, chacun avec son propre historique d'annulation.
- **Explorateur de dossier**, comme dans VS Code : un clic ouvre le fichier dans un onglet d'aperçu (en italique) qui sera remplacé par le prochain ; un double-clic ou une modification le garde ouvert.
- **Intégration à Windows** (facultative) : « Ouvrir les fichiers .md avec EmDy » et « Ouvrir avec EmDy » dans le menu contextuel des dossiers.
- **Portable ou installé** : un seul `EmDy-portable.exe` (quelques Mo), ou un installateur qui demande la langue et les options d'intégration.
- **Bilingue** : français et anglais.
- Thème clair ou sombre selon Windows ; conserve les fins de ligne (CRLF ou LF) ; enregistre en UTF-8.

### Installation

Dans les [Releases](../../releases) :

- **`EmDy-x.y.z-setup.exe`** : installateur (sans droits administrateur). Il demande la langue, puis les options d'intégration à Windows.
- **`EmDy-x.y.z-portable.exe`** : rien à installer. Au premier lancement, une fenêtre propose les mêmes réglages.

Les réglages sont modifiables à tout moment dans **Fichier → Paramètres** (`Ctrl+,`).

> Windows ne permet pas à un programme de se déclarer lui-même « programme par défaut » si vous en avez déjà choisi un autre pour les `.md`. Dans ce cas, le bouton **Choisir EmDy par défaut dans Windows…** ouvre la bonne page des paramètres Windows. Sous Windows 11, les entrées du menu contextuel se trouvent sous « Afficher plus d'options ».

### Raccourcis

| Raccourci | Action |
|---|---|
| `Ctrl+N` / `Ctrl+O` | Nouvel onglet / Ouvrir un fichier |
| `Ctrl+Maj+O` | Ouvrir un dossier |
| `Ctrl+Maj+E` | Afficher / masquer l'explorateur |
| `Ctrl+S` / `Ctrl+Maj+S` / `Ctrl+Alt+S` | Enregistrer / Enregistrer sous / Tout enregistrer |
| `Ctrl+W` | Fermer l'onglet |
| `Ctrl+Tab` / `Ctrl+Maj+Tab` | Onglet suivant / précédent |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+K` | Gras / Italique / Lien |
| `Ctrl+Z` / `Ctrl+Y` | Annuler / Rétablir |
| `Ctrl+F`, `F3` | Rechercher, suivant |
| `Ctrl+/` | Basculer en mode Markdown |
| `Ctrl+,` | Paramètres |
| `Ctrl+clic` sur un lien | Ouvrir dans le navigateur |

**Configuration requise** : Windows 10 ou 11 avec WebView2 (présent sur Windows 11 et sur les Windows 10 à jour ; l'installateur l'installe au besoin).

---

## English

EmDy opens and saves `.md` files, but you write as in a word processor: bold looks bold, headings look like headings. The Markdown code only shows up when you ask for it.

### Features

- **Visual (WYSIWYG)**: bold, italic, strikethrough, code, headings, lists, clickable task lists, quotes, code blocks, links, images, tables, horizontal rules.
- **Optional Markdown mode**: the **M↓** button or `Ctrl+/`.
- **Tabs**, each with its own undo history.
- **Folder explorer**, VS Code style: single-click opens a preview tab (italic) that the next file replaces; double-click or editing keeps it open.
- **Windows integration** (optional): "Open .md files with EmDy" and "Open with EmDy" in the folder context menu.
- **Portable or installed**: a single `EmDy-portable.exe`, or an installer that asks for language and integration options.
- **Bilingual**: English and French.

### Install

From [Releases](../../releases): `EmDy-x.y.z-setup.exe` (installer, no admin rights needed) or `EmDy-x.y.z-portable.exe` (no install; a first-run window offers the same settings). Settings can be changed anytime in **File → Settings** (`Ctrl+,`). Shortcuts are listed in the French table above (`Maj` = `Shift`).

---

## Développement / Development

Built with [Tauri 2](https://tauri.app) (Rust) and [Milkdown](https://milkdown.dev) (ProseMirror).

```bash
npm install
npm run tauri dev                    # dev mode
npm run tauri build                  # portable exe + NSIS installer
```

- Portable exe: `src-tauri/target/release/emdy.exe`
- Installer: `src-tauri/target/release/bundle/nsis/`
- Translations: [`src/i18n.js`](src/i18n.js) (copy a block to add a language)
- Windows integration: [`src-tauri/src/assoc.rs`](src-tauri/src/assoc.rs) (per-user registry, no admin rights)
- Installer options page: [`src-tauri/windows/installer.nsi`](src-tauri/windows/installer.nsi) (Tauri 2.12.5 template + an *Options* page) and [`hooks.nsh`](src-tauri/windows/hooks.nsh)

Pushing a `v*` tag builds both files on GitHub Actions and attaches them to a release.

## Licence / License

[0BSD](LICENSE) (BSD Zero Clause): do anything you want with it, no attribution required.

## Signature / Code signing

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/) — see the [code signing policy](CODE_SIGNING_POLICY.md).

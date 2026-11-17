// Pas de console sous Windows en mode release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod assoc;

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};

/// Lit un fichier texte (UTF-8, BOM retiré, octets invalides remplacés).
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&bytes);
    Ok(text.trim_start_matches('\u{feff}').to_string())
}

/// Écrit le fichier en UTF-8 (sans BOM).
#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct Entry {
    name: String,
    path: String,
    dir: bool,
}

const MD_EXT: [&str; 4] = [".md", ".markdown", ".mdown", ".mkd"];
const SKIP_DIRS: [&str; 3] = ["node_modules", "$recycle.bin", "system volume information"];

/// Contenu d'un dossier : sous-dossiers puis fichiers Markdown, triés par nom.
#[tauri::command]
fn list_dir(path: String) -> Result<Vec<Entry>, String> {
    let mut out = Vec::new();
    for e in fs::read_dir(&path).map_err(|e| e.to_string())?.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        let lower = name.to_lowercase();
        if name.starts_with('.') || SKIP_DIRS.contains(&lower.as_str()) {
            continue;
        }
        let p = e.path();
        let dir = p.is_dir();
        if !dir && !MD_EXT.iter().any(|x| lower.ends_with(x)) {
            continue;
        }
        out.push(Entry { name, path: p.to_string_lossy().to_string(), dir });
    }
    out.sort_by(|a, b| b.dir.cmp(&a.dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(out)
}

#[derive(Serialize, Clone, Default)]
struct LaunchArgs {
    files: Vec<String>,
    folder: Option<String>,
}

/// Sépare les fichiers et le (premier) dossier d'une ligne de commande, en chemins absolus.
fn parse_args(args: &[String], cwd: &Path) -> LaunchArgs {
    let mut out = LaunchArgs::default();
    for a in args.iter().skip(1).filter(|a| !a.starts_with('-')) {
        let a = a.trim_matches('"');
        let p = Path::new(a);
        let p = if p.is_absolute() { p.to_path_buf() } else { cwd.join(p) };
        let Ok(abs) = fs::canonicalize(&p) else { continue };
        let s = abs.to_string_lossy().to_string();
        let s = s.strip_prefix(r"\\?\").map(str::to_string).unwrap_or(s);
        if abs.is_dir() {
            out.folder.get_or_insert(s);
        } else if abs.is_file() {
            out.files.push(s);
        }
    }
    out
}

/// Arguments du lancement (« Ouvrir avec », menu contextuel, glisser sur l'exe).
#[tauri::command]
fn launch_args() -> LaunchArgs {
    let args: Vec<String> = std::env::args().collect();
    let cwd = std::env::current_dir().unwrap_or_default();
    parse_args(&args, &cwd)
}

// ---------- Réglages (%APPDATA%\EmDy\settings.json) ----------
fn settings_path() -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|a| PathBuf::from(a).join("EmDy").join("settings.json"))
}

#[tauri::command]
fn get_settings() -> String {
    settings_path()
        .and_then(|p| fs::read_to_string(p).ok())
        .unwrap_or_else(|| "{}".into())
}

#[tauri::command]
fn save_settings(json: String) -> Result<(), String> {
    let p = settings_path().ok_or("APPDATA introuvable")?;
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    fs::write(p, json).map_err(|e| e.to_string())
}

/// Commandes sans fenêtre, utilisées par l'installateur :
/// `--configure --lang=fr|en --md=0|1 --folder=0|1` et `--unregister`.
fn run_cli(args: &[String]) -> bool {
    let has = |f: &str| args.iter().any(|a| a == f);
    if has("--unregister") {
        let _ = assoc::set_md_assoc(false, String::new());
        let _ = assoc::set_folder_assoc(false, String::new());
        return true;
    }
    if has("--configure") {
        let get = |k: &str| {
            let prefix = format!("--{k}=");
            args.iter().find_map(|a| a.strip_prefix(&prefix).map(str::to_string))
        };
        let lang = get("lang").filter(|l| l == "fr" || l == "en").unwrap_or_else(|| "en".into());
        let on = |k: &str| get(k).as_deref() == Some("1");
        let label = if lang == "fr" { "Ouvrir avec EmDy" } else { "Open with EmDy" };
        let _ = assoc::set_md_assoc(on("md"), label.into());
        let _ = assoc::set_folder_assoc(on("folder"), label.into());
        let mut v: serde_json::Value = serde_json::from_str(&get_settings()).unwrap_or_default();
        if !v.is_object() {
            v = serde_json::json!({});
        }
        v["lang"] = serde_json::json!(lang);
        v["setupDone"] = serde_json::json!(true);
        let _ = save_settings(v.to_string());
        return true;
    }
    false
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if run_cli(&args) {
        return;
    }
    tauri::Builder::default()
        // Une seule fenêtre : un second lancement transmet ses fichiers/dossier à la fenêtre ouverte.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let args = parse_args(&argv, Path::new(&cwd));
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            let _ = app.emit("open-args", args);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            list_dir,
            launch_args,
            get_settings,
            save_settings,
            assoc::assoc_status,
            assoc::set_md_assoc,
            assoc::set_folder_assoc,
            assoc::open_default_apps
        ])
        .run(tauri::generate_context!())
        .expect("error while running EmDy");
}

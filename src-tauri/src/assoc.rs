//! Intégration à Windows (registre de l'utilisateur courant, HKCU — aucun droit administrateur requis).
//!
//! * Fichiers .md : ProgID « EmDy.md », entrée « Ouvrir avec », verbe « Ouvrir avec EmDy » dans le menu
//!   contextuel, et inscription dans « Applications par défaut » de Windows.
//!   Windows interdit à une application de s'imposer comme programme par défaut si l'utilisateur a déjà
//!   fait un choix : dans ce cas, `open_default_apps` ouvre la page des paramètres Windows d'EmDy.
//! * Dossiers : « Ouvrir avec EmDy » dans le menu contextuel des dossiers et du fond d'un dossier.

use serde::Serialize;

#[derive(Serialize)]
pub struct AssocStatus {
    md: bool,
    folder: bool,
}

#[cfg(windows)]
mod imp {
    use super::AssocStatus;
    use std::ffi::c_void;
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    const PROGID: &str = "EmDy.md";
    const CLASSES: &str = r"Software\Classes";
    const EXTS: [&str; 2] = [".md", ".markdown"];
    const CAPS: &str = r"Software\EmDy\Capabilities";

    #[link(name = "shell32")]
    extern "system" {
        fn SHChangeNotify(event: i32, flags: u32, item1: *const c_void, item2: *const c_void);
    }

    fn es(e: std::io::Error) -> String {
        e.to_string()
    }
    fn hkcu() -> RegKey {
        RegKey::predef(HKEY_CURRENT_USER)
    }
    fn set(path: &str, name: &str, val: &str) -> Result<(), String> {
        let (k, _) = hkcu().create_subkey(path).map_err(es)?;
        k.set_value(name, &val.to_string()).map_err(es)
    }
    fn del_tree(path: &str) {
        let _ = hkcu().delete_subkey_all(path);
    }
    fn del_value(path: &str, name: &str) {
        if let Ok(k) = hkcu().open_subkey_with_flags(path, winreg::enums::KEY_ALL_ACCESS) {
            let _ = k.delete_value(name);
        }
    }
    fn exists(path: &str) -> bool {
        hkcu().open_subkey(path).is_ok()
    }
    fn notify() {
        // SHCNE_ASSOCCHANGED : rafraîchit les associations dans l'Explorateur.
        unsafe { SHChangeNotify(0x0800_0000, 0, std::ptr::null(), std::ptr::null()) };
    }
    fn exe() -> Result<(String, String), String> {
        let p = std::env::current_exe().map_err(es)?;
        let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "emdy.exe".into());
        Ok((p.to_string_lossy().to_string(), name))
    }

    pub fn status() -> AssocStatus {
        AssocStatus {
            md: exists(&format!(r"{CLASSES}\{PROGID}\shell\open\command")),
            folder: exists(&format!(r"{CLASSES}\Directory\shell\EmDy\command")),
        }
    }

    pub fn set_md(enable: bool, label: &str) -> Result<(), String> {
        let (exe, exe_name) = exe()?;
        let apps = format!(r"{CLASSES}\Applications\{exe_name}");
        if enable {
            let cmd = format!("\"{exe}\" \"%1\"");
            let icon = format!("\"{exe}\",0");
            let prog = format!(r"{CLASSES}\{PROGID}");
            set(&prog, "", "Markdown")?;
            set(&format!(r"{prog}\DefaultIcon"), "", &icon)?;
            set(&format!(r"{prog}\shell\open\command"), "", &cmd)?;
            set(&apps, "FriendlyAppName", "EmDy")?;
            set(&format!(r"{apps}\shell\open\command"), "", &cmd)?;
            set(&format!(r"{CAPS}"), "ApplicationName", "EmDy")?;
            set(&format!(r"{CAPS}"), "ApplicationDescription", "Markdown editor")?;
            set(r"Software\RegisteredApplications", "EmDy", CAPS)?;
            for ext in EXTS {
                set(&format!(r"{CLASSES}\{ext}\OpenWithProgids"), PROGID, "")?;
                set(&format!(r"{apps}\SupportedTypes"), ext, "")?;
                set(&format!(r"{CAPS}\FileAssociations"), ext, PROGID)?;
                // Programme par défaut seulement si aucun autre n'est déclaré pour l'utilisateur.
                let (k, _) = hkcu().create_subkey(format!(r"{CLASSES}\{ext}")).map_err(es)?;
                let cur: String = k.get_value("").unwrap_or_default();
                if cur.is_empty() || cur == PROGID {
                    k.set_value("", &PROGID.to_string()).map_err(es)?;
                }
                // Verbe « Ouvrir avec EmDy » dans le menu contextuel.
                let verb = format!(r"{CLASSES}\SystemFileAssociations\{ext}\shell\EmDy");
                set(&verb, "", label)?;
                set(&verb, "Icon", &icon)?;
                set(&format!(r"{verb}\command"), "", &cmd)?;
            }
        } else {
            del_tree(&format!(r"{CLASSES}\{PROGID}"));
            del_tree(&apps);
            del_tree(r"Software\EmDy");
            del_value(r"Software\RegisteredApplications", "EmDy");
            for ext in EXTS {
                del_value(&format!(r"{CLASSES}\{ext}\OpenWithProgids"), PROGID);
                let key = format!(r"{CLASSES}\{ext}");
                if let Ok(k) = hkcu().open_subkey(&key) {
                    let cur: String = k.get_value("").unwrap_or_default();
                    if cur == PROGID {
                        del_value(&key, "");
                    }
                }
                del_tree(&format!(r"{CLASSES}\SystemFileAssociations\{ext}\shell\EmDy"));
            }
        }
        notify();
        Ok(())
    }

    pub fn set_folder(enable: bool, label: &str) -> Result<(), String> {
        let (exe, _) = exe()?;
        for base in [r"Directory\shell\EmDy", r"Directory\Background\shell\EmDy"] {
            let key = format!(r"{CLASSES}\{base}");
            if enable {
                set(&key, "", label)?;
                set(&key, "Icon", &format!("\"{exe}\",0"))?;
                set(&format!(r"{key}\command"), "", &format!("\"{exe}\" \"%V\""))?;
            } else {
                del_tree(&key);
            }
        }
        notify();
        Ok(())
    }

    pub fn open_default_apps() -> Result<(), String> {
        std::process::Command::new("explorer.exe")
            .arg("ms-settings:defaultapps?registeredAppUser=EmDy")
            .spawn()
            .map(|_| ())
            .map_err(es)
    }
}

#[cfg(not(windows))]
mod imp {
    use super::AssocStatus;
    pub fn status() -> AssocStatus {
        AssocStatus { md: false, folder: false }
    }
    pub fn set_md(_: bool, _: &str) -> Result<(), String> {
        Err("Windows only".into())
    }
    pub fn set_folder(_: bool, _: &str) -> Result<(), String> {
        Err("Windows only".into())
    }
    pub fn open_default_apps() -> Result<(), String> {
        Err("Windows only".into())
    }
}

#[tauri::command]
pub fn assoc_status() -> AssocStatus {
    imp::status()
}

#[tauri::command]
pub fn set_md_assoc(enable: bool, label: String) -> Result<(), String> {
    imp::set_md(enable, &label)
}

#[tauri::command]
pub fn set_folder_assoc(enable: bool, label: String) -> Result<(), String> {
    imp::set_folder(enable, &label)
}

#[tauri::command]
pub fn open_default_apps() -> Result<(), String> {
    imp::open_default_apps()
}

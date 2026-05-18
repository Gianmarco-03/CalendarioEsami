pub mod tray;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub const QUICKLOG_LABEL: &str = "quicklog";

pub fn show_or_create(app: &AppHandle) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window(QUICKLOG_LABEL) {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(app, QUICKLOG_LABEL, WebviewUrl::App("index.html".into()))
        .title("Quick log studio")
        .inner_size(380.0, 240.0)
        .decorations(false)
        .resizable(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .center()
        .build()?;
    Ok(())
}

pub fn register_hotkey(app: &AppHandle) -> tauri::Result<()> {
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyS);
    let app_for_handler = app.clone();
    app.global_shortcut().on_shortcut(shortcut, move |_app, _sc, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = show_or_create(&app_for_handler);
        }
    }).map_err(|e| tauri::Error::from(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    Ok(())
}

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub fn install(app: &tauri::App) -> tauri::Result<()> {
    let open_app = MenuItemBuilder::with_id("open_app", "Apri app").build(app)?;
    let open_quicklog = MenuItemBuilder::with_id("open_quicklog", "Apri quick log…").build(app)?;
    let toggle_mute = MenuItemBuilder::with_id("toggle_mute", "Disattiva notifiche temporaneamente").build(app)?;
    let quit = MenuItemBuilder::with_id("quit_app", "Esci").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&open_app)
        .item(&open_quicklog)
        .separator()
        .item(&toggle_mute)
        .separator()
        .item(&quit)
        .build()?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Calendario Appelli e Studio")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "open_app" => { show_main(app); }
                "open_quicklog" => { let _ = crate::quicklog::show_or_create(app); }
                "toggle_mute" => {
                    // Toggle master OFF/ON
                    let state = app.state::<crate::commands::AppState>();
                    if let Ok(guard) = state.conn.lock() {
                        if let Ok(conn) = guard.as_ref() {
                            let prefs = crate::notify::prefs::load_all(conn).unwrap_or_default();
                            let new_enabled = !prefs.master_enabled();
                            let _ = crate::notify::prefs::upsert(conn, "_master", new_enabled, "{}");
                        };
                    };
                }
                "quit_app" => { app.exit(0); }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

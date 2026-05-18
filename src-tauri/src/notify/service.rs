use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use crate::notify::types::NotifEvent;

/// Astrazione iniettabile per i test.
pub trait NotificationSink: Send + Sync + 'static {
    fn send(&self, ev: &NotifEvent) -> Result<(), String>;
}

pub struct TauriSink {
    pub app: AppHandle,
}

impl NotificationSink for TauriSink {
    fn send(&self, ev: &NotifEvent) -> Result<(), String> {
        let mut b = self.app.notification().builder()
            .title(&ev.title)
            .body(&ev.body);
        if let Some(s) = &ev.sound {
            b = b.sound(s);
        }
        // Per le azioni cliccabili (with_actions=true) servirebbe registrare ActionTypeId nel
        // notification center di Windows via tauri_plugin_notification::register_action_types,
        // chiamato al setup() della app. Vedi notify::actions per i payload.
        b.show().map_err(|e| format!("notif: {e}"))
    }
}

#[cfg(test)]
pub struct VecSink {
    pub sent: std::sync::Mutex<Vec<NotifEvent>>,
}

#[cfg(test)]
impl VecSink {
    pub fn new() -> Self { Self { sent: std::sync::Mutex::new(vec![]) } }
}

#[cfg(test)]
impl NotificationSink for VecSink {
    fn send(&self, ev: &NotifEvent) -> Result<(), String> {
        self.sent.lock().unwrap().push(ev.clone());
        Ok(())
    }
}

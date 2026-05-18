use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotifKind {
    ExamImminent,
    ProjectStart,
    ProjectDeadline,
    StudyReminder,
    StudyMissed,
    StreakMilestone,
    QuickLogPrompt,
}

impl NotifKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ExamImminent     => "exam_imminent",
            Self::ProjectStart     => "project_start",
            Self::ProjectDeadline  => "project_deadline",
            Self::StudyReminder    => "study_reminder",
            Self::StudyMissed      => "study_missed",
            Self::StreakMilestone  => "streak_milestone",
            Self::QuickLogPrompt   => "quick_log_prompt",
        }
    }

    pub fn all() -> &'static [NotifKind] {
        &[
            Self::ExamImminent, Self::ProjectStart, Self::ProjectDeadline,
            Self::StudyReminder, Self::StudyMissed, Self::StreakMilestone,
            Self::QuickLogPrompt,
        ]
    }

    pub fn default_enabled(self) -> bool { true }
}

/// Una notifica concreta che lo scheduler deve inviare.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NotifEvent {
    pub kind: NotifKind,
    /// Chiave univoca per dedup (es. "exam_imminent:42:7:T-3")
    pub dedup_key: String,
    pub title: String,
    pub body: String,
    /// Solo per QuickLogPrompt: include azioni cliccabili.
    pub with_actions: bool,
    /// Se Some, percorso a file audio nel bundle (es. "streak.wav").
    pub sound: Option<String>,
}

/// Preferenze persistite. `config_json` è un blob libero per tipo.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NotifPref {
    pub enabled: bool,
    pub config_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct NotifPrefs {
    /// Chiave = NotifKind::as_str(). Anche pseudo-chiavi: "_master", "_autostart",
    /// "_minimize_to_tray", "_quicklog_hotkey".
    pub entries: HashMap<String, NotifPref>,
}

impl NotifPrefs {
    pub fn is_enabled(&self, kind: NotifKind) -> bool {
        self.entries.get(kind.as_str())
            .map(|p| p.enabled)
            .unwrap_or_else(|| kind.default_enabled())
    }

    pub fn master_enabled(&self) -> bool {
        self.entries.get("_master").map(|p| p.enabled).unwrap_or(false)
    }

    pub fn autostart_enabled(&self) -> bool {
        self.entries.get("_autostart").map(|p| p.enabled).unwrap_or(false)
    }

    pub fn minimize_to_tray(&self) -> bool {
        self.entries.get("_minimize_to_tray").map(|p| p.enabled).unwrap_or(true)
    }

    pub fn config<T: for<'de> Deserialize<'de>>(&self, kind: NotifKind) -> Option<T> {
        let raw = &self.entries.get(kind.as_str())?.config_json;
        serde_json::from_str(raw).ok()
    }

    pub fn config_raw(&self, kind_str: &str) -> Option<&str> {
        self.entries.get(kind_str).map(|p| p.config_json.as_str())
    }
}

// ---------- config payloads per i tipi che ne hanno ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExamImminentCfg {
    pub offsets: Vec<i64>, // giorni: es. [7, 3, 1, 0]; 0 = mattina dell'appello
    #[serde(default = "default_eight")]
    pub hour: u32,        // ora del giorno per T-7/T-3/T-1
    #[serde(default = "default_seven_thirty")]
    pub morning_hour: u32, // ora per T-0
    #[serde(default = "default_morning_min")]
    pub morning_minute: u32,
}
impl Default for ExamImminentCfg {
    fn default() -> Self {
        Self { offsets: vec![7,3,1,0], hour: 8, morning_hour: 7, morning_minute: 30 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDeadlineCfg {
    pub offsets: Vec<i64>, // [3, 1, 0]
    #[serde(default = "default_eight")]
    pub hour: u32,
}
impl Default for ProjectDeadlineCfg {
    fn default() -> Self { Self { offsets: vec![3,1,0], hour: 8 } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyReminderCfg {
    pub times: Vec<String>, // ["HH:MM", ...]
}
impl Default for StudyReminderCfg {
    fn default() -> Self { Self { times: vec!["18:00".into()] } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyMissedCfg {
    pub hour: u32,
    pub minute: u32,
    pub weekdays_only: bool,
}
impl Default for StudyMissedCfg {
    fn default() -> Self { Self { hour: 22, minute: 0, weekdays_only: true } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickLogPromptCfg {
    pub times: Vec<String>, // default vuoto
}
impl Default for QuickLogPromptCfg {
    fn default() -> Self { Self { times: vec![] } }
}

fn default_eight() -> u32 { 8 }
fn default_seven_thirty() -> u32 { 7 }
fn default_morning_min() -> u32 { 30 }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn master_default_off() {
        let p = NotifPrefs::default();
        assert!(!p.master_enabled());
        assert!(!p.autostart_enabled());
        assert!(p.minimize_to_tray()); // default ON
    }

    #[test]
    fn kind_default_on() {
        let p = NotifPrefs::default();
        for k in NotifKind::all() {
            assert!(p.is_enabled(*k), "kind {:?} should default ON", k);
        }
    }

    #[test]
    fn kind_str_roundtrip() {
        for k in NotifKind::all() {
            let s = k.as_str();
            assert!(!s.is_empty());
            assert!(s.chars().all(|c| c.is_ascii_lowercase() || c == '_'));
        }
    }

    #[test]
    fn config_parses_when_present() {
        let mut p = NotifPrefs::default();
        p.entries.insert("study_reminder".into(), NotifPref {
            enabled: true,
            config_json: r#"{"times":["09:00","19:00"]}"#.into(),
        });
        let cfg: StudyReminderCfg = p.config(NotifKind::StudyReminder).unwrap();
        assert_eq!(cfg.times, vec!["09:00".to_string(), "19:00".to_string()]);
    }
}

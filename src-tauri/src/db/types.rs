use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExamKind {
    Esame,
    Progetto,
}

impl ExamKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            ExamKind::Esame => "esame",
            ExamKind::Progetto => "progetto",
        }
    }
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "esame" => Ok(ExamKind::Esame),
            "progetto" => Ok(ExamKind::Progetto),
            other => Err(format!("kind sconosciuto: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appello {
    pub id: i64,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRange {
    pub id: i64,
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyDay {
    pub date: String,
    pub minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Exam {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub kind: ExamKind,
    pub passed: bool,
    pub default_study_minutes: i32,
    pub appelli: Vec<Appello>,
    pub ranges: Vec<ProjectRange>,
    pub study_days: Vec<StudyDay>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExamInput {
    pub name: String,
    pub color: String,
    pub kind: ExamKind,
    pub passed: bool,
    pub default_study_minutes: i32,
    pub appelli: Vec<String>,
    pub ranges: Vec<DateRange>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportReport {
    pub inserted: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

// ---------- Validation ----------

use once_cell::sync::Lazy;
use regex::Regex;
static COLOR_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^#[0-9A-Fa-f]{6}$").unwrap());
static DATE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap());

pub fn validate_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Il nome non può essere vuoto".into());
    }
    if trimmed.chars().count() > 200 {
        return Err("Il nome supera i 200 caratteri".into());
    }
    Ok(trimmed.to_string())
}

pub fn validate_color(color: &str) -> Result<(), String> {
    if !COLOR_RE.is_match(color) {
        return Err(format!("Colore non valido: {color} (atteso #RRGGBB)"));
    }
    Ok(())
}

pub fn validate_date(s: &str) -> Result<(), String> {
    if !DATE_RE.is_match(s) {
        return Err(format!("Data non valida: {s} (atteso YYYY-MM-DD)"));
    }
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| format!("Data non valida: {s} (atteso YYYY-MM-DD)"))
}

pub fn validate_range(r: &DateRange) -> Result<(), String> {
    validate_date(&r.start)?;
    validate_date(&r.end)?;
    if r.end < r.start {
        return Err(format!("end_date {} precede start_date {}", r.end, r.start));
    }
    Ok(())
}

pub fn validate_input(input: &ExamInput) -> Result<String, String> {
    let name = validate_name(&input.name)?;
    validate_color(&input.color)?;
    if input.default_study_minutes < 0 || input.default_study_minutes > 1440 {
        return Err(format!(
            "Tempo di studio predefinito non valido: {} (0..1440)",
            input.default_study_minutes
        ));
    }
    for d in &input.appelli {
        validate_date(d)?;
    }
    for r in &input.ranges {
        validate_range(r)?;
    }
    match input.kind {
        ExamKind::Esame => {
            if !input.ranges.is_empty() {
                return Err("Un esame non può avere ranges (sono solo per i progetti)".into());
            }
        }
        ExamKind::Progetto => {
            if !input.appelli.is_empty() {
                return Err("Un progetto non può avere appelli (sono solo per gli esami)".into());
            }
            if input.ranges.is_empty() {
                return Err("Un progetto richiede almeno un periodo".into());
            }
        }
    }
    Ok(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn name_empty_rejected() {
        assert!(validate_name("").is_err());
        assert!(validate_name("   ").is_err());
    }

    #[test]
    fn name_trimmed() {
        assert_eq!(validate_name("  hi  ").unwrap(), "hi");
    }

    #[test]
    fn color_format() {
        assert!(validate_color("#1A2B3C").is_ok());
        assert!(validate_color("#abcdef").is_ok());
        assert!(validate_color("1A2B3C").is_err());
        assert!(validate_color("#GG2B3C").is_err());
        assert!(validate_color("#123").is_err());
    }

    #[test]
    fn date_format() {
        assert!(validate_date("2026-05-16").is_ok());
        assert!(validate_date("2026-5-16").is_err());
        assert!(validate_date("16/05/2026").is_err());
    }

    #[test]
    fn range_end_before_start() {
        let r = DateRange { start: "2026-05-20".into(), end: "2026-05-10".into() };
        assert!(validate_range(&r).is_err());
    }

    #[test]
    fn esame_with_ranges_rejected() {
        let i = ExamInput {
            name: "x".into(),
            color: "#112233".into(),
            kind: ExamKind::Esame,
            passed: false,
            default_study_minutes: 60,
            appelli: vec![],
            ranges: vec![DateRange { start: "2026-01-01".into(), end: "2026-01-02".into() }],
        };
        assert!(validate_input(&i).is_err());
    }

    #[test]
    fn progetto_without_ranges_rejected() {
        let i = ExamInput {
            name: "x".into(),
            color: "#112233".into(),
            kind: ExamKind::Progetto,
            passed: false,
            default_study_minutes: 60,
            appelli: vec![],
            ranges: vec![],
        };
        assert!(validate_input(&i).is_err());
    }

    #[test]
    fn progetto_with_appelli_rejected() {
        let i = ExamInput {
            name: "x".into(),
            color: "#112233".into(),
            kind: ExamKind::Progetto,
            passed: false,
            default_study_minutes: 60,
            appelli: vec!["2026-01-01".into()],
            ranges: vec![DateRange { start: "2026-01-01".into(), end: "2026-01-02".into() }],
        };
        assert!(validate_input(&i).is_err());
    }

    #[test]
    fn default_study_minutes_out_of_range_rejected() {
        let mut i = ExamInput {
            name: "x".into(),
            color: "#112233".into(),
            kind: ExamKind::Esame,
            passed: false,
            default_study_minutes: -1,
            appelli: vec![],
            ranges: vec![],
        };
        assert!(validate_input(&i).is_err());

        i.default_study_minutes = 1441;
        assert!(validate_input(&i).is_err());

        i.default_study_minutes = 0;
        assert!(validate_input(&i).is_ok());

        i.default_study_minutes = 1440;
        assert!(validate_input(&i).is_ok());
    }
}

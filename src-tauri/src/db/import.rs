use rusqlite::Connection;
use serde::Deserialize;
use crate::db::types::*;
use crate::db::exams;

fn default_60() -> i32 { 60 }

#[derive(Deserialize)]
struct ArtifactRoot {
    exams: Vec<ArtifactExam>,
}

fn default_icon() -> String { "book-open".to_string() }

#[derive(Deserialize)]
struct ArtifactExam {
    name: String,
    color: String,
    #[serde(default = "default_icon")]
    icon: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    passed: bool,
    #[serde(rename = "defaultStudyMinutes", default = "default_60")]
    default_study_minutes: i32,
    #[serde(default)]
    appelli: Vec<ArtifactAppello>,
    #[serde(default)]
    ranges: Vec<ArtifactRange>,
    #[serde(rename = "studyDays", default)]
    study_days: Vec<String>,
}

#[derive(Deserialize)]
struct ArtifactAppello { date: String }

#[derive(Deserialize)]
struct ArtifactRange { start: String, end: Option<String> }

pub fn import_artifact_json(conn: &mut Connection, payload: &str) -> Result<ImportReport, String> {
    let root: ArtifactRoot = serde_json::from_str(payload)
        .map_err(|e| format!("JSON non parsabile: {e}"))?;
    let mut report = ImportReport { inserted: 0, skipped: 0, errors: vec![] };

    for ae in root.exams {
        let kind = match ExamKind::from_str(&ae.kind) {
            Ok(k) => k,
            Err(e) => { report.skipped += 1; report.errors.push(format!("{}: {e}", ae.name)); continue; }
        };

        if name_exists(conn, &ae.name)? {
            report.skipped += 1;
            report.errors.push(format!("'{}' già presente, saltato", ae.name));
            continue;
        }

        let ranges: Vec<DateRange> = ae.ranges.iter().map(|r| DateRange {
            start: r.start.clone(),
            end: r.end.clone().unwrap_or_else(|| r.start.clone()),
        }).collect();
        let appelli: Vec<String> = ae.appelli.iter().map(|a| a.date.clone()).collect();

        let base = EsameInputData {
            name: ae.name.clone(),
            color: ae.color.clone(),
            icon: ae.icon.clone(),
            passed: ae.passed,
            default_study_minutes: ae.default_study_minutes,
            appelli,
        };
        let input: ExamInput = match kind {
            ExamKind::Esame => {
                if !ranges.is_empty() {
                    report.skipped += 1;
                    report.errors.push(format!("'{}': type=esame con ranges, scartato", ae.name));
                    continue;
                }
                ExamInput::Esame(base)
            }
            ExamKind::Progetto => ExamInput::Progetto(ProgettoInputData {
                esame: base,
                ranges,
            }),
        };

        match exams::create(conn, &input) {
            Ok(exam) => {
                for d in &ae.study_days {
                    if let Err(e) = exams::toggle_study_day(conn, exam.id(), d) {
                        report.errors.push(format!("'{}': study day {d}: {e}", ae.name));
                    }
                }
                report.inserted += 1;
            }
            Err(e) => {
                report.skipped += 1;
                report.errors.push(format!("'{}': {e}", ae.name));
            }
        }
    }

    Ok(report)
}

fn name_exists(conn: &Connection, name: &str) -> Result<bool, String> {
    let n = conn.query_row(
        "SELECT 1 FROM exams WHERE name = ?1 COLLATE NOCASE",
        rusqlite::params![name],
        |_| Ok(true),
    );
    match n {
        Ok(_) => Ok(true),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
        Err(e) => Err(format!("check name: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    const PAYLOAD: &str = r##"{
        "exams": [
            { "name": "Neuro", "color": "#E8543F", "type": "esame", "passed": false,
              "appelli": [{"date":"2026-06-15"}], "ranges": [], "studyDays": ["2026-06-01"] },
            { "name": "Tesina", "color": "#27AE60", "type": "progetto", "passed": false,
              "appelli": [], "ranges": [{"start":"2026-05-01","end":"2026-05-15"}], "studyDays": [] },
            { "name": "BAD", "color": "not-a-color", "type": "esame", "appelli": [], "ranges": [], "studyDays": [] }
        ]
    }"##;

    #[test]
    fn import_inserts_two_skips_one() {
        let mut conn = open_in_memory().unwrap();
        let report = import_artifact_json(&mut conn, PAYLOAD).unwrap();
        assert_eq!(report.inserted, 2);
        assert_eq!(report.skipped, 1);
        let list = exams::list(&conn).unwrap();
        assert_eq!(list.len(), 2);
        let neuro = list.iter().find(|e| e.base().name == "Neuro").unwrap();
        assert_eq!(neuro.base().appelli.len(), 1);
        let sd = &neuro.base().study_days;
        assert_eq!(sd.len(), 1);
        assert_eq!(sd[0].date, "2026-06-01");
    }

    #[test]
    fn import_skips_duplicate_names() {
        let mut conn = open_in_memory().unwrap();
        import_artifact_json(&mut conn, PAYLOAD).unwrap();
        let report = import_artifact_json(&mut conn, PAYLOAD).unwrap();
        assert_eq!(report.inserted, 0);
        assert_eq!(report.skipped, 3);
    }

    #[test]
    fn import_rejects_invalid_json() {
        let mut conn = open_in_memory().unwrap();
        assert!(import_artifact_json(&mut conn, "not json").is_err());
    }
}

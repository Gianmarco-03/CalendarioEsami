//! Logica progetto-specifica: espansione dei range in giorni unici e helper di conteggio.

use chrono::NaiveDate;
use crate::db::types::ProgettoData;

/// Espande tutti i range di un Progetto in YYYY-MM-DD unici (deduplicati,
/// ordinati ascending).
pub fn expand_ranges(p: &ProgettoData) -> Vec<String> {
    let mut seen = std::collections::BTreeSet::new();
    for r in &p.ranges {
        let start = match NaiveDate::parse_from_str(&r.start, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };
        let end = match NaiveDate::parse_from_str(&r.end, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };
        let mut d = start;
        while d <= end {
            seen.insert(d.format("%Y-%m-%d").to_string());
            d = match d.succ_opt() { Some(n) => n, None => break };
        }
    }
    seen.into_iter().collect()
}

/// Numero di giorni unici coperti dai range del progetto.
pub fn total_range_days(p: &ProgettoData) -> usize {
    expand_ranges(p).len()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::types::{EsameData, ProjectRange};

    fn make(ranges: Vec<(&str, &str)>) -> ProgettoData {
        ProgettoData {
            esame: EsameData {
                id: 1,
                name: "X".into(),
                color: "#000000".into(),
                icon: "book-open".into(),
                passed: false,
                default_study_minutes: 60,
                appelli: vec![],
                study_days: vec![],
            },
            ranges: ranges.into_iter().enumerate().map(|(i, (s, e))| ProjectRange {
                id: i as i64,
                start: s.into(),
                end: e.into(),
            }).collect(),
        }
    }

    #[test]
    fn expand_empty() {
        let p = make(vec![]);
        assert_eq!(expand_ranges(&p), Vec::<String>::new());
    }

    #[test]
    fn expand_single_range() {
        let p = make(vec![("2026-05-01", "2026-05-03")]);
        assert_eq!(
            expand_ranges(&p),
            vec!["2026-05-01", "2026-05-02", "2026-05-03"]
        );
    }

    #[test]
    fn expand_multiple_overlap_dedups() {
        let p = make(vec![
            ("2026-05-01", "2026-05-05"),
            ("2026-05-03", "2026-05-07"),
        ]);
        assert_eq!(
            expand_ranges(&p),
            vec![
                "2026-05-01", "2026-05-02", "2026-05-03",
                "2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07",
            ]
        );
        assert_eq!(total_range_days(&p), 7);
    }
}

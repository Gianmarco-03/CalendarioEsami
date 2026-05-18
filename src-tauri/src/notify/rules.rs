use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, TimeZone, Timelike};
use crate::db::types::Exam;
use crate::notify::types::*;

/// Helper: parse "YYYY-MM-DD" → NaiveDate. None se invalido.
fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

/// Helper: data del momento "now".
fn today(now: DateTime<Local>) -> NaiveDate { now.date_naive() }

/// Helper: scattante una notifica al `target_time` se `now >= target_time` e siamo nello stesso giorno
/// (così evitiamo che notifiche pianificate per oggi 08:00 partano alle 23:59 di ieri o domani).
fn time_due_today(now: DateTime<Local>, hour: u32, minute: u32) -> bool {
    let target = Local.with_ymd_and_hms(now.year(), now.month(), now.day(), hour, minute, 0)
        .single();
    match target {
        Some(t) => now >= t,
        None => false,
    }
}

/// Notifiche di tipo "esame imminente": per ogni appello attivo, per ogni offset configurato.
pub fn rule_exam_imminent(
    now: DateTime<Local>,
    cfg: &ExamImminentCfg,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    let today = today(now);
    let mut out = Vec::new();
    for exam in exams.iter().filter(|e| !e.base().passed) {
        for ap in &exam.base().appelli {
            let Some(d) = parse_date(&ap.date) else { continue };
            for offset in &cfg.offsets {
                let target = d - Duration::days(*offset);
                if target != today { continue; }
                let due = if *offset == 0 {
                    time_due_today(now, cfg.morning_hour, cfg.morning_minute)
                } else {
                    time_due_today(now, cfg.hour, 0)
                };
                if !due { continue; }
                let label = if *offset == 0 { "T-0".into() } else { format!("T-{}", offset) };
                let body = if *offset == 0 {
                    format!("Oggi è il giorno dell'appello di {}.", exam.base().name)
                } else if *offset == 1 {
                    format!("Domani appello di {}.", exam.base().name)
                } else {
                    format!("Fra {} giorni appello di {}.", offset, exam.base().name)
                };
                out.push(NotifEvent {
                    kind: NotifKind::ExamImminent,
                    dedup_key: format!("exam_imminent:{}:{}:{}", exam.base().id, ap.id, label),
                    title: "Esame imminente".into(),
                    body,
                    with_actions: false,
                    sound: None,
                });
            }
        }
    }
    out
}

pub fn rule_project_start(
    now: DateTime<Local>,
    cfg: &ProjectDeadlineCfg, // riusa solo `hour`
    exams: &[Exam],
) -> Vec<NotifEvent> {
    let today = today(now);
    if !time_due_today(now, cfg.hour, 0) { return vec![]; }
    let mut out = Vec::new();
    for exam in exams.iter().filter(|e| !e.base().passed) {
        for r in exam.ranges() {
            let Some(start) = parse_date(&r.start) else { continue };
            if start != today { continue; }
            out.push(NotifEvent {
                kind: NotifKind::ProjectStart,
                dedup_key: format!("project_start:{}:{}", exam.base().id, r.id),
                title: "Progetto iniziato".into(),
                body: format!("Inizia oggi il periodo per {}.", exam.base().name),
                with_actions: false,
                sound: None,
            });
        }
    }
    out
}

pub fn rule_project_deadline(
    now: DateTime<Local>,
    cfg: &ProjectDeadlineCfg,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    let today = today(now);
    if !time_due_today(now, cfg.hour, 0) { return vec![]; }
    let mut out = Vec::new();
    for exam in exams.iter().filter(|e| !e.base().passed) {
        let ranges = exam.ranges();
        let Some(last) = ranges.last() else { continue };
        let Some(end) = parse_date(&last.end) else { continue };
        for offset in &cfg.offsets {
            let target = end - Duration::days(*offset);
            if target != today { continue; }
            let label = if *offset == 0 { "T-0".into() } else { format!("T-{}", offset) };
            let body = if *offset == 0 {
                format!("Consegna oggi: {}.", exam.base().name)
            } else if *offset == 1 {
                format!("Domani scade {}.", exam.base().name)
            } else {
                format!("Fra {} giorni scade {}.", offset, exam.base().name)
            };
            out.push(NotifEvent {
                kind: NotifKind::ProjectDeadline,
                dedup_key: format!("project_deadline:{}:{}:{}", exam.base().id, last.id, label),
                title: "Deadline progetto".into(),
                body,
                with_actions: false,
                sound: None,
            });
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::types::*;

    fn dt(y: i32, m: u32, d: u32, h: u32, mi: u32) -> DateTime<Local> {
        Local.with_ymd_and_hms(y, m, d, h, mi, 0).unwrap()
    }

    fn esame_with_appello(id: i64, ap_id: i64, name: &str, ap_date: &str) -> Exam {
        Exam::Esame(EsameData {
            id, name: name.into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![Appello { id: ap_id, date: ap_date.into() }],
            study_days: vec![],
        })
    }

    fn progetto(id: i64, range_id: i64, name: &str, start: &str, end: &str) -> Exam {
        Exam::Progetto(ProgettoData {
            esame: EsameData {
                id, name: name.into(), color: "#112233".into(), icon: "book-open".into(),
                passed: false, default_study_minutes: 60,
                appelli: vec![], study_days: vec![],
            },
            ranges: vec![ProjectRange { id: range_id, start: start.into(), end: end.into() }],
        })
    }

    #[test]
    fn exam_imminent_fires_at_t_minus_3_at_08() {
        let now = dt(2026, 5, 18, 8, 0);
        let cfg = ExamImminentCfg::default();
        let exams = vec![esame_with_appello(1, 7, "Neuro", "2026-05-21")];
        let evs = rule_exam_imminent(now, &cfg, &exams);
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].dedup_key, "exam_imminent:1:7:T-3");
    }

    #[test]
    fn exam_imminent_silent_before_08() {
        let now = dt(2026, 5, 18, 7, 59);
        let cfg = ExamImminentCfg::default();
        let exams = vec![esame_with_appello(1, 7, "Neuro", "2026-05-21")];
        assert!(rule_exam_imminent(now, &cfg, &exams).is_empty());
    }

    #[test]
    fn exam_imminent_t_zero_uses_morning_time() {
        let now = dt(2026, 5, 18, 7, 30);
        let cfg = ExamImminentCfg::default();
        let exams = vec![esame_with_appello(1, 7, "Neuro", "2026-05-18")];
        let evs = rule_exam_imminent(now, &cfg, &exams);
        assert_eq!(evs.len(), 1);
        assert!(evs[0].dedup_key.ends_with(":T-0"));
    }

    #[test]
    fn exam_imminent_skips_passed() {
        let now = dt(2026, 5, 18, 8, 0);
        let cfg = ExamImminentCfg::default();
        let mut e = esame_with_appello(1, 7, "Neuro", "2026-05-21");
        if let Exam::Esame(ref mut b) = e { b.passed = true; }
        assert!(rule_exam_imminent(now, &cfg, &[e]).is_empty());
    }

    #[test]
    fn project_start_fires_on_start_date() {
        let now = dt(2026, 5, 18, 8, 0);
        let cfg = ProjectDeadlineCfg::default();
        let p = progetto(2, 9, "Tesi", "2026-05-18", "2026-06-10");
        let evs = rule_project_start(now, &cfg, &[p]);
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].dedup_key, "project_start:2:9");
    }

    #[test]
    fn project_deadline_fires_at_t_minus_1() {
        let now = dt(2026, 5, 18, 8, 0);
        let cfg = ProjectDeadlineCfg::default();
        let p = progetto(2, 9, "Tesi", "2026-05-01", "2026-05-19");
        let evs = rule_project_deadline(now, &cfg, &[p]);
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].dedup_key, "project_deadline:2:9:T-1");
    }

    #[test]
    fn project_deadline_only_last_range() {
        let now = dt(2026, 5, 18, 8, 0);
        let cfg = ProjectDeadlineCfg::default();
        let p = Exam::Progetto(ProgettoData {
            esame: EsameData {
                id: 2, name: "Tesi".into(), color: "#112233".into(), icon: "book-open".into(),
                passed: false, default_study_minutes: 60,
                appelli: vec![], study_days: vec![],
            },
            ranges: vec![
                ProjectRange { id: 9,  start: "2026-04-01".into(), end: "2026-05-18".into() }, // oggi
                ProjectRange { id: 10, start: "2026-05-25".into(), end: "2026-06-10".into() }, // futuro = last
            ],
        });
        let evs = rule_project_deadline(now, &cfg, &[p]);
        // last range termina 2026-06-10 → oggi (2026-05-18) non è T-3/T-1/T-0 → nessuna notifica
        assert!(evs.is_empty());
    }
}

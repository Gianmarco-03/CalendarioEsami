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

fn parse_hhmm(s: &str) -> Option<(u32, u32)> {
    let mut it = s.split(':');
    let h: u32 = it.next()?.parse().ok()?;
    let m: u32 = it.next()?.parse().ok()?;
    if h < 24 && m < 60 { Some((h, m)) } else { None }
}

fn total_minutes_today(exams: &[Exam], today: NaiveDate) -> i64 {
    let today_s = today.format("%Y-%m-%d").to_string();
    let mut tot: i64 = 0;
    for e in exams.iter().filter(|e| !e.base().passed) {
        for sd in &e.base().study_days {
            if sd.date == today_s {
                tot += sd.minutes.unwrap_or(0) as i64;
            }
        }
    }
    tot
}

fn any_active_exams(exams: &[Exam]) -> bool {
    exams.iter().any(|e| !e.base().passed)
}

pub fn rule_study_reminder(
    now: DateTime<Local>,
    cfg: &StudyReminderCfg,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    if !any_active_exams(exams) { return vec![]; }
    let today = today(now);
    if total_minutes_today(exams, today) > 0 { return vec![]; }
    let mut out = Vec::new();
    for t in &cfg.times {
        let Some((h, m)) = parse_hhmm(t) else { continue };
        if !time_due_today(now, h, m) { continue; }
        out.push(NotifEvent {
            kind: NotifKind::StudyReminder,
            dedup_key: format!("study_reminder:{}:{}", today.format("%Y-%m-%d"), t),
            title: "Promemoria studio".into(),
            body: "Non hai ancora registrato studio per oggi.".into(),
            with_actions: false,
            sound: None,
        });
    }
    out
}

pub fn rule_study_missed(
    now: DateTime<Local>,
    cfg: &StudyMissedCfg,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    if !any_active_exams(exams) { return vec![]; }
    let today = today(now);
    if cfg.weekdays_only {
        // chrono: Mon=1, Sun=7
        let wd = today.weekday().number_from_monday();
        if wd > 5 { return vec![]; }
    }
    if !time_due_today(now, cfg.hour, cfg.minute) { return vec![]; }
    if total_minutes_today(exams, today) > 0 { return vec![]; }
    vec![NotifEvent {
        kind: NotifKind::StudyMissed,
        dedup_key: format!("study_missed:{}", today.format("%Y-%m-%d")),
        title: "Giornata senza studio".into(),
        body: "Oggi non hai registrato minuti su nessun esame attivo.".into(),
        with_actions: false,
        sound: None,
    }]
}

/// Calcola lo streak corrente (giorni consecutivi con almeno 1 minuto su qualunque esame attivo)
/// fino a `today` incluso, con un look-back massimo di 200 giorni.
fn current_streak(exams: &[Exam], today: NaiveDate) -> i64 {
    let mut day = today;
    let mut count: i64 = 0;
    for _ in 0..200 {
        let day_s = day.format("%Y-%m-%d").to_string();
        let any: bool = exams.iter().filter(|e| !e.base().passed).any(|e| {
            e.base().study_days.iter().any(|sd| sd.date == day_s && sd.minutes.unwrap_or(0) > 0)
        });
        if any {
            count += 1;
            day = day.pred_opt().unwrap_or(day);
        } else {
            break;
        }
    }
    count
}

pub fn rule_streak_milestone(
    now: DateTime<Local>,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    const MILESTONES: &[i64] = &[7, 14, 30, 60, 100];
    let streak = current_streak(exams, today(now));
    if !MILESTONES.contains(&streak) { return vec![]; }
    // Fire solo se siamo dopo le 09:00 (evita disturbo a mezzanotte se l'utente aggiorna in piena notte)
    if !time_due_today(now, 9, 0) { return vec![]; }
    vec![NotifEvent {
        kind: NotifKind::StreakMilestone,
        dedup_key: format!("streak_milestone:{}", streak),
        title: format!("{} giorni di streak!", streak),
        body: format!("Hai studiato {} giorni di fila. Continua così.", streak),
        with_actions: false,
        sound: Some("streak.wav".into()),
    }]
}

pub fn rule_quick_log_prompt(
    now: DateTime<Local>,
    cfg: &QuickLogPromptCfg,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    if !any_active_exams(exams) { return vec![]; }
    let today = today(now);
    let mut out = Vec::new();
    for t in &cfg.times {
        let Some((h, m)) = parse_hhmm(t) else { continue };
        if !time_due_today(now, h, m) { continue; }
        out.push(NotifEvent {
            kind: NotifKind::QuickLogPrompt,
            dedup_key: format!("quick_log_prompt:{}:{}", today.format("%Y-%m-%d"), t),
            title: "Quanto hai studiato?".into(),
            body: "Tocca un bottone per registrare i minuti.".into(),
            with_actions: true,
            sound: None,
        });
    }
    out
}

/// Entry point unico: applica tutte le rules in base alle prefs.
pub fn compute_due(
    now: DateTime<Local>,
    prefs: &NotifPrefs,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    if !prefs.master_enabled() { return vec![]; }
    let mut out = Vec::new();
    if prefs.is_enabled(NotifKind::ExamImminent) {
        let cfg: ExamImminentCfg = prefs.config(NotifKind::ExamImminent).unwrap_or_default();
        out.extend(rule_exam_imminent(now, &cfg, exams));
    }
    if prefs.is_enabled(NotifKind::ProjectStart) {
        let cfg: ProjectDeadlineCfg = prefs.config(NotifKind::ProjectStart).unwrap_or_default();
        out.extend(rule_project_start(now, &cfg, exams));
    }
    if prefs.is_enabled(NotifKind::ProjectDeadline) {
        let cfg: ProjectDeadlineCfg = prefs.config(NotifKind::ProjectDeadline).unwrap_or_default();
        out.extend(rule_project_deadline(now, &cfg, exams));
    }
    if prefs.is_enabled(NotifKind::StudyReminder) {
        let cfg: StudyReminderCfg = prefs.config(NotifKind::StudyReminder).unwrap_or_default();
        out.extend(rule_study_reminder(now, &cfg, exams));
    }
    if prefs.is_enabled(NotifKind::StudyMissed) {
        let cfg: StudyMissedCfg = prefs.config(NotifKind::StudyMissed).unwrap_or_default();
        out.extend(rule_study_missed(now, &cfg, exams));
    }
    if prefs.is_enabled(NotifKind::StreakMilestone) {
        out.extend(rule_streak_milestone(now, exams));
    }
    if prefs.is_enabled(NotifKind::QuickLogPrompt) {
        let cfg: QuickLogPromptCfg = prefs.config(NotifKind::QuickLogPrompt).unwrap_or_default();
        out.extend(rule_quick_log_prompt(now, &cfg, exams));
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

    fn esame_with_studyday(id: i64, name: &str, date: &str, minutes: Option<i32>) -> Exam {
        Exam::Esame(EsameData {
            id, name: name.into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![],
            study_days: vec![StudyDay { date: date.into(), minutes }],
        })
    }

    #[test]
    fn study_reminder_fires_when_no_minutes_today() {
        let now = dt(2026, 5, 18, 18, 0);
        let cfg = StudyReminderCfg::default();
        let e = Exam::Esame(EsameData {
            id: 1, name: "X".into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![], study_days: vec![],
        });
        let evs = rule_study_reminder(now, &cfg, &[e]);
        assert_eq!(evs.len(), 1);
    }

    #[test]
    fn study_reminder_silent_when_studied() {
        let now = dt(2026, 5, 18, 18, 0);
        let cfg = StudyReminderCfg::default();
        let e = esame_with_studyday(1, "X", "2026-05-18", Some(30));
        assert!(rule_study_reminder(now, &cfg, &[e]).is_empty());
    }

    #[test]
    fn study_missed_fires_weekday_evening() {
        // 2026-05-18 è un lunedì
        let now = dt(2026, 5, 18, 22, 0);
        let cfg = StudyMissedCfg::default();
        let e = Exam::Esame(EsameData {
            id: 1, name: "X".into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![], study_days: vec![],
        });
        let evs = rule_study_missed(now, &cfg, &[e]);
        assert_eq!(evs.len(), 1);
    }

    #[test]
    fn study_missed_silent_weekend() {
        // 2026-05-23 è un sabato
        let now = dt(2026, 5, 23, 22, 0);
        let cfg = StudyMissedCfg::default();
        let e = Exam::Esame(EsameData {
            id: 1, name: "X".into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![], study_days: vec![],
        });
        assert!(rule_study_missed(now, &cfg, &[e]).is_empty());
    }

    #[test]
    fn streak_milestone_at_7() {
        let now = dt(2026, 5, 18, 10, 0);
        // 7 giorni consecutivi fino a oggi
        let mut sd = Vec::new();
        for off in 0..7 {
            let d = NaiveDate::from_ymd_opt(2026, 5, 18).unwrap() - Duration::days(off);
            sd.push(StudyDay { date: d.format("%Y-%m-%d").to_string(), minutes: Some(30) });
        }
        let e = Exam::Esame(EsameData {
            id: 1, name: "X".into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![], study_days: sd,
        });
        let evs = rule_streak_milestone(now, &[e]);
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].dedup_key, "streak_milestone:7");
    }

    #[test]
    fn streak_not_at_milestone_silent() {
        let now = dt(2026, 5, 18, 10, 0);
        let mut sd = Vec::new();
        for off in 0..5 {
            let d = NaiveDate::from_ymd_opt(2026, 5, 18).unwrap() - Duration::days(off);
            sd.push(StudyDay { date: d.format("%Y-%m-%d").to_string(), minutes: Some(30) });
        }
        let e = Exam::Esame(EsameData {
            id: 1, name: "X".into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![], study_days: sd,
        });
        assert!(rule_streak_milestone(now, &[e]).is_empty());
    }

    #[test]
    fn compute_due_respects_master_off() {
        let now = dt(2026, 5, 18, 8, 0);
        let prefs = NotifPrefs::default(); // master OFF
        let exams = vec![esame_with_appello(1, 7, "Neuro", "2026-05-21")];
        assert!(compute_due(now, &prefs, &exams).is_empty());
    }

    #[test]
    fn compute_due_runs_when_master_on() {
        let now = dt(2026, 5, 18, 8, 0);
        let mut prefs = NotifPrefs::default();
        prefs.entries.insert("_master".into(), NotifPref { enabled: true, config_json: "{}".into() });
        let exams = vec![esame_with_appello(1, 7, "Neuro", "2026-05-21")];
        let evs = compute_due(now, &prefs, &exams);
        assert!(evs.iter().any(|e| e.kind == NotifKind::ExamImminent));
    }
}

use serde::{Deserialize, Serialize};
use crate::db::types::validate_date;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskPriority {
    Low,
    Normal,
    High,
    Urgent,
}

impl TaskPriority {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaskPriority::Low => "low",
            TaskPriority::Normal => "normal",
            TaskPriority::High => "high",
            TaskPriority::Urgent => "urgent",
        }
    }
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "low" => Ok(TaskPriority::Low),
            "normal" => Ok(TaskPriority::Normal),
            "high" => Ok(TaskPriority::High),
            "urgent" => Ok(TaskPriority::Urgent),
            other => Err(format!("priority sconosciuta: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecklistItem {
    pub id: i64,
    pub label: String,
    pub done: bool,
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub exam_id: Option<i64>,
    pub priority: TaskPriority,
    pub due_date: Option<String>,
    pub done: bool,
    pub checklist: Vec<ChecklistItem>,
    pub predecessor_ids: Vec<i64>,
    pub successor_ids: Vec<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistItemInput {
    pub label: String,
    pub done: bool,
    pub position: i32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub title: String,
    pub description: String,
    pub exam_id: Option<i64>,
    pub priority: TaskPriority,
    pub due_date: Option<String>,
    pub checklist: Vec<ChecklistItemInput>,
}

pub fn validate_task_input(input: &TaskInput) -> Result<String, String> {
    let trimmed = input.title.trim();
    if trimmed.is_empty() {
        return Err("Il titolo non può essere vuoto".into());
    }
    if trimmed.chars().count() > 200 {
        return Err("Il titolo supera i 200 caratteri".into());
    }
    if let Some(d) = &input.due_date {
        validate_date(d)?;
    }
    for (i, item) in input.checklist.iter().enumerate() {
        if item.label.trim().is_empty() {
            return Err(format!("Checklist item {i}: label vuota"));
        }
    }
    Ok(trimmed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_input() -> TaskInput {
        TaskInput {
            title: "Scrivere capitolo 2".into(),
            description: "Bozza per relatore".into(),
            exam_id: None,
            priority: TaskPriority::Normal,
            due_date: None,
            checklist: vec![],
        }
    }

    #[test]
    fn empty_title_rejected() {
        let mut i = sample_input();
        i.title = "   ".into();
        assert!(validate_task_input(&i).is_err());
    }

    #[test]
    fn long_title_rejected() {
        let mut i = sample_input();
        i.title = "x".repeat(201);
        assert!(validate_task_input(&i).is_err());
    }

    #[test]
    fn title_trimmed() {
        let mut i = sample_input();
        i.title = "  hi  ".into();
        assert_eq!(validate_task_input(&i).unwrap(), "hi");
    }

    #[test]
    fn invalid_due_date_rejected() {
        let mut i = sample_input();
        i.due_date = Some("2026-5-1".into());
        assert!(validate_task_input(&i).is_err());
    }

    #[test]
    fn empty_checklist_label_rejected() {
        let mut i = sample_input();
        i.checklist.push(ChecklistItemInput { label: "  ".into(), done: false, position: 0 });
        assert!(validate_task_input(&i).is_err());
    }

    #[test]
    fn priority_roundtrip() {
        for p in ["low","normal","high","urgent"] {
            let parsed = TaskPriority::from_str(p).unwrap();
            assert_eq!(parsed.as_str(), p);
        }
        assert!(TaskPriority::from_str("foo").is_err());
    }
}

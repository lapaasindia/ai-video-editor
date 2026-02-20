use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;

fn workspace_root() -> Result<PathBuf, String> {
    let current =
        std::env::current_dir().map_err(|error| format!("Cannot resolve current_dir: {error}"))?;
    Ok(current)
}

fn node_binary() -> String {
    std::env::var("NODE_BIN").unwrap_or_else(|_| "node".to_string())
}

fn run_node_script(script_path: &Path, args: &[String]) -> Result<String, String> {
    let root = workspace_root()?;
    let mut command = Command::new(node_binary());
    command.current_dir(&root).arg(script_path);
    for arg in args {
        command.arg(arg);
    }

    let output = command
        .output()
        .map_err(|error| format!("Failed to execute script {:?}: {error}", script_path))?;

    if output.status.success() {
        let stdout = String::from_utf8(output.stdout)
            .map_err(|error| format!("Invalid UTF-8 stdout: {error}"))?;
        Ok(stdout.trim().to_string())
    } else {
        let stderr =
            String::from_utf8(output.stderr).unwrap_or_else(|_| "Unknown script error".to_string());
        Err(stderr.trim().to_string())
    }
}

fn script_path(relative: &str) -> Result<PathBuf, String> {
    let root = workspace_root()?;
    Ok(root.join(relative))
}

fn projects_file_path() -> Result<PathBuf, String> {
    let root = workspace_root()?;
    Ok(root.join("desktop").join("data").join("projects.json"))
}

fn timeline_file_path(project_id: &str) -> Result<PathBuf, String> {
    let root = workspace_root()?;
    Ok(root
        .join("desktop")
        .join("data")
        .join(project_id)
        .join("timeline.json"))
}

fn render_history_file_path(project_id: &str) -> Result<PathBuf, String> {
    let root = workspace_root()?;
    Ok(root
        .join("desktop")
        .join("data")
        .join(project_id)
        .join("renders")
        .join("history.json"))
}

fn telemetry_summary_file_path(project_id: &str) -> Result<PathBuf, String> {
    let root = workspace_root()?;
    Ok(root
        .join("desktop")
        .join("data")
        .join(project_id)
        .join("telemetry")
        .join("summary.json"))
}

fn telemetry_events_file_path(project_id: &str) -> Result<PathBuf, String> {
    let root = workspace_root()?;
    Ok(root
        .join("desktop")
        .join("data")
        .join(project_id)
        .join("telemetry")
        .join("events.jsonl"))
}

fn ensure_projects_store() -> Result<PathBuf, String> {
    let file_path = projects_file_path()?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Failed creating data dir: {error}"))?;
    }
    if !file_path.exists() {
        fs::write(&file_path, "[]\n")
            .map_err(|error| format!("Failed creating projects store: {error}"))?;
    }
    Ok(file_path)
}

fn ensure_timeline_store(project_id: &str) -> Result<PathBuf, String> {
    let file_path = timeline_file_path(project_id)?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed creating timeline dir: {error}"))?;
    }
    Ok(file_path)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSettings {
    aspect_ratio: String,
    fps: u32,
    resolution: String,
    language: String,
    ai_mode: String,
    fallback_policy: Option<String>,
    transcription_model: Option<String>,
    cut_planner_model: Option<String>,
    template_planner_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Project {
    id: String,
    name: String,
    settings: ProjectSettings,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateProjectRequest {
    name: String,
    settings: ProjectSettings,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProjectSettingsRequest {
    project_id: String,
    settings: ProjectSettings,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaIngestRequest {
    project_id: String,
    input: String,
    generate_proxy: Option<bool>,
    generate_waveform: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimeRange {
    start_us: u64,
    end_us: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimelineTrack {
    id: String,
    name: String,
    kind: String,
    order: u32,
    locked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimelineClip {
    clip_id: String,
    track_id: String,
    clip_type: String,
    start_us: u64,
    end_us: u64,
    source_start_us: u64,
    source_end_us: u64,
    source_ref: String,
    effects: Value,
    transform: Value,
    meta: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Timeline {
    id: String,
    project_id: String,
    version: u32,
    status: String,
    fps: u32,
    duration_us: u64,
    created_at: String,
    updated_at: String,
    tracks: Vec<TimelineTrack>,
    clips: Vec<TimelineClip>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateRoughCutTimelineRequest {
    project_id: String,
    duration_us: u64,
    fps: u32,
    source_ref: Option<String>,
    remove_ranges: Option<Vec<TimeRange>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetTimelineRequest {
    project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetRenderHistoryRequest {
    project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetProjectTelemetryRequest {
    project_id: String,
    limit: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveTimelineRequest {
    timeline: Timeline,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartEditingRequest {
    project_id: String,
    input: String,
    mode: Option<String>,
    language: Option<String>,
    fps: Option<u32>,
    source_ref: Option<String>,
    fallback_policy: Option<String>,
    transcription_model: Option<String>,
    cut_planner_model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EditNowRequest {
    project_id: String,
    fps: Option<u32>,
    source_ref: Option<String>,
    fetch_external: Option<bool>,
    fallback_policy: Option<String>,
    template_planner_model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenderVideoRequest {
    project_id: String,
    output_name: Option<String>,
    burn_subtitles: Option<bool>,
    quality: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenPathRequest {
    path: String,
    reveal: Option<bool>,
}

fn now_iso() -> String {
    let epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{epoch}")
}

fn generate_project_id() -> String {
    let micros = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros();
    format!("proj-{micros}")
}

fn read_projects() -> Result<Vec<Project>, String> {
    let file_path = ensure_projects_store()?;
    let raw = fs::read_to_string(&file_path)
        .map_err(|error| format!("Failed reading projects store: {error}"))?;
    serde_json::from_str::<Vec<Project>>(&raw)
        .map_err(|error| format!("Invalid projects JSON: {error}"))
}

fn write_projects(projects: &[Project]) -> Result<(), String> {
    let file_path = ensure_projects_store()?;
    let serialized = serde_json::to_string_pretty(projects)
        .map_err(|error| format!("Serialize error: {error}"))?;
    fs::write(&file_path, format!("{serialized}\n"))
        .map_err(|error| format!("Failed writing projects store: {error}"))
}

fn update_project_status(project_id: &str, status: &str) -> Result<(), String> {
    let mut projects = read_projects()?;
    let mut found = false;
    let now = now_iso();
    for project in &mut projects {
        if project.id == project_id {
            project.status = status.to_string();
            project.updated_at = now.clone();
            found = true;
            break;
        }
    }
    if !found {
        return Err("Project not found.".to_string());
    }
    write_projects(&projects)
}

fn read_timeline(project_id: &str) -> Result<Timeline, String> {
    let file_path = timeline_file_path(project_id)?;
    if !file_path.exists() {
        return Err("Timeline not found.".to_string());
    }
    let raw = fs::read_to_string(&file_path)
        .map_err(|error| format!("Failed reading timeline file: {error}"))?;
    serde_json::from_str::<Timeline>(&raw)
        .map_err(|error| format!("Invalid timeline JSON: {error}"))
}

fn write_timeline(timeline: &Timeline) -> Result<(), String> {
    let file_path = ensure_timeline_store(&timeline.project_id)?;
    let serialized = serde_json::to_string_pretty(timeline)
        .map_err(|error| format!("Timeline serialize error: {error}"))?;
    fs::write(&file_path, format!("{serialized}\n"))
        .map_err(|error| format!("Failed writing timeline file: {error}"))
}

fn normalize_ranges(ranges: Vec<TimeRange>, duration_us: u64) -> Vec<TimeRange> {
    let mut normalized = ranges
        .into_iter()
        .map(|range| TimeRange {
            start_us: range.start_us.min(duration_us),
            end_us: range.end_us.min(duration_us),
        })
        .filter(|range| range.end_us > range.start_us)
        .collect::<Vec<_>>();

    normalized.sort_by_key(|range| range.start_us);
    let mut merged: Vec<TimeRange> = Vec::new();

    for range in normalized {
        if let Some(last) = merged.last_mut() {
            if range.start_us <= last.end_us {
                if range.end_us > last.end_us {
                    last.end_us = range.end_us;
                }
                continue;
            }
        }
        merged.push(range);
    }

    merged
}

fn invert_ranges(remove_ranges: &[TimeRange], duration_us: u64) -> Vec<TimeRange> {
    if duration_us == 0 {
        return Vec::new();
    }

    let mut keep_ranges = Vec::new();
    let mut cursor = 0_u64;

    for range in remove_ranges {
        if range.start_us > cursor {
            keep_ranges.push(TimeRange {
                start_us: cursor,
                end_us: range.start_us,
            });
        }
        cursor = range.end_us.max(cursor);
    }

    if cursor < duration_us {
        keep_ranges.push(TimeRange {
            start_us: cursor,
            end_us: duration_us,
        });
    }

    keep_ranges
}

fn build_rough_cut_timeline(
    project_id: String,
    duration_us: u64,
    fps: u32,
    source_ref: String,
    remove_ranges: Vec<TimeRange>,
) -> Timeline {
    let remove_ranges = normalize_ranges(remove_ranges, duration_us);
    let keep_ranges = invert_ranges(&remove_ranges, duration_us);

    let video_track = TimelineTrack {
        id: "track-video-main".to_string(),
        name: "Main Video".to_string(),
        kind: "video".to_string(),
        order: 0,
        locked: false,
    };
    let captions_track = TimelineTrack {
        id: "track-captions".to_string(),
        name: "Captions".to_string(),
        kind: "caption".to_string(),
        order: 1,
        locked: false,
    };

    let mut clips = Vec::new();
    let mut timeline_cursor = 0_u64;

    for (index, keep) in keep_ranges.iter().enumerate() {
        let clip_duration = keep.end_us - keep.start_us;
        let timeline_start = timeline_cursor;
        let timeline_end = timeline_start + clip_duration;

        clips.push(TimelineClip {
            clip_id: format!("clip-{}", index + 1),
            track_id: video_track.id.clone(),
            clip_type: "source_clip".to_string(),
            start_us: timeline_start,
            end_us: timeline_end,
            source_start_us: keep.start_us,
            source_end_us: keep.end_us,
            source_ref: source_ref.clone(),
            effects: serde_json::json!({}),
            transform: serde_json::json!({}),
            meta: serde_json::json!({
                "generatedBy": "ai-rough-cut",
                "removeRangesApplied": remove_ranges
            }),
        });

        timeline_cursor = timeline_end;
    }

    let now = now_iso();
    Timeline {
        id: format!("timeline-{}", generate_project_id()),
        project_id,
        version: 1,
        status: "ROUGH_CUT_READY".to_string(),
        fps: fps.max(1),
        duration_us: timeline_cursor,
        created_at: now.clone(),
        updated_at: now,
        tracks: vec![video_track, captions_track],
        clips,
    }
}

#[tauri::command]
async fn discover_models() -> Result<Value, String> {
    let script = script_path("scripts/model_runtime_discovery.mjs")?;
    let args = vec!["--pretty".to_string()];

    let raw =
        match tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args)).await {
            Ok(Ok(payload)) => payload,
            Ok(Err(error_message)) => return Err(error_message),
            Err(error) => return Err(format!("Task join error: {error}")),
        };

    serde_json::from_str::<Value>(&raw).map_err(|error| format!("Invalid discovery JSON: {error}"))
}

#[tauri::command]
async fn model_health() -> Result<Value, String> {
    let script = script_path("scripts/model_runtime_health.mjs")?;
    let args = Vec::<String>::new();

    let raw =
        match tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args)).await {
            Ok(Ok(payload)) => payload,
            Ok(Err(error_message)) => return Err(error_message),
            Err(error) => return Err(format!("Task join error: {error}")),
        };

    serde_json::from_str::<Value>(&raw)
        .map_err(|error| format!("Invalid model health JSON: {error}"))
}

#[tauri::command]
async fn hardware_diagnostics() -> Result<Value, String> {
    let script = script_path("scripts/hardware_diagnostics.mjs")?;
    let args = Vec::<String>::new();

    let raw =
        match tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args)).await {
            Ok(Ok(payload)) => payload,
            Ok(Err(error_message)) => return Err(error_message),
            Err(error) => return Err(format!("Task join error: {error}")),
        };

    serde_json::from_str::<Value>(&raw)
        .map_err(|error| format!("Invalid hardware diagnostics JSON: {error}"))
}

#[tauri::command]
async fn first_run_checks() -> Result<Value, String> {
    let script = script_path("scripts/first_run_checks.mjs")?;
    let args = Vec::<String>::new();

    let raw =
        match tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args)).await {
            Ok(Ok(payload)) => payload,
            Ok(Err(error_message)) => return Err(error_message),
            Err(error) => return Err(format!("Task join error: {error}")),
        };

    serde_json::from_str::<Value>(&raw)
        .map_err(|error| format!("Invalid first-run checks JSON: {error}"))
}

#[derive(Deserialize)]
struct InstallRequest {
    runtime: String,
    model: Option<String>,
}

#[tauri::command]
async fn install_model(request: InstallRequest) -> Result<Value, String> {
    let script = script_path("scripts/model_runtime_install.mjs")?;
    let mut args = vec!["--runtime".to_string(), request.runtime.clone()];
    if let Some(model) = request.model.clone() {
        if !model.trim().is_empty() {
            args.push("--model".to_string());
            args.push(model);
        }
    }

    let runtime = request.runtime;
    let model = request.model.unwrap_or_default();
    let output = tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args))
        .await
        .map_err(|error| format!("Task join error: {error}"))??;

    if let Ok(parsed) = serde_json::from_str::<Value>(&output) {
        return Ok(parsed);
    }

    Ok(serde_json::json!({
        "ok": true,
        "runtime": runtime,
        "model": model,
        "status": "installed",
        "output": output,
    }))
}

#[tauri::command]
async fn list_projects() -> Result<Vec<Project>, String> {
    tauri::async_runtime::spawn_blocking(read_projects)
        .await
        .map_err(|error| format!("Task join error: {error}"))?
}

#[tauri::command]
async fn create_project(request: CreateProjectRequest) -> Result<Project, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut projects = read_projects()?;
        let now = now_iso();

        let project = Project {
            id: generate_project_id(),
            name: request.name,
            settings: request.settings,
            status: "PROJECT_CREATED".to_string(),
            created_at: now.clone(),
            updated_at: now,
        };

        projects.push(project.clone());
        write_projects(&projects)?;
        Ok(project)
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))?
}

#[tauri::command]
async fn update_project_settings(request: UpdateProjectSettingsRequest) -> Result<Project, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut projects = read_projects()?;
        let now = now_iso();
        let mut found: Option<Project> = None;

        for project in &mut projects {
            if project.id == request.project_id {
                project.settings = request.settings.clone();
                project.updated_at = now.clone();
                project.status = "SETTINGS_SAVED".to_string();
                found = Some(project.clone());
                break;
            }
        }

        let project = found.ok_or_else(|| "Project not found.".to_string())?;
        write_projects(&projects)?;
        Ok(project)
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))?
}

#[tauri::command]
async fn ingest_media(request: MediaIngestRequest) -> Result<Value, String> {
    let script = script_path("scripts/media_ingest.mjs")?;
    let args = vec![
        "--input".to_string(),
        request.input.clone(),
        "--project-id".to_string(),
        request.project_id.clone(),
        "--generate-proxy".to_string(),
        if request.generate_proxy.unwrap_or(true) {
            "true".to_string()
        } else {
            "false".to_string()
        },
        "--generate-waveform".to_string(),
        if request.generate_waveform.unwrap_or(true) {
            "true".to_string()
        } else {
            "false".to_string()
        },
    ];

    let raw = tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args))
        .await
        .map_err(|error| format!("Task join error: {error}"))??;

    serde_json::from_str::<Value>(&raw)
        .map_err(|error| format!("Invalid media ingest JSON: {error}"))
}

#[tauri::command]
async fn create_rough_cut_timeline(
    request: CreateRoughCutTimelineRequest,
) -> Result<Timeline, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let timeline = build_rough_cut_timeline(
            request.project_id,
            request.duration_us,
            request.fps,
            request
                .source_ref
                .unwrap_or_else(|| "source-video".to_string()),
            request.remove_ranges.unwrap_or_default(),
        );

        write_timeline(&timeline)?;
        Ok(timeline)
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))?
}

#[tauri::command]
async fn get_timeline(request: GetTimelineRequest) -> Result<Timeline, String> {
    tauri::async_runtime::spawn_blocking(move || read_timeline(&request.project_id))
        .await
        .map_err(|error| format!("Task join error: {error}"))?
}

#[tauri::command]
async fn get_render_history(request: GetRenderHistoryRequest) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = render_history_file_path(&request.project_id)?;
        if !file_path.exists() {
            return Ok::<Value, String>(serde_json::json!({
                "projectId": request.project_id,
                "history": []
            }));
        }

        let raw = fs::read_to_string(&file_path)
            .map_err(|error| format!("Failed reading render history file: {error}"))?;
        let parsed = serde_json::from_str::<Value>(&raw)
            .map_err(|error| format!("Invalid render history JSON: {error}"))?;
        let history = if parsed.is_array() {
            parsed
        } else {
            serde_json::json!([])
        };

        Ok(serde_json::json!({
            "projectId": request.project_id,
            "history": history
        }))
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))?
}

#[tauri::command]
async fn get_project_telemetry(request: GetProjectTelemetryRequest) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let limit = request.limit.unwrap_or(80).max(1).min(400) as usize;
        let summary_path = telemetry_summary_file_path(&request.project_id)?;
        let events_path = telemetry_events_file_path(&request.project_id)?;

        let summary = if summary_path.exists() {
            let raw = fs::read_to_string(&summary_path)
                .map_err(|error| format!("Failed reading telemetry summary file: {error}"))?;
            serde_json::from_str::<Value>(&raw)
                .map_err(|error| format!("Invalid telemetry summary JSON: {error}"))?
        } else {
            serde_json::Value::Null
        };

        let recent_events = if events_path.exists() {
            let raw = fs::read_to_string(&events_path)
                .map_err(|error| format!("Failed reading telemetry events file: {error}"))?;
            let rows = raw
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .collect::<Vec<_>>();
            let mut parsed = Vec::<Value>::new();
            for line in rows.iter().rev().take(limit) {
                if let Ok(value) = serde_json::from_str::<Value>(line) {
                    parsed.push(value);
                }
            }
            Value::Array(parsed)
        } else {
            Value::Array(Vec::new())
        };

        Ok(serde_json::json!({
            "projectId": request.project_id,
            "summary": summary,
            "recentEvents": recent_events
        }))
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))?
}

#[tauri::command]
async fn save_timeline(request: SaveTimelineRequest) -> Result<Timeline, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut timeline = request.timeline;
        timeline.version = timeline.version.saturating_add(1);
        timeline.updated_at = now_iso();
        write_timeline(&timeline)?;
        Ok(timeline)
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))?
}

#[tauri::command]
async fn start_editing(request: StartEditingRequest) -> Result<Value, String> {
    let script = script_path("scripts/start_editing_pipeline.mjs")?;
    let mode = request.mode.unwrap_or_else(|| "hybrid".to_string());
    let language = request.language.unwrap_or_else(|| "en".to_string());
    let fps = request.fps.unwrap_or(30);
    let source_ref = request
        .source_ref
        .unwrap_or_else(|| "source-video".to_string());
    let fallback_policy = request.fallback_policy.unwrap_or_default();
    let transcription_model = request.transcription_model.unwrap_or_default();
    let cut_planner_model = request.cut_planner_model.unwrap_or_default();

    let mut args = vec![
        "--project-id".to_string(),
        request.project_id.clone(),
        "--input".to_string(),
        request.input.clone(),
        "--mode".to_string(),
        mode,
        "--language".to_string(),
        language,
        "--fps".to_string(),
        fps.to_string(),
        "--source-ref".to_string(),
        source_ref.clone(),
    ];

    if !fallback_policy.trim().is_empty() {
        args.push("--fallback-policy".to_string());
        args.push(fallback_policy);
    }
    if !transcription_model.trim().is_empty() {
        args.push("--transcription-model".to_string());
        args.push(transcription_model);
    }
    if !cut_planner_model.trim().is_empty() {
        args.push("--cut-planner-model".to_string());
        args.push(cut_planner_model);
    }

    let raw = tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args))
        .await
        .map_err(|error| format!("Task join error: {error}"))??;

    let pipeline: Value = serde_json::from_str(&raw)
        .map_err(|error| format!("Invalid start editing JSON: {error}"))?;

    let duration_us = pipeline
        .get("durationUs")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Pipeline response missing durationUs.".to_string())?;

    let remove_ranges: Vec<TimeRange> = serde_json::from_value(
        pipeline
            .get("removeRanges")
            .cloned()
            .unwrap_or_else(|| serde_json::json!([])),
    )
    .map_err(|error| format!("Invalid removeRanges payload: {error}"))?;

    let timeline = tauri::async_runtime::spawn_blocking({
        let project_id = request.project_id.clone();
        let source_ref = source_ref.clone();
        move || {
            let timeline =
                build_rough_cut_timeline(project_id, duration_us, fps, source_ref, remove_ranges);
            write_timeline(&timeline)?;
            Ok::<Timeline, String>(timeline)
        }
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))??;

    let _ = tauri::async_runtime::spawn_blocking({
        let project_id = request.project_id.clone();
        move || update_project_status(&project_id, "ROUGH_CUT_READY")
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))??;

    Ok(serde_json::json!({
        "ok": true,
        "pipeline": pipeline,
        "timeline": timeline
    }))
}

#[tauri::command]
async fn edit_now(request: EditNowRequest) -> Result<Value, String> {
    let script = script_path("scripts/edit_now_pipeline.mjs")?;
    let fps = request.fps.unwrap_or(30);
    let source_ref = request
        .source_ref
        .unwrap_or_else(|| "source-video".to_string());
    let fetch_external = request.fetch_external.unwrap_or(true);
    let fallback_policy = request.fallback_policy.unwrap_or_default();
    let template_planner_model = request.template_planner_model.unwrap_or_default();

    let mut args = vec![
        "--project-id".to_string(),
        request.project_id.clone(),
        "--fps".to_string(),
        fps.to_string(),
        "--source-ref".to_string(),
        source_ref,
        "--fetch-external".to_string(),
        if fetch_external {
            "true".to_string()
        } else {
            "false".to_string()
        },
    ];

    if !fallback_policy.trim().is_empty() {
        args.push("--fallback-policy".to_string());
        args.push(fallback_policy);
    }
    if !template_planner_model.trim().is_empty() {
        args.push("--template-planner-model".to_string());
        args.push(template_planner_model);
    }

    let raw = tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args))
        .await
        .map_err(|error| format!("Task join error: {error}"))??;

    let result: Value =
        serde_json::from_str(&raw).map_err(|error| format!("Invalid edit now JSON: {error}"))?;

    let _ = tauri::async_runtime::spawn_blocking({
        let project_id = request.project_id.clone();
        move || update_project_status(&project_id, "ENRICHED_TIMELINE_READY")
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))??;

    Ok(result)
}

#[tauri::command]
async fn render_video(request: RenderVideoRequest) -> Result<Value, String> {
    let script = script_path("scripts/render_pipeline.mjs")?;
    let output_name = request.output_name.unwrap_or_default();
    let burn_subtitles = request.burn_subtitles.unwrap_or(false);
    let quality = request.quality.unwrap_or_else(|| "balanced".to_string());

    let _ = tauri::async_runtime::spawn_blocking({
        let project_id = request.project_id.clone();
        move || update_project_status(&project_id, "RENDER_IN_PROGRESS")
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))??;

    let args = vec![
        "--project-id".to_string(),
        request.project_id.clone(),
        "--output-name".to_string(),
        output_name,
        "--burn-subtitles".to_string(),
        if burn_subtitles {
            "true".to_string()
        } else {
            "false".to_string()
        },
        "--quality".to_string(),
        quality,
    ];

    let raw =
        match tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args)).await {
            Ok(Ok(payload)) => payload,
            Ok(Err(error_message)) => {
                let _ = tauri::async_runtime::spawn_blocking({
                    let project_id = request.project_id.clone();
                    move || update_project_status(&project_id, "RENDER_FAILED")
                })
                .await
                .map_err(|error| format!("Task join error: {error}"))??;
                return Err(error_message);
            }
            Err(error) => {
                let _ = tauri::async_runtime::spawn_blocking({
                    let project_id = request.project_id.clone();
                    move || update_project_status(&project_id, "RENDER_FAILED")
                })
                .await
                .map_err(|join_error| format!("Task join error: {join_error}"))??;
                return Err(format!("Task join error: {error}"));
            }
        };

    let result: Value =
        serde_json::from_str(&raw).map_err(|error| format!("Invalid render JSON: {error}"))?;

    let _ = tauri::async_runtime::spawn_blocking({
        let project_id = request.project_id.clone();
        move || update_project_status(&project_id, "RENDER_DONE")
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))??;

    Ok(result)
}

#[tauri::command]
async fn open_path(request: OpenPathRequest) -> Result<Value, String> {
    let target_path = request.path.trim().to_string();
    if target_path.is_empty() {
        return Err("Missing required field: path".to_string());
    }
    let reveal = request.reveal.unwrap_or(true);

    let status = tauri::async_runtime::spawn_blocking(move || {
        let mut command = Command::new("open");
        if reveal {
            command.arg("-R");
        }
        command.arg(&target_path);
        command
            .status()
            .map_err(|error| format!("Failed to execute open command: {error}"))
    })
    .await
    .map_err(|error| format!("Task join error: {error}"))??;

    if status.success() {
        Ok(serde_json::json!({
            "ok": true,
            "path": request.path,
            "reveal": reveal
        }))
    } else {
        Err("open command exited with non-zero status".to_string())
    }
}

#[tauri::command]
fn app_metadata() -> Value {
    serde_json::json!({
        "name": "Lapaas AI Editor",
        "version": env!("CARGO_PKG_VERSION"),
    })
}

fn start_backend_server() -> Option<std::process::Child> {
    let root = workspace_root().ok()?;
    let server_script = root.join("desktop").join("backend").join("server.mjs");
    if !server_script.exists() {
        eprintln!("[Tauri] Backend script not found: {:?}", server_script);
        return None;
    }
    let node = node_binary();
    match Command::new(&node)
        .arg(&server_script)
        .current_dir(&root)
        .spawn()
    {
        Ok(child) => {
            eprintln!("[Tauri] Backend server started (pid={})", child.id());
            Some(child)
        }
        Err(e) => {
            eprintln!("[Tauri] Failed to start backend server: {e}");
            None
        }
    }
}

fn main() {
    // Start the HTTP backend server as a background process.
    // The UI health-check will connect to it automatically.
    let backend_child: Arc<Mutex<Option<std::process::Child>>> =
        Arc::new(Mutex::new(start_backend_server()));

    let backend_child_clone = Arc::clone(&backend_child);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            discover_models,
            model_health,
            hardware_diagnostics,
            first_run_checks,
            install_model,
            list_projects,
            create_project,
            update_project_settings,
            ingest_media,
            start_editing,
            edit_now,
            render_video,
            open_path,
            create_rough_cut_timeline,
            get_timeline,
            get_render_history,
            get_project_telemetry,
            save_timeline,
            app_metadata
        ])
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the backend server when the last window closes
                if let Ok(mut guard) = backend_child_clone.lock() {
                    if let Some(ref mut child) = *guard {
                        let _ = child.kill();
                        eprintln!("[Tauri] Backend server stopped");
                    }
                    *guard = None;
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Lapaas AI Editor desktop shell");

    // Ensure backend is killed if run() returns
    if let Ok(mut guard) = backend_child.lock() {
        if let Some(ref mut child) = *guard {
            let _ = child.kill();
        }
    }
}

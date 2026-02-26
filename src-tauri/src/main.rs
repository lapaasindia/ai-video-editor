use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;

fn workspace_root() -> Result<PathBuf, String> {
    // 1. Check for explicit override (useful for dev/CI)
    if let Ok(v) = std::env::var("LAPAAS_WORKSPACE_ROOT") {
        let p = PathBuf::from(v);
        if p.exists() {
            return Ok(p);
        }
    }

    // 2. Try to resolve from the executable path (works in .app bundle)
    if let Ok(exe) = std::env::current_exe() {
        // In a macOS .app: Contents/MacOS/lapaas-ai-editor-desktop
        // Resources are at: Contents/Resources/
        // But we bundle scripts at the same level, so check parent dirs
        if let Some(macos_dir) = exe.parent() {
            // Check if we're inside a .app bundle
            if let Some(contents_dir) = macos_dir.parent() {
                let resources_dir = contents_dir.join("Resources");
                // If resources dir has our scripts, use it
                if resources_dir.join("scripts").exists()
                    || resources_dir.join("desktop").exists()
                {
                    return Ok(resources_dir);
                }
            }

            // Dev mode: exe is in target/debug/ or target/release/
            // Walk up to find package.json
            let mut search = macos_dir.to_path_buf();
            for _ in 0..6 {
                if search.join("package.json").exists() && search.join("scripts").exists() {
                    return Ok(search);
                }
                match search.parent() {
                    Some(p) => search = p.to_path_buf(),
                    None => break,
                }
            }
        }
    }

    // 3. Fallback: current_dir (dev mode)
    let mut current =
        std::env::current_dir().map_err(|error| format!("Cannot resolve current_dir: {error}"))?;

    if current.ends_with("src-tauri") {
        if let Some(parent) = current.parent() {
            current = parent.to_path_buf();
        }
    }

    Ok(current)
}

fn node_binary() -> String {
    // 1. Explicit override (useful for dev/CI)
    if let Ok(v) = std::env::var("NODE_BIN") {
        return v;
    }
    // 2. Bundled sidecar inside the .app (Tauri externalBin convention)
    //    The binary is placed next to the main executable as "node"
    if let Ok(exe) = std::env::current_exe() {
        let sidecar = exe.parent().map(|p| p.join("node")).unwrap_or_default();
        if sidecar.exists() {
            return sidecar.to_string_lossy().to_string();
        }
        // macOS .app: Contents/MacOS/node
        let macos_sidecar = exe
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.join("MacOS").join("node"))
            .unwrap_or_default();
        if macos_sidecar.exists() {
            return macos_sidecar.to_string_lossy().to_string();
        }
    }
    // 3. Fall back to system node (dev mode / user has Node installed)
    "node".to_string()
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

// ── Missing Pipeline Request Structs ─────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TranscribeRequest {
    project_id: String,
    input: String,
    mode: Option<String>,
    language: Option<String>,
    source_ref: Option<String>,
    fallback_policy: Option<String>,
    transcription_model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CutPlanRequest {
    project_id: String,
    input: String,
    source_ref: Option<String>,
    mode: Option<String>,
    #[allow(dead_code)]
    fps: Option<u32>,
    llm_provider: Option<String>,
    llm_model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OverlayPlanChunkRequest {
    project_id: String,
    chunk_index: Option<u32>,
    chunk_start_us: Option<u64>,
    chunk_end_us: Option<u64>,
    mode: Option<String>,
    llm_provider: Option<String>,
    llm_model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FetchAssetRequest {
    project_id: String,
    query: String,
    kind: Option<String>,
    provider: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgenticEditRequest {
    project_id: String,
    input: String,
    language: Option<String>,
    fps: Option<u32>,
    mode: Option<String>,
    source_ref: Option<String>,
    fetch_external: Option<bool>,
    llm_provider: Option<String>,
    llm_model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportFcpxmlRequest {
    project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveAiConfigRequest {
    key: Option<String>,
    value: Option<String>,
    keys: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OllamaPullRequest {
    model: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectDataRequest {
    project_id: String,
    file_name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveProjectDataRequest {
    project_id: String,
    file_name: String,
    data: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveProjectStateRequest {
    project_id: String,
    state: Option<Value>,
    timeline: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoadProjectRequest {
    project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgenticProgressRequest {
    project_id: String,
}

// ── Pipeline: Standalone Transcription ──────────────────────────────────

#[tauri::command]
async fn pipeline_transcribe(request: TranscribeRequest) -> Result<Value, String> {
    let script = script_path("scripts/transcribe_only.mjs")?;
    let root = workspace_root()?;
    let p_dir = root.join("desktop").join("data").join(&request.project_id);
    let mode = request.mode.unwrap_or_else(|| "hybrid".to_string());
    let language = request.language.unwrap_or_else(|| "en".to_string());
    let source_ref = request.source_ref.unwrap_or_else(|| "source-video".to_string());

    let mut args = vec![
        "--project-id".to_string(), request.project_id.clone(),
        "--project-dir".to_string(), p_dir.to_string_lossy().to_string(),
        "--input".to_string(), request.input.clone(),
        "--mode".to_string(), mode,
        "--language".to_string(), language,
        "--source-ref".to_string(), source_ref,
    ];
    if let Some(fp) = request.fallback_policy { if !fp.is_empty() { args.push("--fallback-policy".to_string()); args.push(fp); } }
    if let Some(tm) = request.transcription_model { if !tm.is_empty() { args.push("--transcription-model".to_string()); args.push(tm); } }

    let pid = request.project_id.clone();
    let _ = tauri::async_runtime::spawn_blocking({
        let pid = pid.clone();
        move || update_project_status(&pid, "TRANSCRIBING")
    }).await;

    let raw = tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args))
        .await.map_err(|e| format!("Task join error: {e}"))??;

    let _ = tauri::async_runtime::spawn_blocking({
        let pid2 = pid.clone();
        move || update_project_status(&pid2, "TRANSCRIPT_READY")
    }).await;

    serde_json::from_str::<Value>(&raw).map_err(|e| format!("Invalid JSON: {e}"))
}

// ── Pipeline: Standalone Cut Planning ───────────────────────────────────

#[tauri::command]
async fn pipeline_cut_plan(request: CutPlanRequest) -> Result<Value, String> {
    let script = script_path("scripts/cut_plan_only.mjs")?;
    let root = workspace_root()?;
    let p_dir = root.join("desktop").join("data").join(&request.project_id);
    let source_ref = request.source_ref.unwrap_or_else(|| "source-video".to_string());
    let mode = request.mode.unwrap_or_else(|| "heuristic".to_string());

    let mut args = vec![
        "--project-id".to_string(), request.project_id.clone(),
        "--project-dir".to_string(), p_dir.to_string_lossy().to_string(),
        "--input".to_string(), request.input.clone(),
        "--source-ref".to_string(), source_ref,
        "--mode".to_string(), mode,
    ];
    if let Some(lp) = request.llm_provider { if !lp.is_empty() { args.push("--llm-provider".to_string()); args.push(lp); } }
    if let Some(lm) = request.llm_model { if !lm.is_empty() { args.push("--llm-model".to_string()); args.push(lm); } }

    let pid = request.project_id.clone();
    let _ = tauri::async_runtime::spawn_blocking({
        let pid = pid.clone();
        move || update_project_status(&pid, "PLANNING_CUTS")
    }).await;

    let raw = tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args))
        .await.map_err(|e| format!("Task join error: {e}"))??;

    let _ = tauri::async_runtime::spawn_blocking({
        let pid2 = pid.clone();
        move || update_project_status(&pid2, "CUTS_READY")
    }).await;

    serde_json::from_str::<Value>(&raw).map_err(|e| format!("Invalid JSON: {e}"))
}

// ── Pipeline: Chunk Overlay Planning ────────────────────────────────────

#[tauri::command]
async fn pipeline_overlay_plan_chunk(request: OverlayPlanChunkRequest) -> Result<Value, String> {
    let script = script_path("scripts/overlay_plan_chunk.mjs")?;
    let root = workspace_root()?;
    let p_dir = root.join("desktop").join("data").join(&request.project_id);
    let chunk_index = request.chunk_index.unwrap_or(0);
    let chunk_start = request.chunk_start_us.unwrap_or(0);
    let chunk_end = request.chunk_end_us.unwrap_or(60_000_000);
    let mode = request.mode.unwrap_or_else(|| "auto".to_string());

    let mut args = vec![
        "--project-id".to_string(), request.project_id.clone(),
        "--project-dir".to_string(), p_dir.to_string_lossy().to_string(),
        "--chunk-index".to_string(), chunk_index.to_string(),
        "--chunk-start-us".to_string(), chunk_start.to_string(),
        "--chunk-end-us".to_string(), chunk_end.to_string(),
        "--mode".to_string(), mode,
    ];
    if let Some(lp) = request.llm_provider { if !lp.is_empty() { args.push("--llm-provider".to_string()); args.push(lp); } }
    if let Some(lm) = request.llm_model { if !lm.is_empty() { args.push("--llm-model".to_string()); args.push(lm); } }

    let raw = tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args))
        .await.map_err(|e| format!("Task join error: {e}"))??;

    serde_json::from_str::<Value>(&raw).map_err(|e| format!("Invalid JSON: {e}"))
}

// ── Pipeline: Fetch Free Asset ──────────────────────────────────────────

#[tauri::command]
async fn pipeline_fetch_asset(request: FetchAssetRequest) -> Result<Value, String> {
    let script = script_path("scripts/fetch_free_assets.mjs")?;
    let root = workspace_root()?;
    let p_dir = root.join("desktop").join("data").join(&request.project_id);
    let kind = request.kind.unwrap_or_else(|| "image".to_string());
    let provider = request.provider.unwrap_or_else(|| "pexels".to_string());

    let args = vec![
        "--project-id".to_string(), request.project_id.clone(),
        "--project-dir".to_string(), p_dir.to_string_lossy().to_string(),
        "--query".to_string(), request.query.clone(),
        "--kind".to_string(), kind,
        "--provider".to_string(), provider,
    ];

    let raw = tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args))
        .await.map_err(|e| format!("Task join error: {e}"))??;

    serde_json::from_str::<Value>(&raw).map_err(|e| format!("Invalid JSON: {e}"))
}

// ── Agentic Edit: full AI-driven pipeline ───────────────────────────────

#[tauri::command]
async fn agentic_edit(request: AgenticEditRequest) -> Result<Value, String> {
    let script = script_path("scripts/agentic_editing_pipeline.mjs")?;
    let root = workspace_root()?;
    let p_dir = root.join("desktop").join("data").join(&request.project_id);
    let language = request.language.unwrap_or_else(|| "hi".to_string());
    let fps = request.fps.unwrap_or(30);
    let mode = request.mode.unwrap_or_else(|| "hybrid".to_string());
    let source_ref = request.source_ref.unwrap_or_else(|| "source-video".to_string());
    let fetch_external = if request.fetch_external.unwrap_or(true) { "true" } else { "false" };

    let mut args = vec![
        "--project-id".to_string(), request.project_id.clone(),
        "--project-dir".to_string(), p_dir.to_string_lossy().to_string(),
        "--input".to_string(), request.input.clone(),
        "--language".to_string(), language,
        "--fps".to_string(), fps.to_string(),
        "--mode".to_string(), mode,
        "--source-ref".to_string(), source_ref,
        "--fetch-external".to_string(), fetch_external.to_string(),
    ];
    if let Some(lp) = request.llm_provider { if !lp.is_empty() { args.push("--llm-provider".to_string()); args.push(lp); } }
    if let Some(lm) = request.llm_model { if !lm.is_empty() { args.push("--llm-model".to_string()); args.push(lm); } }

    let pid = request.project_id.clone();
    let _ = tauri::async_runtime::spawn_blocking({
        let pid = pid.clone();
        move || update_project_status(&pid, "AGENTIC_EDIT_IN_PROGRESS")
    }).await;

    let raw = tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args))
        .await.map_err(|e| format!("Task join error: {e}"))??;

    let _ = tauri::async_runtime::spawn_blocking({
        let pid2 = pid.clone();
        move || update_project_status(&pid2, "AGENTIC_EDIT_DONE")
    }).await;

    serde_json::from_str::<Value>(&raw).map_err(|e| format!("Invalid JSON: {e}"))
}

// ── Agentic Edit Progress ───────────────────────────────────────────────

#[tauri::command]
async fn agentic_edit_progress(request: AgenticProgressRequest) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = workspace_root()?;
        let progress_file = root.join("desktop").join("data").join(&request.project_id).join("agent_state.json");
        if !progress_file.exists() {
            return Ok(serde_json::json!({ "status": "idle", "percent": 0 }));
        }
        let raw = fs::read_to_string(&progress_file)
            .map_err(|e| format!("Failed reading agent_state: {e}"))?;
        serde_json::from_str::<Value>(&raw).map_err(|e| format!("Invalid JSON: {e}"))
    }).await.map_err(|e| format!("Task join error: {e}"))?
}

// ── Export FCPXML ───────────────────────────────────────────────────────

#[tauri::command]
async fn export_fcpxml(request: ExportFcpxmlRequest) -> Result<Value, String> {
    let script = script_path("scripts/export_fcpxml.mjs")?;
    let root = workspace_root()?;
    let p_dir = root.join("desktop").join("data").join(&request.project_id);
    let output = p_dir.join("project.fcpxml");

    let args = vec![
        "--project-id".to_string(), request.project_id.clone(),
        "--project-dir".to_string(), p_dir.to_string_lossy().to_string(),
        "--output".to_string(), output.to_string_lossy().to_string(),
    ];

    let _ = tauri::async_runtime::spawn_blocking(move || run_node_script(&script, &args))
        .await.map_err(|e| format!("Task join error: {e}"))??;

    Ok(serde_json::json!({ "ok": true, "path": output.to_string_lossy() }))
}

// ── AI Config: Get/Save API Keys ────────────────────────────────────────

#[tauri::command]
async fn ai_config_get() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let root = workspace_root()?;
        let config_path = root.join("desktop").join("data").join("ai_config.json");
        if !config_path.exists() {
            return Ok(serde_json::json!({}));
        }
        let raw = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed reading ai_config: {e}"))?;
        serde_json::from_str::<Value>(&raw).map_err(|e| format!("Invalid JSON: {e}"))
    }).await.map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
async fn ai_config_save(request: SaveAiConfigRequest) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = workspace_root()?;
        let config_path = root.join("desktop").join("data").join("ai_config.json");
        fs::create_dir_all(config_path.parent().unwrap())
            .map_err(|e| format!("Failed creating dir: {e}"))?;

        // Load existing config
        let mut config: serde_json::Map<String, Value> = if config_path.exists() {
            let raw = fs::read_to_string(&config_path).unwrap_or_else(|_| "{}".to_string());
            serde_json::from_str(&raw).unwrap_or_default()
        } else {
            serde_json::Map::new()
        };

        // Apply updates
        if let Some(keys) = request.keys {
            for (k, v) in keys {
                if v.is_empty() {
                    config.remove(&k);
                } else {
                    config.insert(k, Value::String(v));
                }
            }
        } else if let (Some(key), Some(value)) = (request.key, request.value) {
            if value.is_empty() {
                config.remove(&key);
            } else {
                config.insert(key, Value::String(value));
            }
        }

        let serialized = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Serialize error: {e}"))?;
        fs::write(&config_path, format!("{serialized}\n"))
            .map_err(|e| format!("Failed writing ai_config: {e}"))?;

        // Also set env vars for current process
        for (k, v) in &config {
            if let Some(s) = v.as_str() {
                std::env::set_var(k, s);
            }
        }

        Ok(serde_json::json!({ "ok": true, "keys": config.len() }))
    }).await.map_err(|e| format!("Task join error: {e}"))?
}

// ── AI Provider Catalog ─────────────────────────────────────────────────

#[tauri::command]
async fn ai_providers() -> Result<Value, String> {
    let script = script_path("scripts/lib/llm_provider.mjs")?;
    // Use a small inline script to import and dump the catalog
    let root = workspace_root()?;
    let inline = format!(
        "import('{}').then(m => console.log(JSON.stringify(m.getProviderCatalog())))",
        script.to_string_lossy().replace('\\', "/")
    );
    let node = node_binary();
    let output = tauri::async_runtime::spawn_blocking(move || {
        let out = Command::new(&node)
            .args(["--input-type=module", "-e", &inline])
            .current_dir(&root)
            .output()
            .map_err(|e| format!("Failed to run node: {e}"))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            return Err(format!("Node error: {}", stderr.chars().take(300).collect::<String>()));
        }
        Ok(String::from_utf8(out.stdout).unwrap_or_default().trim().to_string())
    }).await.map_err(|e| format!("Task join error: {e}"))??;

    serde_json::from_str::<Value>(&output).map_err(|e| format!("Invalid JSON: {e}"))
}

// ── Ollama: List Models ─────────────────────────────────────────────────

#[tauri::command]
async fn ollama_list_models() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let output = Command::new("ollama")
            .arg("list")
            .output()
            .map_err(|e| format!("Failed to run ollama: {e}"))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let models: Vec<Value> = stdout.lines().skip(1).filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.is_empty() { return None; }
            Some(serde_json::json!({
                "name": parts[0],
                "size": parts.get(2).unwrap_or(&""),
            }))
        }).collect();
        Ok(serde_json::json!({ "models": models }))
    }).await.map_err(|e| format!("Task join error: {e}"))?
}

// ── Ollama: Pull Model ──────────────────────────────────────────────────

#[tauri::command]
async fn ollama_pull_model(request: OllamaPullRequest) -> Result<Value, String> {
    let model = request.model.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let output = Command::new("ollama")
            .args(["pull", &model])
            .output()
            .map_err(|e| format!("Failed to run ollama pull: {e}"))?;
        if output.status.success() {
            Ok(serde_json::json!({ "ok": true, "model": model }))
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("ollama pull failed: {}", stderr.chars().take(300).collect::<String>()))
        }
    }).await.map_err(|e| format!("Task join error: {e}"))?
}

// ── Project Data: Read/Write JSON ───────────────────────────────────────

#[tauri::command]
async fn get_project_data(request: ProjectDataRequest) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = workspace_root()?;
        let file_path = root.join("desktop").join("data").join(&request.project_id).join(&request.file_name);
        if !file_path.exists() {
            return Err("Report not found".to_string());
        }
        let raw = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed reading: {e}"))?;
        serde_json::from_str::<Value>(&raw).map_err(|e| format!("Invalid JSON: {e}"))
    }).await.map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
async fn save_project_data(request: SaveProjectDataRequest) -> Result<Value, String> {
    let allowed = ["chunk_review_decisions.json"];
    if !allowed.contains(&request.file_name.as_str()) {
        return Err(format!("Writing to {} is not allowed", request.file_name));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let root = workspace_root()?;
        let file_path = root.join("desktop").join("data").join(&request.project_id).join(&request.file_name);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed creating dir: {e}"))?;
        }
        let serialized = serde_json::to_string_pretty(&request.data)
            .map_err(|e| format!("Serialize error: {e}"))?;
        fs::write(&file_path, format!("{serialized}\n"))
            .map_err(|e| format!("Failed writing: {e}"))?;
        Ok(serde_json::json!({ "ok": true }))
    }).await.map_err(|e| format!("Task join error: {e}"))?
}

// ── Save/Load Project State ─────────────────────────────────────────────

#[tauri::command]
async fn save_project_state(request: SaveProjectStateRequest) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = workspace_root()?;
        let project_dir = root.join("desktop").join("data").join(&request.project_id);
        fs::create_dir_all(&project_dir).map_err(|e| format!("Failed creating dir: {e}"))?;

        if let Some(state) = &request.state {
            let state_path = project_dir.join("state.json");
            let serialized = serde_json::to_string_pretty(state)
                .map_err(|e| format!("Serialize error: {e}"))?;
            fs::write(&state_path, format!("{serialized}\n"))
                .map_err(|e| format!("Failed writing state: {e}"))?;
        }

        if let Some(timeline) = &request.timeline {
            let timeline_path = project_dir.join("timeline.json");
            let serialized = serde_json::to_string_pretty(timeline)
                .map_err(|e| format!("Serialize error: {e}"))?;
            fs::write(&timeline_path, format!("{serialized}\n"))
                .map_err(|e| format!("Failed writing timeline: {e}"))?;
        }

        // Update updatedAt in projects.json
        let mut projects = read_projects()?;
        let now = now_iso();
        for project in &mut projects {
            if project.id == request.project_id {
                project.updated_at = now.clone();
                break;
            }
        }
        write_projects(&projects)?;

        Ok(serde_json::json!({ "ok": true }))
    }).await.map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
async fn load_project(request: LoadProjectRequest) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = workspace_root()?;
        let project_dir = root.join("desktop").join("data").join(&request.project_id);

        let state = {
            let state_path = project_dir.join("state.json");
            if state_path.exists() {
                let raw = fs::read_to_string(&state_path)
                    .map_err(|e| format!("Failed reading state: {e}"))?;
                serde_json::from_str::<Value>(&raw).ok()
            } else {
                None
            }
        };

        let timeline = {
            let tl_path = project_dir.join("timeline.json");
            if tl_path.exists() {
                let raw = fs::read_to_string(&tl_path)
                    .map_err(|e| format!("Failed reading timeline: {e}"))?;
                serde_json::from_str::<Value>(&raw).ok()
            } else {
                None
            }
        };

        let projects = read_projects()?;
        let project = projects.into_iter().find(|p| p.id == request.project_id);

        Ok(serde_json::json!({
            "ok": true,
            "state": state,
            "timeline": timeline,
            "project": project
        }))
    }).await.map_err(|e| format!("Task join error: {e}"))?
}

// ── Auto Setup (callable from frontend) ─────────────────────────────────

#[tauri::command]
async fn run_setup() -> Result<Value, String> {
    let script = script_path("scripts/auto_setup.mjs")?;
    let root = workspace_root()?;
    let node = node_binary();

    let output = tauri::async_runtime::spawn_blocking(move || {
        let out = Command::new(&node)
            .arg(&script)
            .current_dir(&root)
            .output()
            .map_err(|e| format!("Failed to run auto_setup: {e}"))?;
        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
        Ok::<(bool, String), String>((out.status.success(), stderr))
    }).await.map_err(|e| format!("Task join error: {e}"))??;

    Ok(serde_json::json!({
        "ok": output.0,
        "log": output.1
    }))
}

#[tauri::command]
fn app_metadata() -> Value {
    serde_json::json!({
        "name": "Lapaas AI Editor",
        "version": env!("CARGO_PKG_VERSION"),
    })
}

fn run_auto_setup(root: &Path) {
    let node = node_binary();
    let setup_script = root.join("scripts").join("auto_setup.mjs");
    if !setup_script.exists() {
        eprintln!("[Tauri] auto_setup.mjs not found, skipping auto-setup");
        return;
    }
    eprintln!("[Tauri] Running auto-setup...");
    match Command::new(&node)
        .arg(&setup_script)
        .current_dir(root)
        .output()
    {
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.is_empty() {
                eprintln!("{}", stderr.trim_end());
            }
            if output.status.success() {
                eprintln!("[Tauri] Auto-setup completed");
            } else {
                eprintln!("[Tauri] Auto-setup finished with warnings");
            }
        }
        Err(e) => {
            eprintln!("[Tauri] Auto-setup failed to run: {e}");
        }
    }
}

fn ensure_npm_modules(root: &Path) {
    let node_modules = root.join("node_modules");
    if node_modules.exists() {
        return;
    }
    eprintln!("[Tauri] node_modules not found, running npm install...");
    match Command::new("npm")
        .args(["install", "--prefer-offline", "--no-audit", "--no-fund"])
        .current_dir(root)
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                eprintln!("[Tauri] npm install completed");
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                eprintln!("[Tauri] npm install failed: {}", stderr.chars().take(200).collect::<String>());
            }
        }
        Err(e) => {
            eprintln!("[Tauri] npm install failed to run: {e}");
        }
    }
}

fn start_backend_server() -> Option<std::process::Child> {
    let root = workspace_root().ok()?;
    eprintln!("[Tauri] Workspace root: {:?}", root);

    // Ensure node_modules exist (critical for .app first launch)
    ensure_npm_modules(&root);

    // Run auto-setup to install ffmpeg, Ollama, etc.
    run_auto_setup(&root);

    let server_script = root.join("desktop").join("backend").join("server.mjs");
    if !server_script.exists() {
        eprintln!("[Tauri] Backend script not found: {:?}", server_script);
        return None;
    }
    let node = node_binary();
    eprintln!("[Tauri] Starting backend: {} {:?}", node, server_script);
    match Command::new(&node)
        .arg(&server_script)
        .current_dir(&root)
        .env("LAPAAS_WORKSPACE_ROOT", &root)
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
            app_metadata,
            // Pipeline commands
            pipeline_transcribe,
            pipeline_cut_plan,
            pipeline_overlay_plan_chunk,
            pipeline_fetch_asset,
            agentic_edit,
            agentic_edit_progress,
            export_fcpxml,
            // AI config & providers
            ai_config_get,
            ai_config_save,
            ai_providers,
            // Ollama management
            ollama_list_models,
            ollama_pull_model,
            // Project data (QC reports, review decisions)
            get_project_data,
            save_project_data,
            // Project save/load
            save_project_state,
            load_project,
            // Auto-setup
            run_setup
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
        if let Some(child) = guard.as_mut() {
            let _ = child.kill();
        }
    };
}

use std::fs;
use std::path::Path;

use anyhow::{Context, Result};

use super::player::Player;
use super::world::WorldState;

const PLAYERS_DIR: &str = "data/players";
const WORLD_STATE_FILE: &str = "data/world_state.json";

/// Ensure data directories exist.
pub fn init_dirs() -> Result<()> {
    fs::create_dir_all(PLAYERS_DIR).context("Failed to create players directory")?;
    Ok(())
}

// ── Player persistence ───────────────────────────────────────────────

pub fn save_player(player: &Player) -> Result<()> {
    init_dirs()?;
    let path = format!("{}/{}.json", PLAYERS_DIR, sanitize_name(&player.name));
    let json = serde_json::to_string_pretty(player).context("Failed to serialize player")?;
    atomic_write(&path, &json)
}

pub fn load_player(name: &str) -> Result<Option<Player>> {
    let path = format!("{}/{}.json", PLAYERS_DIR, sanitize_name(name));
    if !Path::new(&path).exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).context("Failed to read player file")?;
    let player: Player = serde_json::from_str(&json).context("Failed to parse player file")?;
    Ok(Some(player))
}

// ── World state persistence ──────────────────────────────────────────

pub fn save_world_state(state: &WorldState) -> Result<()> {
    init_dirs()?;
    let json = serde_json::to_string_pretty(state).context("Failed to serialize world state")?;
    atomic_write(WORLD_STATE_FILE, &json)
}

pub fn load_world_state() -> Result<WorldState> {
    if !Path::new(WORLD_STATE_FILE).exists() {
        let state = WorldState::default();
        save_world_state(&state)?;
        return Ok(state);
    }
    let json = fs::read_to_string(WORLD_STATE_FILE).context("Failed to read world state")?;
    let state: WorldState =
        serde_json::from_str(&json).context("Failed to parse world state")?;
    Ok(state)
}

/// Reload world state from disk (pick up changes from other players).
pub fn reload_world_state() -> Result<WorldState> {
    load_world_state()
}

// ── Helpers ──────────────────────────────────────────────────────────

/// Atomic write: write to a temp file, then rename. Prevents corruption
/// if two SSH sessions write concurrently.
fn atomic_write(path: &str, content: &str) -> Result<()> {
    let tmp = format!("{}.tmp.{}", path, std::process::id());
    fs::write(&tmp, content).context("Failed to write temp file")?;
    fs::rename(&tmp, path).context("Failed to rename temp file")?;
    Ok(())
}

/// Sanitize a player name for use as a filename.
fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

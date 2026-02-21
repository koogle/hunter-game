# Hunter Game — Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                    main.rs                       │
│  - Parse args (player name from SSH)             │
│  - Initialize terminal (ratatui + crossterm)     │
│  - Create App, run main loop, cleanup            │
└────────────┬────────────────────┬───────────────┘
             │                    │
     ┌───────▼───────┐   ┌───────▼────────┐
     │   game/       │   │   ui/           │
     │  (logic)      │   │  (rendering)    │
     │               │   │                 │
     │ - GameState   │   │ - draw(frame,   │
     │ - tick()      │   │    game_state)  │
     │ - handle_     │   │ - layout        │
     │   action()    │   │ - widgets       │
     │ - combat      │   │                 │
     └───────┬───────┘   └────────────────┘
             │
     ┌───────▼───────┐
     │   world/      │
     │  (data)       │
     │               │
     │ - Tiles        │
     │ - Enemies      │
     │ - Items        │
     │ - WorldState   │
     │   (shared)     │
     └───────────────┘
```

**Key separation**: The `game` module owns all logic and state transitions. The `ui` module is a pure function of `GameState → Frame`. They never import each other's internals — `main.rs` orchestrates both.

---

## File Structure (final)

```
hunter-game/
├── Cargo.toml                  # Updated deps (add ratatui)
├── Dockerfile                  # Multi-stage build
├── docker-compose.yml          # Optional local dev
├── entrypoint.sh               # SSH server startup script
├── sshd_config                 # SSH config for Railway
├── src/
│   ├── main.rs                 # Entry point: terminal setup, main loop
│   ├── app.rs                  # App struct: bridges game + ui
│   ├── game/
│   │   ├── mod.rs              # GameState, Screen enum, tick/update
│   │   ├── player.rs           # Player struct (hp, level, exp, inventory)
│   │   ├── combat.rs           # CombatState, turn logic, damage calc
│   │   ├── world.rs            # Tile, TileEvent, world definition
│   │   └── persistence.rs      # Save/load player + world state
│   └── ui/
│       ├── mod.rs              # draw() dispatcher
│       ├── images.rs           # Existing image renderer (kept)
│       ├── title_screen.rs     # Title/menu screen
│       ├── explore_screen.rs   # World exploration view
│       ├── combat_screen.rs    # Combat encounter view
│       ├── inventory_screen.rs # Inventory/stats view
│       └── game_over_screen.rs # Death/game over view
├── data/
│   ├── world_state.json        # Shared world state (all players)
│   └── players/                # Per-player save files
│       └── <player_name>.json
├── assets/
│   └── images/
│       └── title.png
└── ...
```

---

## Step-by-Step Implementation

### Step 1: Update Dependencies

Add `ratatui` to `Cargo.toml`. Update crossterm to be compatible. Add `uuid` for player IDs and `chrono` for timestamps. Add `dirs` or use simple path logic for data dirs.

```toml
[dependencies]
ratatui = { version = "0.29", features = ["crossterm"] }
crossterm = "0.28"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
rand = "0.8"
anyhow = "1.0"
image = { version = "0.25", default-features = false, features = ["png", "gif", "webp"] }
chrono = { version = "0.4", features = ["serde"] }
```

### Step 2: Define Game Data Types (`game/player.rs`)

```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct Player {
    pub name: String,
    pub hp: i32,
    pub max_hp: i32,
    pub level: u32,
    pub exp: u32,
    pub exp_to_next: u32,
    pub inventory: Vec<Item>,
    pub current_tile: usize,       // index into world tiles
}
```

Items:
```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct Item {
    pub name: String,
    pub description: String,
    pub item_type: ItemType,
    pub value: i32,                 // heal amount, damage, etc.
}

pub enum ItemType { Weapon, Potion, Key, Misc }
```

### Step 3: Define World Model (`game/world.rs`)

A tile-based world where each tile has:

```rust
pub struct Tile {
    pub id: usize,
    pub name: String,
    pub description: String,
    pub connections: Vec<usize>,    // indices of connected tiles
    pub events: Vec<TileEvent>,     // what can happen here
}

pub enum TileEvent {
    Enemy(EnemyTemplate),
    ItemPickup(Item),
    Npc { name: String, dialogue: String },
    Rest,                           // restore HP
    Nothing,
}

pub struct EnemyTemplate {
    pub name: String,
    pub hp: i32,
    pub damage: i32,
    pub exp_reward: u32,
    pub loot: Option<Item>,
}
```

Hardcoded world: ~8-10 tiles forming a small map (village, forest, cave, ruins, etc.)

**Shared world state** (`data/world_state.json`):
```rust
pub struct WorldState {
    pub defeated_bosses: Vec<String>,       // boss names killed by any player
    pub discovered_secrets: Vec<String>,    // secrets found by any player
    pub global_kill_count: u32,             // total enemies killed
    pub player_messages: Vec<PlayerMessage>,// messages left by players
}
```

File locking: use `std::fs::File` with advisory locking (`flock`) or simple atomic read-modify-write (read → deserialize → modify → serialize → write to temp → rename). This is sufficient for SSH-based concurrency.

### Step 4: Game State Machine (`game/mod.rs`)

The game is a state machine with screens:

```rust
pub enum Screen {
    Title,
    Explore,          // viewing current tile, choosing where to go
    Combat(CombatState),
    Inventory,
    GameOver,
}

pub struct GameState {
    pub screen: Screen,
    pub player: Player,
    pub world: Vec<Tile>,
    pub world_state: WorldState,
    pub message_log: Vec<String>,   // recent messages shown in UI
    pub should_quit: bool,
}
```

`GameState` exposes:
- `handle_input(key: KeyEvent)` — processes input based on current screen
- `tick()` — any time-based updates (none for now, placeholder for LLM)

### Step 5: Combat System (`game/combat.rs`)

```rust
pub struct CombatState {
    pub enemy_name: String,
    pub enemy_hp: i32,
    pub enemy_max_hp: i32,
    pub enemy_damage: i32,
    pub exp_reward: u32,
    pub loot: Option<Item>,
    pub turn: CombatTurn,
    pub log: Vec<String>,
    pub selected_action: usize,
}

pub enum CombatTurn { PlayerChoosing, PlayerAttacking, EnemyAttacking, Victory, Defeat }
```

Actions: Attack, Defend (reduce damage next hit), Use Potion, Flee.
Simple damage formula: `base_damage + rand(-2..3)`. Defend halves incoming damage.

### Step 6: Persistence (`game/persistence.rs`)

- `save_player(player: &Player)` — writes to `data/players/<name>.json`
- `load_player(name: &str) -> Option<Player>` — reads from file
- `save_world_state(state: &WorldState)` — atomic write to `data/world_state.json`
- `load_world_state() -> WorldState` — read or create default
- Auto-save after each tile transition and combat resolution

### Step 7: App Struct (`app.rs`)

Bridges game logic and UI:

```rust
pub struct App {
    pub game: GameState,
}

impl App {
    pub fn new(player_name: String) -> Result<Self> { ... }
    pub fn run(&mut self, terminal: &mut Terminal<CrosstermBackend<Stdout>>) -> Result<()> {
        loop {
            terminal.draw(|f| ui::draw(f, &self.game))?;
            if let Event::Key(key) = event::read()? {
                self.game.handle_input(key);
            }
            if self.game.should_quit { break; }
        }
        Ok(())
    }
}
```

### Step 8: UI Rendering (`ui/`)

All UI functions take `&Frame` and `&GameState` — pure rendering, no mutation.

**Layout** (ratatui):
```
┌──────────────────────────────────────┐
│  HUNTER GAME          HP: 20/20  L:1 │  <- header bar
├──────────────────────────────────────┤
│                                      │
│  [Location/Combat/Screen content]    │  <- main area
│                                      │
├──────────────────────────────────────┤
│  > message log line 1                │  <- message log
│  > message log line 2                │
├──────────────────────────────────────┤
│  [1] Go north  [2] Go east  [Q] Quit│  <- action bar
└──────────────────────────────────────┘
```

Each screen file (`title_screen.rs`, `explore_screen.rs`, etc.) exports a `draw(f: &mut Frame, area: Rect, game: &GameState)` function.

### Step 9: Entry Point (`main.rs`)

```rust
fn main() -> Result<()> {
    // Player name from args or env (SSH sets this)
    let player_name = std::env::args().nth(1)
        .or(std::env::var("USER").ok())
        .unwrap_or_else(|| "anonymous".to_string());

    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Run game
    let mut app = App::new(player_name)?;
    let result = app.run(&mut terminal);

    // Cleanup terminal
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen, DisableMouseCapture)?;
    terminal.show_cursor()?;

    result
}
```

### Step 10: Hardcoded World Content

Create ~8 tiles:

| # | Name | Description | Events |
|---|------|-------------|--------|
| 0 | Village Square | Starting tile, safe haven | Rest, NPC (elder) |
| 1 | Forest Path | Dark woods leading north | Enemy (Wolf), Item (Herb) |
| 2 | River Crossing | A shallow ford | Item (Old Sword) |
| 3 | Abandoned Mine | Deep tunnels | Enemy (Goblin), Item (Torch) |
| 4 | Mountain Pass | Windy heights | Enemy (Bandit) |
| 5 | Ancient Ruins | Crumbling stone | Enemy (Skeleton), Item (Shield) |
| 6 | Dark Cave | Boss area | Enemy (Cave Troll - boss) |
| 7 | Hidden Shrine | Secret area | Rest, Item (Amulet) |

Connectivity forms a small graph (not linear — branching paths).

### Step 11: Dockerfile + SSH Setup

```dockerfile
# Build stage
FROM rust:1.85-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y openssh-server && rm -rf /var/lib/apt/lists/*
RUN mkdir /var/run/sshd

# SSH config: allow password-free login, force game as shell
COPY sshd_config /etc/ssh/sshd_config
COPY --from=builder /app/target/release/hunter-game /usr/local/bin/hunter-game
COPY entrypoint.sh /entrypoint.sh
COPY assets/ /app/assets/
RUN chmod +x /entrypoint.sh

# Create game data directory
RUN mkdir -p /app/data/players

EXPOSE 22
WORKDIR /app
ENTRYPOINT ["/entrypoint.sh"]
```

**sshd_config** (key points):
- `PermitEmptyPasswords yes` or use key-based auth
- `ForceCommand /usr/local/bin/hunter-game` — every SSH session runs the game
- `AllowTcpForwarding no`

**entrypoint.sh**:
- Generate SSH host keys if missing
- Create a `hunter` user with no password
- Start sshd in foreground

The player name will be derived from the SSH username or a prompt on startup.

**Railway**: Expose port 22, users connect via `ssh hunter@<app>.railway.app`.

### Step 12: Data directory strategy

- `/app/data/players/<name>.json` — per-player saves
- `/app/data/world_state.json` — shared world state
- On Railway, mount a persistent volume at `/app/data` so saves survive redeploys

---

## Implementation Order

1. **Cargo.toml** — add ratatui, chrono
2. **game/player.rs** — Player, Item structs
3. **game/world.rs** — Tile, TileEvent, EnemyTemplate, hardcoded world, WorldState
4. **game/combat.rs** — CombatState, combat logic
5. **game/persistence.rs** — save/load player + world
6. **game/mod.rs** — GameState, Screen enum, handle_input, tick
7. **app.rs** — App struct, main loop
8. **ui/mod.rs** — draw dispatcher, layout
9. **ui/title_screen.rs** — title screen rendering
10. **ui/explore_screen.rs** — exploration view
11. **ui/combat_screen.rs** — combat view
12. **ui/inventory_screen.rs** — inventory/stats view
13. **ui/game_over_screen.rs** — game over view
14. **main.rs** — rewrite entry point
15. **Dockerfile + sshd_config + entrypoint.sh** — deployment
16. **Build & test** — cargo build, fix errors, verify game loop

---

## Design Decisions

- **ratatui** over raw crossterm: gives us layout, widgets, borders, styled text out of the box — much less boilerplate for a good-looking TUI.
- **File-based persistence** over a database: simplest approach, works with Railway volumes, easy to swap for SQLite later.
- **Atomic file writes** (write tmp + rename) for world state: prevents corruption from concurrent SSH sessions.
- **Player name from env/args**: SSH `ForceCommand` can pass `$USER` as argument, giving each session its own save.
- **State machine screens**: clean separation, easy to add new screens later (shop, dialogue, etc.).
- **Hardcoded world in Rust**: keeps it simple now; later, tiles and events can come from JSON files or an LLM API call.

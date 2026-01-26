# Hunter Game - AI Agent Guidelines

## Project Overview

**Hunter Game** is a terminal-based interactive text role-playing game written in Rust. Players navigate through a dark fantasy world as hunters, making choices that affect the story, engaging in combat, and managing resources.

## Tech Stack

- **Language**: Rust (latest stable)
- **Terminal UI**: `crossterm` for cross-platform terminal manipulation
- **Image Rendering**: Custom ASCII art renderer using `image` crate (works in any terminal including Ghostty)
- **Serialization**: `serde` + `serde_json` for save/load functionality
- **Random**: `rand` for dice rolls and randomization
- **Error Handling**: `anyhow` for ergonomic error handling

## Project Structure

```
hunter-game/
├── Cargo.toml
├── src/
│   ├── main.rs           # Entry point, game loop
│   ├── game/
│   │   ├── mod.rs        # Game state management
│   │   ├── combat.rs     # Combat system
│   │   └── events.rs     # Random events and encounters
│   ├── player/
│   │   ├── mod.rs        # Player struct and methods
│   │   ├── inventory.rs  # Inventory management
│   │   └── stats.rs      # Player statistics
│   ├── world/
│   │   ├── mod.rs        # World/location management
│   │   ├── locations.rs  # Location definitions
│   │   └── npcs.rs       # Non-player characters
│   ├── story/
│   │   ├── mod.rs        # Story/narrative engine
│   │   └── dialogue.rs   # Dialogue system
│   └── ui/
│       ├── mod.rs        # Terminal UI utilities
│       ├── input.rs      # Input handling
│       ├── display.rs    # Text display and formatting
│       └── images.rs     # Image rendering utilities
├── data/
│   ├── locations.json    # Location data
│   ├── items.json        # Item definitions
│   └── enemies.json      # Enemy definitions
├── assets/
│   └── images/           # Game images (PNG/JPG for terminal display)
│       ├── locations/    # Location artwork
│       ├── enemies/      # Enemy portraits
│       └── items/        # Item icons
└── saves/                # Player save files
```

## Core Game Mechanics

### Player Stats
- **Health**: Current/max health points
- **Stamina**: Used for actions and combat
- **Gold**: Currency for trading
- **Experience**: Progression towards leveling up

### Combat System
- Turn-based combat with action choices (attack, defend, use item, flee)
- Damage calculation based on player stats and equipment
- Enemy AI with varied behaviors

### World Navigation
- Text descriptions of locations
- Numbered choices for movement and interaction
- Random encounters during travel

### Inventory System
- Weapons, armor, consumables
- Equipment slots affecting stats
- Weight/capacity limits

### Image Rendering (ASCII Art)
- Custom ASCII art renderer that works in **any terminal** (including Ghostty)
- Supports both grayscale and **ANSI true color** output
- Uses luminance-based character mapping for accurate representation
- Images for: location scenes, enemy encounters, item displays, title screen
- **Supported formats**: PNG, GIF, WebP
- Keep source images reasonably sized; they're resized to fit terminal width
- Colored output uses ANSI 24-bit true color escape sequences

## Coding Guidelines

### Style
- Follow Rust idioms and best practices
- Use `rustfmt` for formatting
- Use `clippy` for linting
- Prefer `Result` and `Option` over panics
- Write descriptive error messages

### Architecture
- Keep modules focused and single-purpose
- Use traits for shared behavior (e.g., `Combatant`, `Displayable`)
- Separate data (JSON files) from logic
- Game state should be serializable for save/load

### Testing
- Unit tests for combat calculations
- Integration tests for game flow
- Test save/load functionality

## Development Phases

### Phase 1: Foundation
- [ ] Basic game loop with input/output
- [ ] Player creation and stats
- [ ] Simple location system
- [ ] Save/load functionality

### Phase 2: Core Gameplay
- [ ] Combat system
- [ ] Inventory management
- [ ] Multiple locations with navigation
- [ ] Basic enemies

### Phase 3: Content & Polish
- [ ] Story/quest system
- [ ] NPCs and dialogue
- [ ] More items, enemies, locations
- [ ] Game balance tuning

### Phase 4: Enhancement
- [ ] ASCII art and visual polish
- [ ] Sound effects (optional)
- [ ] Achievements/unlockables
- [ ] Multiple endings

## Commands for Development

```bash
# Build the project
cargo build

# Run the game
cargo run

# Run tests
cargo test

# Check for issues
cargo clippy

# Format code
cargo fmt
```

## Notes for AI Agents

- When implementing features, start simple and iterate
- Prioritize working code over perfect code
- Keep the player experience in mind - clear prompts, helpful feedback
- Text should be evocative but concise for terminal readability
- Test combat balance with actual gameplay
- Preserve backwards compatibility with save files when changing data structures

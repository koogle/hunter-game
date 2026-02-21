pub mod combat;
pub mod dice;
pub mod persistence;
pub mod player;
pub mod world;

use crossterm::event::{KeyCode, KeyEvent};
use rand::Rng;

use combat::{CombatAction, CombatPhase, CombatState};
use player::Player;
use world::{Tile, TileEvent, WorldState};

// ── Screens ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub enum Screen {
    Title,
    NameEntry,
    Explore,
    Combat,
    Inventory,
    GameOver,
    Victory,
}

// ── Game state ───────────────────────────────────────────────────────

pub struct GameState {
    pub screen: Screen,
    pub player: Player,
    pub tiles: Vec<Tile>,
    pub world_state: WorldState,
    pub combat: Option<CombatState>,
    pub log: Vec<String>,
    pub selected: usize,
    pub should_quit: bool,
    pub name_input: String,
    pub tile_event_index: usize,
}

impl GameState {
    pub fn new() -> Self {
        let tiles = world::build_world();
        let world_state = persistence::load_world_state().unwrap_or_default();

        Self {
            screen: Screen::Title,
            player: Player::new("".into()),
            tiles,
            world_state,
            combat: None,
            log: vec!["Welcome to Hunter Game.".into()],
            selected: 0,
            should_quit: false,
            name_input: String::new(),
            tile_event_index: 0,
        }
    }

    pub fn current_tile(&self) -> &Tile {
        &self.tiles[self.player.current_tile]
    }

    pub fn handle_input(&mut self, key: KeyEvent) {
        match self.screen {
            Screen::Title => self.handle_title(key),
            Screen::NameEntry => self.handle_name_entry(key),
            Screen::Explore => self.handle_explore(key),
            Screen::Combat => self.handle_combat(key),
            Screen::Inventory => self.handle_inventory(key),
            Screen::GameOver => self.handle_game_over(key),
            Screen::Victory => self.handle_game_over(key),
        }
    }

    // ── Title ────────────────────────────────────────────────────────

    fn handle_title(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Enter | KeyCode::Char(' ') => {
                self.screen = Screen::NameEntry;
                self.name_input.clear();
            }
            KeyCode::Char('q') => self.should_quit = true,
            _ => {}
        }
    }

    // ── Name entry ───────────────────────────────────────────────────

    fn handle_name_entry(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Enter => {
                if self.name_input.trim().is_empty() {
                    return;
                }
                let name = self.name_input.trim().to_string();
                self.start_game(name);
            }
            KeyCode::Backspace => {
                self.name_input.pop();
            }
            KeyCode::Char(c) if self.name_input.len() < 20 => {
                self.name_input.push(c);
            }
            KeyCode::Esc => {
                self.screen = Screen::Title;
            }
            _ => {}
        }
    }

    fn start_game(&mut self, name: String) {
        // Try to load existing save
        if let Ok(Some(saved)) = persistence::load_player(&name) {
            self.player = saved;
            self.log = vec![format!("Welcome back, {}!", self.player.name)];
        } else {
            self.player = Player::new(name.clone());
            self.log = vec![format!("A new hunter rises: {}!", name)];
        }

        // Reload shared world state
        if let Ok(ws) = persistence::reload_world_state() {
            self.world_state = ws;
        }

        self.screen = Screen::Explore;
        self.selected = 0;
        self.tile_event_index = 0;
        self.describe_current_tile();
    }

    // ── Explore ──────────────────────────────────────────────────────

    fn handle_explore(&mut self, key: KeyEvent) {
        let tile = self.current_tile().clone();
        let num_options = self.explore_options_count(&tile);

        match key.code {
            KeyCode::Up | KeyCode::Char('k') => {
                if self.selected > 0 {
                    self.selected -= 1;
                }
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if self.selected + 1 < num_options {
                    self.selected += 1;
                }
            }
            KeyCode::Enter => {
                self.execute_explore_option(&tile);
            }
            KeyCode::Char('i') => {
                self.screen = Screen::Inventory;
                self.selected = 0;
            }
            KeyCode::Char('q') => self.should_quit = true,
            _ => {}
        }
    }

    fn explore_options_count(&self, tile: &Tile) -> usize {
        // Connections + interact + rest (if available)
        let mut count = tile.connections.len(); // travel options
        count += 1; // "Look around" / interact with events
        count // total
    }

    fn execute_explore_option(&mut self, tile: &Tile) {
        let travel_count = tile.connections.len();

        if self.selected < travel_count {
            // Travel to connected tile
            let dest = tile.connections[self.selected];
            self.player.current_tile = dest;
            self.selected = 0;
            self.tile_event_index = 0;
            self.describe_current_tile();
            self.trigger_tile_event();
            self.auto_save();
        } else {
            // "Look around" — cycle through tile events
            self.interact_with_tile();
        }
    }

    fn describe_current_tile(&mut self) {
        let tile = self.current_tile().clone();
        self.log.push(format!("── {} ──", tile.name));
        self.log.push(tile.description.clone());

        // Show world messages for this tile
        let messages: Vec<_> = self
            .world_state
            .messages
            .iter()
            .filter(|m| m.tile_id == tile.id)
            .collect();
        if !messages.is_empty() {
            for msg in messages.iter().rev().take(3) {
                self.log
                    .push(format!("  [{}]: \"{}\"", msg.author, msg.text));
            }
        }
    }

    fn trigger_tile_event(&mut self) {
        let tile = self.current_tile().clone();
        if tile.events.is_empty() {
            return;
        }

        // Roll against the tile's encounter chance
        let mut rng = rand::thread_rng();
        let roll: f64 = rng.r#gen();
        if roll >= tile.encounter_chance {
            self.log.push("The area seems quiet... for now.".into());
            return;
        }

        // Encounter triggered — pick a random event
        let event = &tile.events[rng.gen_range(0..tile.events.len())];

        match event {
            TileEvent::Enemy(template) => {
                // Check if boss already defeated globally
                if template.is_boss
                    && self
                        .world_state
                        .defeated_bosses
                        .contains(&template.name)
                {
                    self.log.push(format!(
                        "The {} has already been slain by another hunter.",
                        template.name
                    ));
                    return;
                }
                self.combat = Some(CombatState::from_template(template));
                self.screen = Screen::Combat;
                self.selected = 0;
            }
            TileEvent::Nothing => {
                self.log.push("The area is quiet.".into());
            }
            _ => {} // Npc, ItemPickup, Rest handled via "look around"
        }
    }

    fn interact_with_tile(&mut self) {
        let tile = self.current_tile().clone();
        if tile.events.is_empty() {
            self.log.push("Nothing of interest here.".into());
            return;
        }

        let event = &tile.events[self.tile_event_index % tile.events.len()];
        self.tile_event_index += 1;

        match event {
            TileEvent::Enemy(template) => {
                if template.is_boss
                    && self
                        .world_state
                        .defeated_bosses
                        .contains(&template.name)
                {
                    self.log.push(format!(
                        "The {} has already been defeated.",
                        template.name
                    ));
                    return;
                }
                self.combat = Some(CombatState::from_template(template));
                self.screen = Screen::Combat;
                self.selected = 0;
            }
            TileEvent::ItemPickup(item) => {
                self.log
                    .push(format!("You found: {} — {}", item.name, item.description));
                self.player.inventory.push(item.clone());
                self.auto_save();
            }
            TileEvent::Npc { name, dialogue } => {
                self.log.push(format!("{}: \"{}\"", name, dialogue));
            }
            TileEvent::Rest => {
                let healed = self.player.max_hp - self.player.hp;
                self.player.hp = self.player.max_hp;
                if healed > 0 {
                    self.log
                        .push(format!("You rest and recover {} HP. (Full health)", healed));
                } else {
                    self.log.push("You rest, but you're already at full health.".into());
                }
                self.auto_save();
            }
            TileEvent::Nothing => {
                self.log.push("You look around but find nothing new.".into());
            }
        }
    }

    // ── Combat ───────────────────────────────────────────────────────

    fn handle_combat(&mut self, key: KeyEvent) {
        let Some(ref combat) = self.combat else {
            return;
        };

        match combat.phase {
            CombatPhase::PlayerChoosing => match key.code {
                KeyCode::Up | KeyCode::Char('k') => {
                    if self.selected > 0 {
                        self.selected -= 1;
                    }
                }
                KeyCode::Down | KeyCode::Char('j') => {
                    if self.selected + 1 < CombatAction::ALL.len() {
                        self.selected += 1;
                    }
                }
                KeyCode::Enter => {
                    let mut combat = self.combat.take().unwrap();
                    combat.selected_action = self.selected;
                    combat.execute_action(&mut self.player);

                    // Copy combat log into game log
                    let new_entries: Vec<String> = combat.log.clone();
                    self.log.extend(new_entries);

                    match combat.phase {
                        CombatPhase::Victory => {
                            self.resolve_victory(&combat);
                            self.combat = None;
                            self.screen = Screen::Explore;
                            self.selected = 0;
                        }
                        CombatPhase::Defeat => {
                            self.combat = None;
                            self.screen = Screen::GameOver;
                        }
                        CombatPhase::Fled => {
                            self.combat = None;
                            self.screen = Screen::Explore;
                            self.selected = 0;
                        }
                        _ => {
                            self.combat = Some(combat);
                        }
                    }
                }
                _ => {}
            },
            CombatPhase::Victory | CombatPhase::Defeat | CombatPhase::Fled => {
                // Any key continues
                self.combat = None;
                self.screen = Screen::Explore;
                self.selected = 0;
            }
        }
    }

    fn resolve_victory(&mut self, combat: &CombatState) {
        let leveled = self.player.gain_exp(combat.exp_reward);
        self.log
            .push(format!("You gained {} EXP!", combat.exp_reward));
        if leveled {
            self.log.push(format!(
                "LEVEL UP! You are now level {}!",
                self.player.level
            ));
        }

        if let Some(ref loot) = combat.loot {
            self.log
                .push(format!("Loot: {} — {}", loot.name, loot.description));
            self.player.inventory.push(loot.clone());
        }

        // Boss tracking
        if combat.is_boss {
            self.world_state
                .defeated_bosses
                .push(combat.enemy_name.clone());
            self.log.push(format!(
                "The {} has been vanquished! All hunters will know of this deed.",
                combat.enemy_name
            ));

            // Check victory condition: both bosses defeated
            if self.world_state.defeated_bosses.contains(&"Cave Troll".to_string())
                && self
                    .world_state
                    .defeated_bosses
                    .contains(&"Shrine Guardian".to_string())
            {
                self.screen = Screen::Victory;
                self.log.push(
                    "With both ancient evils vanquished, peace returns to the land!".into(),
                );
            }
        }

        self.world_state.global_kill_count += 1;
        let _ = persistence::save_world_state(&self.world_state);
        self.auto_save();
    }

    // ── Inventory ────────────────────────────────────────────────────

    fn handle_inventory(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc | KeyCode::Char('i') => {
                self.screen = Screen::Explore;
                self.selected = 0;
            }
            KeyCode::Up | KeyCode::Char('k') => {
                if self.selected > 0 {
                    self.selected -= 1;
                }
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if !self.player.inventory.is_empty()
                    && self.selected + 1 < self.player.inventory.len()
                {
                    self.selected += 1;
                }
            }
            _ => {}
        }
    }

    // ── Game Over ────────────────────────────────────────────────────

    fn handle_game_over(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Enter | KeyCode::Char('r') => {
                // Restart with same name
                let name = self.player.name.clone();
                self.player = Player::new(name);
                self.screen = Screen::Explore;
                self.selected = 0;
                self.log = vec!["You awaken once more...".into()];
                self.describe_current_tile();
                self.auto_save();
            }
            KeyCode::Char('q') => self.should_quit = true,
            _ => {}
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────

    fn auto_save(&self) {
        let _ = persistence::save_player(&self.player);
    }
}

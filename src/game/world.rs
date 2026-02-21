use serde::{Deserialize, Serialize};

use super::player::Item;

// ── Tile events ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnemyTemplate {
    pub name: String,
    pub hp: i32,
    pub damage: i32,
    pub exp_reward: u32,
    pub loot: Option<Item>,
    pub is_boss: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TileEvent {
    Enemy(EnemyTemplate),
    ItemPickup(Item),
    Npc {
        name: String,
        dialogue: String,
    },
    Rest,
    Nothing,
}

// ── Tile ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tile {
    pub id: usize,
    pub name: String,
    pub description: String,
    pub connections: Vec<usize>,
    pub events: Vec<TileEvent>,
}

// ── Shared world state (persisted, shared across all players) ────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorldState {
    pub defeated_bosses: Vec<String>,
    pub discovered_secrets: Vec<String>,
    pub global_kill_count: u32,
    pub messages: Vec<PlayerMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerMessage {
    pub author: String,
    pub text: String,
    pub tile_id: usize,
}

// ── Hardcoded world builder ──────────────────────────────────────────

pub fn build_world() -> Vec<Tile> {
    use super::player::ItemType;

    vec![
        // 0 — Village Square
        Tile {
            id: 0,
            name: "Village Square".into(),
            description: "A quiet village square with a stone well at its center. \
                An old elder sits on a bench nearby. Paths lead north into the \
                forest and east toward the river."
                .into(),
            connections: vec![1, 2],
            events: vec![
                TileEvent::Rest,
                TileEvent::Npc {
                    name: "Elder Maren".into(),
                    dialogue: "Welcome, hunter. Dark creatures stir in the mines \
                        to the north. Be careful out there... and bring potions."
                        .into(),
                },
            ],
        },
        // 1 — Forest Path
        Tile {
            id: 1,
            name: "Forest Path".into(),
            description: "Tall oaks tower above a narrow dirt path. Shadows shift \
                between the trunks. The village lies south; deeper woods and the \
                old mine entrance wait to the north."
                .into(),
            connections: vec![0, 3, 4],
            events: vec![
                TileEvent::Enemy(EnemyTemplate {
                    name: "Wild Wolf".into(),
                    hp: 15,
                    damage: 4,
                    exp_reward: 15,
                    loot: None,
                    is_boss: false,
                }),
                TileEvent::ItemPickup(Item {
                    name: "Forest Herb".into(),
                    description: "A fragrant herb. Restores 8 HP.".into(),
                    item_type: ItemType::Potion,
                    value: 8,
                }),
            ],
        },
        // 2 — River Crossing
        Tile {
            id: 2,
            name: "River Crossing".into(),
            description: "A shallow ford crosses a rushing river. Smooth stones \
                glint beneath the clear water. The village is to the west; \
                mountain trails climb to the east."
                .into(),
            connections: vec![0, 5],
            events: vec![
                TileEvent::ItemPickup(Item {
                    name: "Sturdy Sword".into(),
                    description: "A solid blade wedged between the rocks.".into(),
                    item_type: ItemType::Weapon,
                    value: 5,
                }),
                TileEvent::Nothing,
            ],
        },
        // 3 — Abandoned Mine
        Tile {
            id: 3,
            name: "Abandoned Mine".into(),
            description: "Rotting timber frames a dark tunnel mouth. The air is \
                damp and smells of iron. Deeper shafts branch off into blackness. \
                The forest path lies behind you."
                .into(),
            connections: vec![1, 6],
            events: vec![
                TileEvent::Enemy(EnemyTemplate {
                    name: "Goblin Scout".into(),
                    hp: 12,
                    damage: 3,
                    exp_reward: 12,
                    loot: Some(Item {
                        name: "Goblin Dagger".into(),
                        description: "A crude but sharp dagger.".into(),
                        item_type: ItemType::Weapon,
                        value: 4,
                    }),
                    is_boss: false,
                }),
                TileEvent::ItemPickup(Item {
                    name: "Torch".into(),
                    description: "A flickering torch. Might be useful.".into(),
                    item_type: ItemType::Misc,
                    value: 0,
                }),
            ],
        },
        // 4 — Mossy Clearing
        Tile {
            id: 4,
            name: "Mossy Clearing".into(),
            description: "A sun-dappled clearing carpeted in soft moss. Birdsong \
                fills the air. A crumbling stone arch stands at the far end, \
                half-swallowed by ivy."
                .into(),
            connections: vec![1, 7],
            events: vec![
                TileEvent::Rest,
                TileEvent::Enemy(EnemyTemplate {
                    name: "Giant Spider".into(),
                    hp: 18,
                    damage: 5,
                    exp_reward: 20,
                    loot: Some(Item {
                        name: "Spider Silk".into(),
                        description: "Tough, shimmering silk. Could fetch a price.".into(),
                        item_type: ItemType::Misc,
                        value: 0,
                    }),
                    is_boss: false,
                }),
            ],
        },
        // 5 — Mountain Pass
        Tile {
            id: 5,
            name: "Mountain Pass".into(),
            description: "A narrow trail hugs the mountainside. Wind howls through \
                gaps in the rock. Far below, the river glitters. The ancient \
                ruins lie ahead."
                .into(),
            connections: vec![2, 7],
            events: vec![
                TileEvent::Enemy(EnemyTemplate {
                    name: "Mountain Bandit".into(),
                    hp: 20,
                    damage: 6,
                    exp_reward: 25,
                    loot: Some(Item {
                        name: "Health Potion".into(),
                        description: "A red vial. Restores 15 HP.".into(),
                        item_type: ItemType::Potion,
                        value: 15,
                    }),
                    is_boss: false,
                }),
                TileEvent::Nothing,
            ],
        },
        // 6 — Deep Mine (Boss)
        Tile {
            id: 6,
            name: "Deep Mine".into(),
            description: "The tunnel opens into a vast underground cavern. \
                Stalactites drip overhead. Something large shifts in the \
                darkness ahead, its eyes reflecting your torchlight."
                .into(),
            connections: vec![3],
            events: vec![TileEvent::Enemy(EnemyTemplate {
                name: "Cave Troll".into(),
                hp: 50,
                damage: 10,
                exp_reward: 100,
                loot: Some(Item {
                    name: "Troll's Greataxe".into(),
                    description: "A massive axe pulsing with dark energy.".into(),
                    item_type: ItemType::Weapon,
                    value: 10,
                }),
                is_boss: true,
            })],
        },
        // 7 — Ancient Ruins
        Tile {
            id: 7,
            name: "Ancient Ruins".into(),
            description: "Weathered pillars rise from overgrown flagstones. \
                Faded carvings depict hunters battling monstrous creatures. \
                A hidden shrine glows faintly to the north."
                .into(),
            connections: vec![4, 5, 8],
            events: vec![
                TileEvent::Enemy(EnemyTemplate {
                    name: "Skeleton Warrior".into(),
                    hp: 22,
                    damage: 7,
                    exp_reward: 30,
                    loot: Some(Item {
                        name: "Bone Shield".into(),
                        description: "A shield fashioned from ancient bones. +3 def.".into(),
                        item_type: ItemType::Misc,
                        value: 3,
                    }),
                    is_boss: false,
                }),
                TileEvent::Nothing,
            ],
        },
        // 8 — Hidden Shrine (Boss)
        Tile {
            id: 8,
            name: "Hidden Shrine".into(),
            description: "A sacred chamber bathed in pale blue light. An altar \
                stands at the center, and the air hums with old magic. But a \
                guardian still watches over this place..."
                .into(),
            connections: vec![7],
            events: vec![
                TileEvent::Enemy(EnemyTemplate {
                    name: "Shrine Guardian".into(),
                    hp: 60,
                    damage: 12,
                    exp_reward: 150,
                    loot: Some(Item {
                        name: "Guardian's Amulet".into(),
                        description: "A radiant amulet. You feel its power.".into(),
                        item_type: ItemType::Misc,
                        value: 0,
                    }),
                    is_boss: true,
                }),
                TileEvent::Rest,
            ],
        },
    ]
}

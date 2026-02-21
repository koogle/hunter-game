use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ItemType {
    Weapon,
    Potion,
    Key,
    Misc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub name: String,
    pub description: String,
    pub item_type: ItemType,
    /// Context-dependent value: heal amount for potions, damage for weapons, etc.
    pub value: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub name: String,
    pub hp: i32,
    pub max_hp: i32,
    pub level: u32,
    pub exp: u32,
    pub exp_to_next: u32,
    pub attack: i32,
    pub defense: i32,
    pub inventory: Vec<Item>,
    pub current_tile: usize,
}

impl Player {
    pub fn new(name: String) -> Self {
        Self {
            name,
            hp: 30,
            max_hp: 30,
            level: 1,
            exp: 0,
            exp_to_next: 50,
            attack: 5,
            defense: 2,
            inventory: vec![
                Item {
                    name: "Rusty Sword".into(),
                    description: "A worn but serviceable blade.".into(),
                    item_type: ItemType::Weapon,
                    value: 3,
                },
                Item {
                    name: "Small Potion".into(),
                    description: "Restores 10 HP.".into(),
                    item_type: ItemType::Potion,
                    value: 10,
                },
            ],
            current_tile: 0,
        }
    }

    pub fn is_alive(&self) -> bool {
        self.hp > 0
    }

    pub fn heal(&mut self, amount: i32) {
        self.hp = (self.hp + amount).min(self.max_hp);
    }

    #[allow(dead_code)]
    pub fn take_damage(&mut self, amount: i32) {
        let reduced = (amount - self.defense).max(1);
        self.hp = (self.hp - reduced).max(0);
    }

    pub fn gain_exp(&mut self, amount: u32) -> bool {
        self.exp += amount;
        if self.exp >= self.exp_to_next {
            self.level_up();
            true
        } else {
            false
        }
    }

    fn level_up(&mut self) {
        self.exp -= self.exp_to_next;
        self.level += 1;
        self.exp_to_next = 50 * self.level;
        self.max_hp += 5;
        self.hp = self.max_hp;
        self.attack += 2;
        self.defense += 1;
    }

    pub fn best_weapon_damage(&self) -> i32 {
        self.inventory
            .iter()
            .filter(|i| i.item_type == ItemType::Weapon)
            .map(|i| i.value)
            .max()
            .unwrap_or(0)
    }

    pub fn total_attack(&self) -> i32 {
        self.attack + self.best_weapon_damage()
    }

    pub fn potion_count(&self) -> usize {
        self.inventory
            .iter()
            .filter(|i| i.item_type == ItemType::Potion)
            .count()
    }

    /// Use the first potion in inventory. Returns heal amount or None.
    pub fn use_potion(&mut self) -> Option<i32> {
        if let Some(idx) = self
            .inventory
            .iter()
            .position(|i| i.item_type == ItemType::Potion)
        {
            let value = self.inventory[idx].value;
            self.inventory.remove(idx);
            self.heal(value);
            Some(value)
        } else {
            None
        }
    }
}

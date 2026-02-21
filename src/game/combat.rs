use rand::Rng;

use super::player::Player;
use super::world::EnemyTemplate;

#[derive(Debug, Clone, PartialEq)]
pub enum CombatAction {
    Attack,
    Defend,
    UsePotion,
    Flee,
}

impl CombatAction {
    pub const ALL: [CombatAction; 4] = [
        CombatAction::Attack,
        CombatAction::Defend,
        CombatAction::UsePotion,
        CombatAction::Flee,
    ];

    pub fn label(&self) -> &'static str {
        match self {
            CombatAction::Attack => "Attack",
            CombatAction::Defend => "Defend",
            CombatAction::UsePotion => "Use Potion",
            CombatAction::Flee => "Flee",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum CombatPhase {
    PlayerChoosing,
    Victory,
    Defeat,
    Fled,
}

#[derive(Debug, Clone)]
pub struct CombatState {
    pub enemy_name: String,
    pub enemy_hp: i32,
    pub enemy_max_hp: i32,
    pub enemy_damage: i32,
    pub exp_reward: u32,
    pub is_boss: bool,
    pub loot: Option<super::player::Item>,
    pub phase: CombatPhase,
    pub selected_action: usize,
    pub defending: bool,
    pub log: Vec<String>,
}

impl CombatState {
    pub fn from_template(template: &EnemyTemplate) -> Self {
        Self {
            enemy_name: template.name.clone(),
            enemy_hp: template.hp,
            enemy_max_hp: template.hp,
            enemy_damage: template.damage,
            exp_reward: template.exp_reward,
            is_boss: template.is_boss,
            loot: template.loot.clone(),
            phase: CombatPhase::PlayerChoosing,
            selected_action: 0,
            defending: false,
            log: vec![format!("A {} appears!", template.name)],
        }
    }

    pub fn execute_action(&mut self, player: &mut Player) {
        let action = CombatAction::ALL[self.selected_action].clone();
        self.defending = false;

        match action {
            CombatAction::Attack => {
                let mut rng = rand::thread_rng();
                let variance = rng.gen_range(-2..=2);
                let damage = (player.total_attack() + variance).max(1);
                self.enemy_hp = (self.enemy_hp - damage).max(0);
                self.log
                    .push(format!("You strike the {} for {} damage!", self.enemy_name, damage));

                if self.enemy_hp <= 0 {
                    self.phase = CombatPhase::Victory;
                    self.log.push(format!("The {} is defeated!", self.enemy_name));
                    return;
                }
            }
            CombatAction::Defend => {
                self.defending = true;
                self.log.push("You brace yourself, reducing incoming damage.".into());
            }
            CombatAction::UsePotion => {
                if let Some(healed) = player.use_potion() {
                    self.log.push(format!("You drink a potion and recover {} HP.", healed));
                } else {
                    self.log.push("You have no potions!".into());
                }
            }
            CombatAction::Flee => {
                let mut rng = rand::thread_rng();
                if rng.gen_bool(0.5) {
                    self.phase = CombatPhase::Fled;
                    self.log.push("You manage to escape!".into());
                    return;
                } else {
                    self.log.push("You fail to escape!".into());
                }
            }
        }

        // Enemy turn
        self.enemy_turn(player);
    }

    fn enemy_turn(&mut self, player: &mut Player) {
        let mut rng = rand::thread_rng();
        let variance = rng.gen_range(-1..=2);
        let mut damage = (self.enemy_damage + variance).max(1);

        if self.defending {
            damage /= 2;
            damage = damage.max(1);
        }

        let reduced = (damage - player.defense).max(1);
        player.hp = (player.hp - reduced).max(0);
        self.log.push(format!(
            "The {} attacks you for {} damage!",
            self.enemy_name, reduced
        ));

        if !player.is_alive() {
            self.phase = CombatPhase::Defeat;
            self.log.push("You have been slain...".into());
        } else {
            self.phase = CombatPhase::PlayerChoosing;
        }
    }
}

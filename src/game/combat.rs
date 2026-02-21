use super::dice::Dice;
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
    pub enemy_damage_dice: Dice,
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
            enemy_damage_dice: template.damage_dice.clone(),
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
                // Player rolls: 1d6 + total_attack bonus (weapon + level)
                let attack_dice = Dice::new(1, 6, player.total_attack());
                let result = attack_dice.roll();
                let damage = result.total;
                self.enemy_hp = (self.enemy_hp - damage).max(0);
                self.log.push(format!(
                    "You attack! ({}) = {} damage!",
                    result, damage
                ));

                if self.enemy_hp <= 0 {
                    self.phase = CombatPhase::Victory;
                    self.log
                        .push(format!("The {} is defeated!", self.enemy_name));
                    return;
                }
            }
            CombatAction::Defend => {
                self.defending = true;
                self.log
                    .push("You brace yourself, reducing incoming damage.".into());
            }
            CombatAction::UsePotion => {
                if let Some(healed) = player.use_potion() {
                    self.log
                        .push(format!("You drink a potion and recover {} HP.", healed));
                } else {
                    self.log.push("You have no potions!".into());
                }
            }
            CombatAction::Flee => {
                // Roll 1d20 — flee on 11+ (50%)
                let flee_roll = Dice::new(1, 20, 0).roll();
                if flee_roll.total >= 11 {
                    self.phase = CombatPhase::Fled;
                    self.log.push(format!(
                        "You roll to flee ({}) — escaped!",
                        flee_roll
                    ));
                    return;
                } else {
                    self.log.push(format!(
                        "You roll to flee ({}) — failed!",
                        flee_roll
                    ));
                }
            }
        }

        // Enemy turn
        self.enemy_turn(player);
    }

    fn enemy_turn(&mut self, player: &mut Player) {
        let result = self.enemy_damage_dice.roll();
        let mut damage = result.total;

        if self.defending {
            damage /= 2;
            damage = damage.max(1);
        }

        let reduced = (damage - player.defense).max(1);
        player.hp = (player.hp - reduced).max(0);

        if self.defending {
            self.log.push(format!(
                "The {} attacks! ({}) — blocked! {} damage taken.",
                self.enemy_name, result, reduced
            ));
        } else {
            self.log.push(format!(
                "The {} attacks! ({}) = {} damage!",
                self.enemy_name, result, reduced
            ));
        }

        if !player.is_alive() {
            self.phase = CombatPhase::Defeat;
            self.log.push("You have been slain...".into());
        } else {
            self.phase = CombatPhase::PlayerChoosing;
        }
    }
}

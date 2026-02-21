use std::fmt;

use rand::Rng;
use serde::{Deserialize, Serialize};

/// A dice expression like 2d6+3.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dice {
    pub count: u32,
    pub sides: u32,
    pub bonus: i32,
}

impl Dice {
    pub fn new(count: u32, sides: u32, bonus: i32) -> Self {
        Self { count, sides, bonus }
    }

    /// Roll the dice and return (total, individual_rolls).
    pub fn roll(&self) -> DiceResult {
        let mut rng = rand::thread_rng();
        let rolls: Vec<u32> = (0..self.count)
            .map(|_| rng.gen_range(1..=self.sides))
            .collect();
        let sum: i32 = rolls.iter().map(|&r| r as i32).sum::<i32>() + self.bonus;
        DiceResult {
            total: sum.max(1),
            rolls,
            dice: self.clone(),
        }
    }
}

impl fmt::Display for Dice {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}d{}", self.count, self.sides)?;
        match self.bonus.cmp(&0) {
            std::cmp::Ordering::Greater => write!(f, "+{}", self.bonus),
            std::cmp::Ordering::Less => write!(f, "{}", self.bonus), // negative sign included
            std::cmp::Ordering::Equal => Ok(()),
        }
    }
}

pub struct DiceResult {
    pub total: i32,
    pub rolls: Vec<u32>,
    pub dice: Dice,
}

impl fmt::Display for DiceResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let rolls_str: Vec<String> = self.rolls.iter().map(|r| r.to_string()).collect();
        write!(
            f,
            "{} [{}] = {}",
            self.dice,
            rolls_str.join("+"),
            self.total
        )
    }
}

use std::io;

use anyhow::Result;
use crossterm::event::{self, Event};
use ratatui::backend::CrosstermBackend;
use ratatui::Terminal;

use crate::game::GameState;
use crate::ui;

pub struct App {
    pub game: GameState,
}

impl App {
    pub fn new() -> Self {
        Self {
            game: GameState::new(),
        }
    }

    pub fn run(&mut self, terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()> {
        loop {
            // Render
            terminal.draw(|frame| ui::draw(frame, &self.game))?;

            // Handle input (blocking)
            if let Event::Key(key) = event::read()? {
                // Ignore key release events on Windows
                if key.kind == crossterm::event::KeyEventKind::Press {
                    self.game.handle_input(key);
                }
            }

            if self.game.should_quit {
                break;
            }
        }

        Ok(())
    }
}

mod combat_screen;
mod explore_screen;
mod game_over_screen;
mod inventory_screen;
mod title_screen;

use ratatui::prelude::*;
use ratatui::widgets::{Block, Borders, Gauge, Paragraph};

use crate::game::{GameState, Screen};

/// Main draw dispatcher — called each frame, pure rendering.
pub fn draw(frame: &mut Frame, game: &GameState) {
    let area = frame.area();

    match game.screen {
        Screen::Title => title_screen::draw(frame, area, game),
        Screen::NameEntry => title_screen::draw_name_entry(frame, area, game),
        Screen::Explore => draw_with_chrome(frame, area, game, explore_screen::draw),
        Screen::Combat => draw_with_chrome(frame, area, game, combat_screen::draw),
        Screen::Inventory => draw_with_chrome(frame, area, game, inventory_screen::draw),
        Screen::GameOver => game_over_screen::draw(frame, area, game),
        Screen::Victory => game_over_screen::draw_victory(frame, area, game),
    }
}

/// Shared layout: header bar + main content + message log.
fn draw_with_chrome(
    frame: &mut Frame,
    area: Rect,
    game: &GameState,
    content_fn: fn(&mut Frame, Rect, &GameState),
) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),  // header
            Constraint::Min(8),    // main content
            Constraint::Length(8), // message log
        ])
        .split(area);

    draw_header(frame, chunks[0], game);
    content_fn(frame, chunks[1], game);
    draw_log(frame, chunks[2], game);
}

/// Top bar: game name, HP bar, level/exp.
fn draw_header(frame: &mut Frame, area: Rect, game: &GameState) {
    let cols = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Length(20), // title
            Constraint::Min(20),   // hp bar
            Constraint::Length(22), // level/exp
        ])
        .split(area);

    // Title
    let title = Paragraph::new("  HUNTER GAME")
        .style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))
        .block(Block::default().borders(Borders::ALL));
    frame.render_widget(title, cols[0]);

    // HP bar
    let hp_ratio = if game.player.max_hp > 0 {
        game.player.hp as f64 / game.player.max_hp as f64
    } else {
        0.0
    };
    let hp_color = if hp_ratio > 0.5 {
        Color::Green
    } else if hp_ratio > 0.25 {
        Color::Yellow
    } else {
        Color::Red
    };
    let hp_gauge = Gauge::default()
        .block(Block::default().title(" HP ").borders(Borders::ALL))
        .gauge_style(Style::default().fg(hp_color))
        .ratio(hp_ratio.clamp(0.0, 1.0))
        .label(format!("{}/{}", game.player.hp, game.player.max_hp));
    frame.render_widget(hp_gauge, cols[1]);

    // Level / Exp
    let stats = Paragraph::new(format!(
        " Lv.{} EXP {}/{}",
        game.player.level, game.player.exp, game.player.exp_to_next
    ))
    .style(Style::default().fg(Color::Cyan))
    .block(Block::default().borders(Borders::ALL));
    frame.render_widget(stats, cols[2]);
}

/// Bottom message log — shows recent game messages.
fn draw_log(frame: &mut Frame, area: Rect, game: &GameState) {
    let visible = area.height.saturating_sub(2) as usize; // minus borders
    let start = game.log.len().saturating_sub(visible);
    let lines: Vec<Line> = game.log[start..]
        .iter()
        .map(|s| Line::from(Span::styled(s.as_str(), Style::default().fg(Color::DarkGray))))
        .collect();

    let log = Paragraph::new(lines)
        .block(Block::default().title(" Log ").borders(Borders::ALL));
    frame.render_widget(log, area);
}

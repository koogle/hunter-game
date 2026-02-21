use ratatui::prelude::*;
use ratatui::widgets::Paragraph;

use crate::game::GameState;

pub fn draw(frame: &mut Frame, area: Rect, game: &GameState) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage(30),
            Constraint::Length(5),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Min(0),
        ])
        .split(area);

    let skull = r#"
    ☠  YOU DIED  ☠
"#;
    let header = Paragraph::new(skull)
        .style(
            Style::default()
                .fg(Color::Red)
                .add_modifier(Modifier::BOLD),
        )
        .alignment(Alignment::Center);
    frame.render_widget(header, chunks[1]);

    let info = Paragraph::new(format!(
        "{} fell at level {} with {} EXP.",
        game.player.name, game.player.level, game.player.exp
    ))
    .style(Style::default().fg(Color::DarkGray))
    .alignment(Alignment::Center);
    frame.render_widget(info, chunks[2]);

    let prompt = Paragraph::new("Press R to restart  •  Q to quit")
        .style(Style::default().fg(Color::Yellow))
        .alignment(Alignment::Center);
    frame.render_widget(prompt, chunks[3]);
}

pub fn draw_victory(frame: &mut Frame, area: Rect, game: &GameState) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage(25),
            Constraint::Length(5),
            Constraint::Length(3),
            Constraint::Length(5),
            Constraint::Length(3),
            Constraint::Min(0),
        ])
        .split(area);

    let banner = r#"
    ★  VICTORY  ★
"#;
    let header = Paragraph::new(banner)
        .style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )
        .alignment(Alignment::Center);
    frame.render_widget(header, chunks[1]);

    let info = Paragraph::new(format!(
        "Hunter {} has vanquished all ancient evils!",
        game.player.name,
    ))
    .style(Style::default().fg(Color::Green))
    .alignment(Alignment::Center);
    frame.render_widget(info, chunks[2]);

    let stats = Paragraph::new(format!(
        "Level: {}  |  Total EXP: {}  |  Items: {}",
        game.player.level,
        game.player.exp + game.player.exp_to_next * (game.player.level - 1),
        game.player.inventory.len(),
    ))
    .style(Style::default().fg(Color::Cyan))
    .alignment(Alignment::Center);
    frame.render_widget(stats, chunks[3]);

    let prompt = Paragraph::new("Press R to play again  •  Q to quit")
        .style(Style::default().fg(Color::Yellow))
        .alignment(Alignment::Center);
    frame.render_widget(prompt, chunks[4]);
}

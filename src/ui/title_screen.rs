use ratatui::prelude::*;
use ratatui::widgets::{Block, Borders, Paragraph};

use crate::game::GameState;

const LOGO: &str = r#"
 ╦ ╦╦ ╦╔╗╔╔╦╗╔═╗╦═╗
 ╠═╣║ ║║║║ ║ ║╣ ╠╦╝
 ╩ ╩╚═╝╝╚╝ ╩ ╚═╝╩╚═
    ╔═╗╔═╗╔╦╗╔═╗
    ║ ╦╠═╣║║║║╣
    ╚═╝╩ ╩╩ ╩╚═╝
"#;

pub fn draw(frame: &mut Frame, area: Rect, _game: &GameState) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage(20),
            Constraint::Length(9),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Min(0),
        ])
        .split(area);

    // Logo
    let logo = Paragraph::new(LOGO)
        .style(Style::default().fg(Color::Red).add_modifier(Modifier::BOLD))
        .alignment(Alignment::Center);
    frame.render_widget(logo, chunks[1]);

    // Subtitle
    let subtitle = Paragraph::new("A new journey awaits")
        .style(Style::default().fg(Color::DarkGray))
        .alignment(Alignment::Center);
    frame.render_widget(subtitle, chunks[2]);

    // Prompt
    let prompt = Paragraph::new("Press ENTER to start  •  Q to quit")
        .style(Style::default().fg(Color::Yellow))
        .alignment(Alignment::Center);
    frame.render_widget(prompt, chunks[3]);
}

pub fn draw_name_entry(frame: &mut Frame, area: Rect, game: &GameState) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage(30),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Min(0),
        ])
        .split(area);

    let prompt = Paragraph::new("Enter your hunter's name:")
        .style(Style::default().fg(Color::Yellow))
        .alignment(Alignment::Center);
    frame.render_widget(prompt, chunks[1]);

    // Name input box
    let input_width = 24_u16;
    let input_area = centered_rect(input_width, 3, chunks[2]);
    let input = Paragraph::new(game.name_input.as_str())
        .style(Style::default().fg(Color::White))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Cyan)),
        );
    frame.render_widget(input, input_area);

    // Show cursor
    frame.set_cursor_position(Position::new(
        input_area.x + game.name_input.len() as u16 + 1,
        input_area.y + 1,
    ));

    let hint = Paragraph::new("Press ENTER to confirm  •  ESC to go back")
        .style(Style::default().fg(Color::DarkGray))
        .alignment(Alignment::Center);
    frame.render_widget(hint, chunks[3]);
}

/// Create a centered rect of given width and height inside `area`.
fn centered_rect(width: u16, height: u16, area: Rect) -> Rect {
    let x = area.x + area.width.saturating_sub(width) / 2;
    let y = area.y + area.height.saturating_sub(height) / 2;
    Rect::new(x, y, width.min(area.width), height.min(area.height))
}

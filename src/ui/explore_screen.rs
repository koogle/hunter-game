use ratatui::prelude::*;
use ratatui::widgets::{Block, Borders, List, ListItem, Paragraph};

use crate::game::GameState;

pub fn draw(frame: &mut Frame, area: Rect, game: &GameState) {
    let tile = game.current_tile();

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5), // tile description
            Constraint::Length(8), // message log
            Constraint::Min(4),   // actions list
            Constraint::Length(1), // hint bar
        ])
        .split(area);

    // Tile name + description
    let desc = Paragraph::new(vec![
        Line::from(Span::styled(
            tile.name.as_str(),
            Style::default()
                .fg(Color::Green)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(Span::styled(
            tile.description.as_str(),
            Style::default().fg(Color::White),
        )),
    ])
    .block(Block::default().borders(Borders::ALL).title(" Location "))
    .wrap(ratatui::widgets::Wrap { trim: true });
    frame.render_widget(desc, chunks[0]);

    // Message log
    super::draw_log(frame, chunks[1], game);

    // Build option list
    let mut items: Vec<ListItem> = Vec::new();

    // Travel options
    for &conn in &tile.connections {
        let dest = &game.tiles[conn];
        items.push(ListItem::new(format!("  Go to {}", dest.name)));
    }

    // Interact option
    items.push(ListItem::new("  Look around"));

    // Highlight selected
    let items: Vec<ListItem> = items
        .into_iter()
        .enumerate()
        .map(|(i, item)| {
            if i == game.selected {
                item.style(
                    Style::default()
                        .fg(Color::Black)
                        .bg(Color::Yellow)
                        .add_modifier(Modifier::BOLD),
                )
            } else {
                item.style(Style::default().fg(Color::White))
            }
        })
        .collect();

    let list = List::new(items)
        .block(Block::default().borders(Borders::ALL).title(" Actions "));
    frame.render_widget(list, chunks[2]);

    // Hint bar
    let hint = Paragraph::new(" ↑↓/jk: select • Enter: confirm • i: inventory • q: quit")
        .style(Style::default().fg(Color::DarkGray));
    frame.render_widget(hint, chunks[3]);
}

use ratatui::prelude::*;
use ratatui::widgets::{Block, Borders, List, ListItem, Paragraph};

use crate::game::player::ItemType;
use crate::game::GameState;

pub fn draw(frame: &mut Frame, area: Rect, game: &GameState) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Min(8),   // stats + inventory
            Constraint::Length(8), // message log
        ])
        .split(area);

    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(40), Constraint::Percentage(60)])
        .split(rows[0]);

    // Left: player stats
    let stats_text = vec![
        Line::from(Span::styled(
            game.player.name.as_str(),
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(format!(
            "  HP:      {}/{}",
            game.player.hp, game.player.max_hp
        )),
        Line::from(format!("  Level:   {}", game.player.level)),
        Line::from(format!(
            "  EXP:     {}/{}",
            game.player.exp, game.player.exp_to_next
        )),
        Line::from(format!("  Attack:  {}", game.player.total_attack())),
        Line::from(format!("  Defense: {}", game.player.defense)),
        Line::from(""),
        Line::from(Span::styled(
            "  Equipment:",
            Style::default().fg(Color::Cyan),
        )),
    ];

    // List equipped weapon
    let mut lines = stats_text;
    if let Some(weapon) = game
        .player
        .inventory
        .iter()
        .filter(|i| i.item_type == ItemType::Weapon)
        .max_by_key(|i| i.value)
    {
        lines.push(Line::from(format!(
            "    Weapon: {} (+{})",
            weapon.name, weapon.value
        )));
    } else {
        lines.push(Line::from("    Weapon: (none)"));
    }

    let stats = Paragraph::new(lines).block(
        Block::default()
            .borders(Borders::ALL)
            .title(" Stats "),
    );
    frame.render_widget(stats, chunks[0]);

    // Right: inventory list
    if game.player.inventory.is_empty() {
        let empty = Paragraph::new("  Your pack is empty.")
            .style(Style::default().fg(Color::DarkGray))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(" Inventory "),
            );
        frame.render_widget(empty, chunks[1]);
    } else {
        let items: Vec<ListItem> = game
            .player
            .inventory
            .iter()
            .enumerate()
            .map(|(i, item)| {
                let icon = match item.item_type {
                    ItemType::Weapon => "W",
                    ItemType::Potion => "P",
                    ItemType::Key => "K",
                    ItemType::Misc => "*",
                };
                let label = format!("  [{}] {} — {}", icon, item.name, item.description);
                let list_item = ListItem::new(label);
                if i == game.selected {
                    list_item.style(
                        Style::default()
                            .fg(Color::Black)
                            .bg(Color::Cyan),
                    )
                } else {
                    list_item.style(Style::default().fg(Color::White))
                }
            })
            .collect();

        let list = List::new(items).block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Inventory "),
        );
        frame.render_widget(list, chunks[1]);
    }

    // Message log
    super::draw_log(frame, rows[1], game);
}

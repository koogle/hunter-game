use ratatui::prelude::*;
use ratatui::widgets::{Block, Borders, Gauge, List, ListItem, Paragraph};

use crate::game::combat::{CombatAction, CombatPhase};
use crate::game::GameState;

pub fn draw(frame: &mut Frame, area: Rect, game: &GameState) {
    let Some(ref combat) = game.combat else {
        return;
    };

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5), // enemy info
            Constraint::Min(4),   // combat log + actions
            Constraint::Length(1), // hint
        ])
        .split(area);

    // Enemy info
    let hp_ratio = if combat.enemy_max_hp > 0 {
        combat.enemy_hp as f64 / combat.enemy_max_hp as f64
    } else {
        0.0
    };
    let enemy_color = if combat.is_boss {
        Color::Magenta
    } else {
        Color::Red
    };

    let enemy_block = Block::default()
        .title(format!(" ⚔ {} ", combat.enemy_name))
        .title_style(
            Style::default()
                .fg(enemy_color)
                .add_modifier(Modifier::BOLD),
        )
        .borders(Borders::ALL)
        .border_style(Style::default().fg(enemy_color));

    let enemy_inner = enemy_block.inner(chunks[0]);
    frame.render_widget(enemy_block, chunks[0]);

    let enemy_rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(1), Constraint::Length(1)])
        .split(enemy_inner);

    let hp_gauge = Gauge::default()
        .gauge_style(Style::default().fg(Color::Red))
        .ratio(hp_ratio.clamp(0.0, 1.0))
        .label(format!(
            "HP: {}/{}",
            combat.enemy_hp, combat.enemy_max_hp
        ));
    frame.render_widget(hp_gauge, enemy_rows[0]);

    let enemy_stats = Paragraph::new(format!("ATK: {}", combat.enemy_damage_dice))
        .style(Style::default().fg(Color::DarkGray));
    frame.render_widget(enemy_stats, enemy_rows[1]);

    // Combat log + actions side by side
    let mid_cols = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(55), Constraint::Percentage(45)])
        .split(chunks[1]);

    // Combat log (left)
    let visible = mid_cols[0].height.saturating_sub(2) as usize;
    let start = combat.log.len().saturating_sub(visible);
    let log_lines: Vec<ListItem> = combat.log[start..]
        .iter()
        .map(|s| ListItem::new(s.as_str()).style(Style::default().fg(Color::White)))
        .collect();
    let combat_log = List::new(log_lines).block(
        Block::default()
            .borders(Borders::ALL)
            .title(" Combat Log "),
    );
    frame.render_widget(combat_log, mid_cols[0]);

    // Actions (right)
    if combat.phase == CombatPhase::PlayerChoosing {
        let actions: Vec<ListItem> = CombatAction::ALL
            .iter()
            .enumerate()
            .map(|(i, action)| {
                let label = match action {
                    CombatAction::UsePotion => {
                        format!("  {} ({})", action.label(), game.player.potion_count())
                    }
                    _ => format!("  {}", action.label()),
                };
                let item = ListItem::new(label);
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

        let action_list = List::new(actions).block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Your Move "),
        );
        frame.render_widget(action_list, mid_cols[1]);
    } else {
        let msg = match combat.phase {
            CombatPhase::Victory => "Victory! Press any key...",
            CombatPhase::Defeat => "Defeated... Press any key...",
            CombatPhase::Fled => "Escaped! Press any key...",
            _ => "",
        };
        let p = Paragraph::new(msg)
            .style(Style::default().fg(Color::Yellow))
            .block(Block::default().borders(Borders::ALL));
        frame.render_widget(p, mid_cols[1]);
    }

    // Hint
    let hint = Paragraph::new(" ↑↓/jk: select • Enter: confirm")
        .style(Style::default().fg(Color::DarkGray));
    frame.render_widget(hint, chunks[2]);
}

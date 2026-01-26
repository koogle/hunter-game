use anyhow::Result;
use crossterm::{
    event::{self, Event},
    terminal,
};

mod ui;

fn main() -> Result<()> {
    println!("=================================");
    println!("       HUNTER GAME");
    println!("=================================");
    println!();
    println!("A terminal-based text RPG");
    println!();
    println!("Press any key to start...");

    // Wait for keypress
    terminal::enable_raw_mode()?;
    loop {
        if event::poll(std::time::Duration::from_millis(100))? {
            if let Event::Key(_) = event::read()? {
                break;
            }
        }
    }
    terminal::disable_raw_mode()?;

    println!();
    println!("Game starting...");
    println!();

    // Demo image rendering if an image exists
    if let Err(e) = ui::images::show_title_screen() {
        println!("(No title image found: {})", e);
    }

    println!();
    println!("Thanks for playing!");

    Ok(())
}

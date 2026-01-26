use anyhow::{Context, Result};
use image::{DynamicImage, GenericImageView, GrayImage, ImageReader, Luma, Rgba};
use std::path::Path;

/// Rendering mode for terminal images
#[derive(Clone, Copy, Default)]
pub enum RenderMode {
    /// Half-block characters (▀) - 2 vertical pixels per cell, full color
    HalfBlock,
    /// Braille characters (⠀-⣿) - 2x4 dots per cell, highest resolution
    Braille,
    /// Colored ASCII characters - classic look
    #[default]
    Ascii,
}

/// Configuration for image rendering
#[derive(Clone)]
pub struct RenderConfig {
    pub width: u32,
    pub mode: RenderMode,
    pub dither: bool,
    pub edge_enhance: bool,
}

impl Default for RenderConfig {
    fn default() -> Self {
        Self {
            width: 80,
            mode: RenderMode::Ascii,
            dither: true,
            edge_enhance: true,
        }
    }
}

/// ASCII characters from dense to sparse (dark to bright on dark bg)
const ASCII_CHARS: &[char] = &['@', '%', '#', '*', '+', '=', '-', ':', '.', ' '];

/// Braille dot positions (Unicode braille is a 2x4 grid)
/// Bit positions:  0 3
///                 1 4
///                 2 5
///                 6 7
const BRAILLE_BASE: u32 = 0x2800;

/// Display an image with default settings (half-block, 80 width)
pub fn show_image<P: AsRef<Path>>(path: P) -> Result<()> {
    render_image(path, &RenderConfig::default())
}

/// Display an image with half-block characters
pub fn show_image_blocks<P: AsRef<Path>>(path: P, width: u32) -> Result<()> {
    render_image(path, &RenderConfig {
        width,
        mode: RenderMode::HalfBlock,
        edge_enhance: true,
        ..Default::default()
    })
}

/// Display an image with braille characters (highest resolution)
pub fn show_image_braille<P: AsRef<Path>>(path: P, width: u32) -> Result<()> {
    render_image(path, &RenderConfig {
        width,
        mode: RenderMode::Braille,
        edge_enhance: true,
        dither: true,
        ..Default::default()
    })
}

/// Display an image as colored ASCII art
pub fn show_image_ascii<P: AsRef<Path>>(path: P, width: u32) -> Result<()> {
    render_image(path, &RenderConfig {
        width,
        mode: RenderMode::Ascii,
        dither: true,
        ..Default::default()
    })
}

/// Main render function
pub fn render_image<P: AsRef<Path>>(path: P, config: &RenderConfig) -> Result<()> {
    let path = path.as_ref();

    let img = ImageReader::open(path)
        .with_context(|| format!("Failed to open image: {}", path.display()))?
        .decode()
        .with_context(|| format!("Failed to decode image: {}", path.display()))?;

    let output = render_dynamic_image(&img, config);
    print!("{}", output);

    Ok(())
}

/// Render a DynamicImage to string
pub fn render_dynamic_image(img: &DynamicImage, config: &RenderConfig) -> String {
    // Calculate dimensions based on mode
    let (img_w, img_h) = img.dimensions();
    let aspect = img_h as f32 / img_w as f32;

    let (target_w, target_h) = match config.mode {
        RenderMode::HalfBlock => {
            let h = (config.width as f32 * aspect) as u32;
            let h = (h + 1) & !1; // Make even
            (config.width, h.max(2))
        }
        RenderMode::Braille => {
            // Braille is 2x4 dots per character
            let char_h = (config.width as f32 * aspect / 2.0) as u32;
            (config.width * 2, (char_h * 4).max(4))
        }
        RenderMode::Ascii => {
            let h = ((config.width as f32 * aspect) / 2.0) as u32;
            (config.width, h.max(1))
        }
    };

    // Apply edge enhancement if requested
    let img = if config.edge_enhance {
        enhance_edges(img)
    } else {
        img.clone()
    };

    // Resize with high-quality filter
    let resized = img.resize_exact(target_w, target_h, image::imageops::FilterType::Lanczos3);

    // Render based on mode
    match config.mode {
        RenderMode::HalfBlock => render_half_blocks(&resized),
        RenderMode::Braille => render_braille(&resized, config.dither),
        RenderMode::Ascii => render_ascii(&resized, config.dither),
    }
}

/// Apply edge enhancement using unsharp masking
fn enhance_edges(img: &DynamicImage) -> DynamicImage {
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    // Create a blurred version
    let blurred = image::imageops::blur(&rgba, 1.0);

    // Unsharp mask: original + (original - blurred) * strength
    let strength = 0.5f32;
    let mut result = rgba.clone();

    for y in 0..height {
        for x in 0..width {
            let orig = rgba.get_pixel(x, y);
            let blur = blurred.get_pixel(x, y);

            let r = (orig[0] as f32 + (orig[0] as f32 - blur[0] as f32) * strength).clamp(0.0, 255.0) as u8;
            let g = (orig[1] as f32 + (orig[1] as f32 - blur[1] as f32) * strength).clamp(0.0, 255.0) as u8;
            let b = (orig[2] as f32 + (orig[2] as f32 - blur[2] as f32) * strength).clamp(0.0, 255.0) as u8;

            result.put_pixel(x, y, Rgba([r, g, b, orig[3]]));
        }
    }

    DynamicImage::ImageRgba8(result)
}

/// Render using half-block characters (▀)
fn render_half_blocks(img: &DynamicImage) -> String {
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let mut result = String::with_capacity((width as usize * 30 + 1) * (height as usize / 2));

    for y in (0..height).step_by(2) {
        for x in 0..width {
            let top = rgba.get_pixel(x, y);
            let bottom = if y + 1 < height {
                rgba.get_pixel(x, y + 1)
            } else {
                top
            };

            // Upper half block: foreground = top color, background = bottom color
            result.push_str(&format!(
                "\x1b[38;2;{};{};{};48;2;{};{};{}m▀",
                top[0], top[1], top[2],
                bottom[0], bottom[1], bottom[2]
            ));
        }
        result.push_str("\x1b[0m\n");
    }

    result
}

/// Render using braille characters (highest resolution)
fn render_braille(img: &DynamicImage, dither: bool) -> String {
    let gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    // Apply dithering if requested
    let gray = if dither {
        floyd_steinberg_dither(&gray)
    } else {
        threshold_image(&gray, 128)
    };

    // Get average colors for each 2x4 braille cell
    let rgba = img.to_rgba8();

    let char_width = (width / 2) as usize;
    let char_height = (height / 4) as usize;

    let mut result = String::with_capacity((char_width * 25 + 1) * char_height);

    for char_y in 0..char_height {
        for char_x in 0..char_width {
            let base_x = (char_x * 2) as u32;
            let base_y = (char_y * 4) as u32;

            // Build braille character from 2x4 dot pattern
            let mut braille: u32 = 0;

            // Braille dot mapping (x, y) -> bit
            // (0,0)->0, (0,1)->1, (0,2)->2, (0,3)->6
            // (1,0)->3, (1,1)->4, (1,2)->5, (1,3)->7
            let dot_bits = [
                (0, 0, 0), (0, 1, 1), (0, 2, 2), (0, 3, 6),
                (1, 0, 3), (1, 1, 4), (1, 2, 5), (1, 3, 7),
            ];

            for (dx, dy, bit) in dot_bits {
                let px = base_x + dx;
                let py = base_y + dy;
                if px < width && py < height {
                    if gray.get_pixel(px, py)[0] > 0 {
                        braille |= 1 << bit;
                    }
                }
            }

            // Calculate average color for this cell
            let (mut r_sum, mut g_sum, mut b_sum, mut count) = (0u32, 0u32, 0u32, 0u32);
            for dy in 0..4 {
                for dx in 0..2 {
                    let px = base_x + dx;
                    let py = base_y + dy;
                    if px < width && py < height {
                        let p = rgba.get_pixel(px, py);
                        r_sum += p[0] as u32;
                        g_sum += p[1] as u32;
                        b_sum += p[2] as u32;
                        count += 1;
                    }
                }
            }

            let (r, g, b) = if count > 0 {
                ((r_sum / count) as u8, (g_sum / count) as u8, (b_sum / count) as u8)
            } else {
                (128, 128, 128)
            };

            let braille_char = char::from_u32(BRAILLE_BASE + braille).unwrap_or(' ');
            result.push_str(&format!("\x1b[38;2;{};{};{}m{}", r, g, b, braille_char));
        }
        result.push_str("\x1b[0m\n");
    }

    result
}

/// Render using ASCII characters
fn render_ascii(img: &DynamicImage, dither: bool) -> String {
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let mut result = String::with_capacity((width as usize * 20 + 1) * height as usize);

    // Create grayscale for character selection
    let gray = img.to_luma8();
    let gray = if dither {
        // Use error diffusion for smoother gradients
        ordered_dither(&gray)
    } else {
        gray
    };

    for y in 0..height {
        for x in 0..width {
            let color = rgba.get_pixel(x, y);
            let lum = gray.get_pixel(x, y)[0];

            let idx = (lum as usize * (ASCII_CHARS.len() - 1)) / 255;
            let ch = ASCII_CHARS[idx];

            result.push_str(&format!("\x1b[38;2;{};{};{}m{}", color[0], color[1], color[2], ch));
        }
        result.push_str("\x1b[0m\n");
    }

    result
}

/// Floyd-Steinberg dithering for binary output
fn floyd_steinberg_dither(img: &GrayImage) -> GrayImage {
    let (width, height) = img.dimensions();
    let mut errors: Vec<Vec<f32>> = vec![vec![0.0; width as usize + 2]; height as usize + 1];
    let mut result = GrayImage::new(width, height);

    for y in 0..height {
        for x in 0..width {
            let old_val = img.get_pixel(x, y)[0] as f32 + errors[y as usize][x as usize + 1];
            let new_val = if old_val > 127.0 { 255.0 } else { 0.0 };
            let error = old_val - new_val;

            result.put_pixel(x, y, Luma([new_val as u8]));

            // Distribute error to neighbors
            let xu = x as usize;
            let yu = y as usize;
            errors[yu][xu + 2] += error * 7.0 / 16.0;
            if yu + 1 < height as usize {
                errors[yu + 1][xu] += error * 3.0 / 16.0;
                errors[yu + 1][xu + 1] += error * 5.0 / 16.0;
                errors[yu + 1][xu + 2] += error * 1.0 / 16.0;
            }
        }
    }

    result
}

/// Simple threshold for binary conversion
fn threshold_image(img: &GrayImage, threshold: u8) -> GrayImage {
    let (width, height) = img.dimensions();
    let mut result = GrayImage::new(width, height);

    for y in 0..height {
        for x in 0..width {
            let val = if img.get_pixel(x, y)[0] > threshold { 255 } else { 0 };
            result.put_pixel(x, y, Luma([val]));
        }
    }

    result
}

/// Ordered (Bayer) dithering for smoother gradients in ASCII mode
fn ordered_dither(img: &GrayImage) -> GrayImage {
    let (width, height) = img.dimensions();
    let mut result = GrayImage::new(width, height);

    // 4x4 Bayer matrix
    const BAYER: [[u8; 4]; 4] = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
    ];

    for y in 0..height {
        for x in 0..width {
            let val = img.get_pixel(x, y)[0];
            let threshold = BAYER[(y % 4) as usize][(x % 4) as usize] * 16;
            // Scale value based on threshold
            let adjusted = ((val as i32 - 128) + (threshold as i32 - 128) / 2 + 128).clamp(0, 255) as u8;
            result.put_pixel(x, y, Luma([adjusted]));
        }
    }

    result
}

// ============ Convenience functions ============

/// Show the title screen image
pub fn show_title_screen() -> Result<()> {
    show_image_ascii("assets/images/title.png", 100)
}

/// Show a location image
pub fn show_location(location_name: &str) -> Result<()> {
    let path = format!("assets/images/locations/{}.png", location_name);
    show_image_ascii(&path, 80)
}

/// Show an enemy image
pub fn show_enemy(enemy_name: &str) -> Result<()> {
    let path = format!("assets/images/enemies/{}.png", enemy_name);
    show_image_ascii(&path, 60)
}

/// Show an item image
pub fn show_item(item_name: &str) -> Result<()> {
    let path = format!("assets/images/items/{}.png", item_name);
    show_image_ascii(&path, 40)
}

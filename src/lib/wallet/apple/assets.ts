import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { encodePng, hexToRgba, mix, type Rgba } from "./png";

/**
 * Image assets that go inside the .pkpass archive.
 *
 * Apple rejects a pass without at least `icon.png` and `logo.png`, so the
 * defaults below are rendered procedurally from the brand colours. Real artwork
 * placed in `assets/apple/` (icon.png, icon@2x.png, logo.png, strip.png, ...)
 * is used instead whenever it exists.
 */

const OVERRIDE_DIR = path.join(process.cwd(), "assets", "apple");

export interface BrandColors {
  background: string;
  foreground: string;
  label: string;
}

export type PassAssets = Record<string, Buffer>;

const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 };

function roundedRectAlpha(
  x: number,
  y: number,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number,
): number {
  const px = x + 0.5 - left;
  const py = y + 0.5 - top;
  const dx = Math.max(radius - px, px - (width - radius), 0);
  const dy = Math.max(radius - py, py - (height - radius), 0);
  if (px < 0 || py < 0 || px > width || py > height) return 0;
  const distance = Math.hypot(dx, dy);
  return Math.max(0, Math.min(1, radius - distance + 0.5));
}

function over(base: Rgba, top: Rgba, alpha: number): Rgba {
  return mix(base, { ...top, a: 255 }, alpha * (top.a / 255));
}

function renderIcon(size: number, colors: BrandColors): Buffer {
  const bg = hexToRgba(colors.background);
  const bgLight = mix(bg, { r: 255, g: 255, b: 255, a: 255 }, 0.18);
  const accent = hexToRgba(colors.label);
  const white = { r: 255, g: 255, b: 255, a: 255 };

  return encodePng(size, size, (x, y, w, h) => {
    const radius = size * 0.22;
    const outside = roundedRectAlpha(x, y, 0, 0, w, h, radius);
    if (outside === 0) return TRANSPARENT;

    let pixel = mix(bgLight, bg, y / h);

    // Card glyph
    const cardW = w * 0.58;
    const cardH = h * 0.4;
    const cardX = (w - cardW) / 2;
    const cardY = (h - cardH) / 2;
    const cardAlpha = roundedRectAlpha(x, y, cardX, cardY, cardW, cardH, Math.max(1, cardW * 0.12));
    pixel = over(pixel, white, cardAlpha);

    // Accent stripe across the card
    const stripeH = Math.max(1, cardH * 0.22);
    const stripeAlpha = roundedRectAlpha(
      x,
      y,
      cardX,
      cardY + cardH * 0.18,
      cardW,
      stripeH,
      stripeH / 2,
    );
    pixel = over(pixel, accent, stripeAlpha * cardAlpha);

    return { ...pixel, a: 255 * outside };
  });
}

function renderLogo(width: number, height: number, colors: BrandColors): Buffer {
  const white = { r: 255, g: 255, b: 255, a: 255 };
  const accent = hexToRgba(colors.label);

  return encodePng(width, height, (x, y, w, h) => {
    let pixel: Rgba = TRANSPARENT;

    const markSize = h * 0.86;
    const markX = h * 0.07;
    const markY = (h - markSize) / 2;
    const markAlpha = roundedRectAlpha(x, y, markX, markY, markSize, markSize, markSize * 0.24);
    pixel = { ...white, a: 255 * markAlpha };

    // Notch in the mark so it reads as a wallet at small sizes.
    const notchW = markSize * 0.5;
    const notchH = markSize * 0.16;
    const notchAlpha = roundedRectAlpha(
      x,
      y,
      markX + markSize * 0.25,
      markY + markSize * 0.55,
      notchW,
      notchH,
      notchH / 2,
    );
    if (notchAlpha > 0) {
      pixel = { ...accent, a: 255 * Math.min(markAlpha, notchAlpha) };
    }

    // Two bars to the right of the mark, suggesting the wordmark.
    const barX = markX + markSize + h * 0.22;
    const barW = w - barX - h * 0.1;
    if (barW > 4) {
      const topBar = roundedRectAlpha(x, y, barX, h * 0.3, barW, h * 0.14, h * 0.07);
      const bottomBar = roundedRectAlpha(x, y, barX, h * 0.54, barW * 0.62, h * 0.1, h * 0.05);
      const barAlpha = Math.max(topBar * 0.95, bottomBar * 0.6);
      if (barAlpha > pixel.a / 255) pixel = { ...white, a: 255 * barAlpha };
    }

    return pixel;
  });
}

function renderStrip(width: number, height: number, colors: BrandColors): Buffer {
  const bg = hexToRgba(colors.background);
  const accent = hexToRgba(colors.label);
  const highlight = mix(bg, accent, 0.35);

  return encodePng(width, height, (x, y, w, h) => {
    const diagonal = (x / w) * 0.7 + (y / h) * 0.3;
    let pixel = mix(highlight, bg, diagonal);

    // Soft glow in the upper-left corner.
    const glow = Math.max(0, 1 - Math.hypot(x / w - 0.12, y / h - 0.1) * 2.4);
    pixel = mix(pixel, mix(bg, accent, 0.55), glow * 0.45);

    // Bottom shading so text stays readable.
    const shade = Math.max(0, (y / h - 0.6) / 0.4);
    pixel = mix(pixel, { r: 0, g: 0, b: 0, a: 255 }, shade * 0.25);

    return { ...pixel, a: 255 };
  });
}

function loadOverride(fileName: string): Buffer | null {
  try {
    const candidate = path.join(OVERRIDE_DIR, fileName);
    if (!candidate.startsWith(OVERRIDE_DIR)) return null;
    if (!existsSync(candidate)) return null;
    return readFileSync(candidate);
  } catch {
    return null;
  }
}

let cache: { key: string; assets: PassAssets } | null = null;

/**
 * Builds the full asset set for a pass. Results are cached per brand palette
 * because PNG encoding is deterministic and not free.
 */
export function buildPassAssets(colors: BrandColors): PassAssets {
  const key = `${colors.background}|${colors.foreground}|${colors.label}`;
  if (cache?.key === key) return cache.assets;

  const generated: PassAssets = {
    "icon.png": renderIcon(29, colors),
    "icon@2x.png": renderIcon(58, colors),
    "icon@3x.png": renderIcon(87, colors),
    "logo.png": renderLogo(160, 50, colors),
    "logo@2x.png": renderLogo(320, 100, colors),
    "strip.png": renderStrip(375, 123, colors),
    "strip@2x.png": renderStrip(750, 246, colors),
  };

  const assets: PassAssets = {};
  for (const [name, buffer] of Object.entries(generated)) {
    assets[name] = loadOverride(name) ?? buffer;
  }

  cache = { key, assets };
  return assets;
}

/** Asset names Apple treats as mandatory. */
export const REQUIRED_ASSETS = ["icon.png", "icon@2x.png", "logo.png"] as const;

export interface PassAppearanceUrls {
  logo: string | null;
  strip: string | null;
  thumbnail: string | null;
  background: string | null;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Builds pass assets using uploaded image URLs when available,
 * falling back to procedurally generated artwork.
 */
export function buildPassAssetsFromUrls(
  appearance: PassAppearanceUrls,
  colors: BrandColors,
): PassAssets {
  const base = buildPassAssets(colors);
  // Synchronous fallback — callers that need URL images should use buildPassAssetsFromUrlsAsync
  return base;
}

export async function buildPassAssetsFromUrlsAsync(
  appearance: PassAppearanceUrls,
  colors: BrandColors,
): Promise<PassAssets> {
  const assets = buildPassAssets(colors);

  if (appearance.logo) {
    const logo = await fetchImageBuffer(appearance.logo);
    if (logo) {
      assets["logo.png"] = logo;
      assets["logo@2x.png"] = logo;
      assets["icon.png"] = logo;
      assets["icon@2x.png"] = logo;
      assets["icon@3x.png"] = logo;
    }
  }

  if (appearance.strip) {
    const strip = await fetchImageBuffer(appearance.strip);
    if (strip) {
      assets["strip.png"] = strip;
      assets["strip@2x.png"] = strip;
    }
  }

  if (appearance.thumbnail) {
    const thumb = await fetchImageBuffer(appearance.thumbnail);
    if (thumb) assets["thumbnail.png"] = thumb;
  }

  if (appearance.background) {
    const bg = await fetchImageBuffer(appearance.background);
    if (bg) assets["background.png"] = bg;
  }

  return assets;
}

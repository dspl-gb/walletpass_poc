import { deflateSync } from "node:zlib";

/**
 * Minimal 8-bit RGBA PNG encoder.
 *
 * Apple Wallet requires real PNG assets inside every .pkpass. Rather than
 * committing binary blobs to the repository, the branding assets are rendered
 * at runtime from the configured brand colours. Drop real artwork into
 * `assets/apple/` to override anything generated here.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type PixelShader = (x: number, y: number, width: number, height: number) => Rgba;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

export function encodePng(width: number, height: number, shader: PixelShader): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x += 1) {
      const { r, g, b, a } = shader(x, y, width, height);
      const offset = rowStart + 1 + x * 4;
      raw[offset] = clampByte(r);
      raw[offset + 1] = clampByte(g);
      raw[offset + 2] = clampByte(b);
      raw[offset + 3] = clampByte(a);
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function clampByte(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function hexToRgba(hex: string, alpha = 255): Rgba {
  const normalized = hex.replace("#", "").trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return { r: 0, g: 0, b: 0, a: alpha };
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
    a: alpha,
  };
}

export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  const ratio = Math.max(0, Math.min(1, t));
  return {
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
    a: a.a + (b.a - a.a) * ratio,
  };
}

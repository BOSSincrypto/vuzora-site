/**
 * Generates the raster icon set from the same artwork as `public/favicon.svg`:
 * `public/favicon.ico` plus `public/icon-192.png` and `public/icon-512.png`.
 *
 * Two consumers, two formats. Google's favicon crawler is far more reliable
 * with a real `/favicon.ico` than with an SVG-only `rel="icon"`, and prefers a
 * size that is a multiple of 48px — hence the 16/32/48 multi-image ICO.
 * Chrome's PWA install prompt instead wants 192px and 512px PNGs in the
 * manifest, which an ICO capped at 48px cannot satisfy.
 *
 * The shapes are re-declared here as signed distance fields rather than being
 * rasterized from the SVG, because rasterizing SVG would mean a dependency
 * (librsvg/sharp/ImageMagick) for three trivial primitives. `SHAPES` below is
 * the mirror of `public/favicon.svg`; change one and re-run this generator.
 *
 * Usage: `node scripts/generate-icons.mjs`
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

// Mirrors public/favicon.svg (viewBox 0 0 64 64).
const VIEWBOX = 64;
const SHAPES = {
  plate: { rx: 14, fill: [0x4f, 0x3c, 0xff] }, // <rect width="64" height="64" rx="14">
  check: {
    points: [
      [14, 26],
      [28, 52],
      [46, 18],
    ],
    width: 9, // stroke-width, round cap + round join
    fill: [0xff, 0xff, 0xff],
  },
  dot: { cx: 49, cy: 14, r: 6, fill: [0xff, 0xb0, 0x20] },
};

// 16/32/48 covers browser tabs, bookmarks and Google's preferred 48px tier.
const ICO_SIZES = [16, 32, 48];
// The two sizes Chrome looks for before it offers to install the PWA.
const PNG_SIZES = [192, 512];
// Supersampling factor per axis at icon sizes where aliasing is visible.
// 8 => 64 samples/pixel: enough that the 16px rounded corners and the check's
// round caps do not stair-step. Large PNGs have pixels to spare, so they drop
// to 4 (16 samples) and stay fast.
const SAMPLES = 8;
const LARGE_SAMPLES = 4;
const LARGE_SIZE = 64;

/** Distance from `p` to the segment `a`–`b`. */
function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const lengthSquared = abx * abx + aby * aby;
  const t =
    lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, (apx * abx + apy * aby) / lengthSquared));
  return Math.hypot(apx - abx * t, apy - aby * t);
}

/** Signed distance to the rounded plate, negative inside. */
function distanceToPlate([px, py]) {
  const half = VIEWBOX / 2;
  const { rx } = SHAPES.plate;
  const qx = Math.abs(px - half) - (half - rx);
  const qy = Math.abs(py - half) - (half - rx);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - rx;
}

function insidePlate(p) {
  return distanceToPlate(p) <= 0;
}

function insideCheck(p) {
  const { points, width } = SHAPES.check;
  const halfWidth = width / 2;
  for (let i = 0; i < points.length - 1; i += 1) {
    // Round caps and joins fall out of the segment distance for free.
    if (distanceToSegment(p, points[i], points[i + 1]) <= halfWidth) return true;
  }
  return false;
}

function insideDot([px, py]) {
  const { cx, cy, r } = SHAPES.dot;
  return Math.hypot(px - cx, py - cy) <= r;
}

/** Alpha-composites a straight-RGB source at `coverage` over an RGBA accumulator. */
function over(dst, [r, g, b], coverage) {
  if (coverage <= 0) return;
  const alpha = coverage + dst[3] * (1 - coverage);
  if (alpha <= 0) {
    dst[0] = dst[1] = dst[2] = dst[3] = 0;
    return;
  }
  dst[0] = (r * coverage + dst[0] * dst[3] * (1 - coverage)) / alpha;
  dst[1] = (g * coverage + dst[1] * dst[3] * (1 - coverage)) / alpha;
  dst[2] = (b * coverage + dst[2] * dst[3] * (1 - coverage)) / alpha;
  dst[3] = alpha;
}

/** Renders the artwork at `size`x`size` into a top-down RGBA buffer. */
function render(size) {
  const samples = size > LARGE_SIZE ? LARGE_SAMPLES : SAMPLES;
  const step = VIEWBOX / size / samples;
  const pixels = Buffer.alloc(size * size * 4);
  const total = samples * samples;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let plate = 0;
      let check = 0;
      let dot = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const p = [(x * samples + sx + 0.5) * step, (y * samples + sy + 0.5) * step];
          if (insidePlate(p)) plate += 1;
          if (insideCheck(p)) check += 1;
          if (insideDot(p)) dot += 1;
        }
      }
      const rgba = [0, 0, 0, 0];
      over(rgba, SHAPES.plate.fill, plate / total);
      over(rgba, SHAPES.check.fill, check / total);
      over(rgba, SHAPES.dot.fill, dot / total);

      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(rgba[0]);
      pixels[offset + 1] = Math.round(rgba[1]);
      pixels[offset + 2] = Math.round(rgba[2]);
      pixels[offset + 3] = Math.round(rgba[3] * 255);
    }
  }
  return pixels;
}

/**
 * Wraps an RGBA buffer as a 32-bit BMP payload for an ICO directory entry:
 * BITMAPINFOHEADER with doubled height, bottom-up BGRA rows, then a zeroed
 * AND mask (the alpha channel already carries transparency).
 */
function toBmp(pixels, size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight: XOR image + AND mask
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(0, 16); // biCompression: BI_RGB

  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const sourceRow = (size - 1 - y) * size * 4; // BMP rows run bottom-up
    for (let x = 0; x < size; x += 1) {
      const from = sourceRow + x * 4;
      const to = (y * size + x) * 4;
      xor[to] = pixels[from + 2]; // B
      xor[to + 1] = pixels[from + 1]; // G
      xor[to + 2] = pixels[from]; // R
      xor[to + 3] = pixels[from + 3]; // A
    }
  }

  const maskStride = Math.ceil(size / 8 / 4) * 4; // 1bpp rows padded to 32 bits
  const mask = Buffer.alloc(maskStride * size); // all zero: every pixel opaque
  header.writeUInt32LE(xor.length + mask.length, 20); // biSizeImage

  return Buffer.concat([header, xor, mask]);
}

function buildIco(sizes) {
  const images = sizes.map((size) => toBmp(render(size), size));
  const directory = Buffer.alloc(6 + 16 * images.length);
  directory.writeUInt16LE(0, 0); // reserved
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(images.length, 4);

  let offset = directory.length;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    const size = sizes[index];
    directory.writeUInt8(size === 256 ? 0 : size, entry); // 0 means 256 in ICO
    directory.writeUInt8(size === 256 ? 0 : size, entry + 1);
    directory.writeUInt8(0, entry + 2); // palette colours
    directory.writeUInt8(0, entry + 3); // reserved
    directory.writeUInt16LE(1, entry + 4); // planes
    directory.writeUInt16LE(32, entry + 6); // bit count
    directory.writeUInt32LE(image.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });

  return Buffer.concat([directory, ...images]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

/** Encodes a top-down RGBA buffer as a truecolour-with-alpha PNG. */
function toPng(pixels, size) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const ico = buildIco(ICO_SIZES);
writeFileSync(join(publicDir, "favicon.ico"), ico);
console.log(`favicon.ico: ${ICO_SIZES.join("/")}px, ${ico.length} bytes`);

for (const size of PNG_SIZES) {
  const png = toPng(render(size), size);
  writeFileSync(join(publicDir, `icon-${size}.png`), png);
  console.log(`icon-${size}.png: ${png.length} bytes`);
}

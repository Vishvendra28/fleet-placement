import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c >>> 0;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = (crc >>> 8) ^ crcTable[(crc ^ b) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
}
function makePNG(pixels, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    for (let x = 0; x < width; x++) {
      const pi = (y * width + x) * 3;
      const ri = y * (1 + width * 3) + 1 + x * 3;
      raw[ri] = pixels[pi]; raw[ri + 1] = pixels[pi + 1]; raw[ri + 2] = pixels[pi + 2];
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function createIcon(size) {
  const pixels = new Uint8Array(size * size * 3);
  const s = size / 192;

  // Background: #1d4ed8
  const [BR, BG, BB] = [29, 78, 216];
  for (let i = 0; i < size * size; i++) {
    pixels[i * 3] = BR; pixels[i * 3 + 1] = BG; pixels[i * 3 + 2] = BB;
  }

  function setPixel(x, y, r, g, b) {
    const ix = Math.round(x), iy = Math.round(y);
    if (ix < 0 || ix >= size || iy < 0 || iy >= size) return;
    const i = (iy * size + ix) * 3;
    pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b;
  }
  function fillRect(x1, y1, x2, y2, r, g, b) {
    for (let y = Math.round(y1); y < Math.round(y2); y++)
      for (let x = Math.round(x1); x < Math.round(x2); x++)
        setPixel(x, y, r, g, b);
  }
  function fillCircle(cx, cy, radius, r, g, b) {
    const r2 = radius * radius;
    for (let y = Math.round(cy - radius); y <= Math.round(cy + radius); y++)
      for (let x = Math.round(cx - radius); x <= Math.round(cx + radius); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) setPixel(x, y, r, g, b);
  }
  function fillRoundRect(x1, y1, x2, y2, rx, r, g, b) {
    fillRect(x1 + rx, y1, x2 - rx, y2, r, g, b);
    fillRect(x1, y1 + rx, x2, y2 - rx, r, g, b);
    fillCircle(x1 + rx, y1 + rx, rx, r, g, b);
    fillCircle(x2 - rx, y1 + rx, rx, r, g, b);
    fillCircle(x1 + rx, y2 - rx, rx, r, g, b);
    fillCircle(x2 - rx, y2 - rx, rx, r, g, b);
  }

  const W = (x) => x * s;
  const [WR, WG, WB] = [255, 255, 255];

  // Outer rounded square background (slightly lighter blue) for visual framing
  fillRoundRect(W(8), W(8), W(184), W(184), W(18), 37, 99, 235);

  // Cargo body
  fillRoundRect(W(16), W(54), W(114), W(116), W(5), WR, WG, WB);

  // Cab
  fillRoundRect(W(114), W(64), W(172), W(116), W(5), WR, WG, WB);

  // Windshield (blue cutout)
  fillRoundRect(W(118), W(69), W(169), W(103), W(3), BR, BG, BB);

  // Chassis bar
  fillRect(W(12), W(116), W(176), W(122), WR, WG, WB);

  // Wheels
  const wheelY = W(133);
  [[W(42), W(20), W(11)], [W(90), W(20), W(11)], [W(150), W(20), W(11)]].forEach(([cx, outerR, innerR]) => {
    fillCircle(cx, wheelY, outerR, WR, WG, WB);
    fillCircle(cx, wheelY, innerR, BR, BG, BB);
  });

  return makePNG(pixels, size, size);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', createIcon(192));
writeFileSync('public/icons/icon-512.png', createIcon(512));
console.log('PWA icons generated');

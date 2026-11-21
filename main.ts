// The Passport Page of a Country That Isn't There
// Renders an invented passport spread (Republic of Velmaris) as a PNG.
// Own PNG encoder + vector shapes + 5x7 bitmap font. Stdlib only, deterministic.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------- 5x7 bitmap font (glyph = 7 rows of 5 bits, MSB = leftmost) ----------
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14], "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31], "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2], "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14], "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14], "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0], "<": [2, 4, 8, 16, 8, 4, 2],
  ">": [8, 4, 2, 1, 2, 4, 8], "-": [0, 0, 0, 31, 0, 0, 0],
  "/": [1, 1, 2, 4, 8, 16, 16], ".": [0, 0, 0, 0, 0, 12, 12],
  ":": [0, 12, 12, 0, 12, 12, 0], "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8], "'": [4, 4, 8, 0, 0, 0, 0],
  ",": [0, 0, 0, 0, 12, 4, 8],
};

type RGB = [number, number, number];

const PAPER: RGB = [247, 242, 230];
const PAPER_SHADOW: RGB = [232, 223, 200];
const NAVY: RGB = [31, 58, 95];
const GOLD: RGB = [169, 138, 60];
const INK: RGB = [34, 48, 62];
const GREY: RGB = [90, 100, 112];
const PHOTO_BG: RGB = [201, 212, 220];
const SKIN: RGB = [217, 169, 134];
const HAIR: RGB = [58, 42, 32];
const BLUE_INK: RGB = [46, 94, 140];
const PURPLE_INK: RGB = [107, 78, 138];
const GREEN_INK: RGB = [47, 107, 79];
const BROWN_INK: RGB = [122, 84, 48];
const GUILLOCHE: RGB = [228, 219, 196];

class Canvas {
  w: number; h: number; buf: Uint8Array;
  constructor(w: number, h: number, fill: RGB) {
    this.w = w; this.h = h;
    this.buf = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.buf[i * 3] = fill[0]; this.buf[i * 3 + 1] = fill[1]; this.buf[i * 3 + 2] = fill[2];
    }
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2];
  }
  get(x: number, y: number): RGB {
    const i = (y * this.w + x) * 3;
    return [this.buf[i], this.buf[i + 1], this.buf[i + 2]];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c);
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c); this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c); this.fillRect(x + w - t, y, t, h, c);
  }
  hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
    for (let t0 = 0; t0 < t; t0++) for (let x = x0; x <= x1; x++) this.px(x, y + t0, c);
  }
  vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
    for (let t0 = 0; t0 < t; t0++) for (let y = y0; y <= y1; y++) this.px(x + t0, y, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }
  fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let y = cy - ry; y <= cy + ry; y++) {
      const dy = (y - cy) / ry;
      const dx = Math.sqrt(Math.max(0, 1 - dy * dy)) * rx;
      for (let x = Math.ceil(cx - dx); x <= Math.floor(cx + dx); x++) this.px(x, y, c);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let a = 0; a < 360; a += 1) {
      const r = (a * Math.PI) / 180;
      this.px(Math.round(cx + Math.cos(r) * rx), Math.round(cy + Math.sin(r) * ry), c);
    }
  }
  text(s: string, x: number, y: number, scale: number, c: RGB, spacing?: number): number {
    const sp = spacing === undefined ? scale : spacing;
    let cx = x;
    for (const ch of s.toUpperCase()) {
      const g = FONT[ch] || FONT[" "];
      for (let r = 0; r < 7; r++) {
        for (let col = 0; col < 5; col++) {
          if (g[r] & (16 >> col)) {
            this.fillRect(cx + col * scale, y + r * scale, scale, scale, c);
          }
        }
      }
      cx += 5 * scale + sp;
    }
    return cx - sp;
  }
  textWidth(s: string, scale: number, spacing?: number): number {
    const sp = spacing === undefined ? scale : spacing;
    return s.length * (5 * scale + sp) - sp;
  }
  textCentered(s: string, cx: number, y: number, scale: number, c: RGB, spacing?: number): void {
    this.text(s, cx - Math.floor(this.textWidth(s, scale, spacing) / 2), y, scale, c, spacing);
  }
}

// ---------- PNG encoder (color type 2, filter 0) ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(cv: Canvas): Buffer {
  const raw = Buffer.alloc(cv.h * (1 + cv.w * 3));
  for (let y = 0; y < cv.h; y++) {
    raw[y * (1 + cv.w * 3)] = 0;
    raw.set(cv.buf.subarray(y * cv.w * 3, (y + 1) * cv.w * 3), y * (1 + cv.w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0); ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- MRZ check digits (ICAO 9303) ----------
function mrzVal(ch: string): number {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - 55;
  return 0;
}
function mrzCheck(s: string): string {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += mrzVal(s[i]) * w[i % 3];
  return String(sum % 10);
}

// ---------- stamp rendering (drawn on a temp canvas, blitted rotated) ----------
function makeStamp(lines: { text: string; scale: number }[], w: number, h: number, ink: RGB): Canvas {
  const c = new Canvas(w, h, PAPER);
  c.rect(4, 4, w - 8, h - 8, ink, 2);
  c.rect(9, 9, w - 18, h - 18, ink, 1);
  let y = 16;
  for (const ln of lines) {
    c.textCentered(ln.text, Math.floor(w / 2), y, ln.scale, ink);
    y += 7 * ln.scale + 6;
  }
  return c;
}
function blitRotated(dst: Canvas, src: Canvas, cx: number, cy: number, deg: number): void {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  const hw = src.w / 2, hh = src.h / 2;
  for (let sy = 0; sy < src.h; sy++) {
    for (let sx = 0; sx < src.w; sx++) {
      const p = src.get(sx, sy);
      if (p[0] === PAPER[0] && p[1] === PAPER[1] && p[2] === PAPER[2]) continue;
      const dx = sx - hw, dy = sy - hh;
      const rx = Math.round(cx + dx * cos - dy * sin);
      const ry = Math.round(cy + dx * sin + dy * cos);
      dst.px(rx, ry, p as RGB);
    }
  }
}

// ---------- portrait ----------
function drawPortrait(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, PHOTO_BG);
  const cx = x + Math.floor(w / 2);
  // shoulders / jacket
  cv.fillRect(x + 8, y + h - 30, w - 16, 30, NAVY);
  cv.fillRect(cx - 9, y + h - 30, 18, 30, [238, 238, 232]);
  cv.line(cx - 9, y + h - 30, cx, y + h - 12, [238, 238, 232]);
  cv.line(cx + 9, y + h - 30, cx, y + h - 12, [238, 238, 232]);
  // neck
  cv.fillRect(cx - 8, y + h - 46, 16, 18, SKIN);
  // hair (back mass) then face
  cv.fillEllipse(cx, y + 52, 27, 30, HAIR);
  cv.fillEllipse(cx, y + 60, 22, 28, SKIN);
  // hair cap over the top of the face
  cv.fillEllipse(cx, y + 40, 23, 14, HAIR);
  cv.fillRect(cx - 23, y + 34, 46, 10, HAIR);
  // ears
  cv.fillEllipse(cx - 23, y + 60, 4, 7, SKIN);
  cv.fillEllipse(cx + 23, y + 60, 4, 7, SKIN);
  // brows, eyes, nose, mouth
  cv.fillRect(cx - 15, y + 52, 10, 2, HAIR);
  cv.fillRect(cx + 5, y + 52, 10, 2, HAIR);
  cv.fillRect(cx - 14, y + 58, 8, 2, INK);
  cv.fillRect(cx + 6, y + 58, 8, 2, INK);
  cv.vline(cx, y + 60, y + 70, [150, 110, 80], 2);
  cv.fillRect(cx - 7, y + 76, 14, 2, [120, 70, 60]);
  cv.rect(x, y, w, h, NAVY, 2);
}

// ---------- the spread ----------
function drawSpread(): Canvas {
  const W = 1024, H = 724;
  const cv = new Canvas(W, H, PAPER);
  // outer frame + centre gutter
  cv.rect(10, 10, W - 20, H - 20, NAVY, 2);
  cv.fillRect(508, 12, 3, H - 24, PAPER_SHADOW);
  cv.fillRect(513, 12, 2, H - 24, [240, 233, 214]);

  // ===== LEFT PAGE: data page =====
  const LX = 28, LW = 466; // left page content box
  const LCX = LX + Math.floor(LW / 2);
  // emblem: compass star in double circle
  const ex = LCX, ey = 74;
  cv.ellipse(ex, ey, 26, 26, NAVY);
  cv.ellipse(ex, ey, 20, 20, GOLD);
  for (let a = 0; a < 8; a++) {
    const r = (a * Math.PI) / 4;
    cv.line(ex, ey, Math.round(ex + Math.cos(r) * 16), Math.round(ey + Math.sin(r) * 16), NAVY);
  }
  cv.fillEllipse(ex, ey, 4, 4, GOLD);
  cv.textCentered("REPUBLIC OF VELMARIS", LCX, 112, 2, NAVY);
  cv.textCentered("PASSPORT", LCX, 134, 2, GOLD);
  cv.hline(LX + 16, LX + LW - 16, 160, GOLD, 2);

  // photo
  drawPortrait(cv, 48, 184, 112, 140);

  // data fields (label small, value larger), right of photo
  const FX = 184;
  const fields: [string, string][] = [
    ["SURNAME", "ILSEN"],
    ["GIVEN NAMES", "MARA"],
    ["NATIONALITY", "VELMARIN"],
    ["DATE OF BIRTH", "04 JUN 1991"],
    ["PLACE OF BIRTH", "PORT SARELLE"],
    ["SEX", "F"],
  ];
  let fy = 184;
  for (const [label, value] of fields) {
    cv.text(label, FX, fy, 1, GREY);
    cv.text(value, FX, fy + 11, 2, NAVY);
    fy += 34;
  }
  // issue / expiry / number row
  const rowY = 408;
  const cols: [number, string, string][] = [
    [48, "DATE OF ISSUE", "12 MAR 2024"],
    [206, "DATE OF EXPIRY", "11 MAR 2034"],
    [364, "PASSPORT NO.", "VLM 847 291"],
  ];
  for (const [cx0, label, value] of cols) {
    cv.text(label, cx0, rowY, 1, GREY);
    cv.text(value, cx0, rowY + 11, 2, NAVY);
  }
  cv.text("AUTHORITY", 48, 452, 1, GREY);
  cv.text("MINISTRY OF THE SEA", 48, 463, 2, NAVY);
  cv.text("LANGUAGES: VELMARIN / ENGLISH", 48, 500, 1, GREY);

  // telling detail: entry condition box
  cv.rect(48, 528, 446, 58, GOLD, 1);
  cv.text("CONDITION OF ENTRY", 60, 538, 1, NAVY);
  cv.text("ENTRY BY SEA ONLY.", 60, 552, 2, INK);
  cv.text("VELMARIS HAS NO AIRPORT.", 60, 570, 1, INK);

  // MRZ (computed check digits)
  const docNo = "VLM847291";
  const dob = "910604";
  const exp = "340311";
  const personal = "<<<<<<<<<<<<<<";
  const line1 = ("P<VLMILSEN<<MARA" + "<".repeat(28)).slice(0, 44);
  const line2core =
    docNo + mrzCheck(docNo) + "VLM" + dob + mrzCheck(dob) + "F" + exp + mrzCheck(exp) +
    personal + mrzCheck(personal);
  const composite = mrzCheck(docNo + mrzCheck(docNo) + dob + mrzCheck(dob) + exp + mrzCheck(exp) + personal + mrzCheck(personal));
  const line2 = line2core + composite;
  cv.hline(LX + 4, LX + LW - 4, 618, GOLD, 1);
  cv.text(line1, 40, 632, 2, INK, 0);
  cv.text(line2, 40, 654, 2, INK, 0);

  // ===== RIGHT PAGE: visas =====
  const RCX = 762;
  cv.textCentered("VISAS", RCX, 44, 2, NAVY);
  cv.hline(548, 976, 70, GOLD, 1);
  // faint guilloche waves
  for (let k = 0; k < 3; k++) {
    const base = 470 + k * 60;
    for (let x = 540; x < 984; x += 2) {
      const y = base + Math.round(Math.sin(x / 38) * 5);
      cv.px(x, y, GUILLOCHE);
    }
  }
  // stamps: 2x2, chronological, all after issue 12 MAR 2024, before expiry 11 MAR 2034
  const stamps: { cx: number; cy: number; deg: number; ink: RGB; lines: { text: string; scale: number }[] }[] = [
    { cx: 652, cy: 190, deg: -6, ink: BLUE_INK, lines: [
      { text: "KESSAR", scale: 2 }, { text: "ARRIVAL", scale: 1 },
      { text: "18 JUN 2024", scale: 2 }, { text: "PORT OF KESSAR", scale: 1 } ] },
    { cx: 872, cy: 190, deg: 5, ink: BLUE_INK, lines: [
      { text: "KESSAR", scale: 2 }, { text: "DEPARTURE", scale: 1 },
      { text: "02 JUL 2024", scale: 2 }, { text: "PORT OF KESSAR", scale: 1 } ] },
    { cx: 652, cy: 330, deg: 7, ink: PURPLE_INK, lines: [
      { text: "DRANMERE", scale: 2 }, { text: "ARRIVAL", scale: 1 },
      { text: "09 SEP 2025", scale: 2 }, { text: "HARBOUR GATE", scale: 1 } ] },
    { cx: 872, cy: 330, deg: -5, ink: GREEN_INK, lines: [
      { text: "OSTVALE", scale: 2 }, { text: "ENTRY", scale: 1 },
      { text: "14 FEB 2026", scale: 2 }, { text: "OSTVALE BORDER", scale: 1 } ] },
  ];
  for (const s of stamps) {
    const st = makeStamp(s.lines, 210, 108, s.ink);
    blitRotated(cv, st, s.cx, s.cy, s.deg);
  }
  // ferry tax fee stamp
  const fee = makeStamp(
    [{ text: "FERRY TAX PAID", scale: 2 }, { text: "40 VLM", scale: 2 }],
    240, 76, BROWN_INK,
  );
  blitRotated(cv, fee, RCX, 500, -3);
  cv.textCentered("THIS PASSPORT REMAINS THE PROPERTY OF", RCX, 636, 1, GREY);
  cv.textCentered("THE REPUBLIC OF VELMARIS", RCX, 650, 1, GREY);
  return cv;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const png = encodePNG(drawSpread());
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();

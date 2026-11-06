import * as THREE from "three";
import { landDots, mapPoint } from "@/lib/worldmap";
import { seeded } from "./shared";

const GOLD = "#f0bb66";
const PALE = "#f4eee2";

function cssFont(variable: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

/** Pixels per layout unit. Drawing large and letting mipmaps shrink it keeps edges clean. */
const DENSITY = 1.5;

/** Canvas texture that repaints once web fonts (and any images) have arrived. */
function paintedTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D, display: string, images: HTMLImageElement[]) => void,
  sources: string[] = [],
) {
  const canvas = document.createElement("canvas");
  canvas.width = width * DENSITY;
  canvas.height = height * DENSITY;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(DENSITY, DENSITY);
  ctx.imageSmoothingQuality = "high";
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  const display = cssFont("--font-display", "sans-serif");
  const images: HTMLImageElement[] = [];

  const repaint = () => {
    ctx.clearRect(0, 0, width, height);
    paint(ctx, display, images);
    texture.needsUpdate = true;
  };

  repaint();
  document.fonts?.load(`500 40px ${display}`).then(repaint, () => {});
  sources.forEach((src, index) => {
    const image = new Image();
    image.onload = () => {
      images[index] = image;
      repaint();
    };
    image.src = src;
  });
  return texture;
}

function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(text, x, y);
  ctx.letterSpacing = "0px";
}

function frame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#0b0805";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,196,110,0.95)";
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, w - 6, h - 6);
}

/** Black mountain ranges under a warm sky. Bold shapes only, as these are shown small. */
function ridges(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
) {
  const rand = seeded(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, "#0d0a08");
  sky.addColorStop(0.55, "#2c1e11");
  sky.addColorStop(0.8, "#a8712f");
  sky.addColorStop(0.92, "#dca75f");
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  [
    { base: 0.66, rough: 0.2, color: "#3a2a1a" },
    { base: 0.76, rough: 0.2, color: "#1d150e" },
    { base: 0.88, rough: 0.14, color: "#070504" },
  ].forEach((layer) => {
    let level = layer.base;
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (let px = 0; px <= w + 40; px += 40) {
      level += (rand() - 0.5) * 0.11;
      level = Math.min(layer.base + layer.rough * 0.4, Math.max(layer.base - layer.rough, level));
      ctx.lineTo(x + px, y + h * level);
    }
    ctx.lineTo(x + w, y + h);
    ctx.fill();
  });
  ctx.restore();
}

/** Sets the largest size at which text fits the width, down to a limit. Returns that size. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  largest: number,
  smallest: number,
  maxWidth: number,
  spacing: number,
  display: string,
) {
  let size = largest;
  ctx.letterSpacing = `${spacing}px`;
  ctx.font = `${weight} ${size}px ${display}`;
  while (size > smallest && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${display}`;
  }
  ctx.letterSpacing = "0px";
  return size;
}

export type PanelEmblem = "projects" | "about" | "skills" | "contact";

const BRIGHT = "#ffe1a8";

/** Strokes in gold with a soft glow, the way lines are drawn on the hall's screens. */
function glowing(ctx: CanvasRenderingContext2D, width: number, alpha: number, draw: () => void) {
  ctx.save();
  ctx.strokeStyle = `rgba(240,187,102,${alpha})`;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(255,190,105,0.8)";
  ctx.shadowBlur = alpha > 0.6 ? 14 : 0;
  draw();
  ctx.restore();
}

/** Stacked project screens, the front one showing a lit mountain scene. */
function projectsEmblem(ctx: CanvasRenderingContext2D) {
  const screens: [number, number, number][] = [
    [300, 262, 0.28],
    [345, 292, 0.5],
    [390, 322, 1],
  ];
  screens.forEach(([x, y, alpha], index) => {
    ctx.fillStyle = "#0b0805";
    ctx.fillRect(x, y, 210, 132);
    glowing(ctx, index === 2 ? 5 : 4, alpha, () => {
      ctx.strokeRect(x, y, 210, 132);
      ctx.beginPath();
      ctx.moveTo(x, y + 26);
      ctx.lineTo(x + 210, y + 26);
      ctx.stroke();
    });
    ctx.fillStyle = `rgba(240,187,102,${alpha})`;
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 12 + i * 16, y + 10, 7, 7);
  });
  const [x, y] = [390, 322];
  glowing(ctx, 5, 1, () => {
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 118);
    ctx.lineTo(x + 70, y + 64);
    ctx.lineTo(x + 104, y + 92);
    ctx.lineTo(x + 140, y + 56);
    ctx.lineTo(x + 196, y + 118);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 160, y + 52, 11, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** A portrait in a ring, with something in orbit around it. */
function aboutEmblem(ctx: CanvasRenderingContext2D) {
  const cx = 430;
  const cy = 362;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 86, 0, Math.PI * 2);
  ctx.fillStyle = "#0b0805";
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = "rgba(240,187,102,0.9)";
  ctx.beginPath();
  ctx.arc(cx, cy - 22, 27, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 70, 62, 58, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  glowing(ctx, 5, 1, () => {
    ctx.beginPath();
    ctx.arc(cx, cy, 86, 0, Math.PI * 2);
    ctx.stroke();
  });
  glowing(ctx, 3, 0.55, () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 150, 36, -0.28, 0.15, Math.PI * 2 - 0.15);
    ctx.stroke();
  });
  ctx.fillStyle = BRIGHT;
  ctx.beginPath();
  ctx.arc(cx + 140, cy - 46, 8, 0, Math.PI * 2);
  ctx.fill();
}

/** Code brackets over a lattice of skill nodes, some of them lit and wired together. */
function skillsEmblem(ctx: CanvasRenderingContext2D) {
  const size = 22;
  const lit = new Set(["1,1", "3,0", "4,2", "6,1", "2,3", "5,3"]);
  const centres: Record<string, [number, number]> = {};
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 270 + col * size * 1.75 + (row % 2) * size * 0.87;
      const y = 268 + row * size * 1.5;
      centres[`${col},${row}`] = [x, y];
      const on = lit.has(`${col},${row}`);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        const px = x + Math.cos(a) * size * 0.8;
        const py = y + Math.sin(a) * size * 0.8;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = on ? "rgba(240,187,102,0.75)" : "rgba(240,187,102,0.05)";
      ctx.fill();
      ctx.strokeStyle = on ? "rgba(255,225,168,0.9)" : "rgba(240,187,102,0.22)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  glowing(ctx, 3, 0.6, () => {
    ctx.beginPath();
    ["1,1", "3,0", "4,2", "6,1"].forEach((key, index) => {
      const [x, y] = centres[key];
      if (index) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
  });
  ctx.fillStyle = "rgba(11,8,5,0.82)";
  ctx.fillRect(345, 300, 170, 120);
  glowing(ctx, 9, 1, () => {
    ctx.beginPath();
    ctx.moveTo(392, 318);
    ctx.lineTo(358, 360);
    ctx.lineTo(392, 402);
    ctx.moveTo(468, 318);
    ctx.lineTo(502, 360);
    ctx.lineTo(468, 402);
    ctx.moveTo(446, 312);
    ctx.lineTo(414, 408);
    ctx.stroke();
  });
}

/** A message rising on signal arcs. */
function contactEmblem(ctx: CanvasRenderingContext2D) {
  const cx = 430;
  const base = 470;
  [190, 150, 110].forEach((r, index) => {
    glowing(ctx, 4, 0.22 + index * 0.18, () => {
      ctx.beginPath();
      ctx.arc(cx, base, r, Math.PI + 0.55, Math.PI * 2 - 0.55);
      ctx.stroke();
    });
  });
  ctx.fillStyle = BRIGHT;
  ctx.beginPath();
  ctx.arc(cx, base - 4, 8, 0, Math.PI * 2);
  ctx.fill();
  const [x, y, ew, eh] = [cx - 70, 300, 140, 92];
  ctx.fillStyle = "#0b0805";
  ctx.fillRect(x, y, ew, eh);
  glowing(ctx, 5, 1, () => {
    ctx.strokeRect(x, y, ew, eh);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(cx, y + 54);
    ctx.lineTo(x + ew, y);
    ctx.stroke();
  });
}

const EMBLEMS: Record<PanelEmblem, (ctx: CanvasRenderingContext2D) => void> = {
  projects: projectsEmblem,
  about: aboutEmblem,
  skills: skillsEmblem,
  contact: contactEmblem,
};

/** Navigation panels in the Archive hall: a number, one big word and an emblem for the page. */
export function navPanelTexture(no: string, title: string, emblem: PanelEmblem, seed: number) {
  const w = 640;
  const h = 500;
  return paintedTexture(w, h, (ctx, display) => {
    frame(ctx, w, h);
    const back = ctx.createLinearGradient(0, 0, 0, h);
    back.addColorStop(0, "#0c0906");
    back.addColorStop(1, "#24170b");
    ctx.fillStyle = back;
    ctx.fillRect(5, 5, w - 10, h - 10);
    // Faint stars, placed the same way every time from the panel's seed.
    const rand = seeded(seed);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(255,232,196,${0.15 + rand() * 0.35})`;
      ctx.fillRect(20 + rand() * (w - 40), 240 + rand() * (h - 260), 3, 3);
    }
    const glow = ctx.createRadialGradient(430, 370, 10, 430, 370, 230);
    glow.addColorStop(0, "rgba(201,138,66,0.28)");
    glow.addColorStop(1, "rgba(201,138,66,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(5, 5, w - 10, h - 10);
    EMBLEMS[emblem](ctx);
    ctx.fillStyle = GOLD;
    ctx.font = `500 58px ${display}`;
    tracked(ctx, no, 38, 92, 4);
    ctx.fillStyle = PALE;
    fitFont(ctx, title, 600, 104, 60, w - 76, 4, display);
    tracked(ctx, title, 38, 210, 4);
  });
}

/** Project cards floating in the orbital archive: the title and a large picture. */
export function projectPanelTexture(no: string, title: string, image: string, seed: number) {
  const w = 760;
  const h = 480;
  return paintedTexture(
    w,
    h,
    (ctx, display, images) => {
      frame(ctx, w, h);
      ctx.fillStyle = GOLD;
      ctx.font = `600 50px ${display}`;
      tracked(ctx, no, 30, 68, 2);
      const left = 30 + ctx.measureText(no).width + 26;
      ctx.fillStyle = PALE;
      const heading = title.toUpperCase();
      const room = w - left - 28;
      fitFont(ctx, heading, 600, 50, 34, room, 2, display);
      tracked(ctx, heading, left, 68, 2);

      const ix = 28;
      const iy = 92;
      const iw = w - 56;
      const ih = h - iy - 28;
      const picture = images[0];
      if (picture) {
        const scale = Math.max(iw / picture.width, ih / picture.height);
        const sw = iw / scale;
        const sh = ih / scale;
        ctx.drawImage(picture, (picture.width - sw) / 2, (picture.height - sh) / 2, sw, sh, ix, iy, iw, ih);
      } else {
        ridges(ctx, ix, iy, iw, ih, seed);
      }
    },
    [image],
  );
}

/** Dotted world map for the observatory console. */
export function worldMapTexture() {
  const w = 900;
  const h = 480;
  const dots = landDots(3.4);
  return paintedTexture(w, h, (ctx, display) => {
    const back = ctx.createLinearGradient(0, 0, 0, h);
    back.addColorStop(0, "#1b1712");
    back.addColorStop(1, "#0a0806");
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(240,220,185,0.7)";
    dots.forEach(([lon, lat]) => {
      const [x, y] = mapPoint(lon, lat);
      ctx.fillRect(40 + x * (w - 80), 40 + y * (h - 90), 5.5, 5.5);
    });
    ctx.strokeStyle = "rgba(240,187,102,0.16)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo((w / 9) * i, 0);
      ctx.lineTo((w / 9) * i, h);
      ctx.stroke();
    }
    const [mx, my] = mapPoint(122.56, 10.72);
    const px = 40 + mx * (w - 80);
    const py = 40 + my * (h - 90);
    ctx.fillStyle = "#ffcf7f";
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffcf7f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = `500 20px ${display}`;
    tracked(ctx, "SIGNAL // ILOILO CITY", 28, h - 18, 4);
  });
}

/** Radial star chart for the small tilted consoles in the halls. */
export function chartTexture(seed: number) {
  const w = 512;
  const h = 340;
  const rand = seeded(seed);
  const specks = Array.from({ length: 150 }, () => [rand(), rand(), rand()]);
  return paintedTexture(w, h, (ctx) => {
    ctx.fillStyle = "#120d08";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,190,105,0.95)";
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) {
      ctx.strokeStyle = `rgba(255,190,105,${0.7 - i * 0.09})`;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, i * 42, i * 24, -0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    specks.forEach(([x, y, a]) => {
      ctx.fillStyle = `rgba(255,215,150,${a})`;
      ctx.fillRect(x * w, y * h, 2.5, 2.5);
    });
    ctx.fillStyle = "#ffd591";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 9, 0, Math.PI * 2);
    ctx.fill();
  });
}

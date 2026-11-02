import * as THREE from "three";
import { landDots, mapPoint } from "@/lib/worldmap";
import { seeded } from "./shared";

const GOLD = "#f0bb66";
const PALE = "#f4eee2";

function cssFont(variable: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

/** Canvas texture that repaints once web fonts (and any images) have arrived. */
function paintedTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D, display: string, images: HTMLImageElement[]) => void,
  sources: string[] = [],
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
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
  ctx.fillStyle = "rgba(11,8,5,0.8)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,196,110,0.95)";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, w - 4, h - 4);
}

/** Black mountain ranges under a gold-dusted sky. */
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
  sky.addColorStop(0.78, "#c98a42");
  sky.addColorStop(0.9, "#f4c684");
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 260; i++) {
    const size = Math.pow(rand(), 3) * 2.2 + 0.5;
    ctx.fillStyle = `rgba(255,236,205,${0.2 + rand() * 0.8})`;
    ctx.fillRect(x + rand() * w, y + rand() * h * 0.62, size, size);
  }
  // A moon with a lit limb.
  const mx = x + w * (0.25 + rand() * 0.5);
  const my = y + h * (0.22 + rand() * 0.16);
  const mr = h * (0.09 + rand() * 0.08);
  const halo = ctx.createRadialGradient(mx, my, mr * 0.7, mx, my, mr * 2.6);
  halo.addColorStop(0, "rgba(255,206,140,0.34)");
  halo.addColorStop(1, "rgba(255,206,140,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#0c0906";
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,214,150,0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx, my, mr, -2.4, 0.5);
  ctx.stroke();
  [
    { base: 0.6, rough: 0.28, color: "#3a2a1a", edge: "rgba(255,190,110,0.28)" },
    { base: 0.72, rough: 0.3, color: "#1d150e", edge: "rgba(255,190,110,0.5)" },
    { base: 0.87, rough: 0.2, color: "#070504", edge: "rgba(255,190,110,0.8)" },
  ].forEach((layer) => {
    const top: [number, number][] = [];
    let level = layer.base;
    for (let px = 0; px <= w + 8; px += 8) {
      level += (rand() - 0.5) * 0.075;
      level = Math.min(layer.base + layer.rough * 0.4, Math.max(layer.base - layer.rough, level));
      top.push([x + px, y + h * level]);
    }
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    top.forEach(([px, py]) => ctx.lineTo(px, py));
    ctx.lineTo(x + w, y + h);
    ctx.fill();
    ctx.strokeStyle = layer.edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    top.forEach(([px, py], index) => (index ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  });
  ctx.restore();
}

function dataRows(ctx: CanvasRenderingContext2D, x: number, y: number, rows: number, seed: number) {
  const rand = seeded(seed);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 5; c++) {
      ctx.fillStyle = `rgba(240,187,102,${0.25 + rand() * 0.6})`;
      ctx.fillRect(x + c * 26, y + r * 13, 10 + rand() * 12, 4);
    }
  }
}

/** Navigation panels in the Archive hall. */
export function navPanelTexture(no: string, title: string, sub: string, seed: number) {
  const w = 640;
  const h = 500;
  return paintedTexture(w, h, (ctx, display) => {
    frame(ctx, w, h);
    ridges(ctx, 3, 3, w - 6, h - 6, seed);
    const shade = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    shade.addColorStop(0, "rgba(6,4,2,0.82)");
    shade.addColorStop(1, "rgba(6,4,2,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(3, 3, w - 6, h * 0.62);
    ctx.fillStyle = GOLD;
    ctx.font = `500 44px ${display}`;
    tracked(ctx, no, 40, 78, 5);
    ctx.fillStyle = PALE;
    ctx.font = `500 56px ${display}`;
    tracked(ctx, title, 40, 148, 8);
    ctx.fillStyle = GOLD;
    ctx.font = `500 25px ${display}`;
    tracked(ctx, sub, 40, 190, 5);
    dataRows(ctx, 40, h - 66, 3, seed + 4);
  });
}

/** Project cards floating in the orbital archive. */
export function projectPanelTexture(
  no: string,
  title: string,
  tags: string[],
  image: string,
  seed: number,
) {
  const w = 760;
  const h = 480;
  return paintedTexture(
    w,
    h,
    (ctx, display, images) => {
      frame(ctx, w, h);
      ctx.fillStyle = GOLD;
      ctx.font = `500 36px ${display}`;
      tracked(ctx, no, 34, 56, 3);
      ctx.fillStyle = PALE;
      const heading = title.toUpperCase();
      let size = 36;
      ctx.letterSpacing = "4px";
      ctx.font = `600 ${size}px ${display}`;
      while (size > 16 && ctx.measureText(heading).width > w - 68) {
        size -= 2;
        ctx.font = `600 ${size}px ${display}`;
      }
      tracked(ctx, heading, 34, 104, 4);

      const ix = 34;
      const iy = 128;
      const iw = 490;
      const ih = 318;
      const picture = images[0];
      if (picture) {
        const scale = Math.max(iw / picture.width, ih / picture.height);
        const sw = iw / scale;
        const sh = ih / scale;
        ctx.drawImage(picture, (picture.width - sw) / 2, (picture.height - sh) / 2, sw, sh, ix, iy, iw, ih);
      } else {
        ridges(ctx, ix, iy, iw, ih, seed);
      }
      ctx.strokeStyle = "rgba(240,187,102,0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(ix, iy, iw, ih);

      ctx.fillStyle = "rgba(240,230,210,0.82)";
      ctx.font = `500 21px ${display}`;
      tags.slice(0, 4).forEach((tag, index) => {
        tracked(ctx, `// ${tag.toUpperCase()}`, ix + iw + 22, iy + 28 + index * 38, 2);
      });

      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w - 76, h - 44);
      ctx.lineTo(w - 36, h - 44);
      ctx.moveTo(w - 50, h - 58);
      ctx.lineTo(w - 36, h - 44);
      ctx.lineTo(w - 50, h - 30);
      ctx.stroke();
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

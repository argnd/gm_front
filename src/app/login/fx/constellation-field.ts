import { FxPointer, FxScene, FxSize } from './login-fx';

const FIELD = {
  areaPerStar: 26000,
  minCount: 40,
  maxCount: 110,
  minSpeed: 6,
  maxSpeed: 16,
  wanderTurn: 0.4,
  minRadius: 0.8,
  maxRadius: 1.9,
  minGlow: 0.5,
  maxGlow: 1,
  minTwinkle: 0.7,
  maxTwinkle: 2.2,
  minBeatRatio: 2.3,
  maxBeatRatio: 3.9,
  minFlickerDepth: 0.18,
  maxFlickerDepth: 0.38,
  linkDistance: 115,
  linkAlpha: 0.25,
  linkColor: 'rgb(164, 182, 224)',
  coreColor: 'rgb(235, 243, 255)',
  wrapMargin: 24,
  spriteSize: 64,
  minHaloSpan: 5,
  maxHaloSpan: 11,
  minHaloAlpha: 0.2,
  maxHaloAlpha: 0.85,
  haloAverage: 0.70,
};

const LANTERN = {
  lightRadius: 190,
  lightBoost: 0.9,
  linkBoost: 1.8,
  repelRadius: 80,
  repelStrength: 60,
  followEase: 7,
  fadeEase: 4,
  glowSpan: 360,
  glowAlpha: 0.1,
};

type StarPoint = {
  x: number;
  y: number;
  heading: number;
  speed: number;
  radius: number;
  glow: number;
  span: number;
  haloAlpha: number;
  phase: number;
  twinkle: number;
  phase2: number;
  twinkle2: number;
  flickerDepth: number;
  light: number;
};

export class ConstellationField implements FxScene {
  private points: StarPoint[] = [];
  private readonly halo = createHaloSprite();
  private readonly lantern = { x: 0, y: 0, intensity: 0 };

  init(size: FxSize): void {
    const count = Math.min(
      FIELD.maxCount,
      Math.max(FIELD.minCount, Math.round((size.width * size.height) / FIELD.areaPerStar)),
    );
    this.points = Array.from({ length: count }, () => spawnStar(size));
  }

  step(dt: number, size: FxSize, pointer: FxPointer): void {
    this.updateLantern(dt, pointer);
    const lantern = this.lantern;
    const lit = lantern.intensity > 0.01;

    for (const point of this.points) {
      point.heading += (Math.random() * 2 - 1) * FIELD.wanderTurn * dt;
      point.x += Math.cos(point.heading) * point.speed * dt;
      point.y += Math.sin(point.heading) * point.speed * dt;
      point.phase += point.twinkle * dt;
      point.phase2 += point.twinkle2 * dt;

      if (lit) {
        const dx = point.x - lantern.x;
        const dy = point.y - lantern.y;
        const dist = Math.hypot(dx, dy);

        if (dist < LANTERN.repelRadius && dist > 0.5) {
          const push =
            (1 - dist / LANTERN.repelRadius) * LANTERN.repelStrength * lantern.intensity * dt;
          point.x += (dx / dist) * push;
          point.y += (dy / dist) * push;
        }

        const closeness = Math.max(0, 1 - dist / LANTERN.lightRadius);
        point.light = closeness * closeness * lantern.intensity;
      } else {
        point.light = 0;
      }

      wrap(point, size);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.drawLanternGlow(ctx);
    this.drawLinks(ctx);
    this.drawStars(ctx);
    ctx.globalAlpha = 1;
  }

  private updateLantern(dt: number, pointer: FxPointer): void {
    const lantern = this.lantern;

    if (pointer.active) {
      if (lantern.intensity < 0.01) {
        lantern.x = pointer.x;
        lantern.y = pointer.y;
      }
      const follow = Math.min(1, LANTERN.followEase * dt);
      lantern.x += (pointer.x - lantern.x) * follow;
      lantern.y += (pointer.y - lantern.y) * follow;
    }

    const target = pointer.active ? 1 : 0;
    lantern.intensity += (target - lantern.intensity) * Math.min(1, LANTERN.fadeEase * dt);
  }

  private drawLanternGlow(ctx: CanvasRenderingContext2D): void {
    if (this.lantern.intensity < 0.01) {
      return;
    }
    const span = LANTERN.glowSpan;
    ctx.globalAlpha = LANTERN.glowAlpha * this.lantern.intensity;
    ctx.drawImage(this.halo, this.lantern.x - span / 2, this.lantern.y - span / 2, span, span);
  }

  private drawLinks(ctx: CanvasRenderingContext2D): void {
    const maxDist = FIELD.linkDistance;
    const maxDist2 = maxDist * maxDist;
    ctx.lineWidth = 1;
    ctx.strokeStyle = FIELD.linkColor;

    for (let i = 0; i < this.points.length; i++) {
      const a = this.points[i];
      for (let j = i + 1; j < this.points.length; j++) {
        const b = this.points[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 >= maxDist2) {
          continue;
        }

        const closeness = 1 - Math.sqrt(dist2) / maxDist;
        const light = 1 + ((a.light + b.light) / 2) * LANTERN.linkBoost;
        ctx.globalAlpha = Math.min(1, closeness * FIELD.linkAlpha * light);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = FIELD.coreColor;
    for (const point of this.points) {
      const wave = 0.62 * Math.sin(point.phase) + 0.38 * Math.sin(point.phase2);
      const brightness = Math.min(
        1,
        point.glow *
          (1 - point.flickerDepth + point.flickerDepth * wave) *
          (1 + point.light * LANTERN.lightBoost),
      );

      ctx.globalAlpha = brightness * point.haloAlpha;
      ctx.drawImage(
        this.halo,
        point.x - point.span / 2,
        point.y - point.span / 2,
        point.span,
        point.span,
      );

      ctx.globalAlpha = brightness;
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function spawnStar(size: FxSize): StarPoint {
  const sizeBias = Math.random();
  const radius = lerp(FIELD.minRadius, FIELD.maxRadius, sizeBias * sizeBias);
  const haloBias = Math.random() ** (1 / FIELD.haloAverage - 1);
  const twinkle = lerp(FIELD.minTwinkle, FIELD.maxTwinkle, Math.random());

  return {
    x: Math.random() * size.width,
    y: Math.random() * size.height,
    heading: Math.random() * Math.PI * 2,
    speed: lerp(FIELD.minSpeed, FIELD.maxSpeed, Math.random()),
    radius,
    glow: lerp(FIELD.minGlow, FIELD.maxGlow, Math.random()),
    span: radius * lerp(FIELD.minHaloSpan, FIELD.maxHaloSpan, haloBias),
    haloAlpha: lerp(FIELD.minHaloAlpha, FIELD.maxHaloAlpha, haloBias),
    phase: Math.random() * Math.PI * 2,
    twinkle,
    phase2: Math.random() * Math.PI * 2,
    twinkle2: twinkle * lerp(FIELD.minBeatRatio, FIELD.maxBeatRatio, Math.random()),
    flickerDepth: lerp(FIELD.minFlickerDepth, FIELD.maxFlickerDepth, Math.random()),
    light: 0,
  };
}

function wrap(point: StarPoint, size: FxSize): void {
  const margin = FIELD.wrapMargin;
  if (point.x < -margin) {
    point.x = size.width + margin;
  } else if (point.x > size.width + margin) {
    point.x = -margin;
  }
  if (point.y < -margin) {
    point.y = size.height + margin;
  } else if (point.y > size.height + margin) {
    point.y = -margin;
  }
}

function lerp(min: number, max: number, ratio: number): number {
  return min + (max - min) * ratio;
}

function createHaloSprite(): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = FIELD.spriteSize;
  sprite.height = FIELD.spriteSize;
  const ctx = sprite.getContext('2d');
  if (!ctx) {
    return sprite;
  }

  const center = FIELD.spriteSize / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(215, 228, 255, 0.65)');
  gradient.addColorStop(0.4, 'rgba(168, 186, 228, 0.18)');
  gradient.addColorStop(1, 'rgba(150, 168, 215, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.spriteSize, FIELD.spriteSize);
  return sprite;
}

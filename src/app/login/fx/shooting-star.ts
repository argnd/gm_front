import { FxScene, FxSize } from './login-fx';

const STREAK = {
  minDelay: 20,
  maxDelay: 30,
  minFirstDelay: 8,
  maxFirstDelay: 16,
  minLife: 0.9,
  maxLife: 1.4,
  minDistance: 170,
  maxDistance: 300,
  minTrail: 80,
  maxTrail: 140,
  lineWidth: 1.5,
  headRadius: 1.4,
  headColor: 'rgb(235, 240, 255)',
  glowSpan: 26,
  cardHalfWidth: 230,
  cardPad: 40,
  tailBuffer: 70,
  minMarginWidth: 150,
  spawnMinY: 0.08,
  spawnMaxY: 0.7,
  leftAngleMin: 105,
  leftAngleMax: 255,
  rightAngleMin: -75,
  rightAngleMax: 75,
  spriteSize: 48,
};

type Streak = {
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  age: number;
  life: number;
  trail: number;
};

export class ShootingStars implements FxScene {
  private streak: Streak | null = null;
  private timer = 0;
  private zone: 'left' | 'right' = 'right';
  private readonly glow = createGlowSprite();

  init(): void {
    this.streak = null;
    this.timer = lerp(STREAK.minFirstDelay, STREAK.maxFirstDelay, Math.random());
  }

  step(dt: number, size: FxSize): void {
    if (this.streak) {
      this.streak.age += dt;
      if (this.streak.age >= this.streak.life) {
        this.streak = null;
        this.timer = lerp(STREAK.minDelay, STREAK.maxDelay, Math.random());
      }
      return;
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      this.zone = this.zone === 'left' ? 'right' : 'left';
      this.streak = spawnStreak(size, this.zone);
      if (!this.streak) {
        this.timer = lerp(STREAK.minDelay, STREAK.maxDelay, Math.random());
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const streak = this.streak;
    if (!streak) {
      return;
    }

    const progress = streak.age / streak.life;
    const eased = progress * progress;
    const headX = streak.x0 + streak.dx * eased;
    const headY = streak.y0 + streak.dy * eased;

    const alpha = Math.min(1, progress / 0.12, (1 - progress) / 0.2);
    if (alpha <= 0) {
      return;
    }

    const length = Math.hypot(streak.dx, streak.dy);
    const ux = streak.dx / length;
    const uy = streak.dy / length;
    const trailLength = streak.trail * (0.35 + 0.65 * progress);
    const tailX = headX - ux * trailLength;
    const tailY = headY - uy * trailLength;

    const gradient = ctx.createLinearGradient(headX, headY, tailX, tailY);
    gradient.addColorStop(0, `rgba(214, 222, 255, ${(alpha * 0.9).toFixed(3)})`);
    gradient.addColorStop(1, 'rgba(160, 170, 235, 0)');

    ctx.globalAlpha = 1;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = STREAK.lineWidth;
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.9;
    ctx.drawImage(
      this.glow,
      headX - STREAK.glowSpan / 2,
      headY - STREAK.glowSpan / 2,
      STREAK.glowSpan,
      STREAK.glowSpan,
    );

    ctx.globalAlpha = alpha;
    ctx.fillStyle = STREAK.headColor;
    ctx.beginPath();
    ctx.arc(headX, headY, STREAK.headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function spawnStreak(size: FxSize, zone: 'left' | 'right'): Streak | null {
  const marginEnd = size.width / 2 - STREAK.cardHalfWidth - STREAK.cardPad;
  if (marginEnd < STREAK.minMarginWidth) {
    return null;
  }

  const offset = lerp(0.1 * marginEnd, marginEnd - STREAK.tailBuffer, Math.random());
  const x0 = zone === 'left' ? offset : size.width - offset;
  const y0 = size.height * lerp(STREAK.spawnMinY, STREAK.spawnMaxY, Math.random());

  const angleDeg =
    zone === 'left'
      ? lerp(STREAK.leftAngleMin, STREAK.leftAngleMax, Math.random())
      : lerp(STREAK.rightAngleMin, STREAK.rightAngleMax, Math.random());
  const angle = (angleDeg * Math.PI) / 180;
  const distance = lerp(STREAK.minDistance, STREAK.maxDistance, Math.random());

  return {
    x0,
    y0,
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
    age: 0,
    life: lerp(STREAK.minLife, STREAK.maxLife, Math.random()),
    trail: lerp(STREAK.minTrail, STREAK.maxTrail, Math.random()),
  };
}

function lerp(min: number, max: number, ratio: number): number {
  return min + (max - min) * ratio;
}

function createGlowSprite(): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = STREAK.spriteSize;
  sprite.height = STREAK.spriteSize;
  const ctx = sprite.getContext('2d');
  if (!ctx) {
    return sprite;
  }

  const center = STREAK.spriteSize / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(214, 222, 255, 0.9)');
  gradient.addColorStop(0.35, 'rgba(170, 180, 240, 0.4)');
  gradient.addColorStop(1, 'rgba(170, 180, 240, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, STREAK.spriteSize, STREAK.spriteSize);
  return sprite;
}

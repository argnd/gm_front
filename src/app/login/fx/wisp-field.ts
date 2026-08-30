import { FxScene, FxSize } from './login-fx';

// Three will-o'-the-wisps, one per narrative axis, wandering across the sky and leaving a
// short trail of motes. They ignore the cursor entirely — only the constellation reacts to
// it, so the two scenes stay readable on top of each other.

const WISP = {
  spriteSize: 64,
  headSpan: 120,
  headPulse: 0.18,
  headAlpha: 0.55,
  minPulseSpeed: 1,
  maxPulseSpeed: 1.7,
  trailRate: 16,
  minTrailLife: 1.1,
  maxTrailLife: 2,
  minTrailSpan: 16,
  maxTrailSpan: 34,
  trailAlpha: 0.34,
  trailJitter: 9,
  trailDrift: 14,
  trailRise: 7,
  primaryAmpX: 0.34,
  secondaryAmpX: 0.13,
  primaryAmpY: 0.3,
  secondaryAmpY: 0.12,
  minFreq: 0.05,
  maxFreq: 0.16,
  minWobbleRatio: 2.2,
  maxWobbleRatio: 3.4,
};

// Romance, adventure, other — the same hues as the accent tokens in the stylesheet
const AXES = [
  { core: [255, 214, 228], glow: [255, 111, 159] },
  { core: [255, 224, 186], glow: [255, 160, 74] },
  { core: [214, 231, 248], glow: [143, 178, 220] },
];

// Sized for the worst case (max rate x max lifetime) so the pool never runs dry: motes are
// recycled rather than allocated, which keeps the loop free of garbage collection
const TRAIL_POOL = Math.ceil(WISP.trailRate * WISP.maxTrailLife) + 8;

type TrailMote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  span: number;
  alive: boolean;
};

type Wisp = {
  sprite: HTMLCanvasElement;
  t: number;
  x: number;
  y: number;
  fx1: number;
  fx2: number;
  fy1: number;
  fy2: number;
  px1: number;
  px2: number;
  py1: number;
  py2: number;
  pulsePhase: number;
  pulseSpeed: number;
  emitAcc: number;
  trail: TrailMote[];
};

export class WispField implements FxScene {
  private wisps: Wisp[] = [];

  init(size: FxSize): void {
    this.wisps = AXES.map((axis) => spawnWisp(axis.core, axis.glow, size));
  }

  step(dt: number, size: FxSize): void {
    for (const wisp of this.wisps) {
      wisp.t += dt;
      wisp.pulsePhase += wisp.pulseSpeed * dt;
      placeWisp(wisp, size);

      // Accumulator rather than one mote per frame: the emission rate stays constant
      // whatever the frame rate, and a long frame emits several at once
      wisp.emitAcc += WISP.trailRate * dt;
      while (wisp.emitAcc >= 1) {
        wisp.emitAcc -= 1;
        emitMote(wisp);
      }

      for (const mote of wisp.trail) {
        if (!mote.alive) {
          continue;
        }
        mote.age += dt;
        if (mote.age >= mote.life) {
          mote.alive = false;
          continue;
        }
        mote.x += mote.vx * dt;
        mote.y += mote.vy * dt;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const wisp of this.wisps) {
      for (const mote of wisp.trail) {
        if (!mote.alive) {
          continue;
        }
        // A mote shrinks and fades as it ages; the squared alpha makes the tail vanish
        // fast enough that the trail stays a wake rather than a smear
        const left = 1 - mote.age / mote.life;
        const span = mote.span * (0.55 + 0.45 * left);
        ctx.globalAlpha = WISP.trailAlpha * left * left;
        ctx.drawImage(wisp.sprite, mote.x - span / 2, mote.y - span / 2, span, span);
      }

      const span = WISP.headSpan * (1 + WISP.headPulse * Math.sin(wisp.pulsePhase));
      ctx.globalAlpha = WISP.headAlpha;
      ctx.drawImage(wisp.sprite, wisp.x - span / 2, wisp.y - span / 2, span, span);
    }
    ctx.globalAlpha = 1;
  }
}

function spawnWisp(core: number[], glow: number[], size: FxSize): Wisp {
  const fx1 = lerp(WISP.minFreq, WISP.maxFreq, Math.random());
  const fy1 = lerp(WISP.minFreq, WISP.maxFreq, Math.random());

  const wisp: Wisp = {
    sprite: createWispSprite(core, glow),
    t: Math.random() * 1000,
    x: 0,
    y: 0,
    fx1,
    fx2: fx1 * lerp(WISP.minWobbleRatio, WISP.maxWobbleRatio, Math.random()),
    fy1,
    fy2: fy1 * lerp(WISP.minWobbleRatio, WISP.maxWobbleRatio, Math.random()),
    px1: randomPhase(),
    px2: randomPhase(),
    py1: randomPhase(),
    py2: randomPhase(),
    pulsePhase: randomPhase(),
    pulseSpeed: lerp(WISP.minPulseSpeed, WISP.maxPulseSpeed, Math.random()),
    emitAcc: 0,
    trail: Array.from({ length: TRAIL_POOL }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 1,
      span: 1,
      alive: false,
    })),
  };

  placeWisp(wisp, size);
  return wisp;
}

// Position is a pure function of time: two detuned sines per axis, in fractions of the
// viewport. Nothing is integrated, so a resize repositions the wisp without any drift.
function placeWisp(wisp: Wisp, size: FxSize): void {
  const t = wisp.t;
  wisp.x =
    size.width *
    (0.5 +
      WISP.primaryAmpX * Math.sin(wisp.fx1 * t + wisp.px1) +
      WISP.secondaryAmpX * Math.sin(wisp.fx2 * t + wisp.px2));
  wisp.y =
    size.height *
    (0.5 +
      WISP.primaryAmpY * Math.sin(wisp.fy1 * t + wisp.py1) +
      WISP.secondaryAmpY * Math.sin(wisp.fy2 * t + wisp.py2));
}

// Takes the first free slot from the pool and re-seeds it; a full pool simply drops the
// emission rather than growing the array
function emitMote(wisp: Wisp): void {
  const mote = wisp.trail.find((candidate) => !candidate.alive);
  if (!mote) {
    return;
  }

  mote.x = wisp.x + (Math.random() * 2 - 1) * WISP.trailJitter;
  mote.y = wisp.y + (Math.random() * 2 - 1) * WISP.trailJitter;
  mote.vx = (Math.random() * 2 - 1) * WISP.trailDrift;
  // Constant upward bias on top of the random drift: the trail rises like embers
  mote.vy = (Math.random() * 2 - 1) * WISP.trailDrift - WISP.trailRise;
  mote.age = 0;
  mote.life = lerp(WISP.minTrailLife, WISP.maxTrailLife, Math.random());
  mote.span = lerp(WISP.minTrailSpan, WISP.maxTrailSpan, Math.random());
  mote.alive = true;
}

function randomPhase(): number {
  return Math.random() * Math.PI * 2;
}

function lerp(min: number, max: number, ratio: number): number {
  return min + (max - min) * ratio;
}

function createWispSprite(core: number[], glow: number[]): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = WISP.spriteSize;
  sprite.height = WISP.spriteSize;
  const ctx = sprite.getContext('2d');
  if (!ctx) {
    return sprite;
  }

  const center = WISP.spriteSize / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, `rgba(${core.join(', ')}, 0.9)`);
  gradient.addColorStop(0.3, `rgba(${glow.join(', ')}, 0.5)`);
  gradient.addColorStop(1, `rgba(${glow.join(', ')}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WISP.spriteSize, WISP.spriteSize);
  return sprite;
}

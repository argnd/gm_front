import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Ambiance } from '../../models/turn.model';
import { AMBIANCE_KEYS, AMBIANCE_MAX_TOTAL, ambianceTotal, ambianceValue } from '../ambiance/ambiance.engine';

const HOME_Y: [number, number] = [10, 430];
const NEAR_X = -14;
const MAX_REACH = 280;
const EDGE_MARGIN = 12;
const PAUSE_MS: [number, number] = [400, 1800];
const DASH_CHANCE = 0.12;
const DASH_COOLDOWN_MS = 20000;
const FADE_MS = 240;
const HOP_COUNT: [number, number] = [2, 5];
const HOP_MS: [number, number] = [240, 460];
const HOP_PAUSE_MS: [number, number] = [90, 330];
const LINGER_MS: [number, number] = [400, 1100];

const BASE_COLOR = { r: 222, g: 234, b: 158 };
const HUE_COLORS = {
  romance: { r: 255, g: 111, b: 159 },
  adventure: { r: 255, g: 160, b: 74 },
  other: { r: 143, g: 178, b: 220 },
} as const;

@Component({
  selector: 'app-firefly',
  templateUrl: './firefly.component.html',
  styleUrl: './firefly.component.scss',
  host: { 'aria-hidden': 'true' },
})
export class FireflyComponent {
  readonly ambiance = input<Ambiance | null>(null);

  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly x = signal(lerp([-70, NEAR_X], Math.random()));
  protected readonly y = signal(lerp(HOME_Y, Math.random()));
  protected readonly z = signal(Math.random());
  protected readonly speed = signal(0);
  protected readonly visible = signal(true);

  protected readonly scale = computed(() => (0.55 + 0.65 * this.z()).toFixed(3));

  protected readonly color = computed(() => {
    const value = this.ambiance();
    const total = value ? ambianceTotal(value) : 0;
    const baseWeight = Math.max(0, 1 - total / AMBIANCE_MAX_TOTAL);
    let r = BASE_COLOR.r * baseWeight;
    let g = BASE_COLOR.g * baseWeight;
    let b = BASE_COLOR.b * baseWeight;
    let weightSum = baseWeight;

    for (const key of AMBIANCE_KEYS) {
      const weight = ambianceValue(value, key) / AMBIANCE_MAX_TOTAL;
      r += HUE_COLORS[key].r * weight;
      g += HUE_COLORS[key].g * weight;
      b += HUE_COLORS[key].b * weight;
      weightSum += weight;
    }

    return `rgb(${Math.round(r / weightSum)}, ${Math.round(g / weightSum)}, ${Math.round(b / weightSum)})`;
  });

  protected readonly glow = computed(() => {
    const value = this.ambiance();
    const total = value ? ambianceTotal(value) : 0;
    return Math.min(1, total / AMBIANCE_MAX_TOTAL).toFixed(3);
  });

  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastDash = 0;

  constructor() {
    this.schedule(600);
    inject(DestroyRef).onDestroy(() => {
      if (this.timer !== null) clearTimeout(this.timer);
    });
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => this.step(), delay);
  }

  private step(): void {
    const now = performance.now();
    if (now - this.lastDash > DASH_COOLDOWN_MS && Math.random() < DASH_CHANCE) {
      void this.dash();
      return;
    }

    const railLeft = this.host.nativeElement.getBoundingClientRect().left;
    const minX = -Math.max(48, Math.min(MAX_REACH, railLeft - EDGE_MARGIN));
    const currentX = this.x();
    const currentY = this.y();
    const leftness = Math.min(1, Math.max(0, (-currentX - 20) / 200));
    const rangeX = 60 + 190 * leftness;
    const rangeY = 18 + 46 * leftness;

    const targetX = clamp(currentX + (Math.random() * 2 - 1) * rangeX, minX, NEAR_X);
    const targetY = clamp(currentY + (Math.random() * 2 - 1) * rangeY, HOME_Y[0], HOME_Y[1]);
    const distance = Math.hypot(targetX - currentX, targetY - currentY);
    const duration = clamp((distance / 32) * 1000, 2800, 9000);

    this.speed.set(duration);
    this.x.set(targetX);
    this.y.set(targetY);
    this.z.set(Math.random());
    this.schedule(duration + lerp(PAUSE_MS, Math.random()));
  }

  private async dash(): Promise<void> {
    this.lastDash = performance.now();
    const rail = this.host.nativeElement.getBoundingClientRect();
    const flow = this.host.nativeElement.closest('.gm-stage')?.querySelector('.gm-flow');
    const flowRect = flow?.getBoundingClientRect() ?? null;
    const base = flowRect ? flowRect.right - rail.left : 900;
    const margin = flowRect
      ? Math.max(0, window.innerWidth - flowRect.right - EDGE_MARGIN)
      : 200;
    const zoneX: [number, number] = [base + 12, base + Math.max(60, Math.min(230, margin))];
    const zoneY: [number, number] = [16, 170];

    this.visible.set(false);
    await this.wait(FADE_MS + 30);

    this.speed.set(0);
    this.x.set(lerp(zoneX, Math.random()));
    this.y.set(lerp(zoneY, Math.random()));
    this.z.set(Math.random());
    await this.wait(40);
    this.visible.set(true);
    await this.wait(FADE_MS + 60);

    const hops = Math.round(lerp(HOP_COUNT, Math.random()));
    for (let i = 0; i < hops; i++) {
      const duration = lerp(HOP_MS, Math.random());
      this.speed.set(duration);
      this.x.set(clamp(this.x() + (Math.random() * 2 - 1) * 110, zoneX[0], zoneX[1]));
      this.y.set(clamp(this.y() + (Math.random() * 2 - 1) * 70, zoneY[0], zoneY[1]));
      this.z.set(Math.random());
      await this.wait(duration + lerp(HOP_PAUSE_MS, Math.random()));
    }

    await this.wait(lerp(LINGER_MS, Math.random()));

    this.visible.set(false);
    await this.wait(FADE_MS + 30);

    this.speed.set(0);
    this.x.set(lerp([-70, NEAR_X], Math.random()));
    this.y.set(lerp(HOME_Y, Math.random()));
    this.z.set(Math.random());
    await this.wait(40);
    this.visible.set(true);
    this.schedule(300);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(resolve, ms);
    });
  }
}

function lerp(range: readonly [number, number], ratio: number): number {
  return range[0] + (range[1] - range[0]) * ratio;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

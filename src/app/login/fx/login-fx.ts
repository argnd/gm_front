// Canvas engine of the login page. Framework-free on purpose: it owns the rAF loop, the
// DPR sizing and the lifecycle, and only knows about scenes through the FxScene interface.
// Adding a scene means adding an object to the array passed in by the component.

// CSS pixels, not canvas pixels — scenes reason in layout coordinates and the DPR scaling
// is applied once by the transform in fitCanvas
export type FxSize = { width: number; height: number };

export type FxPointer = { x: number; y: number; active: boolean };

// Split in three so a scene keeps its simulation independent of the drawing: `step` never
// touches the context, `draw` never mutates state
export interface FxScene {
  init(size: FxSize): void;
  step(dt: number, size: FxSize, pointer: FxPointer): void;
  draw(ctx: CanvasRenderingContext2D, size: FxSize, pointer: FxPointer): void;
}

const MAX_FRAME_DT = 0.05; // caps the jump after a stall, or particles teleport
const MAX_PIXEL_RATIO = 2; // a 3x screen would triple the fill cost for nothing here

export class LoginFx {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private size: FxSize = { width: 0, height: 0 };
  private frame: number | null = null;
  private lastTime = 0;
  private readonly pointer: FxPointer = { x: 0, y: 0, active: false };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scenes: readonly FxScene[],
  ) {
    this.ctx = canvas.getContext('2d');
  }

  // Returns its own teardown: the caller holds a single function that removes every
  // listener and stops the loop, which is what the component wires to DestroyRef
  start(): () => void {
    if (!this.ctx) {
      return () => {};
    }

    this.fitCanvas();
    for (const scene of this.scenes) {
      scene.init(this.size);
    }

    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', this.onPointerLeave);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.reducedMotion.addEventListener('change', this.onMotionPreferenceChange);

    // One frame is always painted, even under reduced motion: the sky is drawn, just still
    this.renderFrame();
    if (!this.reducedMotion.matches) {
      this.resume();
    }

    return () => {
      this.pause();
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('pointermove', this.onPointerMove);
      document.documentElement.removeEventListener('mouseleave', this.onPointerLeave);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.reducedMotion.removeEventListener('change', this.onMotionPreferenceChange);
    };
  }

  private resume(): void {
    if (this.frame !== null) {
      return;
    }
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private pause(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  // Arrow properties throughout, so every handler can be removed by reference
  private readonly tick = (time: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    // Clamped on both ends: negative on a clock adjustment, huge after a background tab
    const dt = Math.min(Math.max((time - this.lastTime) / 1000, 0), MAX_FRAME_DT);
    this.lastTime = time;

    for (const scene of this.scenes) {
      scene.step(dt, this.size, this.pointer);
    }
    this.renderFrame();
  };

  private renderFrame(): void {
    if (!this.ctx) {
      return;
    }
    this.ctx.clearRect(0, 0, this.size.width, this.size.height);
    for (const scene of this.scenes) {
      scene.draw(this.ctx, this.size, this.pointer);
    }
  }

  // Backing store sized in device pixels, context scaled so drawing stays in CSS pixels
  private fitCanvas(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.size = { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
    this.canvas.width = Math.max(1, Math.round(this.size.width * ratio));
    this.canvas.height = Math.max(1, Math.round(this.size.height * ratio));
    this.ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  private readonly onResize = (): void => {
    this.fitCanvas();
    // Resizing clears the backing store: repaint by hand when the loop is stopped
    if (this.frame === null) {
      this.renderFrame();
    }
  };

  // A hidden tab still gets rAF throttled rather than stopped: pausing outright is what
  // keeps the login page from burning cycles in the background
  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.pause();
    } else if (!this.reducedMotion.matches) {
      this.resume();
    }
  };

  private readonly onMotionPreferenceChange = (): void => {
    if (this.reducedMotion.matches) {
      this.pause();
      this.renderFrame();
    } else if (!document.hidden) {
      this.resume();
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    this.pointer.active = true;
  };

  private readonly onPointerLeave = (): void => {
    this.pointer.active = false;
  };
}

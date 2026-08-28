import {
  Component,
  DestroyRef,
  ElementRef,
  Type,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ACTION_COPY, ACTION_HINTS, ActionCopy, AmbianceKey } from '../ambiance/ambiance.engine';
import { AmbianceDecorSlot, AmbianceDecorData, EMPTY_DECOR_DATA } from '../decor/ambiance-decor';

const HINT_ROTATION_MS = 6000;
const HINT_FADE_MS = 450;
const FIELD_MAX_HEIGHT = 340;
const SEAL_MS = 650;

@Component({
  selector: 'app-chat-input',
  imports: [FormsModule, NgComponentOutlet],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.scss',
})
export class ChatInputComponent {
  readonly prompt = input('');
  readonly copy = input<ActionCopy>(ACTION_COPY['neutral']);
  readonly dominant = input<AmbianceKey | 'neutral'>('neutral');
  readonly decor = input<Type<unknown> | null>(null);
  readonly decorData = input<AmbianceDecorData>(EMPTY_DECOR_DATA);
  readonly disabled = input(false);
  readonly loading = input(false);

  readonly promptChange = output<string>();
  readonly submit = output<void>();

  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('field');

  protected readonly focused = signal(false);
  protected readonly sealing = signal(false);
  protected readonly hintFading = signal(false);
  private readonly hintIndex = signal(0);

  protected readonly currentHint = computed(() => {
    const hints = ACTION_HINTS[this.dominant()];
    return hints[this.hintIndex() % hints.length];
  });

  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
  }

  private wasLoading = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    const rotation = setInterval(() => {
      if (this.focused() || this.prompt()) {
        return;
      }
      this.hintFading.set(true);
      setTimeout(() => {
        this.hintIndex.update((index) => index + 1);
        this.hintFading.set(false);
      }, HINT_FADE_MS);
    }, HINT_ROTATION_MS);
    destroyRef.onDestroy(() => clearInterval(rotation));

    afterNextRender(() => this.field()?.nativeElement.focus());

    effect(() => {
      const loading = this.loading();
      if (this.wasLoading && !loading) {
        setTimeout(() => this.field()?.nativeElement.focus());
      }
      this.wasLoading = loading;
    });

    effect(() => {
      if (!this.prompt()) {
        const element = this.field()?.nativeElement;
        if (element) {
          element.style.height = '';
        }
      }
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    this.emitSubmit();
  }

  protected emitSubmit(): void {
    if (this.disabled()) {
      return;
    }
    if (this.prompt().trim()) {
      this.sealing.set(true);
      setTimeout(() => this.sealing.set(false), SEAL_MS);
    }
    this.submit.emit();
  }

  protected autoGrow(event: Event): void {
    const element = event.target as HTMLTextAreaElement;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, FIELD_MAX_HEIGHT)}px`;
  }
}

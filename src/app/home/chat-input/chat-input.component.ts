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
import { ACTION_COPY, ACTION_HINTS, AUTO_TURN, ActionCopy, AmbianceKey } from '../ambiance/ambiance.engine';
import { AmbianceDecorSlot, AmbianceDecorData, EMPTY_DECOR_DATA } from '../decor/ambiance-decor';
import { EmojiPickerComponent } from '../emoji-picker/emoji-picker.component';

// The console: where the player writes their action. Purely presentational — the text is
// owned by the home, which receives it through promptChange and hands it back as an input.

const HINT_ROTATION_MS = 6000; // gap between two rotating suggestions
const HINT_FADE_MS = 450; // must match the fade in the stylesheet
const FIELD_MAX_HEIGHT = 340; // past this the textarea scrolls instead of growing
const SEAL_MS = 650; // duration of the send-seal animation

@Component({
  selector: 'app-chat-input',
  imports: [FormsModule, NgComponentOutlet, EmojiPickerComponent],
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
  readonly continueStory = output<void>();

  protected readonly autoLabel = AUTO_TURN.label;

  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('field');

  protected readonly focused = signal(false);
  protected readonly sealing = signal(false);
  protected readonly hintFading = signal(false);
  private readonly hintIndex = signal(0);

  // Modulo rather than a reset: the pool changes size with the dominant axis, and the
  // index keeps running across an ambiance change without ever going out of bounds
  protected readonly currentHint = computed(() => {
    const hints = ACTION_HINTS[this.dominant()];
    return hints[this.hintIndex() % hints.length];
  });

  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
  }

  // Tracks the falling edge of `loading` in the effect below
  private wasLoading = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    const rotation = setInterval(() => {
      // Suggestions freeze as soon as the player engages: rotating text under an active
      // cursor is distracting
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

    // Hands focus back when the GM finishes answering, so the player can chain turns
    // without touching the mouse. The setTimeout waits for the field to be enabled again.
    effect(() => {
      const loading = this.loading();
      if (this.wasLoading && !loading) {
        setTimeout(() => this.field()?.nativeElement.focus());
      }
      this.wasLoading = loading;
    });

    // Clearing the text does not fire the input event that drives autoGrow, so the height
    // set inline has to be dropped here or the field would stay stretched
    effect(() => {
      if (!this.prompt()) {
        const element = this.field()?.nativeElement;
        if (element) {
          element.style.height = '';
        }
      }
    });
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

  protected emitContinue(): void {
    if (this.disabled()) {
      return;
    }
    this.sealing.set(true);
    setTimeout(() => this.sealing.set(false), SEAL_MS);
    this.continueStory.emit();
  }

  protected paste(): void {
    if (this.disabled()) {
      return;
    }
    navigator.clipboard
      ?.readText()
      .then((text) => {
        if (!text) {
          return;
        }
        const current = this.prompt();
        this.promptChange.emit(current ? `${current}\n${text}` : text);
        this.field()?.nativeElement.focus();
      })
      .catch(() => {});
  }

  // Inserts at the caret, replacing the selection if there is one. The text belongs to the
  // home, so the new value is emitted and only comes back on the next input — hence the
  // caret is restored afterwards rather than straight away, or it would jump to the end.
  protected insertEmoji(char: string): void {
    if (this.disabled()) {
      return;
    }

    const element = this.field()?.nativeElement;
    const current = this.prompt();

    if (!element) {
      this.promptChange.emit(current + char);
      return;
    }

    const start = element.selectionStart ?? current.length;
    const end = element.selectionEnd ?? start;
    const caret = start + char.length;

    this.promptChange.emit(current.slice(0, start) + char + current.slice(end));

    setTimeout(() => {
      const field = this.field()?.nativeElement;
      if (!field) {
        return;
      }
      field.focus();
      field.setSelectionRange(caret, caret);
      // Inserting can push the text onto a new line, and no input event fires here
      this.grow(field);
    });
  }

  protected autoGrow(event: Event): void {
    this.grow(event.target as HTMLTextAreaElement);
  }

  private grow(element: HTMLTextAreaElement): void {
    // Reset to auto first: scrollHeight only shrinks once the inline height is released
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, FIELD_MAX_HEIGHT)}px`;
  }
}

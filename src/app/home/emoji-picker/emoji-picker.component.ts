import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import emojiGroups from '../../content/emojis.json';

// Emoji picker for the console. Hand-rolled on purpose: no third-party picker, no remote
// font or sprite sheet — the glyphs are whatever the player's system already draws.
//
// It owns no text: picking an emoji only emits it, and the console decides where it lands.
// The panel stays open across picks, so several emoji can be chained in one go.

type EmojiEntry = { char: string; name: string };
type EmojiGroup = { key: string; label: string; emojis: EmojiEntry[] };

const GROUPS: EmojiGroup[] = emojiGroups;

@Component({
  selector: 'app-emoji-picker',
  templateUrl: './emoji-picker.component.html',
  styleUrl: './emoji-picker.component.scss',
  host: {
    // Same two-pronged close as the debug panel: pointer for the mouse, Escape for the
    // keyboard. Escape is bound on the document because focus is usually in the textarea.
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class EmojiPickerComponent {
  readonly disabled = input(false);
  readonly pick = output<string>();

  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly groups = GROUPS;
  protected readonly open = signal(false);
  protected readonly activeKey = signal(GROUPS[0].key);

  protected readonly activeEmojis = computed(
    () => GROUPS.find((group) => group.key === this.activeKey())?.emojis ?? [],
  );

  protected toggle(): void {
    if (this.disabled()) return;
    this.open.update((value) => !value);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected selectGroup(key: string): void {
    this.activeKey.set(key);
  }

  protected select(char: string): void {
    this.pick.emit(char);
  }

  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.open()) return;

    const target = event.target;
    if (target instanceof Node && this.host.nativeElement.contains(target)) return;

    this.close();
  }
}

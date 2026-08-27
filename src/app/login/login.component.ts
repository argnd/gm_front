import { Component, ElementRef, HostListener, QueryList, ViewChildren } from '@angular/core';
import { GoogleSigninButtonModule } from '@abacritt/angularx-social-login';

type PupilOffset = {
  x: number;
  y: number;
};

@Component({
  selector: 'app-login',
  imports: [GoogleSigninButtonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  @ViewChildren('eyeSocket') private readonly eyeSockets!: QueryList<ElementRef<HTMLDivElement>>;

  protected pupilOffsets: PupilOffset[] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];

  private readonly maxPupilOffset = 8;

  @HostListener('document:mousemove', ['$event'])
  protected onPointerMove(event: MouseEvent): void {
    const sockets = this.eyeSockets?.toArray() ?? [];

    if (sockets.length === 0) {
      return;
    }

    this.pupilOffsets = sockets.map(({ nativeElement }) =>
      this.getPupilOffset(event.clientX, event.clientY, nativeElement),
    );
  }

  @HostListener('document:mouseleave')
  @HostListener('window:blur')
  protected resetPupilOffsets(): void {
    this.pupilOffsets = this.pupilOffsets.map(() => ({ x: 0, y: 0 }));
  }

  private getPupilOffset(pointerX: number, pointerY: number, eyeSocket: HTMLDivElement): PupilOffset {
    const rect = eyeSocket.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = pointerX - centerX;
    const deltaY = pointerY - centerY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance === 0) {
      return { x: 0, y: 0 };
    }

    const reach = Math.min(this.maxPupilOffset, distance * 0.14);

    return {
      x: (deltaX / distance) * reach,
      y: (deltaY / distance) * reach,
    };
  }
}

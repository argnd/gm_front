import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../core/api.service';
import { AdminUser } from '../models/admin.model';

@Component({
  selector: 'app-admin',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  private api = inject(ApiService);

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.get<AdminUser[]>('/admin/users').subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          err?.status === 403
            ? 'Accès refusé : compte non administrateur.'
            : `Impossible de charger les utilisateurs (${err?.status ?? 'erreur réseau'}).`,
        );
        this.loading.set(false);
      },
    });
  }
}

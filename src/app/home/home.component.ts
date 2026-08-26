import { Component, inject, OnInit, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-home',
  imports: [JsonPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  protected auth = inject(AuthService);
  private api = inject(ApiService);

  protected answer = signal<unknown>(null);
  protected loading = signal(false);
  protected error = signal<string | null>(null);

  protected isString(v: unknown): v is string {
    return typeof v === 'string';
  }

  ngOnInit(): void {
    this.loading.set(true);
    this.api.get('/answer').subscribe({
      next: (data) => {
        this.answer.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to fetch /answer');
        this.loading.set(false);
      },
    });
  }
}


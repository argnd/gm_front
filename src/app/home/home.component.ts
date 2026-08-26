import {Component, inject, OnInit, signal} from '@angular/core';
import {AuthService} from '../core/auth.service';
import {ApiService} from '../core/api.service';

type AnswerResponse = {
  message: string;
};

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  protected auth = inject(AuthService);
  private api = inject(ApiService);

  protected answer = signal<string | null>(null);
  protected loading = signal(false);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    this.loading.set(true);
    this.api.get<AnswerResponse>('/answer').subscribe({
      next: (data) => {
        this.answer.set(data.message);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to fetch /answer');
        this.loading.set(false);
      },
    });
  }
}

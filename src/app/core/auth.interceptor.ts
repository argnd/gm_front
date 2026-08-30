import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

function withToken<T>(req: HttpRequest<T>, token: string): HttpRequest<T> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

// Attaches the Google ID token to backend calls. A 401 means the token is spent and
// nothing renews it: the session ends there and the user signs in again.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only our own backend gets the token — never leak it to third-party hosts (GIS, assets…)
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const token = auth.getIdToken();

  if (!token) {
    // Let it through unauthenticated rather than swallowing it: the backend's 401 is the
    // single place where the session's fate is decided
    console.warn('[AuthInterceptor] No token — request will be unauthenticated');
    return next(req);
  }

  return next(withToken(req, token)).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.sessionLapsed();
      }
      return throwError(() => error);
    }),
  );
};

import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

function withToken<T>(req: HttpRequest<T>, token: string): HttpRequest<T> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

// Attaches the Google ID token to backend calls and owns the 401 recovery path:
// one silent renewal attempt, replay on success, session lapse on failure.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only our own backend gets the token — never leak it to third-party hosts (GIS, assets…)
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  // Any backend call counts as user activity and slides the 24h session window
  auth.touchActivity();
  const token = auth.getIdToken();

  if (!token) {
    // Let it through unauthenticated rather than swallowing it: the backend's 401 is the
    // single place where the recovery path below is decided
    console.warn('[AuthInterceptor] No token — request will be unauthenticated');
    return next(req);
  }

  return next(withToken(req, token)).pipe(
    catchError((error) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      // Single retry: forceRenewToken() dedupes concurrent callers, so a burst of 401s
      // triggers one One Tap prompt, not one per request
      return from(auth.forceRenewToken()).pipe(
        switchMap((renewed) => {
          if (renewed === null) {
            auth.sessionLapsed();
            return throwError(() => error);
          }
          return next(withToken(req, renewed));
        }),
      );
    }),
  );
};

import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

function withToken<T>(req: HttpRequest<T>, token: string): HttpRequest<T> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  auth.touchActivity();
  const token = auth.getIdToken();

  if (!token) {
    console.warn('[AuthInterceptor] No token — request will be unauthenticated');
    return next(req);
  }

  return next(withToken(req, token)).pipe(
    catchError((error) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

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

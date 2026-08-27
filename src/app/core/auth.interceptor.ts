import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getIdToken();

  console.debug('[AuthInterceptor] token present:', !!token, '| length:', token?.length ?? 0);

  if (token && req.url.startsWith(environment.apiBaseUrl)) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  } else if (req.url.startsWith(environment.apiBaseUrl)) {
    console.warn('[AuthInterceptor] No token � request will be unauthenticated');
  }

  return next(req);
};

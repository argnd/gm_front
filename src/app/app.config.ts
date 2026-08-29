import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth.interceptor';
import { SILENT_AUTH_ENABLED } from './core/auth.service';
import {
  SOCIAL_AUTH_CONFIG,
  SocialAuthServiceConfig,
  GoogleLoginProvider,
} from '@abacritt/angularx-social-login';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

// One Tap only on touch devices (bottom sheet): on desktop the white card clashes with the theme
const oneTapEnabled = SILENT_AUTH_ENABLED && window.matchMedia('(pointer: coarse)').matches;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: SOCIAL_AUTH_CONFIG,
      useValue: {
        autoLogin: SILENT_AUTH_ENABLED,
        lang: 'en',
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider(environment.googleClientId, {
              oneTapEnabled,
            }),
          },
        ],
        onError: (err: unknown) => console.error(err),
      } as SocialAuthServiceConfig,
    },
  ],
};

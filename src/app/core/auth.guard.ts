import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

async function waitForBootstrap(auth: AuthService): Promise<void> {
  if (!auth.loading()) return;
  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (!auth.loading()) {
        clearInterval(interval);
        resolve();
      }
    }, 20);
  });
}

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitForBootstrap(auth);

  if (auth.isAuthenticated()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitForBootstrap(auth);

  if (!auth.isAuthenticated()) return true;

  return router.createUrlTree(['/admin/dashboard']);
};

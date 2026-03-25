import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService, AdminRole } from '../services/admin/admin-auth.service';

export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  if (adminAuth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/admin/login'], {
    queryParams: {
      redirectTo: state.url,
    },
  });
};

export const adminGuestGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  if (!adminAuth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/admin']);
};

export const adminRoleGuard: CanActivateFn = (route) => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);
  const roles = (route.data?.['roles'] ?? []) as AdminRole[];

  if (!roles.length || adminAuth.hasRole(roles)) {
    return true;
  }

  return router.createUrlTree(['/admin/forbidden']);
};

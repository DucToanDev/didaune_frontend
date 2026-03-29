import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BACKEND_API_CONFIG } from '../config/backend-api.config';
import { DataService } from './data.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const dataService = inject(DataService);
  const token = dataService.getAuthToken();

  if (!token || !req.url.startsWith(BACKEND_API_CONFIG.baseUrl)) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};

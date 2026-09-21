import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/auth-page.component').then((module) => module.AuthPageComponent),
    data: { mode: 'login' },
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./features/auth/auth-page.component').then((module) => module.AuthPageComponent),
    data: { mode: 'register' },
  },
  { path: 'auth/login', redirectTo: 'login', pathMatch: 'full' },
  { path: 'auth/register', redirectTo: 'registro', pathMatch: 'full' },
  {
    path: 'cuenta',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/account-dashboard.component').then(
        (module) => module.AccountDashboardComponent,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout.component').then(
        (module) => module.PublicLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/home/home.component').then((module) => module.HomeComponent),
      },
      {
        path: 'services',
        loadComponent: () =>
          import('./features/services/services.component').then(
            (module) => module.ServicesComponent,
          ),
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/about/about.component').then((module) => module.AboutComponent),
      },
      {
        path: 'faq',
        loadComponent: () =>
          import('./features/faq/faq.component').then((module) => module.FaqComponent),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./features/not-found/not-found.component').then(
            (module) => module.NotFoundComponent,
          ),
      },
    ],
  },
];

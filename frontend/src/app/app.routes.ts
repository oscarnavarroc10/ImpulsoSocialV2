import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';
import { publicHomeGuard } from './core/auth/public-home.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/auth-page.component').then((module) => module.AuthPageComponent),
    data: { mode: 'login' },
  },
  {
    path: 'registro',
    canActivate: [guestGuard],
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
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'nueva-orden',
      },
      {
        path: 'nueva-orden',
        loadComponent: () =>
          import('./features/account/customer-new-order.component').then(
            (module) => module.CustomerNewOrderComponent,
          ),
      },
      {
        path: 'ordenes',
        loadComponent: () =>
          import('./features/account/customer-orders.component').then(
            (module) => module.CustomerOrdersComponent,
          ),
      },
      {
        path: 'servicios',
        loadComponent: () =>
          import('./features/account/customer-services.component').then(
            (module) => module.CustomerServicesComponent,
          ),
      },
      {
        path: 'saldo',
        loadComponent: () =>
          import('./features/account/customer-wallet.component').then(
            (module) => module.CustomerWalletComponent,
          ),
      },
      {
        path: 'soporte',
        loadComponent: () =>
          import('./features/account/customer-support.component').then(
            (module) => module.CustomerSupportComponent,
          ),
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/account/customer-profile.component').then(
            (module) => module.CustomerProfileComponent,
          ),
      },
    ],
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
        canActivate: [publicHomeGuard],
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

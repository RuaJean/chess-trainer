import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: 'register',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.REGISTER_ROUTES),
  },
  {
    path: 'play',
    loadChildren: () => import('./features/play-ai/play-ai.routes').then(m => m.PLAY_AI_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'library',
    loadChildren: () => import('./features/games-library/games-library.routes').then(m => m.GAMES_LIBRARY_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'analysis',
    loadChildren: () => import('./features/analysis/analysis.routes').then(m => m.ANALYSIS_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'blindfold',
    loadChildren: () => import('./features/blindfold/blindfold.routes').then(m => m.BLINDFOLD_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: '',
    redirectTo: 'play',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'play',
  },
];

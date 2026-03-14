import { Routes } from '@angular/router';
import { GamesLibraryComponent } from './games-library.component';
import { GameDetailComponent } from './game-detail.component';

export const GAMES_LIBRARY_ROUTES: Routes = [
  { path: '', component: GamesLibraryComponent },
  { path: ':id', component: GameDetailComponent },
];

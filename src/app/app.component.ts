import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService, User } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-layout" *ngIf="auth.isLoggedIn; else authLayout">
      <nav class="sidebar">
        <div class="sidebar-header">
          <span class="logo">♞</span>
          <span class="app-name">Chess Trainer</span>
        </div>
        <ul class="nav-links">
          <li>
            <a routerLink="/play" routerLinkActive="active">
              <span class="nav-icon">⚔</span>
              <span>Play vs AI</span>
            </a>
          </li>
          <li>
            <a routerLink="/library" routerLinkActive="active">
              <span class="nav-icon">📚</span>
              <span>Library</span>
            </a>
          </li>
          <li>
            <a routerLink="/analysis" routerLinkActive="active">
              <span class="nav-icon">🔍</span>
              <span>Analysis</span>
            </a>
          </li>
          <li>
            <a routerLink="/blindfold" routerLinkActive="active">
              <span class="nav-icon">🎯</span>
              <span>Blindfold</span>
            </a>
          </li>
          <li>
            <a routerLink="/settings" routerLinkActive="active">
              <span class="nav-icon">⚙</span>
              <span>Settings</span>
            </a>
          </li>
        </ul>
        <div class="sidebar-footer">
          <div class="user-info">
            <span class="user-icon">👤</span>
            <span class="username">{{ auth.user?.username }}</span>
          </div>
          <button class="logout-btn" (click)="auth.logout()" title="Logout">✕</button>
        </div>
      </nav>
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
    <ng-template #authLayout>
      <router-outlet></router-outlet>
    </ng-template>
  `,
  styles: [`
    .app-layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    .sidebar {
      width: 220px;
      min-width: 220px;
      background: #262421;
      display: flex;
      flex-direction: column;
      border-right: 1px solid #3d3a37;
    }
    .sidebar-header {
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #3d3a37;
    }
    .logo {
      font-size: 1.8rem;
    }
    .app-name {
      font-size: 1.1rem;
      font-weight: 600;
      color: #e0e0e0;
    }
    .nav-links {
      list-style: none;
      padding: 8px 0;
      flex: 1;
    }
    .nav-links li a, .nav-links li .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      color: #bababa;
      text-decoration: none;
      transition: background 150ms ease;
      cursor: pointer;
    }
    .nav-links li a:hover {
      background: #3d3a37;
    }
    .nav-links li a.active {
      background: #3d3a37;
      color: #bf811d;
      border-right: 3px solid #bf811d;
    }
    .nav-links li.disabled .nav-item {
      color: #5a5856;
      cursor: default;
    }
    .nav-icon {
      font-size: 1.1em;
      width: 20px;
      text-align: center;
    }
    .badge {
      font-size: 0.7em;
      background: #3d3a37;
      color: #8a8886;
      padding: 1px 6px;
      border-radius: 3px;
      margin-left: auto;
    }
    .sidebar-footer {
      padding: 12px 16px;
      border-top: 1px solid #3d3a37;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #bababa;
      font-size: 0.85em;
      overflow: hidden;
    }
    .user-icon { font-size: 1.1em; }
    .username {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .logout-btn {
      background: transparent;
      border: 1px solid #3d3a37;
      border-radius: 4px;
      color: #8a8886;
      cursor: pointer;
      padding: 4px 8px;
      font-size: 0.85em;
    }
    .logout-btn:hover { color: #ac3333; border-color: #ac3333; }
    .main-content {
      flex: 1;
      overflow: auto;
      min-width: 0;
    }
  `],
})
export class AppComponent implements OnInit {
  constructor(public auth: AuthService) {}

  ngOnInit(): void {
    this.auth.init().subscribe();
  }
}

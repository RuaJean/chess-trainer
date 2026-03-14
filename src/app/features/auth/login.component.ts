import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <span class="logo">♞</span>
          <h1>Chess Trainer</h1>
        </div>
        <h2>Iniciar Sesión</h2>
        <form (ngSubmit)="onSubmit()">
          <div class="field">
            <label>Usuario</label>
            <input type="text" [(ngModel)]="username" name="username" required autocomplete="username">
          </div>
          <div class="field">
            <label>Contraseña</label>
            <input type="password" [(ngModel)]="password" name="password" required autocomplete="current-password">
          </div>
          <p class="error" *ngIf="error">{{ error }}</p>
          <button type="submit" class="btn btn-primary full-width" [disabled]="loading">
            {{ loading ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>
        <p class="alt-action">
          ¿No tienes cuenta? <a routerLink="/register">Regístrate</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: #161512;
    }
    .auth-card {
      background: #262421;
      border: 1px solid #3d3a37;
      border-radius: 8px;
      padding: 32px;
      width: 360px;
    }
    .auth-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
      justify-content: center;
    }
    .logo { font-size: 2rem; }
    h1 { color: #e0e0e0; font-size: 1.3rem; }
    h2 { color: #bababa; font-size: 1rem; margin-bottom: 20px; text-align: center; }
    .field { margin-bottom: 14px; }
    .field label {
      display: block;
      color: #8a8886;
      font-size: 0.85em;
      margin-bottom: 4px;
    }
    .field input {
      width: 100%;
      padding: 8px 10px;
      background: #161512;
      border: 1px solid #3d3a37;
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 0.95em;
      box-sizing: border-box;
    }
    .field input:focus { border-color: #bf811d; outline: none; }
    .error { color: #ac3333; font-size: 0.85em; margin-bottom: 10px; }
    .full-width { width: 100%; padding: 10px; font-size: 0.95em; }
    .alt-action {
      text-align: center;
      margin-top: 16px;
      color: #8a8886;
      font-size: 0.85em;
    }
    .alt-action a { color: #bf811d; text-decoration: none; }
    .alt-action a:hover { text-decoration: underline; }
  `],
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit(): void {
    this.error = '';
    this.loading = true;
    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/play']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.detail || 'Error al iniciar sesión';
      },
    });
  }
}

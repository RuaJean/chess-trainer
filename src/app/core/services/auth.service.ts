import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = environment.apiBaseUrl + '/auth';
  private currentUser = new BehaviorSubject<User | null>(null);
  private initialized = false;

  currentUser$ = this.currentUser.asObservable();

  get user(): User | null {
    return this.currentUser.value;
  }

  get isLoggedIn(): boolean {
    return this.currentUser.value !== null;
  }

  constructor(private http: HttpClient, private router: Router) {}

  /** Check if already logged in via cookie. Call once at app start. */
  init(): Observable<User | null> {
    if (this.initialized) return this.currentUser$;
    this.initialized = true;
    return this.http
      .get<User>(`${this.api}/me`, { withCredentials: true })
      .pipe(
        tap(user => this.currentUser.next(user)),
        catchError(() => {
          this.currentUser.next(null);
          return of(null);
        }),
      );
  }

  register(username: string, email: string, password: string): Observable<User> {
    return this.http
      .post<User>(`${this.api}/register`, { username, email, password }, { withCredentials: true })
      .pipe(tap(user => this.currentUser.next(user)));
  }

  login(username: string, password: string): Observable<User> {
    return this.http
      .post<User>(`${this.api}/login`, { username, password }, { withCredentials: true })
      .pipe(tap(user => this.currentUser.next(user)));
  }

  logout(): void {
    this.http.post(`${this.api}/logout`, {}, { withCredentials: true }).subscribe(() => {
      this.currentUser.next(null);
      this.router.navigate(['/login']);
    });
  }
}

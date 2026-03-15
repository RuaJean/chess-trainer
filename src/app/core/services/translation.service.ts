import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { DatabaseService } from './database.service';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private translations: Record<string, string> = {};
  private currentLang = 'en';
  readonly lang$ = new BehaviorSubject<string>('en');

  constructor(
    private http: HttpClient,
    private db: DatabaseService,
  ) {}

  async init(): Promise<void> {
    let lang: string | undefined;
    try {
      lang = await this.db.getSetting<string>('language');
    } catch { /* ignore - not logged in yet */ }
    if (!lang) {
      const browserLang = navigator.language?.substring(0, 2);
      lang = browserLang === 'es' ? 'es' : 'en';
    }
    await this.loadLanguage(lang);
  }

  async setLanguage(lang: string): Promise<void> {
    await this.loadLanguage(lang);
    try {
      await this.db.setSetting('language', lang);
    } catch { /* ignore */ }
  }

  private async loadLanguage(lang: string): Promise<void> {
    try {
      this.translations = await firstValueFrom(
        this.http.get<Record<string, string>>(`/assets/i18n/${lang}.json`)
      );
    } catch {
      // Fallback to English
      if (lang !== 'en') {
        this.translations = await firstValueFrom(
          this.http.get<Record<string, string>>('/assets/i18n/en.json')
        );
        lang = 'en';
      }
    }
    this.currentLang = lang;
    this.lang$.next(lang);
  }

  get language(): string {
    return this.currentLang;
  }

  t(key: string, params?: Record<string, string | number>): string {
    let text = this.translations[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
    }
    return text;
  }
}

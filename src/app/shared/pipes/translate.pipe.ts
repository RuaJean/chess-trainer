import { Pipe, PipeTransform, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../core/services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private cachedKey = '';
  private cachedParams = '';
  private cachedValue = '';
  private cachedLang = '';
  private sub: Subscription;

  constructor(
    private i18n: TranslationService,
    private cd: ChangeDetectorRef,
  ) {
    this.sub = this.i18n.lang$.subscribe(() => {
      this.cachedLang = '';
      this.cd.markForCheck();
    });
  }

  transform(key: string, params?: Record<string, string | number>): string {
    const paramsStr = params ? JSON.stringify(params) : '';
    if (key === this.cachedKey && paramsStr === this.cachedParams && this.i18n.language === this.cachedLang) {
      return this.cachedValue;
    }
    this.cachedKey = key;
    this.cachedParams = paramsStr;
    this.cachedLang = this.i18n.language;
    this.cachedValue = this.i18n.t(key, params);
    return this.cachedValue;
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

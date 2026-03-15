import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClockConfig, CLOCK_PRESETS } from '../../models/clock.model';
import { EngineConfig, DEFAULT_ENGINE_CONFIG } from '../../models/engine-config.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

export interface NewGameOptions {
  playerColor: 'white' | 'black' | 'random';
  engineConfig: EngineConfig;
  clockConfig: ClockConfig;
}

@Component({
  selector: 'app-new-game-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <h2>{{ 'dialog.title' | translate }}</h2>

        <div class="form-section">
          <label>{{ 'dialog.playAs' | translate }}</label>
          <div class="color-picker">
            <button class="color-btn" [class.selected]="playerColor === 'white'"
                    (click)="playerColor = 'white'">
              <span class="piece-icon white">♔</span> {{ 'dialog.white' | translate }}
            </button>
            <button class="color-btn" [class.selected]="playerColor === 'random'"
                    (click)="playerColor = 'random'">
              🎲 {{ 'dialog.random' | translate }}
            </button>
            <button class="color-btn" [class.selected]="playerColor === 'black'"
                    (click)="playerColor = 'black'">
              <span class="piece-icon black">♚</span> {{ 'dialog.black' | translate }}
            </button>
          </div>
        </div>

        <div class="form-section">
          <label>{{ 'dialog.strength' | translate }} <strong>{{ elo }} ELO</strong></label>
          <input type="range" [min]="1320" [max]="3190" [step]="10"
                 [(ngModel)]="elo" class="elo-slider">
          <div class="elo-labels">
            <span>{{ 'dialog.beginner' | translate }}</span>
            <span>{{ 'dialog.intermediate' | translate }}</span>
            <span>{{ 'dialog.advanced' | translate }}</span>
            <span>{{ 'dialog.master' | translate }}</span>
          </div>
        </div>

        <div class="form-section">
          <label>{{ 'dialog.timeControl' | translate }}</label>
          <div class="time-presets">
            <button *ngFor="let preset of clockPresets"
                    class="preset-btn"
                    [class.selected]="selectedPresetLabel === preset.label"
                    (click)="selectPreset(preset)">
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-secondary" (click)="close.emit()">{{ 'dialog.cancel' | translate }}</button>
          <button class="btn btn-primary" (click)="startGame()">{{ 'dialog.play' | translate }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    h2 {
      margin-bottom: 20px;
      color: #e0e0e0;
      font-size: 1.3rem;
    }
    .form-section {
      margin-bottom: 20px;
    }
    .form-section > label {
      display: block;
      margin-bottom: 8px;
      color: #bababa;
      font-size: 0.95em;
    }
    .color-picker {
      display: flex;
      gap: 8px;
    }
    .color-btn {
      flex: 1;
      padding: 12px;
      background: #302e2c;
      border: 2px solid transparent;
      border-radius: 4px;
      color: #bababa;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 0.95em;
    }
    .color-btn:hover { background: #3d3a37; }
    .color-btn.selected {
      border-color: #bf811d;
      background: #3d3a37;
    }
    .piece-icon { font-size: 1.4em; }
    .piece-icon.black { color: #666; }

    .elo-slider {
      width: 100%;
      -webkit-appearance: none;
      height: 6px;
      background: #3d3a37;
      border-radius: 3px;
      outline: none;
      margin: 8px 0;
    }
    .elo-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      background: #bf811d;
      border-radius: 50%;
      cursor: pointer;
    }
    .elo-labels {
      display: flex;
      justify-content: space-between;
      color: #8a8886;
      font-size: 0.8em;
    }

    .time-presets {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }
    .preset-btn {
      padding: 8px 12px;
      background: #302e2c;
      border: 2px solid transparent;
      border-radius: 4px;
      color: #bababa;
      cursor: pointer;
      font-size: 0.9em;
      text-align: center;
    }
    .preset-btn:hover { background: #3d3a37; }
    .preset-btn.selected {
      border-color: #bf811d;
      background: #3d3a37;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 24px;
    }
  `],
})
export class NewGameDialogComponent {
  @Output() close = new EventEmitter<void>();
  @Output() startNewGame = new EventEmitter<NewGameOptions>();

  playerColor: 'white' | 'black' | 'random' = 'white';
  elo = 1500;
  clockPresets = CLOCK_PRESETS;
  selectedPresetLabel = '10+0 (Rapid)';
  selectedClockConfig: ClockConfig = { initialTime: 600, increment: 0 };

  selectPreset(preset: { label: string; config: ClockConfig }): void {
    this.selectedPresetLabel = preset.label;
    this.selectedClockConfig = preset.config;
  }

  startGame(): void {
    const color = this.playerColor === 'random'
      ? (Math.random() < 0.5 ? 'white' : 'black')
      : this.playerColor;

    const engineConfig: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      elo: this.elo,
      limitStrength: true,
    };

    this.startNewGame.emit({
      playerColor: color,
      engineConfig,
      clockConfig: this.selectedClockConfig,
    });
  }
}

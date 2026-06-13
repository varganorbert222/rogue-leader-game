import { Routes } from '@angular/router';
import { GameCanvasComponent } from './features/game-canvas/game-canvas.component';
import { MainMenuComponent } from './features/main-menu/main-menu.component';
import { MissionSelectComponent } from './features/mission-select/mission-select.component';
import { ControlsComponent } from './features/controls/controls.component';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  { path: '', component: MainMenuComponent },
  { path: 'mission-select', component: MissionSelectComponent },
  { path: 'play/:missionId', component: GameCanvasComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'controls', component: ControlsComponent },
  { path: '**', redirectTo: '' },
];

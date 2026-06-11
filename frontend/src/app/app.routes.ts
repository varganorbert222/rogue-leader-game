import { Routes } from '@angular/router';
import { GameCanvasComponent } from './pages/game-canvas/game-canvas.component';
import { MainMenuComponent } from './pages/main-menu/main-menu.component';
import { MissionSelectComponent } from './pages/mission-select/mission-select.component';
import { ControlsComponent } from './pages/controls/controls.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  { path: '', component: MainMenuComponent },
  { path: 'mission-select', component: MissionSelectComponent },
  { path: 'play/:missionId', component: GameCanvasComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'controls', component: ControlsComponent },
  { path: '**', redirectTo: '' },
];

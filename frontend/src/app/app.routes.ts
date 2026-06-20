import { Routes } from '@angular/router';
import { GameCanvasComponent } from './features/game-canvas/game-canvas/game-canvas.component';
import { MainMenuComponent } from './features/main-menu/main-menu/main-menu.component';
import { MissionSelectComponent } from './features/mission-select/mission-select/mission-select.component';
import { ControlsComponent } from './features/controls/controls/controls.component';
import { SettingsComponent } from './features/settings/settings/settings.component';
import { LodEditorComponent } from './features/lod-editor/lod-editor/lod-editor.component';
import { CockpitEditorComponent } from './features/cockpit-editor/cockpit-editor/cockpit-editor.component';
import { ParticleEditorComponent } from './features/particle-editor/particle-editor/particle-editor.component';
import { PrefabManagerComponent } from './features/prefab-manager/prefab-manager/prefab-manager.component';
import { EncyclopediaComponent } from './features/encyclopedia/encyclopedia/encyclopedia.component';

export const routes: Routes = [
  { path: '', component: MainMenuComponent },
  { path: 'mission-select', component: MissionSelectComponent },
  { path: 'play/:missionId', component: GameCanvasComponent },
  { path: 'dev/lod-editor', component: LodEditorComponent },
  { path: 'dev/cockpit-editor', component: CockpitEditorComponent },
  { path: 'dev/particle-editor', component: ParticleEditorComponent },
  { path: 'dev/prefab-manager', component: PrefabManagerComponent },
  { path: 'encyclopedia', component: EncyclopediaComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'controls', component: ControlsComponent },
  { path: '**', redirectTo: '' },
];

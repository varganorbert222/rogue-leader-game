import {
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BabylonHost,
  buildParticleEffectHierarchy,
  cloneParticleEffect,
  defaultParticleSystem,
  DevConfigTools,
  estimateEffectPreviewDurationMs,
  loadParticlePresets,
  loadParticleTextureCatalog,
  newBlankParticlePreset,
  ParticlePreviewScene,
  reorderFlatHierarchy,
  syncAlbedoTextureFromCatalog,
  syncStaticAtlasCell,
  isAnimatedParticleAtlas,
  type HierarchyNode,
  type HierarchyReorderEvent,
  type ParticleEffectEditable,
  type ParticlePresetEntry,
  type ParticleSystemEditable,
  type ParticleTextureEntry,
} from '@rogue-leader/engine';
import { HierarchyPanelComponent } from '../../shared/components/hierarchy-panel/hierarchy-panel.component';
import { DevEditorShellComponent } from '../../shared/dev-editor/dev-editor-shell.component';
import { DevJsonCopyComponent } from '../../shared/dev-editor/dev-json-copy.component';
import { DevEditorStatusComponent } from '../../shared/dev-editor/dev-editor-status.component';
import {
  createDevBabylonHost,
  disposeDevBabylonHost,
  startDevPreviewRenderLoop,
  toErrorMessage,
  type DevEditorCanvases,
} from '../../shared/dev-editor/dev-editor.utils';
import { ParticleSystemInspectorComponent } from './inspectors/particle-system-inspector.component';

@Component({
  selector: 'app-particle-editor',
  standalone: true,
  imports: [
    FormsModule,
    HierarchyPanelComponent,
    DevEditorShellComponent,
    DevJsonCopyComponent,
    DevEditorStatusComponent,
    ParticleSystemInspectorComponent,
  ],
  templateUrl: './particle-editor.component.html',
  styleUrl: './particle-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ParticleEditorComponent implements OnInit, OnDestroy {
  readonly devTool = DevConfigTools.particleEditor;

  presets: ParticlePresetEntry[] = [];
  selectedPresetId = '';
  effect: ParticleEffectEditable | null = null;
  selectedSystemId = '';
  hierarchy: HierarchyNode[] = [];
  hierarchyRevision = 0;
  loading = true;
  errorMessage = '';
  playing = false;
  particleTextures: ParticleTextureEntry[] = [];

  private host: BabylonHost | null = null;
  private preview: ParticlePreviewScene | null = null;
  private updateTimer: number | null = null;
  private previewReady = false;

  async ngOnInit(): Promise<void> {
    try {
      this.particleTextures = await loadParticleTextureCatalog();
      this.presets = await loadParticlePresets();
      if (!this.presets.length) {
        this.presets = [newBlankParticlePreset()];
      }
      this.selectedPresetId = this.presets[0].id;
      if (this.previewReady) {
        await this.loadPreset(this.selectedPresetId);
        this.loading = false;
      }
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
      this.loading = false;
    }
  }

  async onCanvasReady(canvases: DevEditorCanvases): Promise<void> {
    try {
      this.host = await createDevBabylonHost(canvases.preview);
      this.preview = new ParticlePreviewScene(this.host);
      await this.preview.initRendering();
      startDevPreviewRenderLoop(this.host, {
        updateAxisGizmo: canvases.updateAxisGizmo,
        getCamera: () => this.preview?.getCamera() ?? null,
      });
      this.previewReady = true;
      await this.loadPreset(this.selectedPresetId);
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.updateTimer != null) {
      window.clearTimeout(this.updateTimer);
    }
    disposeDevBabylonHost(this.host, this.preview);
    this.host = null;
    this.preview = null;
  }

  get selectedSystem(): ParticleSystemEditable | null {
    if (!this.effect || !this.selectedSystemId) return null;
    return this.effect.systems.find((s) => s.id === this.selectedSystemId) ?? null;
  }

  get savePayload(): { presets: ParticlePresetEntry[] } {
    this.syncCurrentPreset();
    return { presets: this.presets };
  }

  async onPresetChange(presetId: string): Promise<void> {
    this.selectedPresetId = presetId;
    await this.loadPreset(presetId);
  }

  async newPreset(): Promise<void> {
    const preset = newBlankParticlePreset();
    this.presets = [...this.presets, preset];
    this.selectedPresetId = preset.id;
    await this.loadPreset(preset.id);
  }

  async duplicatePreset(): Promise<void> {
    if (!this.effect) return;

    const copy = cloneParticleEffect(this.effect);
    copy.id = `effect_${Date.now()}`;
    copy.name = `${copy.name} Copy`;
    for (const system of copy.systems) {
      system.id = `ps_${Date.now()}_${system.name}`;
    }

    const preset: ParticlePresetEntry = {
      id: copy.id,
      label: copy.name,
      effect: copy,
    };

    this.presets = [...this.presets, preset];
    this.selectedPresetId = preset.id;
    await this.loadPreset(preset.id);
  }

  onHierarchySelect(node: HierarchyNode): void {
    if (node.kind === 'particleSystem') {
      this.selectedSystemId = node.id;
    } else if (node.kind === 'effectRoot' && this.effect?.systems.length) {
      this.selectedSystemId = this.effect.systems[0].id;
    }
  }

  onHierarchyReorder(event: HierarchyReorderEvent): void {
    if (!this.effect) return;
    const root = this.hierarchy[0];
    if (!root) return;

    const reordered = reorderFlatHierarchy(root.children, event);
    root.children = reordered;
    this.hierarchy = [root];
    this.hierarchyRevision += 1;
    this.effect.systems = reordered.map((node) => {
      const existing = this.effect!.systems.find((s) => s.id === node.id);
      return existing!;
    });
    this.preview?.reorderSystems(this.effect.systems.map((s) => s.id));
    this.syncCurrentPreset();
  }

  addSystem(): void {
    if (!this.effect || !this.preview) return;
    const system = defaultParticleSystem(`System ${this.effect.systems.length + 1}`);
    this.effect.systems.push(system);
    const id = this.preview.addSystem(system);
    this.selectedSystemId = id;
    this.refreshHierarchy();
    this.syncCurrentPreset();
  }

  removeSelectedSystem(): void {
    if (!this.effect || !this.preview || !this.selectedSystemId) return;
    if (this.effect.systems.length <= 1) return;
    this.preview.removeSystem(this.selectedSystemId);
    this.effect.systems = this.effect.systems.filter((s) => s.id !== this.selectedSystemId);
    this.selectedSystemId = this.effect.systems[0]?.id ?? '';
    this.refreshHierarchy();
    this.syncCurrentPreset();
  }

  onAlbedoTextureChange(): void {
    const system = this.selectedSystem;
    if (!system) return;

    if (!system.albedoTexture.textureId) {
      system.albedoTexture.isAtlas = false;
    } else {
      system.albedoTexture = syncStaticAtlasCell(
        syncAlbedoTextureFromCatalog(system.albedoTexture),
      );
    }

    this.onSystemFieldChange();
  }

  onEmissionModeChange(): void {
    this.onSystemFieldChange();
  }

  onDurationChange(): void {
    const system = this.selectedSystem;
    if (!system) return;
    if (system.looping && system.duration <= 0 && system.emissionMode === 'rate') {
      system.looping = false;
    }
    this.onSystemFieldChange();
  }

  onLoopingChange(): void {
    const system = this.selectedSystem;
    if (!system) return;
    if (system.looping && system.duration <= 0) {
      system.duration = Math.max(system.maxLifeTime, 1);
    }
    this.onSystemFieldChange();
  }

  onSystemFieldChange(): void {
    const system = this.selectedSystem;
    if (!system || !this.preview) return;

    if (!isAnimatedParticleAtlas(system.albedoTexture)) {
      system.albedoTexture = syncStaticAtlasCell(system.albedoTexture);
    }

    this.refreshHierarchy();
    this.schedulePreviewUpdate(system);
    this.syncCurrentPreset();
  }

  playPreview(): void {
    this.playing = true;
    this.preview?.playAll();
    const durationMs = this.effect ? estimateEffectPreviewDurationMs(this.effect) : 2000;
    window.setTimeout(() => {
      this.playing = false;
    }, durationMs);
  }

  playSelectedSystem(): void {
    if (!this.selectedSystemId || !this.preview) return;
    this.preview.stopAll();
    this.preview.playSystem(this.selectedSystemId);
  }

  stopPreview(): void {
    this.playing = false;
    this.preview?.stopAll();
  }

  private async loadPreset(presetId: string): Promise<void> {
    const preset = this.presets.find((p) => p.id === presetId);
    if (!preset || !this.preview) return;

    this.effect = cloneParticleEffect(preset.effect);
    await this.preview.setEffect(this.effect);
    this.selectedSystemId = this.effect.systems[0]?.id ?? '';
    this.refreshHierarchy();
  }

  onEffectNameChange(): void {
    this.refreshHierarchy();
    this.syncCurrentPreset();
  }

  private syncCurrentPreset(): void {
    if (!this.effect) return;
    const index = this.presets.findIndex((preset) => preset.id === this.selectedPresetId);
    if (index < 0) return;

    const current = this.presets[index];
    this.presets[index] = {
      ...current,
      label: this.effect.name,
      effect: cloneParticleEffect(this.effect),
    };
    this.presets = [...this.presets];
  }

  private refreshHierarchy(): void {
    if (!this.effect) {
      this.hierarchy = [];
      this.hierarchyRevision += 1;
      return;
    }
    this.hierarchy = buildParticleEffectHierarchy(this.effect);
    this.hierarchyRevision += 1;
  }

  private schedulePreviewUpdate(system: ParticleSystemEditable): void {
    if (this.updateTimer != null) {
      window.clearTimeout(this.updateTimer);
    }
    this.updateTimer = window.setTimeout(() => {
      this.preview?.updateSystem(system);
    }, 120);
  }
}

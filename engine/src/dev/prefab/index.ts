export type {
  PrefabNodeTransform,
  PrefabModelRef,
  PrefabParticleRef,
  PrefabNestedRef,
  PrefabModelSlot,
  PrefabParticleSlot,
  PrefabNestedSlot,
  PrefabContentSlot,
  PrefabTreeNodeKind,
  PrefabTreeNode,
  PrefabEditable,
  PrefabLibraryEntry,
  PrefabLibraryDocument,
} from './types';

export {
  defaultPrefabNodeTransform,
  normalizePrefabNodeTransform,
  ensurePrefabTreeNodeTransform,
  copyNodeTransform,
  applyTransformToBabylonNode,
  readTransformFromBabylonNode,
} from './transform';

export {
  nextPrefabNodeId,
  nextPrefabGroupId,
  defaultPrefabEditable,
  newBlankPrefabLibraryEntry,
  createModelSlot,
  createParticleSlot,
  createPrefabGroupNode,
  createModelTreeNode,
  createParticleTreeNode,
} from './defaults';

export {
  isPrefabModelRef,
  isPrefabParticleRef,
  isPrefabNestedRef,
  isPrefabModelSlot,
  isPrefabParticleSlot,
  isPrefabNestedSlot,
  isSlotReadonlyNestedRef,
  isSlotEditNestedRef,
  normalizePrefabContentSlot,
  setNestedRefMode,
  normalizePrefabEditable,
  clonePrefabEditable,
  resolveNestedSlotToTreeNode,
  detachNestedSlotAsClone,
  writeEditNestedRefToLibrary,
} from './refs';

export {
  walkPrefabTree,
  findPrefabTreeNode,
  findPrefabSlotById,
  countPrefabContentNodes,
  collectPrefabParticleSystemIdsInSubtree,
  insertPrefabNodeUnderAnchor,
  insertPrefabNodeAtTreeRoot,
  removePrefabTreeNode,
  movePrefabTreeNode,
  clonePrefabTree,
  clonePrefabTreeNodeSubtree,
  remapPrefabTreeIds,
  stripSceneNodes,
  serializePrefabTree,
  serializePrefabEditable,
  serializePrefabLibraryEntry,
  buildReferencedPrefabTree,
  buildReferencedParticlePresetTreeForPrefab,
  buildClonedPrefabTree,
  listParticleModuleOptionsForPrefab,
  listParticlePresetOptionsForPrefab,
  type PrefabTreeLocateResult,
} from './tree';

export {
  buildPrefabHierarchy,
  isPrefabNodeInspectorReadonly,
  isPrefabHierarchyNodeLocked,
  canInsertUnderPrefabHierarchyNode,
  canRemovePrefabHierarchyNode,
  canDragPrefabHierarchyNode,
  canReorderPrefabHierarchy,
  isPrefabTreeNodeInReadonlyNestedSubtree,
} from './hierarchy';

export {
  loadPrefabLibrary,
  getBuiltinPrefabLibrary,
  serializePrefabLibraryDocument,
} from './library';

export {
  resolvePrefabModelGlbPath,
  resolvePrefabModelScale,
  listLodEditorModels,
} from './model-ref';

export {
  loadManifestModelEntity,
  createModelReferenceTree,
  hydratePrefabDisplayHierarchy,
} from './model-hierarchy';

export { PrefabPreviewScene } from './preview-scene';

export {
  buildPrefabSpawnPlan,
  buildPrefabSpawnPlanById,
  listPrefabSpawnPlans,
  type PrefabSpawnTransform,
  type PrefabSpawnModelEntry,
  type PrefabSpawnParticleEntry,
  type PrefabSpawnEntry,
  type PrefabSpawnPlan,
} from './spawn-plan';

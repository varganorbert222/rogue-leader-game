declare const entityIdBrand: unique symbol;

/** Opaque entity handle used throughout the ECS world. */
export type EntityId = string & { readonly [entityIdBrand]: unique symbol };

export function entityId(raw: string): EntityId {
  return raw as EntityId;
}

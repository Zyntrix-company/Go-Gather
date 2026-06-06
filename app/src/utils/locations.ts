export type LocationPoint = {
  id?: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  sortOrder?: number;
};

type EntityWithLocations = {
  location?: LocationPoint | string | null;
  locations?: LocationPoint[] | null;
};

export function normalizeLocations(entity: EntityWithLocations): LocationPoint[] {
  if (Array.isArray(entity.locations) && entity.locations.length > 0) {
    return entity.locations
      .filter((l) => l?.name)
      .map((l, index) => ({
        id: l.id,
        name: l.name,
        lat: l.lat ?? null,
        lng: l.lng ?? null,
        sortOrder: l.sortOrder ?? index,
      }));
  }

  if (typeof entity.location === 'string' && entity.location.trim()) {
    return [{ name: entity.location.trim(), sortOrder: 0 }];
  }

  if (entity.location && typeof entity.location === 'object' && entity.location.name) {
    return [{
      id: entity.location.id,
      name: entity.location.name,
      lat: entity.location.lat ?? null,
      lng: entity.location.lng ?? null,
      sortOrder: 0,
    }];
  }

  return [];
}

export function primaryLocationName(entity: EntityWithLocations): string {
  const locations = normalizeLocations(entity);
  return locations[0]?.name ?? '';
}

export function formatLocationsLabel(
  entityOrLocations: EntityWithLocations | LocationPoint[],
  maxVisible = 2,
): string {
  const locations = Array.isArray(entityOrLocations)
    ? entityOrLocations
    : normalizeLocations(entityOrLocations);

  if (locations.length === 0) return '';
  if (locations.length === 1) return locations[0].name;

  const visible = locations.slice(0, maxVisible).map((l) => l.name);
  const remaining = locations.length - maxVisible;
  if (remaining <= 0) return visible.join(' · ');
  return `${visible.join(' · ')} +${remaining}`;
}

export function formatLocationsLabelFull(entity: EntityWithLocations): string {
  return normalizeLocations(entity).map((l) => l.name).join(' · ');
}

export function toLocationPayload(locations: LocationPoint[]) {
  return locations.map((loc, index) => ({
    name: loc.name,
    lat: loc.lat ?? undefined,
    lng: loc.lng ?? undefined,
    sortOrder: loc.sortOrder ?? index,
  }));
}

export const MAX_LOCATIONS = 10;

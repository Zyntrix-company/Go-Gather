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

/** Primary place label — first comma segment (city/locality). */
export function shortLocationName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const first = trimmed.split(',')[0]?.trim();
  return first || trimmed;
}

function shortNamesFromLocations(locations: LocationPoint[]): string[] {
  return locations
    .map((l) => shortLocationName(l.name))
    .filter(Boolean);
}

export function formatLocationsLabel(
  entityOrLocations: EntityWithLocations | LocationPoint[],
  maxVisible = 2,
): string {
  const locations = Array.isArray(entityOrLocations)
    ? entityOrLocations
    : normalizeLocations(entityOrLocations);

  const shorts = shortNamesFromLocations(locations);
  if (shorts.length === 0) return '';
  if (shorts.length === 1) return shorts[0];

  const visible = shorts.slice(0, maxVisible);
  const remaining = shorts.length - maxVisible;
  if (remaining <= 0) return visible.join(' · ');
  return `${visible.join(' · ')} +${remaining}`;
}

/** Detail hero: short city names for every stop (up to maxVisible). */
export function formatLocationsHeroLabel(
  entityOrLocations: EntityWithLocations | LocationPoint[],
  maxVisible = 4,
): string {
  const locations = Array.isArray(entityOrLocations)
    ? entityOrLocations
    : normalizeLocations(entityOrLocations);

  const shorts = shortNamesFromLocations(locations);
  if (shorts.length === 0) return '';
  if (shorts.length === 1) return shorts[0];

  const visible = shorts.slice(0, maxVisible);
  const remaining = shorts.length - maxVisible;
  if (remaining <= 0) return visible.join(' · ');
  return `${visible.join(' · ')} +${remaining}`;
}

export function formatLocationsLabelFull(entity: EntityWithLocations): string {
  return shortNamesFromLocations(normalizeLocations(entity)).join(' · ');
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

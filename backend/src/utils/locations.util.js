const MAX_LOCATIONS = 10;

const formatLocationRow = (row) => ({
  id: row.id,
  name: row.name,
  lat: row.lat != null ? parseFloat(row.lat) : null,
  lng: row.lng != null ? parseFloat(row.lng) : null,
  sortOrder: row.sort_order,
});

const primaryFromLocations = (locations) => {
  if (!locations?.length) {
    return { name: null, lat: null, lng: null };
  }
  const first = locations[0];
  return {
    name: first.name || null,
    lat: first.lat ?? null,
    lng: first.lng ?? null,
  };
};

/**
 * Normalize request body: locations[] wins over legacy location object.
 * Returns normalized array (may be empty).
 */
const normalizeLocationInput = (body) => {
  if (Array.isArray(body.locations) && body.locations.length > 0) {
    return body.locations.map((loc, index) => ({
      name: (loc.name || '').trim(),
      lat: loc.lat ?? null,
      lng: loc.lng ?? null,
      sortOrder: loc.sortOrder ?? index,
    })).filter((loc) => loc.name);
  }

  if (body.location && typeof body.location === 'object' && body.location.name) {
    return [{
      name: String(body.location.name).trim(),
      lat: body.location.lat ?? null,
      lng: body.location.lng ?? null,
      sortOrder: 0,
    }];
  }

  return [];
};

const locationKeywordsFromList = (locations) =>
  (locations || []).map((l) => l.name).filter(Boolean).join(' ');

const insertLocations = async (client, table, parentColumn, parentId, locations) => {
  const sorted = [...locations].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (let i = 0; i < sorted.length; i += 1) {
    const loc = sorted[i];
    await client.query(
      `INSERT INTO ${table} (${parentColumn}, name, lat, lng, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [parentId, loc.name, loc.lat ?? null, loc.lng ?? null, loc.sortOrder ?? i],
    );
  }
};

const replaceLocations = async (client, table, parentColumn, parentId, locations) => {
  await client.query(`DELETE FROM ${table} WHERE ${parentColumn} = $1`, [parentId]);
  if (locations.length > 0) {
    await insertLocations(client, table, parentColumn, parentId, locations);
  }
};

const loadTripLocations = async (db, tripId) => {
  const result = await db(
    `SELECT id, name, lat, lng, sort_order
     FROM trip_locations
     WHERE trip_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [tripId],
  );
  return result.rows.map(formatLocationRow);
};

const loadEventLocations = async (db, eventId) => {
  const result = await db(
    `SELECT id, name, lat, lng, sort_order
     FROM event_locations
     WHERE event_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [eventId],
  );
  return result.rows.map(formatLocationRow);
};

const loadTripLocationsBatch = async (db, tripIds) => {
  if (!tripIds.length) return new Map();
  const result = await db(
    `SELECT trip_id, id, name, lat, lng, sort_order
     FROM trip_locations
     WHERE trip_id = ANY($1::uuid[])
     ORDER BY trip_id, sort_order ASC, created_at ASC`,
    [tripIds],
  );
  const map = new Map();
  for (const row of result.rows) {
    const list = map.get(row.trip_id) || [];
    list.push(formatLocationRow(row));
    map.set(row.trip_id, list);
  }
  return map;
};

const loadEventLocationsBatch = async (db, eventIds) => {
  if (!eventIds.length) return new Map();
  const result = await db(
    `SELECT event_id, id, name, lat, lng, sort_order
     FROM event_locations
     WHERE event_id = ANY($1::uuid[])
     ORDER BY event_id, sort_order ASC, created_at ASC`,
    [eventIds],
  );
  const map = new Map();
  for (const row of result.rows) {
    const list = map.get(row.event_id) || [];
    list.push(formatLocationRow(row));
    map.set(row.event_id, list);
  }
  return map;
};

const attachLocationsToTrip = (trip, locations) => {
  const resolved = locations?.length
    ? locations
    : (trip.location_name
      ? [{
        name: trip.location_name,
        lat: trip.location_lat ? parseFloat(trip.location_lat) : null,
        lng: trip.location_lng ? parseFloat(trip.location_lng) : null,
        sortOrder: 0,
      }]
      : []);

  const primary = primaryFromLocations(resolved);
  return {
    ...trip,
    location: primary,
    locations: resolved,
  };
};

const attachLocationsToEvent = attachLocationsToTrip;

module.exports = {
  MAX_LOCATIONS,
  formatLocationRow,
  primaryFromLocations,
  normalizeLocationInput,
  locationKeywordsFromList,
  insertLocations,
  replaceLocations,
  loadTripLocations,
  loadEventLocations,
  loadTripLocationsBatch,
  loadEventLocationsBatch,
  attachLocationsToTrip,
  attachLocationsToEvent,
};

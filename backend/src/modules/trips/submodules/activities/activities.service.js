const { query: db } = require('../../../../config/database');
const { deleteFromS3 } = require('../../../../utils/s3.util');
const { createAndSendNotifications } = require('../../../../utils/fcm.util');
const { scheduleActivityReminders } = require('../../../../utils/reminders.cron');
const sharedPhotos = require('../../../shared/photos/photos.service');
const logger = require('../../../../utils/logger');

// ── Time helpers ──────────────────────────────────────────────────────────────

/**
 * Convert { hour, minute } → "HH:MM:00" for DB storage.
 * Returns null if input is null/undefined.
 */
const timeToString = (time) => {
  if (time === null || time === undefined) return null;
  if (typeof time === 'string') return time; // already a string
  const h = String(time.hour ?? 0).padStart(2, '0');
  const m = String(time.minute ?? 0).padStart(2, '0');
  return `${h}:${m}:00`;
};

/**
 * Convert "HH:MM:00" → { hour, minute }.
 * Returns null if input is null.
 */
const parseTime = (timeStr) => {
  if (!timeStr) return null;
  const parts = String(timeStr).split(':');
  return {
    hour: parseInt(parts[0], 10),
    minute: parseInt(parts[1], 10),
  };
};

// ── Format helpers ────────────────────────────────────────────────────────────

const formatActivity = (a) => ({
  id: a.id,
  tripId: a.trip_id,
  createdBy: a.created_by,
  title: a.title,
  date: a.activity_date,
  time: parseTime(a.activity_time),
  locationName: a.location_name,
  description: a.description || null,
  isCompleted: a.is_completed,
  photoCount: parseInt(a.photo_count ?? 0, 10),
  linkedExpense: a.expense_id_linked
    ? {
      id: a.expense_id_linked,
      description: a.expense_description,
      amount: parseFloat(a.expense_amount),
    }
    : null,
  createdAt: a.created_at,
  updatedAt: a.updated_at,
});


// ── Activity CRUD ─────────────────────────────────────────────────────────────

const createActivity = async (tripId, userId, body) => {
  const { title, date, time, locationName, description, expenseId } = body;

  // Validate time object
  if (time !== undefined && time !== null) {
    const h = time.hour;
    const m = time.minute;
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      const e = new Error('time.hour must be 0–23 and time.minute must be 0–59');
      e.statusCode = 400; e.error = 'VALIDATION_ERROR'; throw e;
    }
  }

  // Validate expenseId belongs to this trip
  if (expenseId) {
    const expCheck = await db(
      "SELECT id FROM expenses WHERE id = $1 AND parent_type = 'trip' AND parent_id = $2",
      [expenseId, tripId],
    );
    if (expCheck.rowCount === 0) {
      const e = new Error('Expense not found in this trip');
      e.statusCode = 400; e.error = 'VALIDATION_ERROR'; throw e;
    }
  }

  const result = await db(
    `INSERT INTO trip_activities
       (trip_id, created_by, title, activity_date, activity_time, location_name, description, expense_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [tripId, userId, title, date, timeToString(time), locationName || null, description || null, expenseId || null],
  );

  const activityId = result.rows[0].id;

  // Notify other trip members — fire-and-forget
  (async () => {
    try {
      const [membersResult, tripResult, actorResult] = await Promise.all([
        db('SELECT u.id, u.fcm_token FROM trip_members tm JOIN users u ON u.id = tm.user_id WHERE tm.trip_id = $1 AND tm.user_id != $2', [tripId, userId]),
        db('SELECT name FROM trips WHERE id = $1', [tripId]),
        db('SELECT full_name FROM profiles WHERE user_id = $1', [userId]),
      ]);
      if (membersResult.rows.length === 0) return;
      const tripName = tripResult.rows[0]?.name || 'Your trip';
      const actorName = actorResult.rows[0]?.full_name || 'Someone';
      createAndSendNotifications(
        membersResult.rows,
        { title: 'Itinerary Updated', body: `${actorName} added an activity to "${tripName}".` },
        'ITINERARY_UPDATED',
        { tripId, tripName, activityId },
      );
    } catch (err) {
      logger.error('ITINERARY_UPDATED notification failed', { tripId, error: err.message });
    }
  })();

  return getActivityById(tripId, activityId);
};

const updateActivity = async (actId, tripId, requesterId, requesterRole, updates) => {
  const actResult = await db('SELECT * FROM trip_activities WHERE id = $1 AND trip_id = $2', [actId, tripId]);
  if (actResult.rowCount === 0) {
    const e = new Error('Activity not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  const act = actResult.rows[0];

  if (act.created_by !== requesterId && requesterRole !== 'admin') {
    const e = new Error('Only the creator or a trip admin can edit this activity');
    e.statusCode = 403; e.error = 'FORBIDDEN'; throw e;
  }

  // Validate time object
  if (updates.time !== undefined && updates.time !== null) {
    const h = updates.time.hour;
    const m = updates.time.minute;
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      const e = new Error('time.hour must be 0–23 and time.minute must be 0–59');
      e.statusCode = 400; e.error = 'VALIDATION_ERROR'; throw e;
    }
  }

  // Validate expenseId
  if (updates.expenseId) {
    const expCheck = await db(
      "SELECT id FROM expenses WHERE id = $1 AND parent_type = 'trip' AND parent_id = $2",
      [updates.expenseId, tripId],
    );
    if (expCheck.rowCount === 0) {
      const e = new Error('Expense not found in this trip');
      e.statusCode = 400; e.error = 'VALIDATION_ERROR'; throw e;
    }
  }

  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title); }
  if (updates.date !== undefined) { fields.push(`activity_date = $${idx++}`); values.push(updates.date); }
  if (updates.time !== undefined) { fields.push(`activity_time = $${idx++}`); values.push(timeToString(updates.time)); }
  if (updates.locationName !== undefined) { fields.push(`location_name = $${idx++}`); values.push(updates.locationName); }
  if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
  if (updates.expenseId !== undefined) { fields.push(`expense_id = $${idx++}`); values.push(updates.expenseId || null); }
  if (updates.isCompleted !== undefined) { fields.push(`is_completed = $${idx++}`); values.push(updates.isCompleted); }

  if (fields.length === 0) return getActivityById(tripId, actId);

  values.push(actId);
  await db(
    `UPDATE trip_activities SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
    values,
  );

  // Notify other trip members — fire-and-forget
  (async () => {
    try {
      const [membersResult, tripResult, actorResult] = await Promise.all([
        db('SELECT u.id, u.fcm_token FROM trip_members tm JOIN users u ON u.id = tm.user_id WHERE tm.trip_id = $1 AND tm.user_id != $2', [tripId, requesterId]),
        db('SELECT name FROM trips WHERE id = $1', [tripId]),
        db('SELECT full_name FROM profiles WHERE user_id = $1', [requesterId]),
      ]);
      if (membersResult.rows.length === 0) return;
      const tripName = tripResult.rows[0]?.name || 'Your trip';
      const actorName = actorResult.rows[0]?.full_name || 'Someone';
      createAndSendNotifications(
        membersResult.rows,
        { title: 'Itinerary Updated', body: `${actorName} updated an activity in "${tripName}".` },
        'ITINERARY_UPDATED',
        { tripId, tripName, activityId: actId },
      );
    } catch (err) {
      logger.error('ITINERARY_UPDATED notification failed', { tripId, actId, error: err.message });
    }
  })();

  return getActivityById(tripId, actId);
};

const deleteActivity = async (actId, tripId, requesterId, requesterRole) => {
  const actResult = await db('SELECT * FROM trip_activities WHERE id = $1 AND trip_id = $2', [actId, tripId]);
  if (actResult.rowCount === 0) {
    const e = new Error('Activity not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  const act = actResult.rows[0];

  if (act.created_by !== requesterId && requesterRole !== 'admin') {
    const e = new Error('Only the creator or a trip admin can delete this activity');
    e.statusCode = 403; e.error = 'FORBIDDEN'; throw e;
  }

  // Delete activity photos from S3 first (DB cascade via activity_id FK handles rows)
  const photosResult = await db('SELECT s3_key FROM photos WHERE activity_id = $1', [actId]);
  for (const row of photosResult.rows) {
    deleteFromS3(row.s3_key).catch((err) => logger.error('S3 delete failed', { err: err.message }));
  }

  await db('DELETE FROM trip_activities WHERE id = $1', [actId]);
};

const getActivities = async (tripId) => {
  const result = await db(
    `SELECT
       ta.*,
       (SELECT COUNT(*) FROM photos WHERE activity_id = ta.id)::int AS photo_count,
       te.id   AS expense_id_linked,
       te.description AS expense_description,
       te.amount      AS expense_amount
     FROM trip_activities ta
     LEFT JOIN expenses te ON te.id = ta.expense_id AND te.parent_type = 'trip'
     WHERE ta.trip_id = $1
     ORDER BY ta.activity_date ASC, ta.activity_time ASC NULLS LAST`,
    [tripId],
  );

  const activities = result.rows.map(formatActivity);
  return {
    upcoming: activities.filter((a) => !a.isCompleted),
    completed: activities.filter((a) => a.isCompleted),
  };
};

// Get a single activity with full detail (used after update)
const getActivityById = async (tripId, actId) => {
  const result = await db(
    `SELECT
       ta.*,
       (SELECT COUNT(*) FROM photos WHERE activity_id = ta.id)::int AS photo_count,
       te.id   AS expense_id_linked,
       te.description AS expense_description,
       te.amount      AS expense_amount
     FROM trip_activities ta
     LEFT JOIN expenses te ON te.id = ta.expense_id AND te.parent_type = 'trip'
     WHERE ta.id = $1 AND ta.trip_id = $2`,
    [actId, tripId],
  );
  if (result.rowCount === 0) {
    const e = new Error('Activity not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  return formatActivity(result.rows[0]);
};

// ── Activity Photo Endpoints ──────────────────────────────────────────────────

const uploadActivityPhotos = async (tripId, actId, userId, files) => {
  // Verify activity exists in this trip
  const actCheck = await db(
    'SELECT id FROM trip_activities WHERE id = $1 AND trip_id = $2',
    [actId, tripId],
  );
  if (actCheck.rowCount === 0) {
    const e = new Error('Activity not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }

  // Enforce max 5 photos per activity
  const countResult = await db(
    'SELECT COUNT(*)::int AS count FROM photos WHERE activity_id = $1',
    [actId],
  );
  const existing = countResult.rows[0].count;

  if (existing + files.length > 5) {
    const e = new Error('Maximum 5 photos allowed per activity');
    e.statusCode = 400; e.error = 'MAX_PHOTOS_EXCEEDED';
    e.limit = 5; e.current = existing; throw e;
  }

  // Store in shared photos table with activity_id — appears in trip gallery too
  return sharedPhotos.uploadPhotos(
    { parentType: 'trip', parentId: tripId },
    userId,
    files,
    { activityId: actId },
  );
};

const getActivityPhotos = async (tripId, actId) => {
  const actCheck = await db(
    'SELECT id FROM trip_activities WHERE id = $1 AND trip_id = $2',
    [actId, tripId],
  );
  if (actCheck.rowCount === 0) {
    const e = new Error('Activity not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }

  const result = await db(
    `SELECT ph.*, p.full_name AS uploader_name
     FROM photos ph
     LEFT JOIN profiles p ON p.user_id = ph.uploaded_by
     WHERE ph.activity_id = $1
     ORDER BY ph.created_at ASC`,
    [actId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    activityId: row.activity_id,
    tripId: row.parent_id,
    uploadedBy: {
      userId: row.uploaded_by,
      name: row.uploader_name || null,
    },
    url: row.file_url,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  }));
};

const deleteActivityPhoto = async (tripId, actId, photoId, userId, userRole) => {
  const photoResult = await db(
    'SELECT * FROM photos WHERE id = $1 AND activity_id = $2 AND parent_id = $3',
    [photoId, actId, tripId],
  );
  if (photoResult.rowCount === 0) {
    const e = new Error('Photo not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }

  const photo = photoResult.rows[0];
  if (photo.uploaded_by !== userId && userRole !== 'admin') {
    const e = new Error('Only the uploader or a trip admin can delete this photo');
    e.statusCode = 403; e.error = 'FORBIDDEN'; throw e;
  }

  await deleteFromS3(photo.s3_key);
  await db('DELETE FROM photos WHERE id = $1', [photoId]);
};

module.exports = {
  createActivity,
  updateActivity,
  deleteActivity,
  getActivities,
  uploadActivityPhotos,
  getActivityPhotos,
  deleteActivityPhoto,
};

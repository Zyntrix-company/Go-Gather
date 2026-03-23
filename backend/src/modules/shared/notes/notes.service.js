const { query: db } = require('../../../config/database');

const VALID_CATEGORIES = ['general', 'idea', 'important', 'todo'];

const formatNote = (n) => ({
  id: n.id,
  parentType: n.parent_type,
  parentId: n.parent_id,
  title: n.title,
  content: n.content,
  category: n.category,
  isFavorited: Boolean(n.is_favorited),
  createdBy: {
    userId: n.created_by,
    name: n.creator_name || null,
    avatarUrl: n.creator_avatar || null,
  },
  lastEditedBy: n.last_edited_by
    ? { userId: n.last_edited_by, name: n.editor_name || null }
    : null,
  createdAt: n.created_at,
  updatedAt: n.updated_at,
});

const getNotes = async ({ parentType, parentId }, userId) => {
  const result = await db(
    `SELECT
       n.*,
       cp.full_name  AS creator_name,
       cp.avatar_url AS creator_avatar,
       ep.full_name  AS editor_name,
       (nf.user_id IS NOT NULL) AS is_favorited
     FROM notes n
     LEFT JOIN profiles cp ON cp.user_id = n.created_by
     LEFT JOIN profiles ep ON ep.user_id = n.last_edited_by
     LEFT JOIN note_favorites nf ON nf.note_id = n.id AND nf.user_id = $3
     WHERE n.parent_type = $1 AND n.parent_id = $2
     ORDER BY (nf.user_id IS NOT NULL) DESC, n.updated_at DESC`,
    [parentType, parentId, userId],
  );
  const notes = result.rows.map(formatNote);
  return { notes, total: notes.length };
};

const createNote = async ({ parentType, parentId }, userId, { title, content, category }) => {
  const resolvedCategory = VALID_CATEGORIES.includes(category) ? category : 'general';

  const result = await db(
    `INSERT INTO notes (parent_type, parent_id, created_by, title, content, category)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [parentType, parentId, userId, title, content || '', resolvedCategory],
  );
  const n = result.rows[0];

  const profileResult = await db('SELECT full_name, avatar_url FROM profiles WHERE user_id = $1', [userId]);
  const profile = profileResult.rows[0];

  return formatNote({
    ...n,
    creator_name: profile?.full_name || null,
    creator_avatar: profile?.avatar_url || null,
    editor_name: null,
  });
};

const updateNote = async ({ parentType, parentId }, noteId, userId, updates) => {
  const noteResult = await db(
    'SELECT * FROM notes WHERE id = $1 AND parent_type = $2 AND parent_id = $3',
    [noteId, parentType, parentId],
  );
  if (noteResult.rowCount === 0) {
    const e = new Error('Note not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }

  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.title    !== undefined) { fields.push(`title = $${idx++}`);   values.push(updates.title); }
  if (updates.content  !== undefined) { fields.push(`content = $${idx++}`); values.push(updates.content); }
  if (updates.category !== undefined) {
    const cat = VALID_CATEGORIES.includes(updates.category) ? updates.category : 'general';
    fields.push(`category = $${idx++}`); values.push(cat);
  }

  fields.push(`last_edited_by = $${idx++}`);
  values.push(userId);
  fields.push(`updated_at = NOW()`);

  values.push(noteId);
  const result = await db(
    `UPDATE notes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );

  const n = result.rows[0];

  const [creatorProfile, editorProfile] = await Promise.all([
    db('SELECT full_name, avatar_url FROM profiles WHERE user_id = $1', [n.created_by]),
    db('SELECT full_name FROM profiles WHERE user_id = $1', [userId]),
  ]);

  return formatNote({
    ...n,
    creator_name: creatorProfile.rows[0]?.full_name || null,
    creator_avatar: creatorProfile.rows[0]?.avatar_url || null,
    editor_name: editorProfile.rows[0]?.full_name || null,
  });
};

const deleteNote = async ({ parentType, parentId }, noteId, userId, userRole) => {
  const noteResult = await db(
    'SELECT * FROM notes WHERE id = $1 AND parent_type = $2 AND parent_id = $3',
    [noteId, parentType, parentId],
  );
  if (noteResult.rowCount === 0) {
    const e = new Error('Note not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }

  const note = noteResult.rows[0];
  if (note.created_by !== userId && userRole !== 'admin') {
    const e = new Error('Only the note creator or an admin can delete this note');
    e.statusCode = 403; e.error = 'FORBIDDEN'; throw e;
  }

  await db('DELETE FROM notes WHERE id = $1', [noteId]);
};

const toggleFavorite = async ({ parentType, parentId }, noteId, userId) => {
  const noteResult = await db(
    'SELECT id FROM notes WHERE id = $1 AND parent_type = $2 AND parent_id = $3',
    [noteId, parentType, parentId],
  );
  if (noteResult.rowCount === 0) {
    const e = new Error('Note not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }

  const existing = await db(
    'SELECT 1 FROM note_favorites WHERE note_id = $1 AND user_id = $2',
    [noteId, userId],
  );

  if (existing.rowCount > 0) {
    await db('DELETE FROM note_favorites WHERE note_id = $1 AND user_id = $2', [noteId, userId]);
    return { isFavorited: false };
  }

  await db('INSERT INTO note_favorites (note_id, user_id) VALUES ($1, $2)', [noteId, userId]);
  return { isFavorited: true };
};

module.exports = { getNotes, createNote, updateNote, deleteNote, toggleFavorite };

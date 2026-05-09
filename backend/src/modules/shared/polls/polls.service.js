const { query: db, getClient } = require('../../../config/database');

const createPoll = async ({ parentType, parentId }, userId, { question, options }) => {
  if (!options || options.length < 2 || options.length > 10) {
    const e = new Error('A poll must have between 2 and 10 options');
    e.statusCode = 400; e.error = 'VALIDATION_ERROR'; throw e;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const pollResult = await client.query(
      'INSERT INTO polls (parent_type, parent_id, created_by, question) VALUES ($1, $2, $3, $4) RETURNING *',
      [parentType, parentId, userId, question],
    );
    const poll = pollResult.rows[0];

    const insertedOptions = [];
    for (let i = 0; i < options.length; i++) {
      const optResult = await client.query(
        'INSERT INTO poll_options (poll_id, option_text, display_order) VALUES ($1, $2, $3) RETURNING *',
        [poll.id, options[i], i],
      );
      insertedOptions.push(optResult.rows[0]);
    }

    await client.query('COMMIT');
    return formatPoll(poll, insertedOptions, null);
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
};

const vote = async ({ parentType, parentId }, pollId, userId, optionId) => {
  const pollResult = await db(
    'SELECT * FROM polls WHERE id = $1 AND parent_type = $2 AND parent_id = $3',
    [pollId, parentType, parentId],
  );
  if (pollResult.rowCount === 0) {
    const e = new Error('Poll not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }

  const optResult = await db(
    'SELECT * FROM poll_options WHERE id = $1 AND poll_id = $2',
    [optionId, pollId],
  );
  if (optResult.rowCount === 0) {
    const e = new Error('Option not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }

  await db(
    `INSERT INTO poll_votes (poll_id, option_id, user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (poll_id, user_id) DO UPDATE SET option_id = $2, voted_at = NOW()`,
    [pollId, optionId, userId],
  );

  return getPollById({ parentType, parentId }, pollId, userId);
};

const getPolls = async ({ parentType, parentId }, userId) => {
  const result = await db(
    'SELECT * FROM polls WHERE parent_type = $1 AND parent_id = $2 ORDER BY created_at DESC',
    [parentType, parentId],
  );
  const polls = await Promise.all(result.rows.map((p) => getPollById({ parentType, parentId }, p.id, userId)));
  return polls;
};

const getPollById = async ({ parentType, parentId }, pollId, userId) => {
  const pollResult = await db('SELECT * FROM polls WHERE id = $1', [pollId]);
  const poll = pollResult.rows[0];

  const optionsResult = await db(
    `SELECT
       po.id, po.option_text, po.display_order,
       COUNT(pv.id)::int AS vote_count
     FROM poll_options po
     LEFT JOIN poll_votes pv ON pv.option_id = po.id
     WHERE po.poll_id = $1
     GROUP BY po.id
     ORDER BY po.display_order ASC`,
    [pollId],
  );

  const totalVotes = optionsResult.rows.reduce((sum, o) => sum + o.vote_count, 0);

  const myVoteResult = await db(
    'SELECT option_id FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
    [pollId, userId],
  );
  const myVotedOption = myVoteResult.rows[0]?.option_id || null;

  const options = optionsResult.rows.map((o) => ({
    id: o.id,
    text: o.option_text,
    displayOrder: o.display_order,
    voteCount: o.vote_count,
    percentage: totalVotes > 0 ? Math.round((o.vote_count / totalVotes) * 10000) / 100 : 0,
    isMyVote: o.id === myVotedOption,
  }));

  return formatPoll(poll, options, myVotedOption);
};

const formatPoll = (poll, options, myVote) => ({
  id: poll.id,
  parentType: poll.parent_type,
  parentId: poll.parent_id,
  question: poll.question,
  createdBy: poll.created_by,
  createdAt: poll.created_at,
  myVotedOptionId: myVote || null,
  options: options.map((o) => ({
    id: o.id,
    text: o.option_text || o.text,
    displayOrder: o.display_order !== undefined ? o.display_order : (o.displayOrder || 0),
    voteCount: o.vote_count !== undefined ? o.vote_count : (o.voteCount || 0),
    percentage: o.percentage || 0,
    isMyVote: o.isMyVote || false,
  })),
});

const deletePoll = async ({ parentType, parentId }, pollId, userId) => {
  const result = await db(
    'SELECT * FROM polls WHERE id = $1 AND parent_type = $2 AND parent_id = $3',
    [pollId, parentType, parentId],
  );
  if (result.rowCount === 0) {
    const e = new Error('Poll not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  await db('DELETE FROM polls WHERE id = $1', [pollId]);
};

module.exports = { createPoll, vote, getPolls, deletePoll };

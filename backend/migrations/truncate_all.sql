-- Truncate all tables and reset sequences.
-- Run from psql or your migration tool:
--   psql $DATABASE_URL -f migrations/truncate_all.sql

TRUNCATE TABLE
  poll_votes,
  poll_options,
  polls,
  expense_splits,
  expenses,
  settlements,
  photos,
  docs,
  notes,
  note_favorites,
  trip_activities,
  trip_members,
  trip_invites,
  trip_reminders,
  trips,
  event_members,
  event_invites,
  event_reminders,
  events,
  friend_connections,
  friend_invites,
  referrals,
  categories,
  email_oauth_tokens,
  feedback,
  otps,
  refresh_tokens,
  profiles,
  users,
  blogs,
  deals
RESTART IDENTITY CASCADE;

require('../setup');

const {
  resolveRecipients,
  resolveAlbumContext,
} = require('../../src/modules/users/galleryEngagementNotifications');

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

jest.mock('../../src/modules/users/galleryAlbums.service.js', () => ({
  getAlbumById: jest.fn(),
}));

const db = require('../../src/config/database');
const galleryAlbumsService = require('../../src/modules/users/galleryAlbums.service');

const ACTOR_ID = '123e4567-e89b-12d3-a456-426614174000';
const OWNER_ID = '223e4567-e89b-12d3-a456-426614174001';
const MEMBER_ID = '323e4567-e89b-12d3-a456-426614174002';
const TRIP_ID = 'aaaa0001-0000-4000-8000-000000000001';
const ALBUM_ID = 'bbbb0001-0000-4000-8000-000000000001';

describe('galleryEngagementNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveRecipients', () => {
    it('returns album owner for custom album when actor is not owner', async () => {
      galleryAlbumsService.getAlbumById.mockResolvedValue({ user_id: OWNER_ID, name: 'My album' });
      const recipients = await resolveRecipients(ACTOR_ID, 'gallery_album', ALBUM_ID);
      expect(recipients).toEqual([{ id: OWNER_ID }]);
    });

    it('returns empty for custom album when actor is owner', async () => {
      galleryAlbumsService.getAlbumById.mockResolvedValue({ user_id: ACTOR_ID, name: 'My album' });
      const recipients = await resolveRecipients(ACTOR_ID, 'gallery_album', ALBUM_ID);
      expect(recipients).toEqual([]);
    });

    it('returns other trip members excluding actor', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: OWNER_ID }, { id: MEMBER_ID }],
      });
      const recipients = await resolveRecipients(ACTOR_ID, 'trip', TRIP_ID);
      expect(recipients).toEqual([{ id: OWNER_ID }, { id: MEMBER_ID }]);
    });
  });

  describe('resolveAlbumContext', () => {
    it('includes tripId for trip albums', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ name: 'Goa Trip' }] });
      const ctx = await resolveAlbumContext('trip', TRIP_ID);
      expect(ctx.dataBase.tripId).toBe(TRIP_ID);
      expect(ctx.parentKind).toBe('trip');
    });
  });
});

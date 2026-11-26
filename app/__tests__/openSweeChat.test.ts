/**
 * openSweeChat: the Swee floating button reopens a recent chat, otherwise starts a new one,
 * and never falls back to an unrelated chat on a trip/event screen.
 */
jest.mock('../src/api/ai.api', () => ({ getRecentConversation: jest.fn() }));

import { getRecentConversation } from '../src/api/ai.api';
import { openSweeChat } from '../src/utils/openSweeChat';

const mockRecent = getRecentConversation as jest.Mock;
const TRIP = { id: 't-1', name: 'Goa', contextType: 'trip' as const };

function nav() {
  return { navigate: jest.fn() };
}

beforeEach(() => mockRecent.mockReset());

describe('openSweeChat', () => {
  it('Home/Menu: opens the latest recent chat of any kind', async () => {
    mockRecent.mockResolvedValue({ id: 'c-1' });
    const n = nav();
    await openSweeChat(n);
    expect(mockRecent).toHaveBeenCalledWith();
    expect(n.navigate).toHaveBeenCalledWith('ChatDetail', { conversationId: 'c-1' });
  });

  it('starts a new chat when nothing is recent', async () => {
    mockRecent.mockResolvedValue(null);
    const n = nav();
    await openSweeChat(n);
    expect(n.navigate).toHaveBeenCalledWith('ChatDetail', {});
  });

  it('trip screen: scopes the lookup to that trip and opens its recent chat', async () => {
    mockRecent.mockResolvedValue({ id: 'c-2' });
    const n = nav();
    await openSweeChat(n, TRIP);
    expect(mockRecent).toHaveBeenCalledWith({ contextType: 'trip', contextId: 't-1' });
    expect(n.navigate).toHaveBeenCalledWith('ChatDetail', { conversationId: 'c-2' });
  });

  it('trip screen with no recent chat about it: new chat carrying the trip context', async () => {
    mockRecent.mockResolvedValue(null);
    const n = nav();
    await openSweeChat(n, TRIP);
    expect(n.navigate).toHaveBeenCalledWith('ChatDetail', { tripContext: TRIP });
  });

  it('trip screen without an id yet: never looks up an unrelated chat', async () => {
    const n = nav();
    const ctx = { name: 'Goa', contextType: 'trip' as const };
    await openSweeChat(n, ctx);
    expect(mockRecent).not.toHaveBeenCalled();
    expect(n.navigate).toHaveBeenCalledWith('ChatDetail', { tripContext: ctx });
  });

  it('a failed lookup (offline/timeout) just starts a new chat', async () => {
    mockRecent.mockRejectedValue(new Error('timeout'));
    const n = nav();
    await openSweeChat(n);
    expect(n.navigate).toHaveBeenCalledWith('ChatDetail', {});
  });

  it('ignores a second tap while the first lookup is running', async () => {
    let resolve!: (v: unknown) => void;
    mockRecent.mockReturnValue(new Promise(r => { resolve = r; }));
    const n = nav();
    const first = openSweeChat(n);
    await openSweeChat(n); // second tap: ignored
    resolve({ id: 'c-3' });
    await first;
    expect(n.navigate).toHaveBeenCalledTimes(1);
  });
});

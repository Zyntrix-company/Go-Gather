import { handleApiError, parseError } from '../api/trips.api';
import { showAlert } from '../store/alertStore';

export type CreateEntityKind = 'trip' | 'event';

/** User-visible title for create failures. */
export function createErrorTitle(kind: CreateEntityKind): string {
  return kind === 'trip' ? 'Could not create trip' : 'Could not create event';
}

/**
 * Toast + returns a safe message string for inline UI. Never throws.
 */
export function reportCreateError(err: unknown, kind: CreateEntityKind): string {
  let message = 'Something went wrong. Please try again.';
  try {
    const parsed = handleApiError(err);
    message = parsed.message || message;
  } catch {
    try {
      message = parseError(err).message || message;
    } catch {
      /* keep default */
    }
  }
  return message;
}

/** Toast + alert for create failures. Never throws. */
export function showCreateFailure(err: unknown, kind: CreateEntityKind): string {
  const message = reportCreateError(err, kind);
  try {
    showAlert({ title: createErrorTitle(kind), message });
  } catch {
    /* alert store should not crash the app */
  }
  return message;
}

export function invalidCreateResponseError(kind: CreateEntityKind): Error & {
  response: { data: { message: string; error: string } };
} {
  const message =
    kind === 'trip'
      ? 'The server did not return trip details. Please refresh and try again.'
      : 'The server did not return event details. Please refresh and try again.';
  return Object.assign(new Error(message), {
    response: { data: { message, error: 'INVALID_RESPONSE' } },
  });
}

export function requireTripFromResponse(
  res: { trip?: { id?: string } } | null | undefined,
) {
  if (!res?.trip?.id) {
    throw invalidCreateResponseError('trip');
  }
  return res.trip;
}

export function requireEventFromResponse(
  res: { event?: { id?: string }; memberCount?: number } | null | undefined,
) {
  if (!res?.event?.id) {
    throw invalidCreateResponseError('event');
  }
  return res;
}

/** Run post-create uploads/imports without failing the whole create flow. */
export async function runSafePostCreate(
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.warn(`[create] ${label} failed:`, err);
    try {
      const message = parseError(err).message;
      showAlert({
        title: 'Created with warnings',
        message: `${label} could not be completed: ${message}`,
      });
    } catch {
      /* ignore */
    }
  }
}

import client from './client';

/** General app feedback / "Report a Problem" (Support screen). */
export async function submitFeedback(message: string): Promise<void> {
  await client.post('/feedback', { message });
}

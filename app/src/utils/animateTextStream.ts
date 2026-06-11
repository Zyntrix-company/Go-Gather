/**
 * Reveal text word-by-word for a local "typing" effect (welcome, execute results).
 * Returns a cancel function.
 */
export function animateTextStream(
  fullText: string,
  onUpdate: (partial: string, done: boolean) => void,
  wordDelayMs = 36,
): () => void {
  let aborted = false;
  const words = fullText.split(' ').filter((w) => w.length > 0);
  const timers: ReturnType<typeof setTimeout>[] = [];

  if (words.length === 0) {
    onUpdate('', true);
    return () => { aborted = true; };
  }

  words.forEach((_, i) => {
    const t = setTimeout(() => {
      if (aborted) return;
      const partial = words.slice(0, i + 1).join(' ');
      onUpdate(partial, i === words.length - 1);
    }, i * wordDelayMs);
    timers.push(t);
  });

  return () => {
    aborted = true;
    timers.forEach(clearTimeout);
  };
}

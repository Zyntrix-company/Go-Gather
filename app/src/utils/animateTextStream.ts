/**
 * Reveal text character-by-character for a human typing effect.
 * Slight pauses after punctuation make it feel more natural.
 * Returns a cancel function.
 */

const DEFAULT_CHAR_MS = 26;
const PAUSE_AFTER_SENTENCE_MS = 140;
const PAUSE_AFTER_COMMA_MS = 70;
const PAUSE_AFTER_NEWLINE_MS = 90;

function delayAfterChar(char: string, charDelayMs: number): number {
  let extra = charDelayMs;
  if ('.!?'.includes(char)) extra += PAUSE_AFTER_SENTENCE_MS;
  else if (char === ',') extra += PAUSE_AFTER_COMMA_MS;
  else if (char === '\n') extra += PAUSE_AFTER_NEWLINE_MS;
  return extra;
}

export function animateTextStream(
  fullText: string,
  onUpdate: (partial: string, done: boolean) => void,
  charDelayMs = DEFAULT_CHAR_MS,
): () => void {
  let aborted = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  if (!fullText.length) {
    onUpdate('', true);
    return () => { aborted = true; };
  }

  let elapsed = 0;
  for (let i = 0; i < fullText.length; i++) {
    const char = fullText[i];
    const at = elapsed;
    const isLast = i === fullText.length - 1;

    const t = setTimeout(() => {
      if (aborted) return;
      onUpdate(fullText.slice(0, i + 1), isLast);
    }, at);
    timers.push(t);

    elapsed += delayAfterChar(char, charDelayMs);
  }

  return () => {
    aborted = true;
    timers.forEach(clearTimeout);
  };
}

/**
 * MarkdownText: Swee's replies use **bold** on normal lines and "•" bullets (itineraries).
 * The asterisks must never reach the screen.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import MarkdownText from '../src/components/common/MarkdownText';

function render(text: string, streaming = false) {
  let root!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(<MarkdownText text={text} streaming={streaming} />);
  });
  return root;
}

type Json = ReactTestRenderer.ReactTestRendererJSON | string;

function flatten(node: Json | Json[] | null): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flatten).join('');
  return flatten(node.children as Json[] | null);
}

function allText(root: ReactTestRenderer.ReactTestRenderer): string {
  return flatten(root.toJSON() as any);
}

function isBold(style: any): boolean {
  return ([] as any[]).concat(style ?? []).flat(5).some(s => s && s.fontWeight === '700');
}

/** Text of every node that is styled bold. */
function boldTexts(root: ReactTestRenderer.ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (node: any) => {
    if (!node || typeof node === 'string') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (isBold(node.props?.style)) out.push(flatten(node));
    walk(node.children);
  };
  walk(root.toJSON() as any);
  return out;
}

describe('MarkdownText', () => {
  it('renders **bold** on a normal line without showing the asterisks', () => {
    const root = render('Here is a plan:\n\n**Tue 15 Dec**\n• 09:00 Old Goa');
    expect(allText(root)).not.toContain('*');
    expect(allText(root)).toContain('Tue 15 Dec');
    expect(boldTexts(root).some(t => t.includes('Tue 15 Dec'))).toBe(true);
  });

  it('renders "•" lines as bullets with inline bold inside', () => {
    const root = render('• **Lunch** at Panjim · about 1.5 h');
    expect(allText(root)).not.toContain('*');
    expect(allText(root)).toContain('Lunch');
    expect(allText(root)).toContain('Panjim');
  });

  it('keeps "-" and "*" bullets and mid-line bold working', () => {
    const root = render('- first **one**\n* second');
    expect(allText(root)).not.toContain('*');
    expect(allText(root)).toContain('first');
    expect(allText(root)).toContain('second');
  });

  it('hides an unclosed ** while the reply is streaming', () => {
    const root = render('Plan for **Tue 15', true);
    expect(allText(root)).not.toContain('*');
    expect(allText(root)).toContain('Tue 15');
  });

  it('renders bold while streaming', () => {
    const root = render('Day one: **Old Goa** then lunch', true);
    expect(allText(root)).not.toContain('*');
  });
});

import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

type Segment = { type: 'bold' | 'italic' | 'bolditalic' | 'plain'; text: string };

function parseInline(raw: string): Segment[] {
  const segments: Segment[] = [];
  // matches ***text***, **text**, *text*
  const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/gs;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'plain', text: raw.slice(last, match.index) });
    }
    if (match[2] !== undefined) {
      segments.push({ type: 'bolditalic', text: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ type: 'bold', text: match[3] });
    } else if (match[4] !== undefined) {
      segments.push({ type: 'italic', text: match[4] });
    }
    last = match.index + match[0].length;
  }

  if (last < raw.length) {
    segments.push({ type: 'plain', text: raw.slice(last) });
  }
  return segments;
}

function InlineText({ segments, baseStyle }: { segments: Segment[]; baseStyle?: any }) {
  return (
    <Text style={baseStyle}>
      {segments.map((seg, i) => {
        if (seg.type === 'bold') return <Text key={i} style={styles.bold}>{seg.text}</Text>;
        if (seg.type === 'italic') return <Text key={i} style={styles.italic}>{seg.text}</Text>;
        if (seg.type === 'bolditalic') return <Text key={i} style={styles.boldItalic}>{seg.text}</Text>;
        return <Text key={i}>{seg.text}</Text>;
      })}
    </Text>
  );
}

type Props = {
  text: string;
  streaming?: boolean;
  baseStyle?: any;
  userMessage?: boolean;
};

export default function MarkdownText({ text, streaming, baseStyle, userMessage }: Props) {
  const safeText = text ?? '';
  if (streaming) {
    return <Text style={baseStyle}>{safeText}</Text>;
  }

  const lines = safeText.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const h3 = line.match(/^###\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h1 = line.match(/^#\s+(.+)/);
    if (h3 || h2 || h1) {
      const content = (h3 || h2 || h1)![1];
      const headingStyle = h1 ? styles.h1 : h2 ? styles.h2 : styles.h3;
      elements.push(
        <InlineText key={i} segments={parseInline(content)} baseStyle={[baseStyle, headingStyle]} />,
      );
      i++;
      continue;
    }

    // Bullet points (- or *)
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet) {
      // Collect consecutive bullet lines
      const bulletItems: string[] = [];
      while (i < lines.length) {
        const b = lines[i].match(/^[-*]\s+(.+)/);
        if (b) { bulletItems.push(b[1]); i++; }
        else break;
      }
      elements.push(
        <View key={`bullets_${i}`} style={styles.bulletList}>
          {bulletItems.map((item, j) => (
            <View key={j} style={styles.bulletRow}>
              <Text style={[baseStyle, styles.bulletDot]}>{'• '}</Text>
              <InlineText segments={parseInline(item)} baseStyle={[baseStyle, styles.bulletText]} />
            </View>
          ))}
        </View>,
      );
      continue;
    }

    // Blank line — small spacer
    if (line.trim() === '') {
      elements.push(<View key={i} style={styles.spacer} />);
      i++;
      continue;
    }

    // Normal paragraph line
    elements.push(
      <InlineText key={i} segments={parseInline(line)} baseStyle={baseStyle} />,
    );
    i++;
  }

  return <View>{elements}</View>;
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  boldItalic: { fontWeight: '700', fontStyle: 'italic' },
  h1: { fontSize: 17, fontWeight: '700', marginTop: 4, marginBottom: 2 },
  h2: { fontSize: 15, fontWeight: '700', marginTop: 4, marginBottom: 2 },
  h3: { fontSize: 14, fontWeight: '700', marginTop: 4, marginBottom: 2 },
  bulletList: { marginTop: 2, marginBottom: 2, gap: 3 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletDot: { lineHeight: 21 },
  bulletText: { flex: 1, lineHeight: 21 },
  spacer: { height: 6 },
});

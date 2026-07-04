import React, { useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Animated } from 'react-native';
import { colors } from '../../theme/colors';

const APP_BRAND_NAME = 'GatherrGo';
const BRAND_SPLIT = new RegExp(`(${APP_BRAND_NAME})`, 'gi');

function sanitizeSweeDisplayText(text: string): string {
  return text
    .replace(/<\/?t[rhd][^>]*>/gi, '')
    .replace(/<\/?table[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/GatherGo/gi, APP_BRAND_NAME);
}

type Segment = { type: 'bold' | 'italic' | 'bolditalic' | 'plain'; text: string };

function renderBrandAwarePlain(text: string, baseStyle?: object) {
  const parts = text.split(BRAND_SPLIT);
  return (
    <Text style={baseStyle}>
      {parts.map((part, i) =>
        /^GatherrGo$/i.test(part)
          ? <Text key={i} style={styles.brandName}>{part}</Text>
          : part,
      )}
    </Text>
  );
}

function parseInline(raw: string): Segment[] {
  const segments: Segment[] = [];
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
        if (seg.type === 'bold') {
          return (
            <Text key={i} style={styles.bold}>
              {renderBrandAwarePlain(seg.text)}
            </Text>
          );
        }
        if (seg.type === 'italic') {
          return (
            <Text key={i} style={styles.italic}>
              {renderBrandAwarePlain(seg.text)}
            </Text>
          );
        }
        if (seg.type === 'bolditalic') {
          return (
            <Text key={i} style={styles.boldItalic}>
              {renderBrandAwarePlain(seg.text)}
            </Text>
          );
        }
        return <Text key={i}>{renderBrandAwarePlain(seg.text)}</Text>;
      })}
    </Text>
  );
}

// ─── Table rendering ──────────────────────────────────────────────────────────

function isTableLine(line: string) {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isSeparatorLine(line: string) {
  return /^\|[\s\-|:]+\|$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  // Split on | and trim, discarding empty first/last from leading/trailing |
  const parts = line.trim().split('|');
  return parts.slice(1, parts.length - 1).map((c) => c.trim());
}

type TableData = { headers: string[]; rows: string[][] };

function parseTable(lines: string[]): TableData {
  const nonSep = lines.filter((l) => !isSeparatorLine(l));
  const [headerLine, ...dataLines] = nonSep;
  return {
    headers: headerLine ? parseTableCells(headerLine) : [],
    rows: dataLines.map(parseTableCells),
  };
}

function MarkdownTable({ table, baseStyle }: { table: TableData; baseStyle?: any }) {
  return (
    <View style={tableStyles.wrapper}>
      {/* Header row */}
      <View style={tableStyles.headerRow}>
        {table.headers.map((h, i) => (
          <View key={i} style={[tableStyles.cell, i === 0 ? tableStyles.col0 : tableStyles.col1]}>
            <Text style={tableStyles.headerText}>{h}</Text>
          </View>
        ))}
      </View>
      {/* Data rows */}
      {table.rows.map((row, ri) => (
        <View key={ri} style={[tableStyles.dataRow, ri % 2 === 0 ? tableStyles.rowEven : tableStyles.rowOdd]}>
          {row.map((cell, ci) => (
            <View key={ci} style={[tableStyles.cell, ci === 0 ? tableStyles.col0 : tableStyles.col1]}>
              <InlineText
                segments={parseInline(cell)}
                baseStyle={[baseStyle, tableStyles.cellText, ci === 0 && tableStyles.cellTextLabel]}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Skeleton shimmer (shown while streaming a response that will have a table) ──

function SkeletonLine({ width, opacity }: { width: string | number; opacity: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={[skeletonStyles.line, { width, opacity: anim }]}
    />
  );
}

function TableSkeleton() {
  return (
    <View style={skeletonStyles.wrapper}>
      {/* header */}
      <View style={skeletonStyles.headerRow}>
        <View style={skeletonStyles.headerCell}><SkeletonLine width="60%" opacity={0.6} /></View>
        <View style={[skeletonStyles.headerCell, skeletonStyles.headerCellRight]}><SkeletonLine width="80%" opacity={0.6} /></View>
      </View>
      {/* 4 rows */}
      {[1, 0.9, 0.8, 0.7].map((op, i) => (
        <View key={i} style={[skeletonStyles.dataRow, i % 2 === 0 ? skeletonStyles.rowEven : skeletonStyles.rowOdd]}>
          <View style={skeletonStyles.cell}><SkeletonLine width="45%" opacity={op} /></View>
          <View style={[skeletonStyles.cell, skeletonStyles.cellRight]}><SkeletonLine width={`${55 + i * 8}%`} opacity={op} /></View>
        </View>
      ))}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  text: string;
  streaming?: boolean;
  baseStyle?: any;
  userMessage?: boolean;
};

/** Split streaming buffer: prose before table vs table block (hide partial pipes). */
function splitStreamingContent(text: string): { beforeTable: string; inTable: boolean } {
  const sanitized = sanitizeSweeDisplayText(text);
  const lines = sanitized.split('\n');
  let tableStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isTableLine(lines[i])) {
      tableStart = i;
      break;
    }
  }
  if (tableStart === -1) {
    const looksLikeTable = /\|\s*(field|trip name|event name|destination)\b/i.test(sanitized)
      || /^\s*\|/.test(sanitized);
    if (looksLikeTable) return { beforeTable: '', inTable: true };
    return { beforeTable: sanitized, inTable: false };
  }
  return {
    beforeTable: lines.slice(0, tableStart).join('\n').trimEnd(),
    inTable: true,
  };
}

export default function MarkdownText({ text, streaming, baseStyle }: Props) {
  const safeText = sanitizeSweeDisplayText(text ?? '');

  if (streaming) {
    const { beforeTable, inTable } = splitStreamingContent(safeText);
    if (inTable) {
      return (
        <View>
          {beforeTable ? (
            <View>
              {renderBrandAwarePlain(beforeTable, baseStyle)}
              <Text style={styles.cursor}>▌</Text>
            </View>
          ) : (
            <TableSkeleton />
          )}
          {beforeTable ? <TableSkeleton /> : null}
        </View>
      );
    }
    return (
      <Text style={baseStyle}>
        {renderBrandAwarePlain(safeText, baseStyle)}
        <Text style={styles.cursor}>▌</Text>
      </Text>
    );
  }

  const lines = safeText.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table block — collect consecutive table lines
    if (isTableLine(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableLine(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      const table = parseTable(tableLines);
      if (table.headers.length > 0) {
        elements.push(
          <MarkdownTable key={`table_${i}`} table={table} baseStyle={baseStyle} />,
        );
      }
      continue;
    }

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

    // Blank line
    if (line.trim() === '') {
      elements.push(<View key={i} style={styles.spacer} />);
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <View key={i}>{renderBrandAwarePlain(line, baseStyle)}</View>,
    );
    i++;
  }

  return <View>{elements}</View>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  boldItalic: { fontWeight: '700', fontStyle: 'italic' },
  brandName: { color: colors.accent, fontWeight: '600' },
  h1: { fontSize: 17, fontWeight: '600', marginTop: 4, marginBottom: 2 },
  h2: { fontSize: 15, fontWeight: '600', marginTop: 4, marginBottom: 2 },
  h3: { fontSize: 14, fontWeight: '600', marginTop: 4, marginBottom: 2 },
  bulletList: { marginTop: 2, marginBottom: 2, gap: 3 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletDot: { lineHeight: 21 },
  bulletText: { flex: 1, lineHeight: 21 },
  spacer: { height: 6 },
  cursor: { color: '#0d9488', fontWeight: '400' },
});

const skeletonStyles = StyleSheet.create({
  wrapper: {
    marginVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#0d9488',
    paddingVertical: 10,
  },
  headerCell: { flex: 4, paddingHorizontal: 12, justifyContent: 'center' },
  headerCellRight: { flex: 6, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)' },
  dataRow: { flexDirection: 'row', paddingVertical: 10 },
  rowEven: { backgroundColor: '#f0fdfa' },
  rowOdd: { backgroundColor: '#ffffff' },
  cell: { flex: 4, paddingHorizontal: 12, justifyContent: 'center' },
  cellRight: { flex: 6, paddingHorizontal: 12, borderLeftWidth: 1, borderLeftColor: '#ccfbf1' },
  line: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0d9488',
  },
});

const tableStyles = StyleSheet.create({
  wrapper: {
    marginVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#0d9488',
  },
  dataRow: {
    flexDirection: 'row',
  },
  rowEven: { backgroundColor: '#f0fdfa' },
  rowOdd: { backgroundColor: '#ffffff' },
  cell: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  col0: { flex: 4 },
  col1: { flex: 6, borderLeftWidth: 1, borderLeftColor: '#ccfbf1' },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  cellText: {
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 18,
  },
  cellTextLabel: {
    fontWeight: '600',
    color: '#0f172a',
  },
});

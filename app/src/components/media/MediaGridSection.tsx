import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MediaThumbnail, { MediaThumbnailItem } from './MediaThumbnail';
import { buildMediaRows, isRowCentered } from '../../utils/mediaGridLayout';

type MediaGridSectionProps = {
  title?: string;
  items: MediaThumbnailItem[];
  bannerImageUrl?: string | null;
  cellSize: number;
  gap?: number;
  reorderEnabled?: boolean;
  deletingId?: string | null;
  onPressItem?: (item: MediaThumbnailItem) => void;
  onLongPressItem?: (item: MediaThumbnailItem) => void;
  onReorder?: (items: MediaThumbnailItem[]) => void;
};

function StaticGrid({
  items,
  bannerImageUrl,
  cellSize,
  gap,
  deletingId,
  onPressItem,
  onLongPressItem,
}: Omit<MediaGridSectionProps, 'title' | 'reorderEnabled' | 'onReorder'>) {
  const rows = useMemo(() => buildMediaRows(items), [items]);

  return (
    <View style={{ gap }}>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={[
            styles.row,
            isRowCentered(row.length, items.length) && styles.rowCentered,
            { gap },
          ]}
        >
          {row.map((item) => (
            <MediaThumbnail
              key={item.id}
              item={item}
              size={cellSize}
              bannerImageUrl={bannerImageUrl}
              onPress={() => onPressItem?.(item)}
              onLongPress={() => onLongPressItem?.(item)}
              deleting={deletingId === item.id}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function MediaGridSection({
  title,
  items,
  bannerImageUrl,
  cellSize,
  gap = 8,
  reorderEnabled = true,
  deletingId,
  onPressItem,
  onLongPressItem,
  onReorder,
}: MediaGridSectionProps) {
  const canDrag = reorderEnabled && items.length > 1 && !!onReorder;

  const renderDraggableItem = ({ item, drag, isActive }: RenderItemParams<MediaThumbnailItem>) => (
    <ScaleDecorator>
      <View style={{ width: cellSize, marginBottom: gap }}>
        <MediaThumbnail
          item={item}
          size={cellSize}
          bannerImageUrl={bannerImageUrl}
          onPress={() => onPressItem?.(item)}
          onLongPress={drag}
          isActive={isActive}
          deleting={deletingId === item.id}
        />
      </View>
    </ScaleDecorator>
  );

  return (
    <View style={styles.section}>
      {!!title && <Text style={styles.sectionTitle}>{title}</Text>}
      {canDrag ? (
        <GestureHandlerRootView>
          <DraggableFlatList
            data={items}
            keyExtractor={(item) => item.id}
            numColumns={3}
            scrollEnabled={false}
            onDragEnd={({ data }) => onReorder?.(data)}
            renderItem={renderDraggableItem}
            columnWrapperStyle={[styles.draggableRow, { gap, marginBottom: gap }]}
            containerStyle={styles.draggableContainer}
          />
        </GestureHandlerRootView>
      ) : (
        <StaticGrid
          items={items}
          bannerImageUrl={bannerImageUrl}
          cellSize={cellSize}
          gap={gap}
          deletingId={deletingId}
          onPressItem={onPressItem}
          onLongPressItem={onLongPressItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
  rowCentered: {
    justifyContent: 'center',
  },
  draggableContainer: {
    flexGrow: 0,
  },
  draggableRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
});

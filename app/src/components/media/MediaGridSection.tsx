import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Sortable, { type SortableGridDragEndParams, type SortableGridRenderItem } from 'react-native-sortables';
import MediaThumbnail, { MediaThumbnailItem } from './MediaThumbnail';
import { useMediaDialogScroll } from './mediaDialogScrollContext';
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
  const { scrollableRef, onSectionDragStart, onSectionDragEnd } = useMediaDialogScroll();
  const canDrag = reorderEnabled && items.length > 1 && !!onReorder;

  const renderSortableItem = useCallback<SortableGridRenderItem<MediaThumbnailItem>>(
    ({ item }) => (
      <View style={styles.sortableCell}>
        <MediaThumbnail
          item={item}
          size={cellSize}
          layoutMode="fluid"
          bannerImageUrl={bannerImageUrl}
          onPress={() => onPressItem?.(item)}
          deleting={deletingId === item.id}
          imagePointerEvents="none"
        />
      </View>
    ),
    [bannerImageUrl, cellSize, deletingId, onPressItem],
  );

  const handleDragEnd = useCallback(
    ({ data }: SortableGridDragEndParams<MediaThumbnailItem>) => {
      onSectionDragEnd();
      onReorder?.(data);
    },
    [onReorder, onSectionDragEnd],
  );

  const handleDragStart = useCallback(() => {
    onSectionDragStart();
  }, [onSectionDragStart]);

  return (
    <View style={styles.section}>
      {!!title && <Text style={styles.sectionTitle}>{title}</Text>}
      {canDrag ? (
        <Sortable.Layer>
          <Sortable.Grid
            columns={3}
            data={items}
            keyExtractor={(item) => item.id}
            rowGap={gap}
            columnGap={gap}
            scrollableRef={scrollableRef}
            hapticsEnabled
            activeItemScale={1.05}
            inactiveItemOpacity={0.72}
            activationAnimationDuration={200}
            dragActivationDelay={200}
            overflow="visible"
            bringToFrontWhenActive
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            renderItem={renderSortableItem}
          />
        </Sortable.Layer>
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
    fontWeight: '500',
    color: '#0f172a',
    marginBottom: 10,
    marginTop: 4,
  },
  sortableCell: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
  },
  rowCentered: {
    justifyContent: 'center',
  },
});

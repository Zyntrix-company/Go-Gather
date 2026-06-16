import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
} from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import CachedImage from '../common/CachedImage';
import type { DriveFile } from '../../api/trips.api';
import { showAlert } from '../../store/alertStore';

const GRID_H_PADDING = 16;
const GRID_GAP = 8;
const GRID_COLUMNS = 3;

type Props = {
  files: DriveFile[];
  selectedIds: Set<string>;
  maxSelectable: number;
  onToggle: (fileId: string) => void;
};

function PreviewSkeleton() {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return <Animated.View style={[styles.previewSkeleton, { opacity: pulse }]} />;
}

function PreviewImage({ uri }: { uri: string | null | undefined }) {
  const [loading, setLoading] = useState(!!uri);
  const [failed, setFailed] = useState(false);
  const prevUri = useRef(uri);

  useEffect(() => {
    if (prevUri.current !== uri) {
      prevUri.current = uri;
      setFailed(false);
      setLoading(!!uri);
    }
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={styles.previewWrap}>
        <View style={styles.previewFallback}>
          <ImageIcon size={22} color="#94a3b8" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.previewWrap}>
      <CachedImage
        uri={uri}
        style={styles.preview}
        resizeMode="cover"
        priority="normal"
        onLoad={() => setLoading(false)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
      {loading && (
        <View style={styles.previewSkeletonOverlay}>
          <PreviewSkeleton />
        </View>
      )}
    </View>
  );
}

function SelectBadge({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.selectBadge, selected ? styles.selectBadgeFilled : styles.selectBadgeEmpty]}>
      {selected && <Text style={styles.checkmark}>✓</Text>}
    </View>
  );
}

function GridCell({
  file,
  selected,
  onPress,
}: {
  file: DriveFile;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.cell}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <PreviewImage uri={file.thumbnailUrl} />
      <SelectBadge selected={selected} />
    </TouchableOpacity>
  );
}

export default function DrivePhotoPickerGrid({ files, selectedIds, maxSelectable, onToggle }: Props) {
  const handlePress = (fileId: string) => {
    if (selectedIds.has(fileId)) {
      onToggle(fileId);
      return;
    }
    if (maxSelectable <= 0 || selectedIds.size >= maxSelectable) {
      showAlert({
        title: "Can't upload more",
        message: maxSelectable <= 0
          ? 'You have reached the photo limit for this album.'
          : `You can only import up to ${maxSelectable} photo${maxSelectable === 1 ? '' : 's'} at a time.`,
        buttons: [{ text: 'OK' }],
      });
      return;
    }
    onToggle(fileId);
  };

  const renderItem = ({ item }: { item: DriveFile }) => {
    const selected = selectedIds.has(item.fileId);
    return (
      <View style={styles.cellWrap}>
        <GridCell
          file={item}
          selected={selected}
          onPress={() => handlePress(item.fileId)}
        />
      </View>
    );
  };

  return (
    <FlatList
      data={files}
      keyExtractor={(f) => f.fileId}
      numColumns={GRID_COLUMNS}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      columnWrapperStyle={styles.row}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 400,
  },
  listContent: {
    paddingHorizontal: GRID_H_PADDING,
    paddingVertical: 8,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  cellWrap: {
    flex: 1,
  },
  cell: {
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  previewWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f1f5f9',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSkeletonOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  previewSkeleton: {
    flex: 1,
    backgroundColor: '#e2e8f0',
  },
  selectBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBadgeEmpty: {
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  selectBadgeFilled: {
    backgroundColor: '#0d9488',
    borderWidth: 2,
    borderColor: '#0d9488',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
  },
});

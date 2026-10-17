import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  LayoutChangeEvent,
  PanResponder,
  Alert,
} from 'react-native';
import { api, type CatalogItem } from '../api';
import { adaptQuadAtDrop } from '../autoAdapt';
import {
  applyFinishToAll,
  applyFinishToCabinets,
  buildAutoDesign,
  buildAutoDesignFromSlots,
} from '../autoLayout';
import { FINISH_COLORS, elementSource } from '../elements';
import { PerspectiveImage } from '../components/PerspectiveImage';
import { RoomGuideOverlay } from '../components/RoomGuideOverlay';
import {
  isLightCategory,
  moveQuad,
  quadCenter,
  scaleQuad,
  type Pt,
  type Quad,
} from '../perspective';
import { spacing } from '../theme';
import { autoSlotsFromZones, snapQuadToZone, type ZoneMap } from '../zoneSnap';

export type PlacedElement = {
  instanceId: string;
  catalogItemId: string;
  category: string;
  name: string;
  /** 4 movable corners in normalized canvas space: TL TR BR BL */
  corners: Quad;
  colorHex: string;
};

type DragMode =
  | { type: 'move'; start: Quad }
  | { type: 'corner'; index: number; start: Pt }
  | null;

type Props = {
  roomId: string;
  roomName: string;
  imageUri: string;
  onBack: () => void;
  onSave: (placements: PlacedElement[]) => void;
  saving: boolean;
};

const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL'];

export function ComposeScreen({
  roomId,
  roomName,
  imageUri,
  onBack,
  onSave,
  saving,
}: Props) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placements, setPlacements] = useState<PlacedElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 });
  const [finishHex, setFinishHex] = useState(FINISH_COLORS[1].hex);
  const [recolorMode, setRecolorMode] = useState<'one' | 'cabinets' | 'all'>(
    'cabinets'
  );
  const [showGuides, setShowGuides] = useState(false);
  const [pendingItem, setPendingItem] = useState<CatalogItem | null>(null);
  const isKitchen = roomName.toLowerCase().includes('kitchen');
  const [zones, setZones] = useState<ZoneMap | null>(null);
  const [zoneStatus, setZoneStatus] = useState<'off' | 'scanning' | 'ready'>('off');

  const placementsRef = useRef(placements);
  placementsRef.current = placements;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const canvasRef = useRef(canvasSize);
  canvasRef.current = canvasSize;
  const dragRef = useRef<DragMode>(null);

  const selected = placements.find((p) => p.instanceId === selectedId) || null;

  useEffect(() => {
    api
      .catalog(roomId)
      .then(setCatalog)
      .catch(() => Alert.alert('Error', 'Could not load catalog items'))
      .finally(() => setLoading(false));
  }, [roomId]);

  useEffect(() => {
    if (!isKitchen) return;
    let cancelled = false;
    setZoneStatus('scanning');
    api
      .analyzeKitchen(imageUri)
      .then((z) => {
        if (cancelled) return;
        setZones(z);
        setZoneStatus(z ? 'ready' : 'off');
      })
      .catch(() => {
        if (!cancelled) setZoneStatus('off');
      });
    return () => {
      cancelled = true;
    };
  }, [imageUri, isKitchen]);

  const updateSelected = (patch: Partial<PlacedElement>) => {
    if (!selectedId) return;
    setPlacements((prev) =>
      prev.map((p) => (p.instanceId === selectedId ? { ...p, ...patch } : p))
    );
  };

  /** Select from tray → next tap on photo drops with auto scale + perspective */
  const selectForDrop = (item: CatalogItem) => {
    setPendingItem(item);
    setSelectedId(null);
  };

  const dropAt = (cx: number, cy: number) => {
    if (!pendingItem) return;
    const aspect =
      canvasSize.h > 0 ? canvasSize.w / canvasSize.h : 1.2;
    const snapped = zones
      ? snapQuadToZone(zones, pendingItem.category, cx, cy, canvasSize.w, canvasSize.h)
      : null;
    const corners =
      snapped ??
      adaptQuadAtDrop({
        cx,
        cy,
        category: pendingItem.category,
        aspect,
      });
    const instanceId = `${pendingItem.id}-${Date.now()}`;
    const light = isLightCategory(pendingItem.category);
    setPlacements((prev) => [
      ...prev,
      {
        instanceId,
        catalogItemId: pendingItem.id,
        category: pendingItem.category,
        name: pendingItem.name,
        corners,
        colorHex: light ? '#F5E6C8' : finishHex,
      },
    ]);
    setSelectedId(instanceId);
    setPendingItem(null);
  };

  const onCanvasTap = (evt: {
    nativeEvent: { locationX: number; locationY: number };
  }) => {
    if (!pendingItem) return;
    const { locationX, locationY } = evt.nativeEvent;
    const cx = Math.min(0.95, Math.max(0.05, locationX / canvasSize.w));
    const cy = Math.min(0.95, Math.max(0.05, locationY / canvasSize.h));
    dropAt(cx, cy);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setPlacements((prev) => prev.filter((p) => p.instanceId !== selectedId));
    setSelectedId(null);
  };

  const runAutoDesign = () => {
    if (catalog.length === 0) {
      Alert.alert('Wait', 'Catalog is still loading.');
      return;
    }
    const apply = () => {
      const slots = zones ? autoSlotsFromZones(zones, canvasSize.w, canvasSize.h) : [];
      const next =
        slots.length > 0
          ? buildAutoDesignFromSlots(slots, catalog, finishHex)
          : buildAutoDesign(roomName, catalog, finishHex);
      if (next.length === 0) {
        Alert.alert('No items', 'No catalog items available to auto-place.');
        return;
      }
      setPlacements(next);
      setSelectedId(next[0]?.instanceId ?? null);
    };
    if (placements.length > 0) {
      Alert.alert(
        'Auto design',
        'Replace current layout with an automatic kitchen design? You can still change colours after.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Auto design', onPress: apply },
        ]
      );
    } else {
      apply();
    }
  };

  const applyColour = (hex: string) => {
    setFinishHex(hex);
    if (recolorMode === 'one' && selectedId) {
      updateSelected({ colorHex: hex });
      return;
    }
    if (recolorMode === 'all') {
      setPlacements((prev) => applyFinishToAll(prev, hex));
      return;
    }
    // default: all cabinets / units
    setPlacements((prev) => {
      const next = applyFinishToCabinets(prev, hex);
      if (selectedId) {
        return next.map((p) =>
          p.instanceId === selectedId ? { ...p, colorHex: hex } : p
        );
      }
      return next;
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () =>
        !!selectedRef.current && dragRef.current?.type === 'move',
      onMoveShouldSetPanResponder: () => !!dragRef.current,
      onPanResponderMove: (_e, g) => {
        const id = selectedRef.current;
        const mode = dragRef.current;
        if (!id || !mode) return;
        const { w, h } = canvasRef.current;
        const dx = g.dx / w;
        const dy = g.dy / h;

        if (mode.type === 'move') {
          const next = moveQuad(mode.start, dx, dy);
          setPlacements((prev) =>
            prev.map((p) => (p.instanceId === id ? { ...p, corners: next } : p))
          );
        } else {
          const cur = placementsRef.current.find((p) => p.instanceId === id);
          if (!cur) return;
          const corners = [...cur.corners] as Quad;
          corners[mode.index] = {
            x: Math.min(0.98, Math.max(0.02, mode.start.x + dx)),
            y: Math.min(0.98, Math.max(0.02, mode.start.y + dy)),
          };
          setPlacements((prev) =>
            prev.map((p) => (p.instanceId === id ? { ...p, corners } : p))
          );
        }
      },
      onPanResponderRelease: () => {
        dragRef.current = null;
      },
    })
  ).current;

  const startMove = () => {
    if (!selected) return;
    dragRef.current = { type: 'move', start: selected.corners };
  };

  const startCorner = (index: number) => {
    if (!selected) return;
    dragRef.current = {
      type: 'corner',
      index,
      start: { ...selected.corners[index] },
    };
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Premium layout · {roomName}</Text>
        <Text style={styles.hint}>
          1) Tap an element below  2) Tap on the photo to drop — it auto-scales
          and adopts perspective. Then change colour or fine-tune corners.
        </Text>
        {zoneStatus !== 'off' && (
          <Text style={styles.hint}>
            {zoneStatus === 'scanning'
              ? 'AI is scanning the kitchen zones…'
              : 'AI zones ready — drops snap to cabinets, wall, floor and window'}
          </Text>
        )}
        {pendingItem && (
          <Text style={styles.pending}>
            Drop “{pendingItem.name}” — tap anywhere on the photo
          </Text>
        )}
        <Pressable style={styles.autoBtn} onPress={runAutoDesign}>
          <Text style={styles.autoBtnText}>✦ Auto design into map zones</Text>
        </Pressable>
        {isKitchen && (
          <Pressable
            style={styles.guideToggle}
            onPress={() => setShowGuides((v) => !v)}
          >
            <Text style={styles.guideToggleText}>
              {showGuides ? 'Hide map guides' : 'Show map guides'}
            </Text>
          </Pressable>
        )}
      </View>

      <View
        style={[styles.canvas, pendingItem && styles.canvasDropMode]}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setCanvasSize({ w: width, h: height });
        }}
        onStartShouldSetResponder={() => !!pendingItem}
        onResponderRelease={onCanvasTap}
        {...(pendingItem ? {} : panResponder.panHandlers)}
      >
        <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />

        {isKitchen && showGuides && (
          <RoomGuideOverlay
            width={canvasSize.w}
            height={canvasSize.h}
            dim={placements.length > 0}
          />
        )}

        {placements.map((p) => {
          const active = selectedId === p.instanceId;
          const c = p.corners;
          const px = c.map((pt) => ({
            x: pt.x * canvasSize.w,
            y: pt.y * canvasSize.h,
          })) as Quad;
          const srcW = 200;
          const srcH = 140;
          const center = quadCenter(p.corners);
          const light = isLightCategory(p.category);

          return (
            <View key={p.instanceId} style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {light && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.glow,
                    {
                      left: center.x * canvasSize.w - 80,
                      top: center.y * canvasSize.h - 80,
                      shadowColor: '#FFE6A8',
                    },
                  ]}
                />
              )}

              <PerspectiveImage
                source={elementSource(p.category)}
                srcW={srcW}
                srcH={srcH}
                quadPx={px}
                colorHex={p.colorHex}
                colorOpacity={light ? 0.12 : 0.32}
                active={active}
                onPressIn={() => {
                  setSelectedId(p.instanceId);
                  dragRef.current = { type: 'move', start: p.corners };
                }}
              />

              {active &&
                p.corners.map((pt, i) => (
                  <Pressable
                    key={i}
                    onPressIn={() => {
                      setSelectedId(p.instanceId);
                      startCorner(i);
                    }}
                    style={[
                      styles.handle,
                      {
                        left: pt.x * canvasSize.w - 11,
                        top: pt.y * canvasSize.h - 11,
                      },
                    ]}
                  >
                    <Text style={styles.handleText}>{CORNER_LABELS[i]}</Text>
                  </Pressable>
                ))}
            </View>
          );
        })}
      </View>

      {selected && (
        <View style={styles.inspector}>
          <Text style={styles.inspectorTitle} numberOfLines={1}>
            {selected.name} · pull 4 corners for perspective
          </Text>
          <View style={styles.row}>
            <Pressable
              style={styles.toolBtn}
              onPress={() =>
                updateSelected({ corners: scaleQuad(selected.corners, 0.92) })
              }
            >
              <Text style={styles.toolText}>− size</Text>
            </Pressable>
            <Pressable
              style={styles.toolBtn}
              onPress={() =>
                updateSelected({ corners: scaleQuad(selected.corners, 1.08) })
              }
            >
              <Text style={styles.toolText}>+ size</Text>
            </Pressable>
            <Pressable style={styles.toolBtn} onPressIn={startMove}>
              <Text style={styles.toolText}>Drag body</Text>
            </Pressable>
            <Pressable style={styles.toolBtnDanger} onPress={removeSelected}>
              <Text style={styles.toolText}>Remove</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Change colour</Text>
          <View style={styles.row}>
            {(
              [
                ['cabinets', 'All cabinets'],
                ['all', 'Most items'],
                ['one', 'Selected only'],
              ] as const
            ).map(([mode, label]) => (
              <Pressable
                key={mode}
                style={[styles.chip, recolorMode === mode && styles.chipOn]}
                onPress={() => setRecolorMode(mode)}
              >
                <Text
                  style={[
                    styles.chipText,
                    recolorMode === mode && styles.chipTextOn,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 8 }}
          >
            <View style={styles.row}>
              {FINISH_COLORS.map((c) => {
                const on = finishHex === c.hex;
                return (
                  <Pressable
                    key={c.hex}
                    onPress={() => applyColour(c.hex)}
                    style={[
                      styles.swatch,
                      { backgroundColor: c.hex },
                      on && styles.swatchOn,
                    ]}
                  />
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {!selected && placements.length > 0 && (
        <View style={styles.inspector}>
          <Text style={styles.section}>Customer finish colour</Text>
          <Text style={styles.hint}>
            Tap a colour to recolour all cabinets instantly.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.row}>
              {FINISH_COLORS.map((c) => (
                <Pressable
                  key={c.hex}
                  onPress={() => {
                    setRecolorMode('cabinets');
                    applyColour(c.hex);
                  }}
                  style={[
                    styles.swatch,
                    { backgroundColor: c.hex },
                    finishHex === c.hex && styles.swatchOn,
                  ]}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <Text style={styles.trayLabel}>
        Elements — tap one, then tap photo to drop (auto-fit)
      </Text>
      {loading ? (
        <ActivityIndicator color="#C9A227" />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tray}
        >
          {catalog.map((item) => (
            <Pressable
              key={item.id}
              style={[
                styles.trayItem,
                pendingItem?.id === item.id && styles.trayItemActive,
              ]}
              onPress={() => selectForDrop(item)}
            >
              <Image
                source={elementSource(item.category)}
                style={styles.trayImg}
                resizeMode="contain"
              />
              <Text style={styles.trayName} numberOfLines={2}>
                {item.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Pressable
        style={[
          styles.saveBtn,
          (saving || placements.length === 0) && styles.disabled,
        ]}
        disabled={saving || placements.length === 0}
        onPress={() => onSave(placements)}
      >
        <Text style={styles.saveText}>
          {saving ? 'Saving…' : 'Save customer preview'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#141210',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  topBar: { marginBottom: spacing.sm },
  back: { color: '#A89F90', marginBottom: 4 },
  title: { color: '#F4EFE6', fontSize: 21, fontWeight: '600' },
  hint: { color: '#A89F90', fontSize: 12, marginTop: 4, lineHeight: 17 },
  autoBtn: {
    marginTop: 10,
    backgroundColor: '#C9A227',
    paddingVertical: 12,
    alignItems: 'center',
  },
  autoBtnText: {
    color: '#1A1408',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  guideToggle: { marginTop: 8, alignItems: 'center' },
  guideToggleText: { color: '#7DD3FC', fontSize: 12, fontWeight: '600' },
  pending: {
    marginTop: 8,
    color: '#C9A227',
    fontWeight: '700',
    fontSize: 13,
  },
  canvasDropMode: { borderWidth: 2, borderColor: '#C9A227' },
  trayItemActive: { borderColor: '#C9A227', borderWidth: 2 },
  chip: {
    borderWidth: 1,
    borderColor: '#3A342C',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chipOn: { borderColor: '#C9A227', backgroundColor: '#2A2418' },
  chipText: { color: '#A89F90', fontSize: 11, fontWeight: '600' },
  chipTextOn: { color: '#C9A227' },
  canvas: {
    flex: 1,
    minHeight: 260,
    backgroundColor: '#1C1A17',
    overflow: 'hidden',
    position: 'relative',
  },
  photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  glow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,230,170,0.28)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 40,
  },
  handle: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#C9A227',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#FFF6D6',
  },
  handleText: { fontSize: 7, fontWeight: '800', color: '#1A1408' },
  inspector: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2A2620',
    paddingTop: 8,
  },
  inspectorTitle: { color: '#F4EFE6', fontWeight: '600', marginBottom: 8 },
  section: {
    color: '#C9A227',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolBtn: {
    borderWidth: 1,
    borderColor: '#3A342C',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  toolBtnDanger: {
    borderWidth: 1,
    borderColor: '#8B4B4B',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  toolText: { color: '#F4EFE6', fontSize: 12, fontWeight: '600' },
  swatch: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: '#2A2620',
    marginRight: 2,
  },
  swatchOn: { borderColor: '#C9A227', transform: [{ scale: 1.12 }] },
  trayLabel: {
    color: '#C9A227',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  tray: { gap: 10, paddingBottom: 6 },
  trayItem: {
    width: 104,
    backgroundColor: '#1C1A17',
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2620',
  },
  trayImg: { width: 78, height: 56 },
  trayName: {
    color: '#A89F90',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  saveBtn: {
    marginTop: 8,
    backgroundColor: '#C9A227',
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#1A1408', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.4 },
});

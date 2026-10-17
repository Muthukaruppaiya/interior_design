import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  api,
  type CatalogItem,
  type ColorOption,
  type Style,
} from '../api';
import { colors, spacing } from '../theme';

type Props = {
  roomId: string;
  selectedStyle: Style | null;
  selectedColor: ColorOption | null;
  selectedItems: CatalogItem[];
  customerName: string;
  onBack: () => void;
  onChangeStyle: (s: Style) => void;
  onChangeColor: (c: ColorOption) => void;
  onToggleItem: (item: CatalogItem) => void;
  onChangeCustomer: (name: string) => void;
  onGenerate: () => void;
  generating: boolean;
};

export function DesignScreen({
  roomId,
  selectedStyle,
  selectedColor,
  selectedItems,
  customerName,
  onBack,
  onChangeStyle,
  onChangeColor,
  onToggleItem,
  onChangeCustomer,
  onGenerate,
  generating,
}: Props) {
  const [stylesList, setStylesList] = useState<Style[]>([]);
  const [colorList, setColorList] = useState<ColorOption[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.styles(), api.colors(), api.catalog(roomId)])
      .then(([s, c, cat]) => {
        setStylesList(s);
        setColorList(c);
        setCatalog(cat);
      })
      .finally(() => setLoading(false));
  }, [roomId]);

  const selectedIds = new Set(selectedItems.map((i) => i.id));

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Design choices</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 120, gap: spacing.lg }}>
          <View>
            <Text style={styles.section}>Customer name (optional)</Text>
            <TextInput
              value={customerName}
              onChangeText={onChangeCustomer}
              placeholder="e.g. Mr. Kumar"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>

          <View>
            <Text style={styles.section}>Style</Text>
            <View style={styles.rowWrap}>
              {stylesList.map((s) => {
                const active = selectedStyle?.id === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => onChangeStyle(s)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <View
                      style={[styles.swatch, { backgroundColor: s.preview_color }]}
                    />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.section}>Colour</Text>
            <View style={styles.rowWrap}>
              {colorList.map((c) => {
                const active = selectedColor?.id === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => onChangeColor(c)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <View style={[styles.swatch, { backgroundColor: c.hex_code }]} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.section}>Add elements</Text>
            <Text style={styles.hint}>
              Cupboard, TV unit, fan, plants — select what you want to show.
            </Text>
            {catalog.map((item) => {
              const active = selectedIds.has(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onToggleItem(item)}
                  style={[styles.itemRow, active && styles.itemActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {item.category.replace('_', ' ')}
                      {item.style_name ? ` · ${item.style_name}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.check}>{active ? '✓' : '+'}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, generating && styles.disabled]}
          onPress={onGenerate}
          disabled={generating || !selectedStyle}
        >
          <Text style={styles.primaryText}>
            {generating
              ? 'Free AI redesigning… up to ~90s'
              : 'Generate AI preview'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  back: { color: colors.textMuted, marginBottom: spacing.md },
  title: { fontSize: 28, color: colors.text, fontWeight: '500', marginBottom: spacing.md },
  section: {
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  hint: { color: colors.textMuted, marginBottom: spacing.sm, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  swatch: { width: 16, height: 16 },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: colors.text },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemActive: { backgroundColor: colors.accentSoft, paddingHorizontal: 8 },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '500' },
  itemMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  check: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  footer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
});

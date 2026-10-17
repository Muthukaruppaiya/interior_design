import { View, Text, StyleSheet, Pressable, Image, ScrollView, Share } from 'react-native';
import { api, type ProjectResult } from '../api';
import { colors, spacing } from '../theme';
import type { CatalogItem, ColorOption, Style } from '../api';

type Props = {
  project: ProjectResult;
  styleChoice: Style | null;
  colorChoice: ColorOption | null;
  items: CatalogItem[];
  onHome: () => void;
  onAgain: () => void;
};

export function PreviewScreen({
  project,
  styleChoice,
  colorChoice,
  items,
  onHome,
  onAgain,
}: Props) {
  const originalUrl = api.assetUrl(project.originalUrl);
  const resultUrl = api.assetUrl(project.resultUrl);

  const share = async () => {
    await Share.share({
      message: `Interior concept preview (${project.id})\nStyle: ${styleChoice?.name || '-'}\nItems: ${items.map((i) => i.name).join(', ')}\n${resultUrl}`,
      url: resultUrl,
    });
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Customer preview</Text>
      <Text style={styles.sub}>
        {project.mode === 'compose'
          ? 'Your room photo with placed elements — drag-and-drop layout.'
          : 'Concept preview — final site finish may vary.'}
      </Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: spacing.md }}>
        <Text style={styles.label}>Before</Text>
        <Image source={{ uri: originalUrl }} style={styles.image} />

        <Text style={styles.label}>After concept</Text>
        <View>
          <Image source={{ uri: resultUrl }} style={styles.image} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {styleChoice?.name || 'Custom'}
              {colorChoice ? ` · ${colorChoice.name}` : ''} · {items.length} items
            </Text>
          </View>
        </View>

        <View style={styles.summary}>
          {items.map((item) => (
            <Text key={item.id} style={styles.summaryItem}>
              • {item.name}
            </Text>
          ))}
        </View>

        <Pressable style={styles.primaryBtn} onPress={share}>
          <Text style={styles.primaryText}>Share with customer</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onAgain}>
          <Text style={styles.secondaryText}>New visualization</Text>
        </Pressable>
        <Pressable onPress={onHome}>
          <Text style={styles.link}>Back to home</Text>
        </Pressable>
      </ScrollView>
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
  title: { fontSize: 28, color: colors.text, fontWeight: '500' },
  sub: { marginTop: 6, marginBottom: spacing.md, color: colors.textMuted },
  label: {
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  image: { width: '100%', height: 220, backgroundColor: colors.surface },
  badge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 10,
  },
  badgeText: { color: '#fff', fontSize: 13 },
  summary: { gap: 4 },
  summaryItem: { color: colors.text, fontSize: 14 },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: colors.bg, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text },
  link: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});

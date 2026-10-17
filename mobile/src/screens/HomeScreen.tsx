import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  onStart: () => void;
  onProjects: () => void;
};

export function HomeScreen({ onStart, onProjects }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.brand}>ATELIER</Text>
        <Text style={styles.brandSub}>INTERIOR VISUALIZER</Text>
        <Text style={styles.tagline}>
          Capture a room. Auto-design cabinets in one tap, then change colours
          for the customer — no manual rebuild.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={onStart}>
          <Text style={styles.primaryText}>New visualization</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onProjects}>
          <Text style={styles.secondaryText}>Recent projects</Text>
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
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  brand: {
    fontSize: 48,
    letterSpacing: 6,
    color: colors.text,
    fontWeight: '300',
  },
  brandSub: {
    marginTop: spacing.xs,
    fontSize: 13,
    letterSpacing: 4,
    color: colors.accent,
    fontWeight: '600',
  },
  tagline: {
    marginTop: spacing.lg,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textMuted,
    maxWidth: 320,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.text,
    fontSize: 15,
  },
});

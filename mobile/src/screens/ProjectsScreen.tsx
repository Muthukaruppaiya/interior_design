import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { API_BASE_URL } from '../config';
import { colors, spacing } from '../theme';

type ProjectRow = {
  id: string;
  customer_name: string | null;
  room_name: string;
  style_name: string | null;
  status: string;
  created_at: string;
};

type Props = {
  onBack: () => void;
};

export function ProjectsScreen({ onBack }: Props) {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/projects`)
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        return res.json();
      })
      .then(setRows)
      .catch(() => setError('Could not load projects'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Recent projects</Text>

      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No projects yet. Create your first visualization.</Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {item.customer_name || 'Walk-in customer'}
            </Text>
            <Text style={styles.cardMeta}>
              {item.room_name}
              {item.style_name ? ` · ${item.style_name}` : ''} · {item.status}
            </Text>
            <Text style={styles.cardDate}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        )}
      />
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
  title: { fontSize: 28, color: colors.text, fontWeight: '500' },
  error: { color: colors.danger, marginTop: spacing.md },
  empty: { color: colors.textMuted, marginTop: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cardMeta: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  cardDate: { color: colors.textMuted, marginTop: 6, fontSize: 12 },
});

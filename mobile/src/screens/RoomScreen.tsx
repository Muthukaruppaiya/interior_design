import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { api, type Room } from '../api';
import { colors, spacing } from '../theme';

type Props = {
  onBack: () => void;
  onSelect: (room: Room) => void;
};

export function RoomScreen({ onBack, onSelect }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .rooms()
      .then(setRooms)
      .catch(() => setError('Cannot reach API. Is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Choose room</Text>
      <Text style={styles.sub}>Pick the space you are designing for.</Text>

      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onSelect(item)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            {!!item.description && (
              <Text style={styles.cardDesc}>{item.description}</Text>
            )}
          </Pressable>
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
  sub: { marginTop: 6, color: colors.textMuted, fontSize: 15 },
  error: { color: colors.danger, marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  cardDesc: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
});

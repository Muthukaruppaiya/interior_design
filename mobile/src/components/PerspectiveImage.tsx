import { Image, View, StyleSheet, type ImageSourcePropType } from 'react-native';
import type { Quad } from '../perspective';

type Props = {
  source: ImageSourcePropType;
  srcW: number;
  srcH: number;
  quadPx: Quad;
  colorHex: string;
  colorOpacity?: number;
  active?: boolean;
  onPressIn?: () => void;
};

/** Native fallback: axis-aligned box (no full perspective). */
export function PerspectiveImage({
  source,
  srcW,
  srcH,
  quadPx,
  colorHex,
  colorOpacity = 0.34,
  active,
  onPressIn,
}: Props) {
  const xs = quadPx.map((p) => p.x);
  const ys = quadPx.map((p) => p.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;

  return (
    <View
      onStartShouldSetResponder={() => true}
      onResponderGrant={onPressIn}
      style={[
        styles.box,
        {
          left,
          top,
          width,
          height,
          borderColor: active ? '#C9A227' : 'transparent',
        },
      ]}
    >
      <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="stretch" />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colorHex, opacity: colorOpacity }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 1,
    overflow: 'hidden',
  },
});

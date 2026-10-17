import { Image, View, StyleSheet, type ImageSourcePropType } from 'react-native';
import { matrix3dForQuad, type Quad } from '../perspective';

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

/** Web: true CSS matrix3d perspective warp onto 4 corners. */
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
  const matrix = matrix3dForQuad(srcW, srcH, quadPx);

  return (
    <View
      onStartShouldSetResponder={() => true}
      onResponderGrant={onPressIn}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: srcW,
          height: srcH,
          transform: matrix,
          transformOrigin: '0 0',
          borderWidth: active ? 1 : 0,
          borderColor: '#C9A227',
          overflow: 'hidden',
        } as any
      }
    >
      <Image source={source} style={{ width: srcW, height: srcH }} resizeMode="stretch" />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colorHex, opacity: colorOpacity }]}
      />
    </View>
  );
}

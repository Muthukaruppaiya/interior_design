import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';
import {
  FLOOR_GUIDE_LINES,
  KITCHEN_MAP_ZONES,
  type MapZone,
} from '../kitchenMap';

type Props = {
  width: number;
  height: number;
  /** show zone boxes + labels */
  showZones?: boolean;
  /** show backup-camera floor path lines */
  showFloorPath?: boolean;
  zones?: MapZone[];
  dim?: boolean;
};

function quadPoints(zone: MapZone, w: number, h: number): string {
  return zone.corners.map((p) => `${p.x * w},${p.y * h}`).join(' ');
}

function labelPos(zone: MapZone, w: number, h: number) {
  const c = zone.corners;
  return {
    x: ((c[0].x + c[1].x + c[2].x + c[3].x) / 4) * w,
    y: ((c[0].y + c[1].y + c[2].y + c[3].y) / 4) * h,
  };
}

/**
 * Backup-camera style mapping guides.
 * Align the real kitchen counters / window / floor to these lines,
 * then Auto design pastes cupboards into the same boxes.
 */
export function RoomGuideOverlay({
  width,
  height,
  showZones = true,
  showFloorPath = true,
  zones = KITCHEN_MAP_ZONES,
  dim = false,
}: Props) {
  if (width < 8 || height < 8) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, dim && styles.dim]}
    >
      <Svg width={width} height={height}>
        {showFloorPath && (
          <>
            <Line
              x1={FLOOR_GUIDE_LINES.left[0].x * width}
              y1={FLOOR_GUIDE_LINES.left[0].y * height}
              x2={FLOOR_GUIDE_LINES.left[1].x * width}
              y2={FLOOR_GUIDE_LINES.left[1].y * height}
              stroke="#38BDF8"
              strokeWidth={3}
            />
            <Line
              x1={FLOOR_GUIDE_LINES.right[0].x * width}
              y1={FLOOR_GUIDE_LINES.right[0].y * height}
              x2={FLOOR_GUIDE_LINES.right[1].x * width}
              y2={FLOOR_GUIDE_LINES.right[1].y * height}
              stroke="#38BDF8"
              strokeWidth={3}
            />
            <Line
              x1={FLOOR_GUIDE_LINES.near[0].x * width}
              y1={FLOOR_GUIDE_LINES.near[0].y * height}
              x2={FLOOR_GUIDE_LINES.near[1].x * width}
              y2={FLOOR_GUIDE_LINES.near[1].y * height}
              stroke="#EF4444"
              strokeWidth={3}
            />
            <Line
              x1={FLOOR_GUIDE_LINES.far[0].x * width}
              y1={FLOOR_GUIDE_LINES.far[0].y * height}
              x2={FLOOR_GUIDE_LINES.far[1].x * width}
              y2={FLOOR_GUIDE_LINES.far[1].y * height}
              stroke="#7DD3FC"
              strokeWidth={2}
            />
          </>
        )}

        {showZones &&
          zones.map((z) => {
            const mid = labelPos(z, width, height);
            return (
              <Polygon
                key={z.id}
                points={quadPoints(z, width, height)}
                stroke={z.color}
                strokeWidth={2}
                fill={z.color}
                fillOpacity={0.18}
              />
            );
          })}

        {showZones &&
          zones.map((z) => {
            const mid = labelPos(z, width, height);
            return (
              <SvgText
                key={`${z.id}-label`}
                x={mid.x}
                y={mid.y}
                fill="#FFF"
                fontSize={10}
                fontWeight="700"
                textAnchor="middle"
                opacity={0.95}
              >
                {z.label}
              </SvgText>
            );
          })}
      </Svg>

      <View style={styles.legend}>
        <Text style={styles.legendText}>
          Align counters to blue boxes · Red line = floor front · Yellow = light
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
  },
  dim: { opacity: 0.55 },
  legend: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  legendText: {
    color: '#E8F4FF',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
});

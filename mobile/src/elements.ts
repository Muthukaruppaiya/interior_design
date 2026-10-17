import type { ImageSourcePropType } from 'react-native';

const assets: Record<string, ImageSourcePropType> = {
  cabinet: require('../assets/elements/cabinet.png'),
  cabinet_side: require('../assets/elements/cabinet_side.png'),
  upper_cabinet: require('../assets/elements/upper_cabinet.png'),
  tv_unit: require('../assets/elements/tv_unit.png'),
  wardrobe: require('../assets/elements/wardrobe.png'),
  chimney: require('../assets/elements/chimney.png'),
  plant: require('../assets/elements/plant.png'),
  fan: require('../assets/elements/fan.png'),
  backsplash: require('../assets/elements/backsplash.png'),
  lighting: require('../assets/elements/lighting.png'),
  glow_light: require('../assets/elements/glow_light.png'),
  under_cabinet_light: require('../assets/elements/under_cabinet_light.png'),
  vanity: require('../assets/elements/vanity.png'),
  seating: require('../assets/elements/seating.png'),
  floor_mat: require('../assets/elements/floor_mat.png'),
  floor_mat_rect: require('../assets/elements/floor_mat_rect.png'),
  curtain: require('../assets/elements/curtain.png'),
  false_ceiling: require('../assets/elements/lighting.png'),
  bed_panel: require('../assets/elements/wardrobe.png'),
  mirror: require('../assets/elements/vanity.png'),
  shoe_rack: require('../assets/elements/cabinet.png'),
  cladding: require('../assets/elements/backsplash.png'),
  pergola: require('../assets/elements/seating.png'),
  default: require('../assets/elements/default.png'),
};

export function elementSource(category: string): ImageSourcePropType {
  return assets[category] || assets.default;
}

/** Premium muted finishes (no neon orange) */
export const FINISH_COLORS = [
  { name: 'Espresso', hex: '#3C2415' },
  { name: 'Walnut', hex: '#5D3A1A' },
  { name: 'Honey Oak', hex: '#A67C52' },
  { name: 'Champagne', hex: '#D4C4A8' },
  { name: 'Ivory', hex: '#F3EDE3' },
  { name: 'Greige', hex: '#C4B8A8' },
  { name: 'Slate', hex: '#6B6560' },
  { name: 'Charcoal', hex: '#2C2A28' },
  { name: 'Bronze', hex: '#8B7355' },
  { name: 'Sage', hex: '#7A8B6F' },
];

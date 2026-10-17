import type { Quad } from './perspective';

export type MapZone = {
  id: string;
  label: string;
  /** backup-camera style colour */
  color: string;
  categories: string[];
  corners: Quad;
  light?: boolean;
  colorHex?: string;
};

/**
 * Fixed room map for L-shaped unfinished kitchen.
 * User aligns the REAL counters / window / floor to these guides
 * (same idea as car reverse-camera lines), then Auto design pastes
 * into exactly these zones.
 */
export const KITCHEN_MAP_ZONES: MapZone[] = [
  {
    id: 'base-left',
    label: 'CUPBOARD',
    color: '#38BDF8',
    categories: ['cabinet'],
    corners: [
      { x: 0.22, y: 0.50 },
      { x: 0.40, y: 0.50 },
      { x: 0.40, y: 0.66 },
      { x: 0.22, y: 0.66 },
    ],
  },
  {
    id: 'base-mid',
    label: 'CUPBOARD',
    color: '#38BDF8',
    categories: ['cabinet'],
    corners: [
      { x: 0.40, y: 0.495 },
      { x: 0.56, y: 0.495 },
      { x: 0.56, y: 0.655 },
      { x: 0.40, y: 0.655 },
    ],
  },
  {
    id: 'base-right',
    label: 'SIDE CUPBOARD',
    color: '#22D3EE',
    categories: ['cabinet_side', 'cabinet'],
    corners: [
      { x: 0.56, y: 0.52 },
      { x: 0.78, y: 0.48 },
      { x: 0.86, y: 0.72 },
      { x: 0.58, y: 0.76 },
    ],
  },
  {
    id: 'upper-right',
    label: 'UPPER',
    color: '#818CF8',
    categories: ['upper_cabinet', 'cabinet_side', 'cabinet'],
    corners: [
      { x: 0.58, y: 0.18 },
      { x: 0.88, y: 0.14 },
      { x: 0.92, y: 0.38 },
      { x: 0.60, y: 0.42 },
    ],
  },
  {
    id: 'chimney',
    label: 'CHIMNEY',
    color: '#F472B6',
    categories: ['chimney'],
    corners: [
      { x: 0.36, y: 0.28 },
      { x: 0.52, y: 0.28 },
      { x: 0.52, y: 0.42 },
      { x: 0.36, y: 0.42 },
    ],
  },
  {
    id: 'window-curtain',
    label: 'WINDOW',
    color: '#A78BFA',
    categories: ['curtain'],
    corners: [
      { x: 0.38, y: 0.22 },
      { x: 0.54, y: 0.22 },
      { x: 0.54, y: 0.46 },
      { x: 0.38, y: 0.46 },
    ],
    colorHex: '#D4C4A8',
  },
  {
    id: 'light',
    label: 'LIGHT',
    color: '#FBBF24',
    categories: ['glow_light', 'under_cabinet_light', 'lighting'],
    light: true,
    corners: [
      { x: 0.40, y: 0.06 },
      { x: 0.60, y: 0.06 },
      { x: 0.60, y: 0.18 },
      { x: 0.40, y: 0.18 },
    ],
    colorHex: '#FFE9B0',
  },
  {
    id: 'under-light',
    label: 'GLOW',
    color: '#F59E0B',
    categories: ['under_cabinet_light', 'glow_light'],
    light: true,
    corners: [
      { x: 0.24, y: 0.44 },
      { x: 0.54, y: 0.44 },
      { x: 0.54, y: 0.50 },
      { x: 0.24, y: 0.50 },
    ],
    colorHex: '#F5E6C8',
  },
  {
    id: 'floor',
    label: 'FLOOR MAT',
    color: '#EF4444',
    categories: ['floor_mat', 'floor_mat_rect'],
    corners: [
      { x: 0.26, y: 0.72 },
      { x: 0.62, y: 0.72 },
      { x: 0.62, y: 0.92 },
      { x: 0.26, y: 0.92 },
    ],
    colorHex: '#6B3E2E',
  },
];

/** Perspective floor path lines (backup-camera style). */
export const FLOOR_GUIDE_LINES = {
  left: [
    { x: 0.18, y: 0.98 },
    { x: 0.36, y: 0.58 },
  ],
  right: [
    { x: 0.82, y: 0.98 },
    { x: 0.62, y: 0.58 },
  ],
  near: [
    { x: 0.22, y: 0.88 },
    { x: 0.78, y: 0.88 },
  ],
  far: [
    { x: 0.34, y: 0.68 },
    { x: 0.66, y: 0.68 },
  ],
};

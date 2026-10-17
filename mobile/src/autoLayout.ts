import type { CatalogItem } from './api';
import { FINISH_COLORS } from './elements';
import { KITCHEN_MAP_ZONES, type MapZone } from './kitchenMap';
import type { Quad } from './perspective';
import type { PlacedElement } from './screens/ComposeScreen';
import type { AutoSlot } from './zoneSnap';

function pickItem(
  catalog: CatalogItem[],
  categories: string[],
  usedIds: Set<string>
): CatalogItem | null {
  for (const cat of categories) {
    const hit = catalog.find((c) => c.category === cat && !usedIds.has(c.id));
    if (hit) return hit;
    const any = catalog.find((c) => c.category === cat);
    if (any) return any;
  }
  return null;
}

function buildFromZones(
  catalog: CatalogItem[],
  zones: MapZone[],
  defaultFinish: string
): PlacedElement[] {
  const used = new Set<string>();
  const out: PlacedElement[] = [];
  let i = 0;
  for (const zone of zones) {
    const item = pickItem(catalog, zone.categories, used);
    if (!item) continue;
    used.add(item.id);
    out.push({
      instanceId: `auto-${zone.id}-${i++}-${Date.now()}`,
      catalogItemId: item.id,
      category: item.category,
      name: item.name,
      corners: zone.corners.map((p) => ({ ...p })) as Quad,
      colorHex: zone.colorHex || (zone.light ? '#F5E6C8' : defaultFinish),
    });
  }
  return out;
}

const HALL_ZONES: MapZone[] = [
  {
    id: 'tv',
    label: 'TV UNIT',
    color: '#38BDF8',
    categories: ['tv_unit'],
    corners: [
      { x: 0.28, y: 0.35 },
      { x: 0.72, y: 0.35 },
      { x: 0.72, y: 0.72 },
      { x: 0.28, y: 0.72 },
    ],
  },
  {
    id: 'floor',
    label: 'RUG',
    color: '#EF4444',
    categories: ['floor_mat', 'floor_mat_rect'],
    corners: [
      { x: 0.30, y: 0.72 },
      { x: 0.70, y: 0.72 },
      { x: 0.70, y: 0.92 },
      { x: 0.30, y: 0.92 },
    ],
    colorHex: '#6B3E2E',
  },
  {
    id: 'light',
    label: 'LIGHT',
    color: '#FBBF24',
    categories: ['glow_light', 'lighting'],
    light: true,
    corners: [
      { x: 0.42, y: 0.10 },
      { x: 0.58, y: 0.10 },
      { x: 0.58, y: 0.24 },
      { x: 0.42, y: 0.24 },
    ],
    colorHex: '#FFE9B0',
  },
];

const SLOT_FALLBACKS: Record<string, string[]> = {
  cabinet_side: ['cabinet_side', 'cabinet'],
  floor_mat_rect: ['floor_mat_rect', 'floor_mat'],
};

/** Auto design from the AI-detected kitchen zones; lights keep the map spot. */
export function buildAutoDesignFromSlots(
  slots: AutoSlot[],
  catalog: CatalogItem[],
  defaultFinish: string
): PlacedElement[] {
  const used = new Set<string>();
  const out: PlacedElement[] = slots.flatMap((slot, i) => {
    const item = pickItem(catalog, SLOT_FALLBACKS[slot.category] ?? [slot.category], used);
    if (!item) return [];
    used.add(item.id);
    const isFloor = item.category.startsWith('floor');
    return [
      {
        instanceId: `auto-${slot.category}-${i}-${Date.now()}`,
        catalogItemId: item.id,
        category: item.category,
        name: item.name,
        corners: slot.corners,
        colorHex: isFloor ? '#6B3E2E' : defaultFinish,
      },
    ];
  });
  const lights = KITCHEN_MAP_ZONES.filter((z) => z.light);
  return out.concat(buildFromZones(catalog, lights, defaultFinish));
}

/** Auto design uses the same map zones as the camera guidelines. */
export function buildAutoDesign(
  roomName: string,
  catalog: CatalogItem[],
  finishHex = FINISH_COLORS[1].hex
): PlacedElement[] {
  const name = roomName.toLowerCase();
  if (name.includes('kitchen')) {
    return buildFromZones(catalog, KITCHEN_MAP_ZONES, finishHex);
  }
  if (name.includes('hall') || name.includes('living')) {
    return buildFromZones(catalog, HALL_ZONES, finishHex);
  }
  return buildFromZones(catalog, KITCHEN_MAP_ZONES.slice(0, 4), finishHex);
}

const CABINET_CATS = new Set([
  'cabinet',
  'cabinet_side',
  'upper_cabinet',
  'wardrobe',
  'tv_unit',
  'vanity',
  'shoe_rack',
]);

export function applyFinishToCabinets(
  placements: PlacedElement[],
  colorHex: string
): PlacedElement[] {
  return placements.map((p) =>
    CABINET_CATS.has(p.category) ? { ...p, colorHex } : p
  );
}

export function applyFinishToAll(
  placements: PlacedElement[],
  colorHex: string
): PlacedElement[] {
  return placements.map((p) =>
    p.category.startsWith('floor') ||
    p.category === 'curtain' ||
    p.category.includes('light') ||
    p.category === 'glow_light' ||
    p.category === 'lighting' ||
    p.category === 'fan'
      ? p
      : { ...p, colorHex }
  );
}

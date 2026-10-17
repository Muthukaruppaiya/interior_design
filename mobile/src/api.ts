import { Platform } from 'react-native';
import { API_BASE_URL } from './config';
import type { PlacedElement } from './screens/ComposeScreen';
import type { ZoneMap } from './zoneSnap';

export type Room = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
};

export type Style = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  preview_color: string;
};

export type ColorOption = {
  id: string;
  name: string;
  hex_code: string;
  category: string;
};

export type CatalogItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  base_price: string | number;
  style_slug: string | null;
  style_name: string | null;
};

export type ProjectResult = {
  id: string;
  status: string;
  originalUrl: string;
  resultUrl: string;
  mode?: string;
  customer_name?: string | null;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function appendImage(form: FormData, field: string, imageUri: string) {
  if (Platform.OS === 'web') {
    const blobRes = await fetch(imageUri);
    const blob = await blobRes.blob();
    const mime = blob.type || 'image/jpeg';
    const ext = mime.split('/')[1] || 'jpeg';
    form.append(field, blob, `${field}.${ext}`);
  } else {
    const rawName = imageUri.split('/').pop() || 'room.jpg';
    const filename = rawName.split('?')[0] || 'room.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    form.append(field, {
      uri: imageUri,
      name: filename.includes('.') ? filename : 'room.jpg',
      type,
    } as unknown as Blob);
  }
}

export const api = {
  health: () => getJson<{ ok: boolean }>('/health'),
  rooms: () => getJson<Room[]>('/api/rooms'),
  styles: () => getJson<Style[]>('/api/styles'),
  colors: () => getJson<ColorOption[]>('/api/colors'),
  catalog: (roomIdOrSlug: string) =>
    getJson<CatalogItem[]>(`/api/rooms/${roomIdOrSlug}/catalog`),

  composeProject: async (input: {
    imageUri: string;
    roomId: string;
    placements: PlacedElement[];
    customerName?: string;
    /** Pre-baked web canvas JPEG (perspective + glow) */
    resultBlob?: Blob;
  }): Promise<ProjectResult> => {
    const form = new FormData();
    await appendImage(form, 'image', input.imageUri);
    if (input.resultBlob) {
      form.append('result', input.resultBlob, 'result.jpg');
    }
    form.append('roomId', input.roomId);
    if (input.customerName) form.append('customerName', input.customerName);
    form.append(
      'placements',
      JSON.stringify(
        input.placements.map((p) => ({
          catalogItemId: p.catalogItemId,
          category: p.category,
          name: p.name,
          x: (p.corners[0].x + p.corners[2].x) / 2,
          y: (p.corners[0].y + p.corners[2].y) / 2,
          scale: 1,
          rotation: 0,
          colorHex: p.colorHex || null,
          corners: p.corners,
        }))
      )
    );

    const res = await fetch(`${API_BASE_URL}/api/projects/compose`, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Compose failed: ${res.status}`);
    }
    return res.json() as Promise<ProjectResult>;
  },

  analyzeKitchen: async (imageUri: string): Promise<ZoneMap | null> => {
    const form = new FormData();
    await appendImage(form, 'image', imageUri);
    const res = await fetch(`${API_BASE_URL}/api/analyze/kitchen`, {
      method: 'POST',
      body: form,
    });
    if (res.status === 503) return null;
    if (!res.ok) throw new Error(`Analyze failed: ${res.status}`);
    return res.json() as Promise<ZoneMap>;
  },

  assetUrl: (path: string) =>
    path.startsWith('http') ? path : `${API_BASE_URL}${path}`,
};

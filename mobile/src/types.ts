import type { CatalogItem, ColorOption, Room, Style } from './api';
import type { PlacedElement } from './screens/ComposeScreen';

export type WizardState = {
  room: Room | null;
  imageUri: string | null;
  style: Style | null;
  color: ColorOption | null;
  selectedItems: CatalogItem[];
  placements: PlacedElement[];
  customerName: string;
};

export type Step =
  | 'home'
  | 'room'
  | 'capture'
  | 'compose'
  | 'preview'
  | 'projects';

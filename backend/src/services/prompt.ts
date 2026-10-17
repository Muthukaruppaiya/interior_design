export function buildInteriorPrompt(options: {
  roomName: string;
  styleName?: string | null;
  colorHex?: string | null;
  colorName?: string | null;
  itemNames: string[];
}): string {
  const style = options.styleName || 'modern interior';
  const colour = options.colorName
    ? `${options.colorName}${options.colorHex ? ` (${options.colorHex})` : ''}`
    : options.colorHex || 'warm neutral finishes';
  const items =
    options.itemNames.length > 0
      ? options.itemNames.join(', ')
      : 'appropriate furniture and finishes for this room';

  return [
    `Photorealistic interior design redesign of this exact ${options.roomName.toLowerCase()} photo.`,
    `Keep the same camera angle, room layout, window positions, walls, and architecture.`,
    `Transform it into a finished ${style} ${options.roomName.toLowerCase()}.`,
    `Primary colour / material palette: ${colour}.`,
    `Clearly include these design elements: ${items}.`,
    `Make cabinets, finishes, lighting and appliances look real and buildable.`,
    `High-end residential interior photography, natural lighting, sharp detail, no text, no watermark, no UI overlay.`,
  ].join(' ');
}

export const NEGATIVE_PROMPT =
  'lowres, blurry, distorted architecture, moved windows, changed room layout, watermark, text, logo, banner, cartoon, anime, deformed furniture, extra doors, mirrored walls';

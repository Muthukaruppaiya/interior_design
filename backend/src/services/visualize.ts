import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Replicate from 'replicate';
import { GoogleGenAI } from '@google/genai';
import { buildInteriorPrompt, NEGATIVE_PROMPT } from './prompt';

type VisualizeOptions = {
  originalPath: string;
  uploadDir: string;
  projectId: string;
  roomName: string;
  styleName?: string | null;
  colorHex?: string | null;
  colorName?: string | null;
  itemNames: string[];
};

type AiMode = 'pollinations' | 'gemini' | 'replicate' | 'mock';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function toJpegBuffer(filePath: string): Promise<Buffer> {
  return sharp(filePath).rotate().jpeg({ quality: 88 }).resize(1280).toBuffer();
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download AI result: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf).jpeg({ quality: 90 }).toFile(destPath);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Temporary public URL so free Pollinations can read the room photo. */
async function uploadTempPublicUrl(filePath: string): Promise<string> {
  const jpeg = await toJpegBuffer(filePath);
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }),
    'room.jpg'
  );

  const res = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Temp image upload failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    status: string;
    data?: { url?: string };
  };
  const pageUrl = json.data?.url;
  if (!pageUrl) {
    throw new Error('Temp image upload returned no URL');
  }
  // Direct file URL for img2img consumers
  return pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}

/**
 * Free Pollinations classic API — no paid Google/Gemini billing required.
 * Rate limit: about 1 image / 45s per IP on free tier.
 */
async function generateWithPollinations(
  options: VisualizeOptions,
  resultPath: string
): Promise<void> {
  const prompt = buildInteriorPrompt(options);
  const imageUrl = await uploadTempPublicUrl(options.originalPath);
  const encodedPrompt = encodeURIComponent(prompt);
  const encodedImage = encodeURIComponent(imageUrl);
  const seed = Math.floor(Math.random() * 1_000_000);
  const url =
    `https://image.pollinations.ai/prompt/${encodedPrompt}` +
    `?image=${encodedImage}&width=1024&height=768&nologo=true&model=flux&seed=${seed}`;

  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    lastStatus = res.status;
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf).jpeg({ quality: 90 }).toFile(resultPath);
      return;
    }

    if (res.status === 402 || res.status === 429) {
      const body = await res.text();
      const retryMatch = /Retry after (\d+)s/i.exec(body);
      const waitSec = retryMatch ? Number(retryMatch[1]) + 2 : 50;
      console.warn(`Pollinations rate limit — waiting ${waitSec}s…`);
      await sleep(waitSec * 1000);
      continue;
    }

    const errText = await res.text();
    throw new Error(`Pollinations failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  throw new Error(
    `Pollinations free limit still busy (HTTP ${lastStatus}). Wait ~45s and try again.`
  );
}

function friendlyAiError(err: unknown): Error {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : JSON.stringify(err);

  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return new Error(
      'Gemini image AI is NOT free. Free-tier image quota is 0. Use AI_MODE=pollinations (free) or enable Gemini billing / Replicate.'
    );
  }

  return new Error(raw.slice(0, 400) || 'AI visualization failed');
}

async function generateWithGemini(
  options: VisualizeOptions,
  resultPath: string
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');

  const ai = new GoogleGenAI({ apiKey });
  const jpeg = await toJpegBuffer(options.originalPath);
  const prompt = buildInteriorPrompt(options);
  const models = [
    process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-preview-image-generation',
  ].filter((v, i, a) => a.indexOf(v) === i);

  let lastError: unknown;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: jpeg.toString('base64'),
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p) => p.inlineData?.data);
      if (!imagePart?.inlineData?.data) {
        throw new Error(`Gemini model ${model} returned no image`);
      }

      const outBuf = Buffer.from(imagePart.inlineData.data, 'base64');
      await sharp(outBuf).jpeg({ quality: 90 }).toFile(resultPath);
      return;
    } catch (err) {
      lastError = err;
      console.error(`Gemini model failed (${model}):`, err);
    }
  }

  throw friendlyAiError(lastError);
}

async function generateWithReplicate(
  options: VisualizeOptions,
  resultPath: string
): Promise<void> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN missing');

  const replicate = new Replicate({ auth: token });
  const jpeg = await toJpegBuffer(options.originalPath);
  const dataUri = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  const prompt = buildInteriorPrompt(options);

  const output = await replicate.run(
    'adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38',
    {
      input: {
        image: dataUri,
        prompt,
        negative_prompt: NEGATIVE_PROMPT,
        prompt_strength: 0.8,
        guidance_scale: 15,
        num_inference_steps: 50,
      },
    }
  );

  const url =
    typeof output === 'string'
      ? output
      : Array.isArray(output)
        ? String(output[0])
        : output && typeof output === 'object' && 'url' in output
          ? String((output as { url: unknown }).url)
          : null;

  if (!url) {
    throw new Error('Replicate returned no image URL');
  }

  const finalUrl =
    typeof (output as { url?: () => string }).url === 'function'
      ? (output as { url: () => string }).url()
      : url;

  await downloadToFile(finalUrl, resultPath);
}

async function generateOverlayFallback(
  options: VisualizeOptions,
  resultPath: string
): Promise<void> {
  const metaInfo = await sharp(options.originalPath).rotate().metadata();
  const width = metaInfo.width || 1280;
  const height = metaInfo.height || 960;
  const color = options.colorHex || '#C4A574';
  const style = options.styleName || 'Custom';
  const items = options.itemNames.slice(0, 5);
  const itemRows = items
    .map(
      (name, i) => `
      <rect x="24" y="${120 + i * 52}" width="340" height="42" rx="6" fill="rgba(26,28,26,0.78)"/>
      <text x="40" y="${147 + i * 52}" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#F3F0E8">${escapeXml(name)}</text>`
    )
    .join('');

  const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${color}" fill-opacity="0.25"/>
  <rect x="24" y="24" width="300" height="44" rx="6" fill="rgba(196,165,116,0.95)"/>
  <text x="40" y="52" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#1A1C1A">MOCK ONLY (no AI)</text>
  <text x="24" y="100" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#F3F0E8">${escapeXml(style)}</text>
  ${itemRows}
</svg>`);

  await sharp(options.originalPath)
    .rotate()
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toFile(resultPath);
}

function resolveAiMode(): AiMode {
  const forced = (process.env.AI_MODE || '').toLowerCase();
  if (
    forced === 'pollinations' ||
    forced === 'gemini' ||
    forced === 'replicate' ||
    forced === 'mock'
  ) {
    return forced;
  }
  // Default: free Pollinations — Gemini image is paid-only
  return 'pollinations';
}

/**
 * Generates After image.
 * Default free: pollinations
 * Paid: gemini | replicate
 */
export async function generateVisualization(
  options: VisualizeOptions
): Promise<{ resultPath: string; metaPath: string; mode: string }> {
  const resultFile = `${options.projectId}-result.jpg`;
  const metaFile = `${options.projectId}-meta.json`;
  const resultPath = path.join(options.uploadDir, resultFile);
  const metaPath = path.join(options.uploadDir, metaFile);
  const mode = resolveAiMode();

  if (mode === 'pollinations') {
    await generateWithPollinations(options, resultPath);
  } else if (mode === 'gemini') {
    await generateWithGemini(options, resultPath);
  } else if (mode === 'replicate') {
    await generateWithReplicate(options, resultPath);
  } else {
    await generateOverlayFallback(options, resultPath);
  }

  const meta = {
    mode,
    generatedAt: new Date().toISOString(),
    room: options.roomName,
    style: options.styleName || null,
    color: options.colorHex || null,
    colorName: options.colorName || null,
    items: options.itemNames,
    disclaimer:
      mode === 'mock'
        ? 'Mock overlay only.'
        : mode === 'pollinations'
          ? 'Free AI concept (Pollinations). Layout may differ slightly from site.'
          : 'AI concept preview. Final on-site finish may vary.',
  };

  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  return { resultPath, metaPath, mode };
}

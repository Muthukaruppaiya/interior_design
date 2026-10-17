import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const outDir = path.resolve(__dirname, '../assets/elements');
fs.mkdirSync(outDir, { recursive: true });

/** Premium muted palette — espresso / champagne / bronze (no neon orange) */
const ESPRESSO = '#3C2415';
const WALNUT = '#5D3A1A';
const HONEY = '#A67C52';
const CHAMP = '#D4C4A8';
const IVORY = '#F3EDE3';
const BRONZE = '#8B7355';
const SLATE = '#6B6560';
const CHAR = '#2C2A28';
const METAL = '#B8B2A8';
const GREEN = '#5F7358';
const GREEN_LT = '#8FA084';
const GLASS = '#9BB8C7';
const RUG_A = '#6B3E2E';
const RUG_B = '#C4A882';
const GOLD = '#C9A227';
const GLOW = '#FFE9B0';

type Spec = { file: string; svg: string };

const specs: Spec[] = [
  {
    file: 'cabinet.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="300">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${HONEY}"/><stop offset="100%" stop-color="${WALNUT}"/>
      </linearGradient></defs>
      <rect x="8" y="40" width="424" height="244" rx="8" fill="url(#g)" stroke="${ESPRESSO}" stroke-width="2"/>
      <rect x="8" y="14" width="424" height="28" rx="4" fill="${CHAMP}"/>
      <rect x="24" y="56" width="120" height="212" rx="4" fill="${ESPRESSO}" opacity="0.22"/>
      <rect x="160" y="56" width="120" height="212" rx="4" fill="${ESPRESSO}" opacity="0.22"/>
      <rect x="296" y="56" width="120" height="212" rx="4" fill="${ESPRESSO}" opacity="0.22"/>
      <circle cx="128" cy="162" r="5" fill="${IVORY}"/>
      <circle cx="264" cy="162" r="5" fill="${IVORY}"/>
      <circle cx="400" cy="162" r="5" fill="${IVORY}"/>
    </svg>`,
  },
  {
    file: 'cabinet_side.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="340">
      <defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${HONEY}"/><stop offset="100%" stop-color="${ESPRESSO}"/>
      </linearGradient></defs>
      <polygon points="36,44 275,12 298,295 58,318" fill="url(#s)" stroke="${ESPRESSO}" stroke-width="2"/>
      <polygon points="36,44 275,12 275,48 36,78" fill="${CHAMP}"/>
      <line x1="85" y1="95" x2="105" y2="285" stroke="${IVORY}" stroke-width="1.5" opacity="0.35"/>
      <line x1="155" y1="78" x2="175" y2="275" stroke="${IVORY}" stroke-width="1.5" opacity="0.3"/>
      <line x1="220" y1="58" x2="240" y2="265" stroke="${IVORY}" stroke-width="1.5" opacity="0.25"/>
      <circle cx="100" cy="188" r="4" fill="${IVORY}"/>
      <circle cx="170" cy="172" r="4" fill="${IVORY}"/>
      <circle cx="235" cy="158" r="4" fill="${IVORY}"/>
    </svg>`,
  },
  {
    file: 'upper_cabinet.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="170">
      <rect x="10" y="10" width="380" height="150" rx="6" fill="${WALNUT}" stroke="${ESPRESSO}" stroke-width="2"/>
      <rect x="24" y="24" width="108" height="122" rx="4" fill="${HONEY}" opacity="0.4"/>
      <rect x="146" y="24" width="108" height="122" rx="4" fill="${HONEY}" opacity="0.4"/>
      <rect x="268" y="24" width="108" height="122" rx="4" fill="${HONEY}" opacity="0.4"/>
      <circle cx="118" cy="85" r="4" fill="${IVORY}"/>
      <circle cx="240" cy="85" r="4" fill="${IVORY}"/>
      <circle cx="362" cy="85" r="4" fill="${IVORY}"/>
    </svg>`,
  },
  {
    file: 'tv_unit.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="280">
      <rect x="50" y="10" width="360" height="155" rx="6" fill="${CHAR}"/>
      <rect x="68" y="28" width="324" height="118" rx="3" fill="#1A1816"/>
      <rect x="20" y="180" width="420" height="80" rx="6" fill="${WALNUT}" stroke="${ESPRESSO}" stroke-width="2"/>
      <rect x="40" y="196" width="115" height="48" rx="3" fill="${HONEY}" opacity="0.45"/>
      <rect x="172" y="196" width="115" height="48" rx="3" fill="${HONEY}" opacity="0.45"/>
      <rect x="304" y="196" width="115" height="48" rx="3" fill="${HONEY}" opacity="0.45"/>
    </svg>`,
  },
  {
    file: 'wardrobe.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="270" height="430">
      <rect x="10" y="10" width="250" height="410" rx="8" fill="${WALNUT}" stroke="${ESPRESSO}" stroke-width="2"/>
      <line x1="135" y1="20" x2="135" y2="410" stroke="${BRONZE}" stroke-width="2"/>
      <rect x="24" y="28" width="95" height="374" rx="4" fill="${HONEY}" opacity="0.28"/>
      <rect x="151" y="28" width="95" height="374" rx="4" fill="${HONEY}" opacity="0.28"/>
      <circle cx="108" cy="215" r="5" fill="${IVORY}"/>
      <circle cx="162" cy="215" r="5" fill="${IVORY}"/>
    </svg>`,
  },
  {
    file: 'chimney.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190">
      <rect x="28" y="48" width="244" height="50" rx="6" fill="${CHAR}"/>
      <rect x="48" y="62" width="204" height="22" rx="3" fill="${METAL}"/>
      <rect x="118" y="14" width="64" height="40" rx="5" fill="${SLATE}"/>
      <rect x="105" y="108" width="90" height="64" rx="5" fill="#1A1816"/>
      <rect x="122" y="122" width="56" height="10" rx="2" fill="${GOLD}"/>
    </svg>`,
  },
  {
    file: 'plant.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="250">
      <ellipse cx="100" cy="68" rx="58" ry="54" fill="${GREEN}"/>
      <ellipse cx="58" cy="98" rx="36" ry="42" fill="${GREEN_LT}"/>
      <ellipse cx="142" cy="98" rx="36" ry="42" fill="${GREEN_LT}"/>
      <rect x="80" y="135" width="40" height="88" rx="6" fill="${WALNUT}"/>
      <rect x="62" y="215" width="76" height="22" rx="4" fill="${HONEY}"/>
    </svg>`,
  },
  {
    file: 'fan.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250">
      <circle cx="125" cy="125" r="18" fill="${SLATE}"/>
      <ellipse cx="125" cy="55" rx="26" ry="48" fill="${METAL}" opacity="0.9"/>
      <ellipse cx="125" cy="195" rx="26" ry="48" fill="${METAL}" opacity="0.9"/>
      <ellipse cx="55" cy="125" rx="48" ry="26" fill="${METAL}" opacity="0.9"/>
      <ellipse cx="195" cy="125" rx="48" ry="26" fill="${METAL}" opacity="0.9"/>
      <circle cx="125" cy="125" r="9" fill="${GOLD}"/>
    </svg>`,
  },
  {
    file: 'backsplash.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="140">
      <rect x="10" y="15" width="420" height="110" rx="4" fill="${GLASS}" opacity="0.85"/>
      <rect x="10" y="15" width="420" height="110" rx="4" fill="none" stroke="${IVORY}" stroke-width="2"/>
      <line x1="115" y1="15" x2="115" y2="125" stroke="#fff" stroke-opacity="0.35"/>
      <line x1="220" y1="15" x2="220" y2="125" stroke="#fff" stroke-opacity="0.35"/>
      <line x1="325" y1="15" x2="325" y2="125" stroke="#fff" stroke-opacity="0.35"/>
    </svg>`,
  },
  {
    file: 'lighting.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="220">
      <line x1="90" y1="10" x2="90" y2="68" stroke="${BRONZE}" stroke-width="3"/>
      <path d="M42 68 L138 68 L120 145 L60 145 Z" fill="${CHAMP}" stroke="${BRONZE}" stroke-width="2"/>
      <ellipse cx="90" cy="155" rx="34" ry="12" fill="${GLOW}" opacity="0.95"/>
    </svg>`,
  },
  {
    file: 'glow_light.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">
      <circle cx="110" cy="110" r="90" fill="${GLOW}" opacity="0.35"/>
      <circle cx="110" cy="110" r="50" fill="${GLOW}" opacity="0.55"/>
      <circle cx="110" cy="110" r="18" fill="#FFF8E7"/>
      <circle cx="110" cy="110" r="8" fill="${GOLD}"/>
    </svg>`,
  },
  {
    file: 'under_cabinet_light.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="80">
      <rect x="10" y="25" width="400" height="14" rx="4" fill="${CHAR}"/>
      <rect x="20" y="42" width="380" height="22" rx="6" fill="${GLOW}" opacity="0.85"/>
      <rect x="40" y="48" width="340" height="8" rx="3" fill="#FFF8E7" opacity="0.7"/>
    </svg>`,
  },
  {
    file: 'vanity.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="250">
      <rect x="95" y="16" width="150" height="95" rx="8" fill="${GLASS}" opacity="0.7" stroke="${IVORY}" stroke-width="2"/>
      <rect x="40" y="124" width="260" height="105" rx="8" fill="${WALNUT}" stroke="${ESPRESSO}" stroke-width="2"/>
      <ellipse cx="170" cy="155" rx="52" ry="16" fill="${METAL}"/>
      <rect x="58" y="180" width="95" height="36" rx="3" fill="${HONEY}" opacity="0.45"/>
      <rect x="186" y="180" width="95" height="36" rx="3" fill="${HONEY}" opacity="0.45"/>
    </svg>`,
  },
  {
    file: 'seating.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="190">
      <rect x="22" y="78" width="296" height="72" rx="12" fill="${WALNUT}" stroke="${ESPRESSO}" stroke-width="2"/>
      <rect x="34" y="30" width="272" height="54" rx="10" fill="${CHAMP}"/>
      <rect x="34" y="150" width="30" height="28" fill="${ESPRESSO}"/>
      <rect x="276" y="150" width="30" height="28" fill="${ESPRESSO}"/>
    </svg>`,
  },
  {
    file: 'floor_mat.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="210">
      <ellipse cx="210" cy="105" rx="185" ry="85" fill="${RUG_A}"/>
      <ellipse cx="210" cy="105" rx="145" ry="64" fill="${RUG_B}"/>
      <ellipse cx="210" cy="105" rx="95" ry="40" fill="${WALNUT}"/>
      <ellipse cx="210" cy="105" rx="42" ry="18" fill="${GOLD}" opacity="0.8"/>
    </svg>`,
  },
  {
    file: 'floor_mat_rect.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="190">
      <rect x="20" y="28" width="420" height="134" rx="6" fill="${WALNUT}"/>
      <rect x="40" y="46" width="380" height="98" rx="3" fill="${RUG_B}"/>
      <rect x="60" y="64" width="340" height="62" rx="2" fill="${RUG_A}"/>
      <rect x="100" y="82" width="260" height="26" rx="2" fill="${GOLD}" opacity="0.75"/>
    </svg>`,
  },
  {
    file: 'curtain.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="360">
      <rect x="22" y="22" width="68" height="318" rx="6" fill="${CHAMP}"/>
      <rect x="110" y="22" width="68" height="318" rx="6" fill="${CHAMP}"/>
      <rect x="16" y="12" width="168" height="16" rx="3" fill="${BRONZE}"/>
      <path d="M32 40 Q55 90 32 140 Q55 190 32 240 Q55 290 32 330" fill="none" stroke="${HONEY}" stroke-width="5"/>
      <path d="M122 40 Q145 90 122 140 Q145 190 122 240 Q145 290 122 330" fill="none" stroke="${HONEY}" stroke-width="5"/>
    </svg>`,
  },
  {
    file: 'default.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="190">
      <rect x="20" y="28" width="200" height="134" rx="10" fill="${WALNUT}" stroke="${GOLD}" stroke-width="3"/>
      <text x="120" y="110" text-anchor="middle" fill="${IVORY}" font-size="26" font-family="Arial" font-weight="700">ITEM</text>
    </svg>`,
  },
];

async function run() {
  for (const spec of specs) {
    await sharp(Buffer.from(spec.svg)).png().toFile(path.join(outDir, spec.file));
    console.log('wrote', spec.file);
  }
}

run();

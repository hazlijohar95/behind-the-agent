import { BuyNow } from "@/components/home/buy-now";
import { ArrowForwardIcon } from "@/components/home/icons";

/* ──────────────────────────────────────────────────────────────
 * Brushed-metal surface. This is the exact skewed radial gradient from the
 * Figma "Growth Hacks" spec (node 152:223). A CSS gradient can't reproduce it
 * because the sweep is rotated/skewed via a matrix, so it's drawn as an inline
 * SVG that stretches to fill its rounded parent (preserveAspectRatio="none").
 * ────────────────────────────────────────────────────────────── */
const METAL_STOPS: Array<[number, string, number]> = [
  [0.025, "89,96,106", 0.81],
  [0.0606, "85,91,105", 0.81],
  [0.0879, "131,134,141", 0.815],
  [0.1151, "176,176,176", 0.82],
  [0.145, "136,139,146", 0.73],
  [0.175, "95,101,115", 0.64],
  [0.2029, "132,136,147", 0.75],
  [0.2307, "169,171,179", 0.86],
  [0.3345, "182,185,192", 0.83],
  [0.4371, "140,146,154", 0.795],
  [0.5396, "98,107,116", 0.76],
  [0.6, "114,122,130", 0.765],
  [0.6079, "142,149,157", 0.87],
  [0.6413, "192,196,201", 0.84],
  [0.6747, "242,243,245", 0.81],
  [0.6808, "239,239,241", 0.85],
  [0.7145, "172,176,182", 0.795],
  [0.7314, "139,144,152", 0.7675],
  [0.7482, "105,112,122", 0.74],
  [0.7881, "87,93,107", 0.83],
  [0.8361, "99,106,116", 0.8],
  [0.8611, "135,140,148", 0.795],
  [0.8862, "170,174,180", 0.79],
  [0.9112, "206,207,211", 0.785],
  [0.9362, "241,241,243", 0.78],
  [0.9533, "196,198,203", 0.755],
  [0.9703, "151,154,163", 0.73],
  [0.9883, "177,179,185", 0.79],
];

function MetallicSurface() {
  return (
    <svg
      aria-hidden
      preserveAspectRatio="none"
      viewBox="0 0 91 32"
      className="absolute inset-0 size-full"
    >
      <defs>
        <radialGradient
          id="btcMetal"
          gradientUnits="userSpaceOnUse"
          cx="0"
          cy="0"
          r="10"
          gradientTransform="matrix(48.034 48.034 -150.83 70.138 -234.5 -344.34)"
        >
          {METAL_STOPS.map(([offset, rgb, opacity]) => (
            <stop
              key={offset}
              offset={offset}
              stopColor={`rgb(${rgb})`}
              stopOpacity={opacity}
            />
          ))}
        </radialGradient>
      </defs>
      <rect width="91" height="32" fill="url(#btcMetal)" />
    </svg>
  );
}

/* ── Metallic "Buy now" pill button ────────────────────────── */
export function MetallicButton({ href }: { href: string }) {
  return (
    <BuyNow
      fallbackHref={href}
      className="metallic-pill relative flex h-8 items-center gap-1 overflow-hidden rounded-[80px] px-3.5 text-[13px] font-medium transition-transform hover:scale-[1.02]"
    >
      <MetallicSurface />
      <span className="relative z-10 text-[#121212]/55 [text-shadow:0_0.5px_0_rgba(255,255,255,0.5)]">
        Buy now
      </span>
      <ArrowForwardIcon className="relative z-10 size-3.5 text-[#121212]/55" />
    </BuyNow>
  );
}

/* ── Metallic circular knob (pricing card) ─────────────────── */
export function MetallicKnob({ href }: { href: string }) {
  return (
    <BuyNow
      fallbackHref={href}
      ariaLabel="Buy now"
      className="metallic-knob relative grid size-[100px] shrink-0 place-items-center rounded-[999px] transition-transform hover:scale-[1.03]"
    >
      <span className="absolute inset-0 rounded-[999px] bg-[url('/metallic/knob-disc.png')] bg-cover bg-center dark:bg-[url('/metallic/knob-disc-dark.png')]" />
      <span className="pointer-events-none absolute inset-0 rounded-[999px] bg-[url('/metallic/knob-top.png')] bg-cover bg-center opacity-70" />
      <span className="relative z-10 text-[13px] font-medium text-[#121212]/60 [text-shadow:0_0.5px_0_rgba(255,255,255,0.6)]">
        Buy now
      </span>
    </BuyNow>
  );
}

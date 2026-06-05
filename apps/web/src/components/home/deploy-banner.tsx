import { useLocation } from "@tanstack/react-router";
import { ArrowForwardIcon } from "@/components/home/icons";

// Fork-your-own link. This build deploys to Cloudflare Workers (not Vercel),
// so the banner points at the source repo + its README for setup steps.
const REPO_URL = "https://github.com/hazlijohar95/behind-the-agent";
const DEPLOY_URL = REPO_URL;

// Enough repeats that a single half always exceeds the widest viewport, so the
// -50% loop never reveals a gap.
const HALF = Array.from({ length: 24 }, () => "Deploy your own");

function MarqueeHalf() {
  return (
    <div className="flex shrink-0 items-center">
      {HALF.map((phrase, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: static, fixed-length ticker
          key={i}
          className="flex items-center gap-2.5 px-5"
        >
          <span className="text-[12px] font-medium uppercase tracking-widest whitespace-nowrap">
            {phrase}
          </span>
          <ArrowForwardIcon className="size-3 opacity-50" />
        </span>
      ))}
    </div>
  );
}

export function DeployBanner() {
  const pathname = useLocation().pathname;
  // Keep the auth and admin pages clean — no marquee banner.
  if (
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/signup") ||
    pathname?.startsWith("/admin")
  ) {
    return null;
  }

  return (
    <a
      href={DEPLOY_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Deploy your own copy — view the source and setup guide on GitHub"
      className="group relative z-40 block w-full overflow-hidden border-b border-btc-border bg-btc-surface py-2.5 text-btc-muted transition-colors hover:text-btc-text"
    >
      <div className="marquee-track" aria-hidden>
        <MarqueeHalf />
        <MarqueeHalf />
      </div>
    </a>
  );
}

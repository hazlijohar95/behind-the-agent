import { Link } from "@tanstack/react-router";
import { SearchIcon } from "@/components/home/icons";
import { CONTAINER } from "@/components/home/layout";
import { MetallicButton } from "@/components/home/metallic";
import { MobileMenu } from "@/components/home/mobile-menu";

/* ── Brand wordmark ────────────────────────────────────────── */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`text-[24px] font-bold uppercase leading-none tracking-[-0.02em] text-btc-text ${className ?? ""}`}
    >
      Behind the agents
    </Link>
  );
}

/* ── The floating nav pill (shared by hero + watch header) ──── */
export function PillNav() {
  return (
    <div className="hidden items-center gap-5 rounded-[140px] border border-btc-border bg-btc-surface/80 py-3 pl-8 pr-4 backdrop-blur-md sm:flex">
      <Link
        to="/search"
        aria-label="Search videos"
        className="text-btc-text/90 transition-colors hover:text-btc-text"
      >
        <SearchIcon className="size-4" />
      </Link>
      <Link
        to="/live"
        className="flex items-center gap-2 text-[14px] font-medium text-btc-text transition-opacity hover:opacity-80"
      >
        <span className="size-1.5 rounded-[999px] bg-btc-error shadow-[0_0_8px_2px_rgba(236,39,41,0.6)]" />
        Live
      </Link>
      <Link
        to="/pricing"
        className="text-[14px] font-medium text-btc-text/90 transition-colors hover:text-btc-text"
      >
        Pricing
      </Link>
      <Link
        to="/login"
        className="border-r border-btc-border pr-5 text-[14px] font-medium text-btc-text/90 transition-colors hover:text-btc-text"
      >
        Sign in
      </Link>
      <MetallicButton href="/login" />
    </div>
  );
}

/* ── Hero nav (absolute overlay; mirrors BrandHeader so the header sits in
 *    the same place on every page) ─────────────────────────────── */
export function LandingNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 pt-6 sm:pt-10">
      <div className={`flex items-center justify-end gap-4 ${CONTAINER}`}>
        <PillNav />
        <MobileMenu />
      </div>
    </header>
  );
}

/* ── Page header (brand left, pill right) ──────────────────── */
export function BrandHeader() {
  return (
    <header className="relative z-30 pt-6 sm:pt-10">
      <div className={`flex items-center justify-between gap-4 ${CONTAINER}`}>
        <BrandWordmark />
        <PillNav />
        <MobileMenu />
      </div>
    </header>
  );
}

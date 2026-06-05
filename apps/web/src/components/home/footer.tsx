import { Link } from "@tanstack/react-router";
import { CurrentYear } from "@/components/home/current-year";
import { CONTAINER } from "@/components/home/layout";
import { ThemeToggle } from "@/components/home/theme-toggle";

function XLink({ handle }: { handle: string }) {
  return (
    <a
      href={`https://x.com/${handle}`}
      target="_blank"
      rel="noreferrer"
      className="text-btc-text underline-offset-4 transition-colors hover:underline"
    >
      @{handle}
    </a>
  );
}

export function LandingFooter({ siteName }: { siteName: string }) {
  return (
    <footer className="border-t border-btc-border py-12">
      <div className={CONTAINER}>
        <div className="flex flex-col gap-8 border-b border-btc-border pb-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md space-y-3">
            <p className="text-[16px] font-medium text-btc-text">{siteName}</p>
            <p className="text-[14px] leading-normal text-btc-muted">
              An open-source, single-publisher video platform for selling your
              own videos and courses. Self-hosted and fully yours — built on
              TanStack Start and Supabase, running on Cloudflare (Workers +
              Stream), with subscriptions and one-time purchases via Polar.
              Deploy your own in minutes.
            </p>
          </div>
          <p className="text-[14px] leading-normal text-btc-muted">
            Made by <XLink handle="pontusab" /> and{" "}
            <XLink handle="viktorhofte" />
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-8">
          <p className="font-mono text-[13px] text-btc-faint">
            © <CurrentYear /> {siteName}
          </p>
          <div className="flex items-center gap-6 text-[13px] text-btc-muted">
            <Link
              to="/pricing"
              className="transition-colors hover:text-btc-text"
            >
              Pricing
            </Link>
            <Link to="/about" className="transition-colors hover:text-btc-text">
              About
            </Link>
            <Link to="/terms" className="transition-colors hover:text-btc-text">
              Terms
            </Link>
            <Link
              to="/privacy"
              className="transition-colors hover:text-btc-text"
            >
              Privacy
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}

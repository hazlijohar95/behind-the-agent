import { LandingNav } from "@/components/home/brand-header";
import { CONTAINER } from "@/components/home/layout";
import { MetallicKnob } from "@/components/home/metallic";

export function LandingHero({ tagline }: { tagline: string }) {
  return (
    <section className="relative overflow-hidden border-b border-btc-border pb-12 pt-28 sm:pb-16">
      <div className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[720px]" />
      <LandingNav />

      <div className={`relative ${CONTAINER}`}>
        <h1 className="hero-title text-left font-bold uppercase leading-[0.86] tracking-[-0.02em] text-btc-text">
          Behind the agents
        </h1>

        <p className="mt-3.5 max-w-[655px] text-[18px] leading-[1.3] text-btc-text/90">
          {tagline}
        </p>

        <div className="mt-16 flex flex-wrap items-end justify-between gap-x-8 gap-y-10">
          <div
            id="pricing"
            className="flex h-[120px] scroll-mt-24 items-center gap-8 rounded-[120px] border border-btc-border bg-btc-surface pl-[10px] pr-14"
          >
            <MetallicKnob href="/login" />
            <div className="flex flex-col gap-2">
              <div className="flex items-end gap-2 border-b border-btc-border pb-2">
                <span className="font-mono text-[20px] font-medium leading-none text-btc-text">
                  $149
                </span>
                <span className="font-mono text-[13px] leading-none text-btc-faint">
                  One time payment
                </span>
              </div>
              <div className="text-[14px] leading-[1.3] text-btc-text">
                <p>Watch everything.</p>
                <p>Forever.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

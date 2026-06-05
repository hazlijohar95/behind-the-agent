// Barrel for the landing/marketing building blocks. Implementations live in
// sibling files (brand-header, hero, footer, metallic); kept here so existing
// `@/components/home/landing` imports keep working.
export {
  BrandHeader,
  BrandWordmark,
  LandingNav,
  PillNav,
} from "./brand-header";
export { LandingFooter } from "./footer";
export { LandingHero } from "./hero";
export { MetallicButton, MetallicKnob } from "./metallic";

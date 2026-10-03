import stripe from "../../assets/integrations/stripe.svg";
import stripeDark from "../../assets/integrations/stripe-dark.svg";
import tap from "../../assets/integrations/tap.svg";
import aslan from "../../assets/integrations/aslan.svg";
import chari from "../../assets/integrations/chari.svg";
import chariDark from "../../assets/integrations/chari-dark.svg";
import "./integration-logo.css";

/** Official source assets, bundled locally. Preserve shapes, colors and aspect ratios. */
export const INTEGRATION_BRANDS = {
  stripe: {
    name: "Stripe",
    light: stripe,
    dark: stripeDark,
    width: 72,
    height: 30,
    source: "https://stripe.com/newsroom/information",
    assetSource:
      "https://assets.stripeassets.com/fzn2n1nzq965/7q0dJGs6fRS1LRmMpChoAF/87def4edfbb7fd5aef4ab9baf904b2db/Stripe_logo_kit.zip",
  },
  tap: {
    name: "Tap Payments",
    light: tap,
    dark: tap,
    width: 64,
    height: 27,
    source: "https://developers.tap.company/",
    assetSource: "https://files.readme.io/cc73b8e-tap-logo-white.svg",
  },
  aslan: {
    name: "Aslan",
    light: aslan,
    dark: aslan,
    width: 40,
    height: 40,
    source: "https://aslan.ma/fr/marketplace",
    assetSource: "https://aslan.ma/logo.svg",
  },
  chari: {
    name: "Chari Money",
    light: chari,
    dark: chariDark,
    width: 116,
    height: 23,
    source: "https://www.baas.ma/en/partners",
    assetSource: "https://www.baas.ma/images/logo.svg",
  },
} as const;
export type IntegrationBrand = keyof typeof INTEGRATION_BRANDS;

export default function IntegrationLogo({
  provider,
}: {
  provider: IntegrationBrand;
}) {
  const brand = INTEGRATION_BRANDS[provider];
  return (
    <span
      className={`baitly-integration-logo baitly-integration-logo--${provider}`}
      role="img"
      aria-label={brand.name}
    >
      <img
        className="baitly-integration-logo-light"
        src={brand.light}
        width={brand.width}
        height={brand.height}
        alt=""
        aria-hidden="true"
        decoding="async"
      />
      {brand.dark !== brand.light && (
        <img
          className="baitly-integration-logo-dark"
          src={brand.dark}
          width={brand.width}
          height={brand.height}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
      )}
    </span>
  );
}

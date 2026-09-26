import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  CameraIcon,
  ClipboardListIcon,
  CircleCheckIcon,
} from "lucide-react";
import Reveal from "../components/Reveal";
import AnimatedOpsMockup from "../components/AnimatedOpsMockup";
import { PROVIDER_CATEGORIES } from "../data/catalog";
import { cn } from "../../src/utils/cn";
import { useSiteLanguage } from "../lib/siteLanguage";
import { PROVIDERS_MESSAGES } from "../lib/messages/providers";
import "../baitly-readiness.css";

const MISSION_ICONS = [ClipboardListIcon, CameraIcon, CircleCheckIcon];

export default function ProvidersPage() {
  const { language } = useSiteLanguage();
  const m = PROVIDERS_MESSAGES[language];
  return (
    <div className="baitly-provider-page">
      <section className="baitly-provider-hero site-shell">
        <div>
          <p className="baitly-readiness-eyebrow">{m.eyebrow}</p>
          <h1>
            {m.titleBefore}
            <span>{m.titleAccent}</span>
          </h1>
          <p className="baitly-readiness-lead">{m.intro}</p>
          <div className="baitly-readiness-actions">
            <Link
              className="baitly-button"
              to={`/prestataires/inscription?lang=${language}`}
            >
              {m.ctaJoin}
              <ArrowRightIcon size={18} aria-hidden="true" />
            </Link>
            <a className="baitly-text-link" href="#prestataires-metiers">
              {m.ctaExplore}
              <ArrowRightIcon size={17} aria-hidden="true" />
            </a>
          </div>
          <p className="baitly-readiness-note">{m.openingNote}</p>
        </div>
        <figure className="baitly-provider-preview">
          <img
            src={PROVIDER_CATEGORIES[0].photo}
            alt=""
            width={720}
            height={540}
          />
          <figcaption>
            <span>{m.previewLabel}</span>
            <h2>{m.previewTitle}</h2>
            <p>{m.previewCopy}</p>
            <ol>
              {m.previewSteps.map((step, index) => {
                const Icon = MISSION_ICONS[index];
                return (
                  <li key={step}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{step}</span>
                  </li>
                );
              })}
            </ol>
          </figcaption>
        </figure>
      </section>
      <section className="site-shell py-16" id="prestataires-metiers">
        <div className="baitly-proof-heading">
          <h2>{m.categoriesTitle}</h2>
          <p>{m.categoriesCopy}</p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {m.categories.map((category, index) => {
            const { photo, color } = PROVIDER_CATEGORIES[index];
            /* Deux ancres en diagonale — la premiere famille et la derniere —
               s'etendent sur deux colonnes : huit cellules, deux rangees
               pleines, et une grille qui ne se repete pas a l'identique. */
            const wide =
              index === 0 || index === PROVIDER_CATEGORIES.length - 1;
            return (
              <Reveal
                key={category.name}
                delay={((index % 4) + 1) as 1 | 2 | 3 | 4}
                className={cn("flex", wide && "xl:col-span-2")}
              >
                <article
                  className={cn(
                    "partner-card service-tile group flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card",
                    wide && "xl:flex-row",
                  )}
                  style={{ "--brand": color } as CSSProperties}
                >
                  <div
                    className={cn(
                      "relative shrink-0 overflow-hidden",
                      wide
                        ? "aspect-[16/9] xl:aspect-auto xl:w-[44%]"
                        : "aspect-[16/9]",
                    )}
                  >
                    <img
                      src={photo}
                      alt=""
                      width="1000"
                      height="560"
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                    {/* Le titre vit sur la photo pour les tuiles compactes — c'est
                      l'image qui porte l'identite du metier. Les deux ancres le
                      gardent dans leur colonne de texte : leur photo est a cote,
                      pas au-dessus. */}
                    {!wide && (
                      <h3 className="service-tile-title absolute inset-x-0 bottom-0 px-4 pt-10 pb-3.5 text-base font-semibold text-white">
                        {category.name}
                      </h3>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    {wide && (
                      <h3 className="text-lg font-semibold">{category.name}</h3>
                    )}
                    <p
                      className={cn(
                        "text-sm text-muted-foreground",
                        wide && "mt-1.5",
                      )}
                    >
                      {category.copy}
                    </p>
                    {/* Pastilles plutot que liste a coches : le fond porte la
                      teinte du domaine, le texte garde l'encre sourde — une
                      teinte vive en texte plafonne a 2,2:1 de contraste. */}
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {category.examples.map((example) => (
                        <li
                          key={example}
                          className="rounded-full px-2.5 py-1 text-xs text-muted-foreground"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${color} 15%, var(--bui-card))`,
                          }}
                        >
                          {example}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>
      <section className="baitly-provider-process" id="prestataires-parcours">
        <div className="site-shell">
          <p className="baitly-readiness-eyebrow">{m.howBadge}</p>
          <h2>{m.howTitle}</h2>
          <ol>
            {m.steps.map((step, index) => (
              <li key={step.title}>
                <span className="baitly-provider-step-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="baitly-provider-demo site-shell">
        <div>
          <p className="baitly-readiness-eyebrow">{m.appEyebrow}</p>
          <h2>{m.appTitle}</h2>
          <p className="baitly-readiness-lead">{m.appCopy}</p>
          <ul>
            {m.appPoints.map((point, index) => {
              const Icon = MISSION_ICONS[index];
              return (
                <li key={point}>
                  <Icon size={19} aria-hidden="true" />
                  {point}
                </li>
              );
            })}
          </ul>
          <Link
            className="baitly-text-link"
            to={`/produit/operations-menage?lang=${language}`}
          >
            {m.appAction}
            <ArrowRightIcon size={17} aria-hidden="true" />
          </Link>
        </div>
        <div>
          <AnimatedOpsMockup />
          <p className="baitly-readiness-note">{m.sampleNotice}</p>
        </div>
      </section>
      <section className="site-shell baitly-provider-closing">
        <div className="baitly-compare-next">
          <h2>{m.finalTitle}</h2>
          <p>{m.finalCopy}</p>
          <div className="baitly-readiness-actions">
            <Link
              className="baitly-button"
              to={`/prestataires/inscription?lang=${language}`}
            >
              {m.ctaJoin}
              <ArrowRightIcon size={18} aria-hidden="true" />
            </Link>
            <a className="baitly-text-link" href="#prestataires-parcours">
              {m.finalQuestion}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

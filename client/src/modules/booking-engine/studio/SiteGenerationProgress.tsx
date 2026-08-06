import { useEffect, useState } from 'react';
import { cn } from '../../../utils/cn';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FileSearch, LayoutTemplate, PenLine, Palette, Check, type LucideIcon } from 'lucide-react';

/**
 * Vue « construction en cours » de la modale de génération de site IA. La génération est UN appel LLM
 * (~1-2 min, sans flux de progression réel) : on affiche donc une progression ESTIMÉE — étapes qui
 * avancent sur minuterie (calées sur les phases réelles du service : analyse → structure → rédaction →
 * thème), barre indéterminée et astuces rotatives — pour faire patienter sans promettre un pourcentage
 * faux. 100% animations (framer-motion), `prefers-reduced-motion` respecté (fallback statique).
 */

/** Avance estimée entre étapes (ms). La dernière étape reste active jusqu'à la fin de l'appel. */
const STEP_MS = 18_000;
/** Rotation des astuces (ms). */
const TIP_MS = 4_500;

export default function SiteGenerationProgress({ brandLabel }: { brandLabel?: string | null }) {
  const { t } = useTranslation();
  const k = (key: string, fb: string) => t(`bookingEngine.studio.ai.generate.progress.${key}`, fb);
  const reduce = !!useReducedMotion();
  const [step, setStep] = useState(0);
  const [tip, setTip] = useState(0);

  const steps: { icon: LucideIcon; label: string }[] = [
    { icon: FileSearch, label: k('step1', 'Analyse du brief') },
    { icon: LayoutTemplate, label: k('step2', 'Structure des pages') },
    { icon: PenLine, label: k('step3', 'Rédaction du contenu') },
    { icon: Palette, label: k('step4', 'Application du thème') },
  ];
  const tips = [
    k('tip1', "L'IA rédige des textes uniques pour chaque page."),
    k('tip2', 'Cela prend généralement une à deux minutes.'),
    k('tip3', 'Vos pages seront créées en brouillon, à relire avant publication.'),
    k('tip4', 'Le thème — couleurs et typographie — est dérivé de votre brief.'),
  ];

  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), STEP_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const id = setInterval(() => setTip((x) => (x + 1) % tips.length), TIP_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center text-center gap-3.5 py-3">
      <PageAssemblyMotif reduce={reduce} />

      <div>
        <div className="font-[family-name:var(--font-display)] text-base font-bold text-balance text-foreground">
          {k('title', 'Construction de votre site…')}
        </div>
        {brandLabel ? (
          <div className="text-xs text-muted-foreground mt-[1.5px] max-w-[360px] leading-[1.45] text-balance">
            {brandLabel}
          </div>
        ) : null}
      </div>

      <IndeterminateBar reduce={reduce} />

      <div className="flex flex-col gap-1.5 w-full max-w-[300px] text-start">
        {steps.map((s, i) => {
          const done = i < step;
          const active = i === step;
          const Icon = s.icon;
          return (
            <div className={cn('flex items-center gap-[7.5px] transition-opacity duration-300 ease-out-quart motion-reduce:transition-none', done || active ? 'opacity-100' : 'opacity-40')} key={s.label}>
              <div className={cn('w-[26px] h-[26px] rounded-full grid place-items-center shrink-0 transition-colors duration-300 ease-out-quart motion-reduce:transition-none', done || active ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground')}>
                {done ? (
                  <Check size={14} strokeWidth={2.6} />
                ) : active && !reduce ? (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
                    style={{ display: 'grid', placeItems: 'center' }}
                  >
                    <Icon size={14} strokeWidth={2} />
                  </motion.span>
                ) : (
                  <Icon size={14} strokeWidth={2} />
                )}
              </div>
              <div className={cn('text-xs', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="min-h-[32px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={tip}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="text-2xs text-muted-foreground max-w-[360px] leading-[1.5]"
          >
            {tips[tip]}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="text-2xs text-muted-foreground opacity-70">
        {k('doNotClose', 'Ne fermez pas cette fenêtre.')}
      </div>
    </div>
  );
}

/** Mini-wireframe d'une page qui « s'assemble » : vague de shimmer sur les blocs (nav, hero, lignes, cartes). */
function PageAssemblyMotif({ reduce }: { reduce: boolean }) {
  const block = (delay: number, style: React.CSSProperties) => (
    <motion.div
      animate={reduce ? { opacity: 1 } : { opacity: [0.35, 1, 0.35] }}
      transition={reduce ? undefined : { duration: 1.8, repeat: Infinity, delay, ease: 'easeInOut' }}
      style={{ borderRadius: 4, ...style }}
    />
  );
  return (
    <div className="w-[132px] p-[7.5px] rounded-xl bg-card border border-solid border-border shadow-lg flex flex-col gap-[4.5px]">
      {block(0, { height: 8, width: '45%', background: 'var(--bui-muted-foreground)' })}
      {block(0.2, { height: 30, width: '100%', background: 'var(--bui-primary)' })}
      {block(0.4, { height: 6, width: '80%', background: 'var(--bui-border)' })}
      {block(0.5, { height: 6, width: '60%', background: 'var(--bui-border)' })}
      <div className="flex gap-0.5 mt-0.5">
        {[0, 1, 2].map((i) => (
          <div className="flex-1 flex" key={i}>
            {block(0.6 + i * 0.12, { height: 22, width: '100%', background: 'var(--bui-field)', border: '1px solid var(--bui-border)' })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Barre de progression INDÉTERMINÉE : un balayage en boucle (pas de pourcentage faux). */
function IndeterminateBar({ reduce }: { reduce: boolean }) {
  return (
    <div className="w-full max-w-[300px] h-[5px] rounded-full bg-muted overflow-hidden relative">
      {reduce ? (
        <div className="absolute inset-y-0 start-0 w-[45%] rounded-full bg-primary opacity-60" />
      ) : (
        <motion.div
          animate={{ x: ['-45%', '260%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-y-0 w-[40%] rounded-full bg-primary"
        />
      )}
    </div>
  );
}

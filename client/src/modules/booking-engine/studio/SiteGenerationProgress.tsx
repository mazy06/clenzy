import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
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
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2.5, py: 2 }}>
      <PageAssemblyMotif reduce={reduce} />

      <Box>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--ink)' }}>
          {k('title', 'Construction de votre site…')}
        </Box>
        {brandLabel ? (
          <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', mt: 0.25, maxWidth: 360, lineHeight: 1.45, textWrap: 'balance' }}>
            {brandLabel}
          </Box>
        ) : null}
      </Box>

      <IndeterminateBar reduce={reduce} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: 300, textAlign: 'left' }}>
        {steps.map((s, i) => {
          const done = i < step;
          const active = i === step;
          const Icon = s.icon;
          return (
            <Box
              key={i}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.25, opacity: done || active ? 1 : 0.4, transition: 'opacity .3s var(--ease-out)' }}
            >
              <Box
                sx={{
                  width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
                  bgcolor: done || active ? 'var(--accent-soft)' : 'var(--line)',
                  color: done || active ? 'var(--accent)' : 'var(--muted)',
                  transition: 'background .3s var(--ease-out), color .3s var(--ease-out)',
                }}
              >
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
              </Box>
              <Box sx={{ fontSize: 'var(--text-sm)', color: active ? 'var(--ink)' : 'var(--body)', fontWeight: active ? 'var(--fw-semibold)' : undefined }}>
                {s.label}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tip}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', maxWidth: 360, lineHeight: 1.5 }}
          >
            {tips[tip]}
          </motion.div>
        </AnimatePresence>
      </Box>

      <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', opacity: 0.7 }}>
        {k('doNotClose', 'Ne fermez pas cette fenêtre.')}
      </Box>
    </Box>
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
    <Box
      sx={{
        width: 132, p: 1.25, borderRadius: 'var(--radius-lg)', bgcolor: 'var(--card)',
        border: '1px solid var(--line)', boxShadow: '0 12px 32px -20px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', gap: 0.75,
      }}
    >
      {block(0, { height: 8, width: '45%', background: 'var(--muted)' })}
      {block(0.2, { height: 30, width: '100%', background: 'var(--accent)' })}
      {block(0.4, { height: 6, width: '80%', background: 'var(--line)' })}
      {block(0.5, { height: 6, width: '60%', background: 'var(--line)' })}
      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ flex: 1, display: 'flex' }}>
            {block(0.6 + i * 0.12, { height: 22, width: '100%', background: 'var(--field)', border: '1px solid var(--line)' })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Barre de progression INDÉTERMINÉE : un balayage en boucle (pas de pourcentage faux). */
function IndeterminateBar({ reduce }: { reduce: boolean }) {
  return (
    <Box sx={{ width: '100%', maxWidth: 300, height: 5, borderRadius: 999, bgcolor: 'var(--line)', overflow: 'hidden', position: 'relative' }}>
      {reduce ? (
        <Box sx={{ position: 'absolute', insetBlock: 0, left: 0, width: '45%', borderRadius: 999, bgcolor: 'var(--accent)', opacity: 0.6 }} />
      ) : (
        <motion.div
          animate={{ x: ['-45%', '260%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: 999, background: 'var(--accent)' }}
        />
      )}
    </Box>
  );
}

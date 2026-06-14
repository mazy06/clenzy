import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box } from '@mui/material';
import {
  LayoutTemplate,
  FileText,
  CalendarCheck,
  TrendingUp,
  Share2,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import StudioShell, { type Breakpoint, type StudioSection } from './StudioShell';
import StudioCommandPalette, { type StudioCommand } from './StudioCommandPalette';
import DesignBuilder from './builder/DesignBuilder';
import BookingSettingsPanel from './settings/BookingSettingsPanel';
import ContentAiPanel from './settings/ContentAiPanel';
import DistributionPanel from './settings/DistributionPanel';
import { useStudioConfig } from './useStudioConfig';

/**
 * Baitly Studio — page hôte (F0) : assemble StudioShell + palette ⌘K + les 5 sections.
 * Le contenu réel de chaque section arrive aux phases F1-F5 ; F0 pose la coquille navigable.
 */

const SECTIONS: (StudioSection & { blurb: string })[] = [
  { key: 'design', label: 'Design', icon: LayoutTemplate, blurb: 'Composez votre page par blocs et choisissez le thème.' },
  { key: 'content', label: 'Contenu', icon: FileText, blurb: 'Propriétés affichées, pages, blog et contenu assisté par IA.' },
  { key: 'booking', label: 'Réservation', icon: CalendarCheck, blurb: 'Devise, paiement, frais, fenêtre de réservation et politique.' },
  { key: 'growth', label: 'Croissance', icon: TrendingUp, blurb: 'SEO, capture de leads, relance de panier et analytics.' },
  { key: 'distribution', label: 'Diffusion', icon: Share2, blurb: 'Site hébergé, widget intégrable et accès SDK / API.' },
];

export default function StudioPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const cfg = useStudioConfig(id ? Number(id) : undefined);
  const projectName = cfg.config?.name ?? 'Mon booking engine';
  const [activeSection, setActiveSection] = useState('design');
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');
  const [previewLang, setPreviewLang] = useState('fr');
  const [previewCurrency, setPreviewCurrency] = useState('EUR');
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Raccourci ⌘K / Ctrl+K global.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commands = useMemo<StudioCommand[]>(() => {
    const navCmds: StudioCommand[] = SECTIONS.map((s) => ({
      id: `goto-${s.key}`,
      label: `Aller à ${s.label}`,
      group: 'Sections',
      keywords: s.key,
      icon: s.icon,
      run: () => setActiveSection(s.key),
    }));
    const actions: StudioCommand[] = [
      { id: 'publish', label: 'Publier le booking engine', group: 'Actions', icon: Rocket, run: () => {/* F5 */} },
    ];
    return [...navCmds, ...actions];
  }, []);

  const active = SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0];

  return (
    <>
      <StudioShell
        projectName={projectName}
        sections={SECTIONS}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        previewLang={previewLang}
        onPreviewLangChange={setPreviewLang}
        previewCurrency={previewCurrency}
        onPreviewCurrencyChange={setPreviewCurrency}
        breakpoint={breakpoint}
        onBreakpointChange={setBreakpoint}
        onOpenCommand={() => setPaletteOpen(true)}
        onBack={() => navigate('/booking-engine')}
      >
        {active.key === 'design' && <DesignBuilder breakpoint={breakpoint} cfg={cfg} />}
        {active.key === 'content' && <ContentAiPanel />}
        {active.key === 'booking' && (
          <BookingSettingsPanel
            config={cfg.config}
            loading={cfg.loading}
            error={cfg.error}
            saving={cfg.saving}
            dirty={cfg.dirty}
            patch={cfg.patch}
            onSave={() => { cfg.save().catch(() => { /* erreur déjà exposée par le hook */ }); }}
          />
        )}
        {active.key === 'distribution' && <DistributionPanel cfg={cfg} />}
        {active.key === 'growth' && <SectionPlaceholder section={active} />}
      </StudioShell>

      <StudioCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </>
  );
}

function SectionPlaceholder({ section }: { section: StudioSection & { blurb: string } }) {
  const Icon: LucideIcon = section.icon;
  return (
    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
      <Box sx={{ textAlign: 'center', maxWidth: 360 }}>
        <Box
          sx={{
            width: 56, height: 56, mx: 'auto', mb: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-lg)', bgcolor: 'var(--accent-soft)', color: 'var(--accent)',
          }}
        >
          <Icon size={26} strokeWidth={1.85} />
        </Box>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)', mb: 0.5 }}>
          {section.label}
        </Box>
        <Box sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)', lineHeight: 1.5 }}>
          {section.blurb}
        </Box>
      </Box>
    </Box>
  );
}

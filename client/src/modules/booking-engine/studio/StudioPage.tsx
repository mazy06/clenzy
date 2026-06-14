import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box } from '@mui/material';
import { bookingEngineApi } from '../../../services/api/bookingEngineApi';
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

/**
 * Baitly Studio — page hôte (F0) : assemble StudioShell + palette ⌘K + les 5 sections.
 * Le contenu réel de chaque section arrive aux phases F1-F5 ; F0 pose la coquille navigable.
 */

const SECTIONS: (StudioSection & { blurb: string })[] = [
  { key: 'design', label: 'Design', icon: LayoutTemplate, blurb: 'Builder par blocs, thème & templates (F2).' },
  { key: 'content', label: 'Contenu', icon: FileText, blurb: 'Propriétés affichées, blog, pages, IA contenu (F4).' },
  { key: 'booking', label: 'Réservation', icon: CalendarCheck, blurb: 'Devises, annulation, caution, panier, upsells (F3).' },
  { key: 'growth', label: 'Croissance', icon: TrendingUp, blurb: 'SEO, leads & email, abandoned-cart, analytics (F3).' },
  { key: 'distribution', label: 'Diffusion', icon: Share2, blurb: 'Site hébergé · widget · SDK/API (F5).' },
];

export default function StudioPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [projectName, setProjectName] = useState('Mon booking engine');
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

  // Nom réel du projet dans la topbar (best-effort).
  useEffect(() => {
    if (!id) return;
    let alive = true;
    bookingEngineApi.getConfigById(Number(id))
      .then((c) => { if (alive && c?.name) setProjectName(c.name); })
      .catch(() => { /* best-effort : on garde le nom par défaut */ });
    return () => { alive = false; };
  }, [id]);

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
        {active.key === 'design'
          ? <DesignBuilder breakpoint={breakpoint} />
          : <SectionPlaceholder section={active} />}
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

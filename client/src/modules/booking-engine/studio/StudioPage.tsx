import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LayoutTemplate,
  Palette,
  FileText,
  CalendarCheck,
  TrendingUp,
  Share2,
  Wand2,
  Newspaper,
  Globe,
  Filter,
} from 'lucide-react';
import StudioShell, { type Breakpoint, type StudioSection } from './StudioShell';
import {
  useCommandCenter,
  useScreenCommands,
  type CommandDescriptor,
} from '../../../components/command-center';
// Hard cutover (G0) : l'éditeur de PAGE du Studio est GrapesJS. L'ancien builder de blocs maison a
// été retiré ; seuls subsistent du dossier `builder/` les panneaux réutilisés (ThemeInspector, etc.).
import GrapesStudio from './grapes/GrapesStudio';
import SiteEmbedPreview from './grapes/SiteEmbedPreview';
import ThemeInspector from './builder/ThemeInspector';
import DesignAnalysisModal from './DesignAnalysisModal';
import BookingSettingsPanel from './settings/BookingSettingsPanel';
import ContentSection from './settings/ContentSection';
import BlogPanel from './builder/BlogPanel';
import DistributionPanel from './settings/DistributionPanel';
import GrowthSettingsPanel from './settings/GrowthSettingsPanel';
import FunnelAnalyticsPanel from './settings/FunnelAnalyticsPanel';
import { useStudioConfig } from './useStudioConfig';
import { type StudioMode } from './studioMode';
import { sitesApi } from '../../../services/api/sitesApi';
import type { BookingEngineConfig, DesignTokens } from '../../../services/api/bookingEngineApi';

/**
 * Baitly Studio — page hôte : assemble StudioShell + les sections.
 * Chaque section rend son panneau (Design builder, Contenu IA, Réservation, Croissance, Diffusion).
 *
 * <p>Le ⌘K du Studio n'est PLUS une palette à lui : l'éditeur publie ses
 * sections et ses actions dans le centre de commande de l'application
 * (`useScreenCommands`), qui les range en tête sous « Sur cet écran ». Une
 * seule palette, un seul raccourci — deux écouteurs ⌘K concurrents ouvraient
 * deux fenêtres l'une sur l'autre.</p>
 */

const SECTIONS: StudioSection[] = [
  { key: 'design', label: 'Design', icon: LayoutTemplate },
  { key: 'embed', label: 'Aperçu site', icon: Globe },
  { key: 'theme', label: 'Thème', icon: Palette },
  { key: 'content', label: 'Contenu', icon: FileText },
  { key: 'blog', label: 'Blog', icon: Newspaper },
  { key: 'booking', label: 'Réservation', icon: CalendarCheck },
  { key: 'growth', label: 'Croissance', icon: TrendingUp },
  { key: 'funnel', label: 'Funnel', icon: Filter },
  { key: 'distribution', label: 'Diffusion', icon: Share2 },
];

export default function StudioPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const cfg = useStudioConfig(id ? Number(id) : undefined);
  const projectName = cfg.config?.name ?? 'Mon booking engine';
  const [activeSection, setActiveSection] = useState('design');
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');
  const [previewCurrency, setPreviewCurrency] = useState('EUR');
  const [designAnalysisOpen, setDesignAnalysisOpen] = useState(false);
  const { openCenter } = useCommandCenter();

  // Mode d'édition : « Guidé » a été retiré → l'éditeur est TOUJOURS en avancé. Le bouton « Assistant »
  // (topbar) bascule vers le studio immersif (aperçu live + chat) au lieu d'un mode simplifié.
  const studioMode: StudioMode = 'advanced';

  // Bascule vers le studio IMMERSIF : résout le site lié à cette config (find-or-create) puis y navigue.
  const openAssistant = async () => {
    const configId = cfg.config?.id;
    if (!configId) return;
    try {
      const site = await sitesApi.ensureForConfig(configId);
      navigate(`/booking-engine/sites/${site.id}`);
    } catch { /* résolution du site impossible : on reste dans l'éditeur */ }
  };

  // Applique le design extrait (analyse IA d'un site) au booking engine courant : tokens (widget +
  // blocs), CSS généré, couleur/police miroir. Reflété en direct (canvas + widget) ; persisté au save.
  const applyAnalyzedDesign = (tokens: DesignTokens, generatedCss: string) => {
    const changes: Partial<BookingEngineConfig> = { designTokens: JSON.stringify(tokens) };
    if (generatedCss) changes.customCss = generatedCss;
    if (tokens.primaryColor) changes.primaryColor = tokens.primaryColor;
    if (tokens.bodyFontFamily) changes.fontFamily = tokens.bodyFontFamily;
    cfg.patch(changes);
    setDesignAnalysisOpen(false);
  };

  // Sections et actions de l'éditeur, publiées dans le centre de commande. Les
  // `setState` sont des identités stables : la liste n'a aucune dépendance.
  const studioCommands = useMemo<CommandDescriptor[]>(() => {
    const sections: CommandDescriptor[] = SECTIONS.map((s) => ({
      id: `studio.section.${s.key}`,
      section: 'screen',
      label: `Aller à ${s.label}`,
      keywords: s.key,
      icon: <s.icon />,
      run: () => setActiveSection(s.key),
    }));
    // La publication est par page (badge + bouton Publier dans l'éditeur GrapesJS), pas une action globale.
    return [
      ...sections,
      {
        id: 'studio.design-analysis',
        section: 'screen',
        label: 'Analyse du design',
        keywords: 'ia design site couleur typo url analyser',
        icon: <Wand2 />,
        run: () => setDesignAnalysisOpen(true),
      },
    ];
  }, []);

  useScreenCommands('Baitly Studio', studioCommands);

  const active = SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0];

  return (
    <>
      <StudioShell
        projectName={projectName}
        sections={SECTIONS}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        previewCurrency={previewCurrency}
        onPreviewCurrencyChange={setPreviewCurrency}
        breakpoint={breakpoint}
        onBreakpointChange={setBreakpoint}
        onOpenCommand={() => openCenter()}
        onAnalyzeDesign={() => setDesignAnalysisOpen(true)}
        onOpenAssistant={openAssistant}
        onBack={() => navigate('/booking-engine', { state: { tab: 2 } })}
      >
        {active.key === 'design' && <GrapesStudio cfg={cfg} breakpoint={breakpoint} mode={studioMode} />}
        {active.key === 'embed' && <SiteEmbedPreview config={cfg.config} breakpoint={breakpoint} />}
        {active.key === 'theme' && <ThemeInspector config={cfg.config} patch={cfg.patch} />}
        {active.key === 'content' && <ContentSection cfg={cfg} />}
        {active.key === 'blog' && <BlogPanel cfg={cfg} />}
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
        {active.key === 'growth' && <GrowthSettingsPanel />}
        {active.key === 'funnel' && <FunnelAnalyticsPanel />}
      </StudioShell>

      <DesignAnalysisModal
        open={designAnalysisOpen}
        onClose={() => setDesignAnalysisOpen(false)}
        configId={cfg.config?.id ?? null}
        initialUrl={cfg.config?.sourceWebsiteUrl ?? ''}
        onApply={applyAnalyzedDesign}
      />
    </>
  );
}

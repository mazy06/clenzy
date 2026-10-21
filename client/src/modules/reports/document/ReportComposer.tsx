import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Spinner,
} from '../../../components/ui';
import { House, TrendingUp, TriangleAlert, Users, FileText, Eye, Sparkles, Check, type IconComponent } from '../../../icons/glyphs';
import PeriodSegmented from '../../../components/baitly/PeriodSegmented';
import { StatsLayout } from '../../../components/stats';
import { ComposerSection, ComposerChoice, ComposerGroup } from './BaitlyComposerControls';
import { composerCopy } from './baitlyComposerCopy';
import './baitly-report-composer.css';
import { usePageHeaderActions } from '../../../components/PageHeaderActionsContext';
import { cn } from '../../../utils/cn';
import { propertiesApi } from '../../../services/api/propertiesApi';
import {
  reportDocumentsApi,
  type ReportDocumentSummary,
  type ReportGroupBy,
  type ReportProfile,
  type ReportRequestBody,
} from '../../../services/api/reportDocumentsApi';
import SnapshotView from './SnapshotView';
import ReportLibrary from './ReportLibrary';
import { activeIntlLocale } from '../../../utils/activeLocale';
import { useTranslation } from '../../../hooks/useTranslation';
import { Trans } from 'react-i18next';

/**
 * Composition d'un rapport d'analyse.
 *
 * <p>L'ecran tient en deux volets : on COMPOSE a gauche, on retrouve a droite
 * ce qui a deja ete produit. Le tunnel en quatre etapes qui precedait enfermait
 * la bibliotheque dans son dernier ecran — on ne pouvait donc pas consulter un
 * document sans traverser un formulaire, alors que c'est le geste le plus
 * frequent, et de loin.</p>
 *
 * <p>Les trois blocs de composition sont visibles d'un seul tenant : six champs
 * ne justifient pas un tunnel, et un tunnel cache toujours ce qu'on n'a pas
 * encore atteint.</p>
 */

/** Les sections disponibles, dans l'ordre de lecture du document. */
const SECTIONS: Array<{ id: string; always?: boolean }> = [
  { id: 'highlights' },
  { id: 'performance', always: true },
  { id: 'occupancy' },
  { id: 'cancellations' },
  { id: 'distribution' },
  { id: 'pnl' },
  { id: 'settlement' },
  { id: 'upsells' },
  { id: 'properties' },
  { id: 'benchmark' },
  { id: 'outlook' },
  { id: 'pricing' },
  { id: 'seasonality' },
  { id: 'leadtime' },
  { id: 'decisions' },
  { id: 'reputation' },
  { id: 'nuisances' },
  { id: 'operations' },
  { id: 'expenses' },
  { id: 'stays' },
  { id: 'glossary' },
  { id: 'notice', always: true },
];

const SECTION_ORDER = SECTIONS.map((section) => section.id);
const SECTION_IDS = new Set(SECTION_ORDER);
/** Le libelle d'une section se resout a l'affichage : `reports.sections.<id>`. */
const sectionLabelKey = (id: string) => `reports.docSections.${id}`;

/**
 * Les sections, par famille.
 *
 * <p>Vingt-deux etiquettes en vrac ne se lisent pas : on les cherche une a une
 * au lieu de decider par bloc. Regroupees, on retire « tout l'argent » ou « tout
 * l'exploitation » d'un geste.</p>
 */
const SECTION_GROUPS: Array<{ key: string; labelKey: string; ids: string[] }> = [
  {
    key: 'activity',
    labelKey: 'reports.sectionGroups.activity',
    ids: ['highlights', 'performance', 'occupancy', 'cancellations', 'distribution',
      'leadtime', 'seasonality', 'pricing'],
  },
  { key: 'money', labelKey: 'reports.sectionGroups.money', ids: ['pnl', 'settlement', 'upsells', 'expenses'] },
  { key: 'assets', labelKey: 'reports.sectionGroups.assets', ids: ['properties', 'benchmark', 'stays'] },
  { key: 'ops', labelKey: 'reports.sectionGroups.ops', ids: ['operations', 'reputation', 'nuisances'] },
  { key: 'forward', labelKey: 'reports.sectionGroups.forward', ids: ['outlook', 'decisions'] },
  { key: 'annex', labelKey: 'reports.sectionGroups.annex', ids: ['glossary', 'notice'] },
];

/**
 * Les destinataires.
 *
 * <p>TROIS, et non quatre : « releve mensuel » et « releve consolide » ne
 * differaient que par leur decoupage, lequel se choisissait DEJA dans le champ
 * juste en dessous. La carte posait donc un decoupage que le champ suivant
 * contredisait sans rien dire. Le destinataire fixe le ton et le contenu ; le
 * decoupage est une question distincte, et il est pose comme telle.</p>
 *
 * <p>{@code nature} reproduit le libelle etabli par {@code
 * ReportSnapshotBuilder.title} cote serveur, qui reste la source de verite : ici
 * il ne sert qu'a MONTRER le titre a venir, jamais a l'imposer.</p>
 */
const AUDIENCES: Array<{
  profile: ReportProfile;
  labelKey: string;
  /**
   * NON traduit, et c'est deliberé : {@code ReportSnapshotBuilder.title} ecrit
   * ce libelle EN DUR en francais dans le document produit. Le traduire ici
   * ferait annoncer a l'ecran un titre que le document ne portera pas.
   */
  nature: string;
  descriptionKey: string;
  icon: IconComponent;
  sections: string[];
}> = [
  {
    profile: 'OWNER',
    labelKey: 'reports.audiences.owner.label',
    nature: 'Relevé de gestion',
    icon: House,
    descriptionKey: 'reports.audiences.owner.description',
    sections: ['highlights', 'performance', 'occupancy', 'cancellations', 'distribution', 'pnl',
      'settlement', 'upsells', 'outlook', 'pricing', 'seasonality', 'decisions', 'reputation',
      'nuisances', 'operations', 'expenses', 'stays', 'glossary', 'notice'],
  },
  {
    profile: 'INTERNAL',
    labelKey: 'reports.audiences.internal.label',
    nature: 'Revue de performance',
    icon: Users,
    descriptionKey: 'reports.audiences.internal.description',
    sections: ['highlights', 'performance', 'occupancy', 'cancellations', 'distribution',
      'properties', 'benchmark', 'outlook', 'pricing', 'seasonality', 'leadtime', 'decisions',
      'reputation', 'nuisances', 'operations', 'expenses', 'stays', 'notice'],
  },
  {
    profile: 'PROSPECT',
    labelKey: 'reports.audiences.prospect.label',
    nature: 'Dossier de performance',
    icon: TrendingUp,
    descriptionKey: 'reports.audiences.prospect.description',
    sections: ['highlights', 'performance', 'occupancy', 'distribution', 'outlook', 'pricing',
      'seasonality', 'notice'],
  },
];

/**
 * Ce qu'un document cumule gagne : la comparaison.
 *
 * <p>Un document par proprietaire ne peut pas comparer ses biens a ceux d'un
 * autre — ces sections n'auraient rien a montrer. Elles n'apparaissent donc que
 * lorsque le document couvre l'ensemble du perimetre.</p>
 */
const CONSOLIDATED_EXTRAS = ['properties', 'benchmark', 'leadtime'];

const GROUPINGS: Array<{ value: ReportGroupBy; labelKey: string }> = [
  { value: 'NONE', labelKey: 'reports.groupings.none' },
  { value: 'OWNER', labelKey: 'reports.groupings.owner' },
  { value: 'PROPERTY', labelKey: 'reports.groupings.property' },
];

const sectionsFor = (profile: ReportProfile, groupBy: ReportGroupBy): string[] => {
  const audience = AUDIENCES.find((item) => item.profile === profile) ?? AUDIENCES[0];
  const wanted = new Set(audience.sections);
  if (groupBy === 'NONE') {
    CONSOLIDATED_EXTRAS.forEach((id) => wanted.add(id));
  }
  return SECTION_ORDER.filter((id) => wanted.has(id));
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Le titre que le document portera.
 *
 * <p>Miroir de {@code ReportSnapshotBuilder.title} : le serveur l'etablit, cet
 * ecran l'affiche. Un champ libre laissait intituler « Relevé de gestion » un
 * dossier prospect anonymise — le document annoncait alors autre chose que ce
 * qu'il contenait.</p>
 */
const documentTitle = (profile: ReportProfile, from: string, to: string): string => {
  const nature = AUDIENCES.find((item) => item.profile === profile)?.nature ?? 'Rapport';
  // `nature` reste francais : c'est le titre que le serveur ecrira (cf. AUDIENCES).
  return `${nature} — ${titlePeriod(from, to)}`;
};

/** Un mois plein se nomme par son mois, une année pleine par son millésime. */
const titlePeriod = (from: string, to: string): string => {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';

  const lastOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  if (start.getDate() === 1 && end.getTime() === lastOfMonth.getTime()) {
    return start.toLocaleDateString(activeIntlLocale(), { month: 'long', year: 'numeric' });
  }
  const isFullYear =
    start.getMonth() === 0 && start.getDate() === 1
    && end.getMonth() === 11 && end.getDate() === 31
    && start.getFullYear() === end.getFullYear();
  if (isFullYear) return String(start.getFullYear());

  const day = (date: Date) =>
    date.toLocaleDateString(activeIntlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
  return `${day(start)} – ${day(end)}`;
};

/** Raccourcis de periode : on compose presque toujours sur un mois clos. */
const PERIODS: Array<{ value: string; labelKey: string; range: () => [string, string] }> = [
  {
    value: 'last-month',
    labelKey: 'reports.periods.lastMonth',
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return [isoDate(start), isoDate(end)];
    },
  },
  {
    value: 'quarter',
    labelKey: 'reports.periods.quarter',
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return [isoDate(start), isoDate(end)];
    },
  },
  {
    value: 'year',
    labelKey: 'reports.periods.year',
    range: () => {
      const now = new Date();
      return [isoDate(new Date(now.getFullYear(), 0, 1)), isoDate(now)];
    },
  },
];

/** Ce que la modale affiche : un calcul volatil, ou un document enregistre. */
type Viewer =
  | { kind: 'preview' }
  | { kind: 'document'; document: ReportDocumentSummary; batch: number };

const ReportComposer: React.FC = () => {
  const { t, currentLanguage } = useTranslation();
  const copy = composerCopy(currentLanguage);
  const queryClient = useQueryClient();

  const [profile, setProfile] = useState<ReportProfile>('OWNER');
  const [groupBy, setGroupBy] = useState<ReportGroupBy>('OWNER');
  const [sections, setSections] = useState<string[]>(() => sectionsFor('OWNER', 'OWNER'));
  const [ownerIds, setOwnerIds] = useState<number[]>([]);
  const [propertyIds, setPropertyIds] = useState<number[]>([]);
  const [withNarrative, setWithNarrative] = useState(true);
  const [period, setPeriod] = useState('last-month');
  const [[from, to], setRange] = useState<[string, string]>(() => PERIODS[0].range());

  const propertiesQuery = useQuery({
    queryKey: ['report-properties'],
    queryFn: () => propertiesApi.getAll({ size: 500 }),
    staleTime: 5 * 60 * 1000,
  });

  const properties = useMemo(() => {
    const data = propertiesQuery.data as unknown;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && 'content' in data) {
      return ((data as { content: unknown[] }).content ?? []) as Array<{
        id: number; name: string; ownerId: number; ownerName?: string;
      }>;
    }
    return [];
  }, [propertiesQuery.data]) as Array<{ id: number; name: string; ownerId: number; ownerName?: string }>;

  /** Les propriétaires se déduisent du parc : il n'y a pas de liste à maintenir à part. */
  const owners = useMemo(() => {
    const map = new Map<number, { id: number; name: string; count: number }>();
    properties.forEach((property) => {
      if (!property.ownerId) return;
      const existing = map.get(property.ownerId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(property.ownerId, {
          id: property.ownerId,
          name: property.ownerName || `Propriétaire #${property.ownerId}`,
          count: 1,
        });
      }
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [properties]);

  const body: ReportRequestBody = {
    profile, groupBy, from, to, ownerIds, propertyIds, sections, withNarrative,
  };

  const previewMutation = useMutation({
    mutationFn: () => reportDocumentsApi.preview(body),
    onSuccess: () => setViewer({ kind: 'preview' }),
  });

  /**
   * Ce que la modale montre.
   *
   * <p>Le document s'ouvre PAR-DESSUS l'ecran plutot qu'en dessous : un rapport
   * de vingt sections pousse le formulaire hors de vue, et il fallait remonter
   * la page pour changer un parametre et relancer.</p>
   */
  const [viewer, setViewer] = useState<Viewer | null>(null);

  const generateMutation = useMutation({
    mutationFn: () => reportDocumentsApi.generate(body),
    onSuccess: (produced) => {
      queryClient.invalidateQueries({ queryKey: ['report-documents'] });
      if (produced[0]) setViewer({ kind: 'document', document: produced[0], batch: produced.length });
    },
  });

  const openedDocument = viewer?.kind === 'document' ? viewer.document : null;

  const openedSnapshotQuery = useQuery({
    queryKey: ['report-document-snapshot', openedDocument?.id],
    queryFn: () => reportDocumentsApi.snapshot(openedDocument!.id),
    enabled: openedDocument != null,
  });

  /** Changer de destinataire REDONNE son jeu de sections : c'est la promesse de la carte. */
  const applyAudience = (next: ReportProfile) => {
    setProfile(next);
    setSections(sectionsFor(next, groupBy));
  };

  const applyGrouping = (next: ReportGroupBy) => {
    setGroupBy(next);
    setSections(sectionsFor(profile, next));
  };

  const applyPeriod = (value: string) => {
    setPeriod(value);
    const found = PERIODS.find((item) => item.value === value);
    if (found) setRange(found.range());
  };

  const toggle = <T,>(list: T[], value: T, setter: (next: T[]) => void) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const setGroup = (ids: string[], on: boolean) =>
    setSections((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (SECTIONS.find((section) => section.id === id)?.always) return;
        if (on) next.add(id);
        else next.delete(id);
      });
      return SECTION_ORDER.filter((id) => next.has(id));
    });

  const documentCount =
    groupBy === 'NONE' ? 1
      : groupBy === 'OWNER' ? Math.max(1, (ownerIds.length || owners.length))
        : Math.max(1, (propertyIds.length || properties.length));

  const canRun = from <= to;
  const busy = generateMutation.isPending || previewMutation.isPending;

  // Les deux gestes qui comptent vivent dans l'en-tete de l'ecran : le
  // formulaire est long, et un bouton en bas de page se cherche a chaque essai.
  const headerActions = usePageHeaderActions(
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="rc-secondary-action"
        disabled={!canRun || busy}
        onClick={() => previewMutation.mutate()}
      >
        {previewMutation.isPending ? <Spinner /> : <Eye size={15} />}
        {previewMutation.isPending ? copy.calculating : copy.preview}
      </Button>
      <Button size="sm" className="rc-primary-action" disabled={!canRun || busy} onClick={() => generateMutation.mutate()}>
        {generateMutation.isPending ? <Spinner /> : <FileText size={15} />}
        {generateMutation.isPending
          ? copy.generating
          : copy.generate(documentCount)}
      </Button>
    </div>,
  );

  const snapshot = viewer?.kind === 'preview' ? previewMutation.data : openedSnapshotQuery.data;
  const loadingSnapshot = viewer?.kind === 'document' && openedSnapshotQuery.isLoading;

  return (
    <StatsLayout className="baitly-report-composer">
      {headerActions}


      <div className="rc-layout">
        <section className="rc-editor">
          <header className="rc-editor-heading"><span className="rc-editor-icon"><FileText size={22} aria-hidden /></span>
            <div><h2>{copy.title}</h2><p>{copy.subtitle}</p></div></header>
          <ComposerSection number="01" title={copy.audience}>
            <div className="rc-audiences" role="group" aria-label={copy.audience}>
              {AUDIENCES.map(audience => <AudienceCard key={audience.profile} icon={audience.icon}
                label={t(audience.labelKey)} nature={audience.nature}
                profile={audience.profile}
                selected={profile === audience.profile} onSelect={() => applyAudience(audience.profile)} />)}
            </div>
            <p className="rc-audience-explanation" data-profile={profile}>{t(AUDIENCES.find(item => item.profile === profile)!.descriptionKey)}</p>
            <div className="rc-grouping">
              <div><span className="rc-field-label">{t('reports.composer.split')}</span>
                <PeriodSegmented ariaLabel={t('reports.composer.splitAria')} value={groupBy}
                  onChange={value => applyGrouping(value as ReportGroupBy)}
                  options={GROUPINGS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))} /></div>
              <p><Trans i18nKey="reports.composer.willProduce" count={documentCount} values={{ count: documentCount }}
                components={{ b: <b className="tabular-nums text-foreground" /> }} /></p>
            </div>
          </ComposerSection>

          <ComposerSection number="02" title={copy.scope}>
            <div className="rc-period-fields"><div><span className="rc-field-label">{t('reports.composer.period')}</span>
              <PeriodSegmented ariaLabel={t('reports.composer.periodAria')} value={period} onChange={applyPeriod}
                options={PERIODS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))} /></div>
              <Field><FieldLabel htmlFor="report-from">{t('reports.composer.from')}</FieldLabel>
                <Input id="report-from" type="date" value={from} onChange={e => { setPeriod(''); setRange([e.target.value, to]); }} /></Field>
              <Field><FieldLabel htmlFor="report-to">{t('reports.composer.to')}</FieldLabel>
                <Input id="report-to" type="date" value={to} onChange={e => { setPeriod(''); setRange([from, e.target.value]); }} /></Field>
            </div>
            {!canRun && <p role="alert" className="text-xs text-destructive-ink">{t('reports.composer.endBeforeStart')}</p>}
            {owners.length > 0 && <Picker label={t('reports.composer.owners')}
              hint={ownerIds.length === 0 ? t('reports.composer.pickerAll') : t('reports.composer.pickerSelected', { count: ownerIds.length })}
              onClear={ownerIds.length ? () => setOwnerIds([]) : undefined}>
              {owners.map(owner => <ComposerChoice key={owner.id} label={`${owner.name} · ${owner.count}`}
                selected={ownerIds.includes(owner.id)} onClick={() => toggle(ownerIds, owner.id, setOwnerIds)} />)}
            </Picker>}
            <Picker label={t('reports.composer.properties')} scroll
              hint={propertyIds.length === 0 ? t('reports.composer.pickerAll') : t('reports.composer.pickerSelected', { count: propertyIds.length })}
              onClear={propertyIds.length ? () => setPropertyIds([]) : undefined}>
              {properties.map(property => <ComposerChoice key={property.id} label={property.name}
                selected={propertyIds.includes(property.id)} onClick={() => toggle(propertyIds, property.id, setPropertyIds)} />)}
            </Picker>
          </ComposerSection>

          <ComposerSection number="03" title={copy.content} hint={t('reports.composer.sectionsKept', { count: sections.length })}>
            <div className="rc-content-groups">{SECTION_GROUPS.map(group => {
              const ids = group.ids.filter(id => SECTION_IDS.has(id));
              const on = ids.filter(id => sections.includes(id)).length;
              return <ComposerGroup key={group.key} label={t(group.labelKey)} count={on} total={ids.length}
                tone={group.key} initiallyOpen={group.key === 'activity'}
                onToggleAll={() => setGroup(ids, on < ids.length)}
                actionLabel={t(on < ids.length ? 'reports.composer.includeAll' : 'reports.composer.removeAll')}>
                {ids.map(id => <ComposerChoice key={id} label={t(sectionLabelKey(id))} selected={sections.includes(id)}
                  locked={SECTIONS.find(section => section.id === id)?.always} requiredLabel={copy.required}
                  onClick={() => toggle(sections, id, next => setSections(SECTION_ORDER.filter(sid => next.includes(sid))))} />)}
              </ComposerGroup>;
            })}</div>
            <label className="rc-narrative" data-enabled={withNarrative}>
              <span className="rc-narrative-icon"><Sparkles size={20} aria-hidden /></span>
              <span><strong>{t('reports.composer.narrativeTitle')}</strong><small>{t('reports.composer.narrativeBody')}</small></span>
              <input type="checkbox" checked={withNarrative} onChange={event => setWithNarrative(event.target.checked)} />
            </label>
          </ComposerSection>
          <footer className="rc-editor-footer"><FileText size={20} aria-hidden /><div><span>{t('reports.composer.documentTitle')}</span>
            <strong>{documentTitle(profile, from, to)}</strong><p>{t('reports.composer.previewNote')}</p></div></footer>
        </section>
        <ReportLibrary openedId={openedDocument?.id ?? null}
          onOpen={document => setViewer(document ? { kind: 'document', document, batch: 1 } : null)} />
      </div>

      {generateMutation.isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>
            {t('reports.composer.generateError')}
          </AlertDescription>
        </Alert>
      )}
      {previewMutation.isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{t('reports.composer.previewError')}</AlertDescription>
        </Alert>
      )}

      <Dialog open={viewer != null} onOpenChange={(open) => !open && setViewer(null)}>
        <DialogContent className="br-dialog flex max-h-[92vh] flex-col overflow-hidden sm:max-w-[min(1100px,94vw)]">
          <DialogHeader>
            <DialogTitle>
              {viewer?.kind === 'document'
                ? `${viewer.document.title} · ${viewer.document.documentNumber}`
                : t('reports.composer.previewTitle')}
            </DialogTitle>
            <DialogDescription>
              {viewer?.kind === 'document'
                ? `${t('reports.composer.version', { version: viewer.document.version })}${
                    viewer.document.recipientName ? ` · ${viewer.document.recipientName}` : ''
                  }${viewer.batch > 1 ? ` · ${t('reports.composer.producedDocuments', { count: viewer.batch })}` : ''}`
                : t('reports.composer.previewSubtitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="br-dialog-scroll">
            {loadingSnapshot ? (
              <div className="flex justify-center py-10">
                <Spinner className="size-7" />
              </div>
            ) : snapshot ? (
              <SnapshotView snapshot={snapshot} />
            ) : null}
          </div>

          <DialogFooter>
            {openedDocument ? (
              <Button
                size="sm"
                variant="outline"
                className="rc-secondary-action"
                onClick={() =>
                  reportDocumentsApi.downloadPdf(
                    openedDocument.id,
                    `${openedDocument.documentNumber}.pdf`,
                  )
                }
              >
                {t('reports.composer.downloadPdf')}
              </Button>
            ) : null}
            <Button size="sm" className="rc-secondary-action" variant="outline" onClick={() => setViewer(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StatsLayout>
  );
};

/**
 * Un destinataire.
 *
 * <p>L'icone n'est pas un ornement : c'est elle qu'on reconnait au deuxieme
 * passage, avant d'avoir relu les trois libelles. Le titre du document a
 * produire est annonce des la carte — c'est le choix qui le determine.</p>
 */
const AudienceCard: React.FC<{
  icon: IconComponent; label: string; nature: string; profile: ReportProfile;
  selected: boolean; onSelect: () => void;
}> = ({ icon: Icon, label, nature, profile, selected, onSelect }) => <button type="button" onClick={onSelect}
  aria-pressed={selected} className="rc-audience" data-profile={profile}>
  <span className="rc-audience-icon"><Icon size={20} aria-hidden /></span>
  <span><strong>{label}</strong><small>{nature}</small></span>
  {selected && <Check size={15} className="rc-audience-check" aria-hidden />}
</button>;

/** Une liste d'étiquettes à cocher, avec son compteur et sa remise à zéro. */
const Picker: React.FC<{
  label: string;
  hint: string;
  onClear?: () => void;
  scroll?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, onClear, scroll, children }) => {
  const { t } = useTranslation();
  return (
  <div className="rc-picker">
    <div className="rc-picker-heading">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className="text-2xs text-muted-foreground">{hint}</span>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="rc-text-action"
        >
          {t('reports.composer.clearAll')}
        </button>
      ) : null}
    </div>
    <div className={cn('rc-choices', scroll && 'rc-choices-scroll')}>
      {children}
    </div>
  </div>
  );
};

export default ReportComposer;

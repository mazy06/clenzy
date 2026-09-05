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
import { House, TrendingUp, TriangleAlert, Users, type LucideIcon } from 'lucide-react';
import StatusChip from '../../../components/StatusChip';
import PeriodSegmented from '../../../components/baitly/PeriodSegmented';
import { ChartTile, StatsLayout } from '../../../components/stats';
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
const SECTIONS: Array<{ id: string; label: string; always?: boolean }> = [
  { id: 'highlights', label: 'Faits marquants' },
  { id: 'performance', label: 'Performance commerciale', always: true },
  { id: 'occupancy', label: 'Occupation' },
  { id: 'cancellations', label: 'Réservations annulées' },
  { id: 'distribution', label: 'Mix de distribution' },
  { id: 'pnl', label: 'Compte de résultat' },
  { id: 'settlement', label: 'Encaissements' },
  { id: 'upsells', label: 'Ventes additionnelles' },
  { id: 'properties', label: 'Détail par bien' },
  { id: 'benchmark', label: 'Comparaison entre biens' },
  { id: 'outlook', label: 'Perspectives' },
  { id: 'pricing', label: 'Positionnement tarifaire' },
  { id: 'seasonality', label: 'Saisonnalité' },
  { id: 'leadtime', label: 'Délai de réservation' },
  { id: 'decisions', label: 'Ce qu’il faut décider' },
  { id: 'reputation', label: 'Avis voyageurs' },
  { id: 'nuisances', label: 'Nuisances signalées' },
  { id: 'operations', label: 'Ce que nous avons fait' },
  { id: 'expenses', label: 'Détail des charges' },
  { id: 'stays', label: 'Détail des séjours' },
  { id: 'glossary', label: 'Définitions' },
  { id: 'notice', label: 'Périmètre et méthode', always: true },
];

const SECTION_ORDER = SECTIONS.map((section) => section.id);
const LABEL_OF = new Map(SECTIONS.map((section) => [section.id, section.label]));

/**
 * Les sections, par famille.
 *
 * <p>Vingt-deux etiquettes en vrac ne se lisent pas : on les cherche une a une
 * au lieu de decider par bloc. Regroupees, on retire « tout l'argent » ou « tout
 * l'exploitation » d'un geste.</p>
 */
const SECTION_GROUPS: Array<{ key: string; label: string; ids: string[] }> = [
  {
    key: 'activity',
    label: 'Activité',
    ids: ['highlights', 'performance', 'occupancy', 'cancellations', 'distribution',
      'leadtime', 'seasonality', 'pricing'],
  },
  { key: 'money', label: 'Argent', ids: ['pnl', 'settlement', 'upsells', 'expenses'] },
  { key: 'assets', label: 'Biens et séjours', ids: ['properties', 'benchmark', 'stays'] },
  { key: 'ops', label: 'Exploitation', ids: ['operations', 'reputation', 'nuisances'] },
  { key: 'forward', label: 'Suites à donner', ids: ['outlook', 'decisions'] },
  { key: 'annex', label: 'Annexes', ids: ['glossary', 'notice'] },
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
  label: string;
  nature: string;
  description: string;
  icon: LucideIcon;
  sections: string[];
}> = [
  {
    profile: 'OWNER',
    label: 'Propriétaire',
    nature: 'Relevé de gestion',
    icon: House,
    description:
      'Le ton d’un relevé de gestion : compte de résultat, encaissements et définitions des indicateurs.',
    sections: ['highlights', 'performance', 'occupancy', 'cancellations', 'distribution', 'pnl',
      'settlement', 'upsells', 'outlook', 'pricing', 'seasonality', 'decisions', 'reputation',
      'nuisances', 'operations', 'expenses', 'stays', 'glossary', 'notice'],
  },
  {
    profile: 'INTERNAL',
    label: 'Équipe interne',
    nature: 'Revue de performance',
    icon: Users,
    description:
      'Dense et sans glossaire : le détail bien par bien, les écarts et ce qu’il faut arbitrer.',
    sections: ['highlights', 'performance', 'occupancy', 'cancellations', 'distribution',
      'properties', 'benchmark', 'outlook', 'pricing', 'seasonality', 'leadtime', 'decisions',
      'reputation', 'nuisances', 'operations', 'expenses', 'stays', 'notice'],
  },
  {
    profile: 'PROSPECT',
    label: 'Prospect',
    nature: 'Dossier de performance',
    icon: TrendingUp,
    description:
      'Une preuve de performance : aucun nom de propriétaire, aucune adresse, aucun montant nominatif.',
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

const GROUPINGS: Array<{ value: ReportGroupBy; label: string }> = [
  { value: 'NONE', label: 'Un seul document' },
  { value: 'OWNER', label: 'Un par propriétaire' },
  { value: 'PROPERTY', label: 'Un par bien' },
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
  return `${nature} — ${titlePeriod(from, to)}`;
};

/** Un mois plein se nomme par son mois, une année pleine par son millésime. */
const titlePeriod = (from: string, to: string): string => {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';

  const lastOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  if (start.getDate() === 1 && end.getTime() === lastOfMonth.getTime()) {
    return start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  const isFullYear =
    start.getMonth() === 0 && start.getDate() === 1
    && end.getMonth() === 11 && end.getDate() === 31
    && start.getFullYear() === end.getFullYear();
  if (isFullYear) return String(start.getFullYear());

  const day = (date: Date) =>
    date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${day(start)} – ${day(end)}`;
};

/** Raccourcis de periode : on compose presque toujours sur un mois clos. */
const PERIODS: Array<{ value: string; label: string; range: () => [string, string] }> = [
  {
    value: 'last-month',
    label: 'Mois dernier',
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return [isoDate(start), isoDate(end)];
    },
  },
  {
    value: 'quarter',
    label: 'Trimestre',
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return [isoDate(start), isoDate(end)];
    },
  },
  {
    value: 'year',
    label: 'Année en cours',
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
        disabled={!canRun || busy}
        onClick={() => previewMutation.mutate()}
      >
        {previewMutation.isPending ? <Spinner /> : null}
        {previewMutation.isPending ? 'Calcul…' : 'Aperçu'}
      </Button>
      <Button size="sm" disabled={!canRun || busy} onClick={() => generateMutation.mutate()}>
        {generateMutation.isPending ? <Spinner /> : null}
        {generateMutation.isPending
          ? 'Génération…'
          : `Générer ${documentCount} document${documentCount > 1 ? 's' : ''}`}
      </Button>
    </div>,
  );

  const snapshot = viewer?.kind === 'preview' ? previewMutation.data : openedSnapshotQuery.data;
  const loadingSnapshot = viewer?.kind === 'document' && openedSnapshotQuery.isLoading;

  return (
    <StatsLayout>
      {headerActions}

      <div className="grid items-start gap-3 min-[1180px]:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <ChartTile
            fluid
            title="Pour qui ce rapport ?"
            hint="Le destinataire décide du ton, du contenu et de ce qui est masqué"
          >
            <div className="flex flex-col gap-3 pt-1">
              <div className="grid gap-2 min-[720px]:grid-cols-3">
                {AUDIENCES.map((audience) => (
                  <AudienceCard
                    key={audience.profile}
                    icon={audience.icon}
                    label={audience.label}
                    nature={audience.nature}
                    description={audience.description}
                    count={sectionsFor(audience.profile, groupBy).length}
                    selected={profile === audience.profile}
                    onSelect={() => applyAudience(audience.profile)}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">Découpage</span>
                  <PeriodSegmented
                    ariaLabel="Découpage des documents"
                    value={groupBy}
                    onChange={(value) => applyGrouping(value as ReportGroupBy)}
                    options={GROUPINGS}
                  />
                </div>
                <p className="m-0 text-xs text-muted-foreground">
                  Cette demande produira{' '}
                  <b className="tabular-nums text-foreground">{documentCount}</b>{' '}
                  document{documentCount > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </ChartTile>

          <ChartTile fluid title="Sur quoi ?" hint="Période et biens couverts">
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">Période</span>
                  <PeriodSegmented
                    ariaLabel="Période du rapport"
                    value={period}
                    onChange={applyPeriod}
                    options={PERIODS.map(({ value, label }) => ({ value, label }))}
                  />
                </div>
                <Field className="w-36">
                  <FieldLabel htmlFor="report-from">Du</FieldLabel>
                  <Input
                    id="report-from"
                    type="date"
                    value={from}
                    onChange={(e) => { setPeriod(''); setRange([e.target.value, to]); }}
                  />
                </Field>
                <Field className="w-36">
                  <FieldLabel htmlFor="report-to">Au</FieldLabel>
                  <Input
                    id="report-to"
                    type="date"
                    value={to}
                    onChange={(e) => { setPeriod(''); setRange([from, e.target.value]); }}
                  />
                </Field>
              </div>

              {!canRun && (
                <p className="m-0 text-xs text-destructive">
                  La date de fin précède la date de début.
                </p>
              )}

              {owners.length > 0 && (
                <Picker
                  label="Propriétaires"
                  hint={ownerIds.length === 0 ? 'tous' : `${ownerIds.length} sélectionné(s)`}
                  onClear={ownerIds.length ? () => setOwnerIds([]) : undefined}
                >
                  {owners.map((owner) => (
                    <StatusChip
                      key={owner.id}
                      outlined
                      tone="accent"
                      selected={ownerIds.includes(owner.id)}
                      pressed={ownerIds.includes(owner.id)}
                      label={`${owner.name} · ${owner.count}`}
                      onClick={() => toggle(ownerIds, owner.id, setOwnerIds)}
                    />
                  ))}
                </Picker>
              )}

              <Picker
                label="Biens"
                hint={propertyIds.length === 0 ? 'tous' : `${propertyIds.length} sélectionné(s)`}
                onClear={propertyIds.length ? () => setPropertyIds([]) : undefined}
                scroll
              >
                {properties.map((property) => (
                  <StatusChip
                    key={property.id}
                    outlined
                    tone="accent"
                    selected={propertyIds.includes(property.id)}
                    pressed={propertyIds.includes(property.id)}
                    label={property.name}
                    onClick={() => toggle(propertyIds, property.id, setPropertyIds)}
                  />
                ))}
              </Picker>
            </div>
          </ChartTile>

          <ChartTile
            fluid
            title="Que contient-il ?"
            hint={`${sections.length} section${sections.length > 1 ? 's' : ''} retenue${sections.length > 1 ? 's' : ''}`}
          >
            <div className="flex flex-col gap-3 pt-1">
              {SECTION_GROUPS.map((group) => {
                const ids = group.ids.filter((id) => LABEL_OF.has(id));
                const on = ids.filter((id) => sections.includes(id)).length;
                return (
                  <div key={group.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-foreground">{group.label}</span>
                      <span className="text-2xs tabular-nums text-muted-foreground">
                        {on}/{ids.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setGroup(ids, on < ids.length)}
                        className="cursor-pointer text-2xs text-muted-foreground underline-offset-2 transition-colors duration-200 hover:text-foreground hover:underline"
                      >
                        {on < ids.length ? 'tout inclure' : 'tout retirer'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ids.map((id) => {
                        const locked = SECTIONS.find((section) => section.id === id)?.always;
                        return (
                          <StatusChip
                            key={id}
                            outlined
                            tone="accent"
                            selected={sections.includes(id)}
                            pressed={sections.includes(id)}
                            label={LABEL_OF.get(id) ?? id}
                            onClick={locked ? undefined : () => toggle(sections, id, (next) =>
                              setSections(SECTION_ORDER.filter((sid) => next.includes(sid))))}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <label className="flex cursor-pointer items-start gap-2 border-t border-border pt-3 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5 cursor-pointer"
                  checked={withNarrative}
                  onChange={(e) => setWithNarrative(e.target.checked)}
                />
                <span>
                  <span className="font-semibold text-foreground">Faire commenter par l'assistant</span>
                  <span className="block text-muted-foreground">
                    L'assistant commente les chiffres présentés, jamais il n'en produit : tout nombre
                    absent du document fait rejeter le commentaire. Le rapport reste en brouillon
                    jusqu'à votre relecture.
                  </span>
                </span>
              </label>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Titre du document</span>
              {/* Etabli, pas saisi : le nom d'un document dit ce qu'il contient. */}
              <p className="m-0 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground">
                {documentTitle(profile, from, to)}
              </p>
              <span className="text-2xs text-muted-foreground">
                Le titre découle du destinataire et de la période — il n’est pas modifiable pour
                qu’un document ne puisse jamais annoncer autre chose que ce qu’il contient.
              </span>
            </div>
            </div>
          </ChartTile>

          <p className="m-0 text-2xs text-muted-foreground">
            L’aperçu ne consomme pas l’assistant et ne crée aucun document. La génération produit
            un brouillon, qu’il reste à envoyer.
          </p>
        </div>

        <ReportLibrary
          openedId={openedDocument?.id ?? null}
          onOpen={(document) =>
            setViewer(document ? { kind: 'document', document, batch: 1 } : null)}
        />
      </div>

      {generateMutation.isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>
            La génération a échoué. Vérifiez que le périmètre contient au moins un bien.
          </AlertDescription>
        </Alert>
      )}
      {previewMutation.isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>L’aperçu a échoué. Vérifiez la période et le périmètre.</AlertDescription>
        </Alert>
      )}

      <Dialog open={viewer != null} onOpenChange={(open) => !open && setViewer(null)}>
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-[min(1100px,94vw)]">
          <DialogHeader>
            <DialogTitle>
              {viewer?.kind === 'document'
                ? `${viewer.document.title} · ${viewer.document.documentNumber}`
                : 'Aperçu du rapport'}
            </DialogTitle>
            <DialogDescription>
              {viewer?.kind === 'document'
                ? `Version ${viewer.document.version}${
                    viewer.document.recipientName ? ` · ${viewer.document.recipientName}` : ''
                  }${viewer.batch > 1 ? ` · ${viewer.batch} documents produits` : ''}`
                : 'Calculé sans rien enregistrer — ce que vous voyez est ce qui sera rendu.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
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
                onClick={() =>
                  reportDocumentsApi.downloadPdf(
                    openedDocument.id,
                    `${openedDocument.documentNumber}.pdf`,
                  )
                }
              >
                Télécharger le PDF
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setViewer(null)}>
              Fermer
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
  icon: LucideIcon;
  label: string;
  nature: string;
  description: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}> = ({ icon: Icon, label, nature, description, count, selected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={cn(
      'flex cursor-pointer flex-col gap-2 rounded-md border p-3 text-start transition-colors duration-200',
      selected
        ? 'border-primary bg-primary/5'
        : 'border-border hover:border-primary/50 hover:bg-muted/40',
    )}
  >
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-200',
          selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{label}</span>
        <span className="block truncate text-2xs text-muted-foreground">{nature}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          'size-3.5 shrink-0 rounded-full border transition-colors duration-200',
          selected ? 'border-[5px] border-primary' : 'border-border',
        )}
      />
    </span>
    <span className="text-xs text-muted-foreground">{description}</span>
    <span className="mt-auto text-2xs tabular-nums text-muted-foreground">{count} sections</span>
  </button>
);

/** Une liste d'étiquettes à cocher, avec son compteur et sa remise à zéro. */
const Picker: React.FC<{
  label: string;
  hint: string;
  onClear?: () => void;
  scroll?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, onClear, scroll, children }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-baseline gap-2">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className="text-2xs text-muted-foreground">{hint}</span>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer text-2xs text-muted-foreground underline-offset-2 transition-colors duration-200 hover:text-foreground hover:underline"
        >
          tout désélectionner
        </button>
      ) : null}
    </div>
    <div className={cn('flex flex-wrap gap-1', scroll && 'no-scrollbar max-h-40 overflow-y-auto')}>
      {children}
    </div>
  </div>
);

export default ReportComposer;

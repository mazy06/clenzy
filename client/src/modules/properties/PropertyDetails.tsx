import PropertyServiceTeams from './PropertyServiceTeams';
import React, { useState, useEffect, useMemo } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from '../../icons/glyphs';
import {
  Spinner,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useNotification } from '../../hooks/useNotification';
import {
  Edit,
  Home,
  Build,
  Info,
  Hub,
  FlightLand,
  PhotoLibrary,
  Inventory2,
  GppGood,
  Send,
  Star,
} from '../../icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { documentsApi } from '../../services/api/documentsApi';
import { usePropertyDetails } from '../../hooks/usePropertyDetails';
import type { PropertyDetailsData } from '../../hooks/usePropertyDetails';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTranslation } from '../../hooks/useTranslation';
import CheckInInstructionsForm from '../channels/CheckInInstructionsForm';
import PropertyPhotosTab from './PropertyPhotosTab';
import PropertyInventoryTab from './PropertyInventoryTab';
import PropertyComplianceTab from './PropertyComplianceTab';
import PropertyInterventionsTab from './PropertyInterventionsTab';
import ReviewList from '../channels/reviews/ReviewList';
import { getPropertyTypeLabel } from '../../utils/statusUtils';
import { propertyPhotosApi } from '../../services/api/propertyPhotosApi';
import { useQuery } from '@tanstack/react-query';
import PropertyOverview from './overview/PropertyOverview';
import PropertyChannelsTab from './overview/PropertyChannelsTab';

// ─── Re-export type for backward compatibility ─────────────────────────────

export type { PropertyDetailsData };

// Onglets de la fiche bien — `key` stable pour l'URL (?tab=<key>) ; useTabKeyParam derive
// l'index visible depuis la cle.
//
// DOIT rester aligne, dans le meme ORDRE, avec les `options` passees a <PageTabs> plus bas :
// un onglet absent d'ici est inatteignable. `tabKeyFromIndex` renvoie alors `undefined`,
// `useTabKeyParam` efface le parametre `tab`, et le clic renvoie sur "Vue d'ensemble" —
// exactement ce qui arrivait a "Conformite", jamais declaree ici.
const detailTabs = [
  { key: 'overview', hidden: false },
  { key: 'interventions', hidden: false },
  { key: 'channels', hidden: false },
  { key: 'check-in', hidden: false },
  { key: 'photos', hidden: false },
  { key: 'inventory', hidden: false },
  { key: 'compliance', hidden: false },
  { key: 'reviews', hidden: false },
];

// ─── Main component ─────────────────────────────────────────────────────────

const PropertyDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  // ─── React Query ────────────────────────────────────────────────────────
  const { property, interventions, isLoading, isError, error } = usePropertyDetails(id);

  // ─── Photos pour le carrousel (source de verite : endpoint photos) ──────
  const photosQuery = useQuery({
    queryKey: ['property-photos', id],
    queryFn: () => propertyPhotosApi.list(Number(id)),
    enabled: !!id,
    staleTime: 60_000,
  });

  const photoUrls = useMemo(() => {
    const photos = photosQuery.data ?? [];
    return [...photos]
      .sort((a, b) => {
        const s = a.sortOrder - b.sortOrder;
        return s !== 0 ? s : a.id - b.id;
      })
      .map((p) => propertyPhotosApi.getPhotoUrl(Number(id), p.id));
  }, [photosQuery.data, id]);

  const [canEdit, setCanEdit] = useState(false);
  // Devis ménage (Moteur Ménage 3A) : confirmation + envoi au propriétaire.
  const [cleaningQuoteDialogOpen, setCleaningQuoteDialogOpen] = useState(false);
  const [cleaningQuoteSending, setCleaningQuoteSending] = useState(false);
  const { notify } = useNotification();

  const handleSendCleaningQuote = async () => {
    setCleaningQuoteSending(true);
    try {
      await documentsApi.sendCleaningQuote(Number(id));
      notify.success(t('properties.cleaningQuote.sent'));
      setCleaningQuoteDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : t('properties.cleaningQuote.error');
      notify.error(message);
    } finally {
      setCleaningQuoteSending(false);
    }
  };
  const [tabValue, setTabValue] = useTabKeyParam(detailTabs);

  // ─── Permissions (lightweight, kept as useEffect) ───────────────────────
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('properties:edit');
      setCanEdit(canEditPermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // ─── Loading / Error states ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Spinner className="size-7" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-3">
        <UiAlert variant="destructive" className="py-1 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{error || t('properties.loadError')}</AlertDescription>
        </UiAlert>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="p-3">
        <UiAlert variant="warning" className="py-1 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{t('properties.notFound')}</AlertDescription>
        </UiAlert>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0">
        <PageHeader
          title={property.name}
          subtitle={`${getPropertyTypeLabel(property.propertyType, t)} · ${property.city}`}
          iconBadge={<Home />}
          backPath="/properties"
          actions={
            <div className="flex items-center gap-1">
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={() => setCleaningQuoteDialogOpen(true)}
                  size="sm"
                  title={t('properties.cleaningQuote.button')}
                >
                  <Send size={16} strokeWidth={1.75} />
                  {t('properties.cleaningQuote.button')}
                </Button>
              )}
              {canEdit && (
                <Button
                  onClick={() => navigate(`/properties/${id}/edit`)}
                  size="sm"
                  title={t('properties.modify')}
                >
                  <Edit size={16} strokeWidth={1.75} />
                  {t('properties.modify')}
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* ─── Tabs (primitive PageTabs — onglets niveau 1 soulignés accent) ── */}
      <div className="shrink-0">
        <PageTabs
          ariaLabel={t('properties.details')}
          mb={0}
          options={[
            { key: 'overview', label: t('properties.tabs.overview'), icon: <Info /> },
            { key: 'interventions', label: `${t('properties.tabs.interventions')} (${interventions.length})`, icon: <Build /> },
            { key: 'channels', label: t('channels.title'), icon: <Hub /> },
            { key: 'check-in', label: t('channels.checkIn.title'), icon: <FlightLand /> },
            { key: 'photos', label: t('properties.tabs.photos'), icon: <PhotoLibrary /> },
            { key: 'inventory', label: 'Inventaire', icon: <Inventory2 /> },
            { key: 'compliance', label: t('properties.tabs.compliance', 'Conformité'), icon: <GppGood /> },
            // Ajouté EN FIN de liste : les panneaux sont adressés par index,
            // insérer ailleurs décalerait silencieusement tous les suivants.
            { key: 'reviews', label: t('properties.tabs.reviews', 'Avis'), icon: <Star /> },
          ]}
          value={tabValue}
          onChange={setTabValue}
        />
      </div>

      {/* ─── Tab 0: Vue d'ensemble ───────────────────────────────────────── */}
      {tabValue === 0 && (
        <div className="pt-3 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-0" aria-labelledby="property-tab-0">
          <PropertyOverview
            property={property}
            photoUrls={photoUrls}
            onEditAccess={canEdit ? () => setTabValue(3) : undefined}
          />
        </div>
      )}

      {/* ─── Tab 1: Interventions ────────────────────────────────────────── */}
      {tabValue === 1 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-1" aria-labelledby="property-tab-1">
          <PropertyServiceTeams propertyId={Number(id)} />
          <PropertyInterventionsTab interventions={interventions} propertyId={String(id)} />
        </div>
      )}

      {/* ─── Tab 2: Canaux ─────────────────────────────────────────────── */}
      {tabValue === 2 && (
        <div className="pt-3 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-2" aria-labelledby="property-tab-2">
          <PropertyChannelsTab propertyId={Number(id)} />
        </div>
      )}

      {/* ─── Tab 3: Instructions voyageur ─────────────────────────────── */}
      {tabValue === 3 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-3" aria-labelledby="property-tab-3">
          <CheckInInstructionsForm propertyId={Number(id)} />
        </div>
      )}

      {/* ─── Tab 4: Photos ─────────────────────────────────────────────── */}
      {tabValue === 4 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-4" aria-labelledby="property-tab-4">
          <PropertyPhotosTab propertyId={Number(id)} />
        </div>
      )}

      {/* ─── Tab 5: Inventaire ───────────────────────────────────────────── */}
      {tabValue === 5 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-5" aria-labelledby="property-tab-5">
          <PropertyInventoryTab propertyId={Number(id)} canEdit={canEdit} />
        </div>
      )}

      {/* ─── Tab 6: Conformité (licences & autorisations, vague M-A) ─────── */}
      {tabValue === 6 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-6" aria-labelledby="property-tab-6">
          <PropertyComplianceTab propertyId={Number(id)} canEdit={canEdit} />
        </div>
      )}

      {/* ─── Tab 7: Avis voyageurs (même liste que /channels/reviews, filtrée) ─ */}
      {tabValue === 7 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-7" aria-labelledby="property-tab-7">
          <ReviewList propertyId={Number(id)} showStats />
        </div>
      )}

      {/* Devis ménage : confirmation avant envoi au propriétaire */}
      <Dialog open={cleaningQuoteDialogOpen} onOpenChange={(next) => { if (!next) setCleaningQuoteDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('properties.cleaningQuote.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('properties.cleaningQuote.confirmBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setCleaningQuoteDialogOpen(false)} disabled={cleaningQuoteSending}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSendCleaningQuote}
              disabled={cleaningQuoteSending}
            >
              {cleaningQuoteSending ? <Spinner className="size-3.5" /> : <Send size={14} strokeWidth={1.75} />}
              {t('properties.cleaningQuote.confirmSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyDetails;

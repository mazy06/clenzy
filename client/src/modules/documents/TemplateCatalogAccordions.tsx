import { useState } from 'react';
import type React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Upload } from '../../icons/glyphs';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import { guestMessagingApi } from '../../services/api/guestMessagingApi';
import { systemEmailTemplatesApi } from '../../services/api/systemEmailTemplatesApi';
import TemplatePdfPreview from './TemplatePdfPreview';
import EmailTemplatePreview from './EmailTemplatePreview';
import { EventAvailable, Hotel, ExitToApp, Description, AdminPanelSettings } from '../../icons';
import { STATUS_TONES, type ToneTokens } from '../../components/StatusChip';
import { Alert, AlertDescription, Button, NativeSelect, NativeSelectOption, Skeleton } from '../../components/ui';
import type { DocumentTemplate } from '../../services/api/documentsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useScreenSearch } from '../../components/ScreenChrome';
import DocumentsWorkspace, { DOCUMENT_ART, documentArtwork } from './components/DocumentsWorkspace';
import DocumentsHeaderControls from './components/DocumentsHeaderControls';
// ─── Types ───────────────────────────────────────────────────────────────────

interface CatalogItem {
  /** Cles i18n ; les champs francais qui suivent servent de repli. */
  nameKey?: string;
  descriptionKey?: string;
  triggerKey?: string;
  recipientKey?: string;
  id: string;
  name: string;
  description: string;
  trigger: 'auto' | 'manual' | 'form' | 'auto+manual';
  triggerDetail: string;
  recipient: string;
  channel: 'email' | 'in-app' | 'document' | 'email+in-app';
  variables?: string[];
  templateKind: 'document' | 'message' | 'hardcoded' | 'system-email';
  /**
   * Pour templateKind='system-email' uniquement : cle dans la table
   * system_email_template. Permet d'ouvrir l'editeur de la nouvelle tab
   * "Templates email" sur le bon template.
   */
  systemEmailKey?: string;
  /** DocumentType to match with uploaded .html templates */
  documentType?: string;
  /** Link to message template management page */
  messageLink?: string;
}

interface CatalogGroup {
  labelKey?: string;
  id: string;
  label: string;
  icon: React.ReactNode;
  tone: ToneTokens;
  items: CatalogItem[];
}

// ─── Catalog Data ────────────────────────────────────────────────────────────

const GUEST_VARIABLES = [
  'guestName', 'guestFirstName', 'propertyName', 'propertyAddress',
  'checkInDate', 'checkOutDate', 'checkInTime', 'checkOutTime',
  'accessCode', 'wifiName', 'wifiPassword', 'parkingInfo',
  'arrivalInstructions', 'departureInstructions', 'houseRules',
  'emergencyContact', 'confirmationCode',
];

const CATALOG_GROUPS: CatalogGroup[] = [
  {
    id: 'pre-stay',
    labelKey: 'docCatalog.groups.pre-stay',
    label: 'Avant le sejour',
    icon: <EventAvailable />,
    tone: STATUS_TONES.ok,
    items: [
      {
        id: 'checkin-instructions',
        nameKey: 'docCatalog.items.checkin-instructions.name',
        name: 'Instructions check-in',
        descriptionKey: 'docCatalog.items.checkin-instructions.description',
        description:
          'Envoye automatiquement N heures avant l\'arrivee du voyageur. ' +
          'Contient les instructions d\'acces, code WiFi, reglement interieur, informations parking, etc.',
        trigger: 'auto',
        triggerKey: 'docCatalog.items.checkin-instructions.trigger',
        triggerDetail: 'Scheduler automatique (configurable : X heures avant check-in)',
        recipientKey: 'docCatalog.items.checkin-instructions.recipient',
        recipient: 'Voyageur',
        channel: 'email',
        variables: [
          'guestName', 'guestFirstName', 'propertyName', 'propertyAddress',
          'checkInDate', 'checkInTime', 'accessCode', 'wifiName', 'wifiPassword',
          'parkingInfo', 'arrivalInstructions', 'houseRules', 'emergencyContact', 'confirmationCode',
        ],
        templateKind: 'message',
        messageLink: '/settings',
      },
      {
        id: 'welcome-message',
        nameKey: 'docCatalog.items.welcome-message.name',
        name: 'Message de bienvenue',
        descriptionKey: 'docCatalog.items.welcome-message.description',
        description:
          'Message de bienvenue envoye manuellement ou programme pour accueillir le voyageur. ' +
          'Peut contenir des informations personnalisees sur le logement.',
        trigger: 'manual',
        triggerKey: 'docCatalog.items.welcome-message.trigger',
        triggerDetail: 'Envoi manuel depuis la fiche reservation',
        recipientKey: 'docCatalog.items.welcome-message.recipient',
        recipient: 'Voyageur',
        channel: 'email',
        variables: ['guestName', 'guestFirstName', 'propertyName', 'propertyAddress', 'checkInDate', 'checkOutDate'],
        templateKind: 'message',
        messageLink: '/settings',
      },
    ],
  },
  {
    id: 'during-stay',
    labelKey: 'docCatalog.groups.during-stay',
    label: 'Pendant le sejour',
    icon: <Hotel />,
    tone: STATUS_TONES.accent,
    items: [
      {
        id: 'noise-alert-owner',
        nameKey: 'docCatalog.items.noise-alert-owner.name',
        name: 'Alerte bruit — Proprietaire',
        descriptionKey: 'docCatalog.items.noise-alert-owner.description',
        description:
          'Email automatique envoye au proprietaire lorsque le niveau sonore depasse ' +
          'le seuil configure (avertissement ou critique). Contient le niveau mesure, le seuil, le creneau horaire.',
        trigger: 'auto',
        triggerKey: 'docCatalog.items.noise-alert-owner.trigger',
        triggerDetail: 'Automatique (capteur Minut/Tuya — depassement de seuil)',
        recipientKey: 'docCatalog.items.noise-alert-owner.recipient',
        recipient: 'Proprietaire',
        channel: 'email+in-app',
        templateKind: 'system-email',
        systemEmailKey: 'noise_alert_owner',
      },
      {
        id: 'noise-alert-guest',
        nameKey: 'docCatalog.items.noise-alert-guest.name',
        name: 'Alerte bruit — Voyageur',
        descriptionKey: 'docCatalog.items.noise-alert-guest.description',
        description:
          'Message automatique envoye au voyageur en cas de nuisance sonore detectee. ' +
          'Rappel du reglement interieur et demande de reduire le bruit.',
        trigger: 'auto',
        triggerKey: 'docCatalog.items.noise-alert-guest.trigger',
        triggerDetail: 'Automatique (si active dans la config alerte bruit)',
        recipientKey: 'docCatalog.items.noise-alert-guest.recipient',
        recipient: 'Voyageur',
        channel: 'email',
        templateKind: 'system-email',
        systemEmailKey: 'noise_alert_guest',
      },
      {
        id: 'custom-message',
        nameKey: 'docCatalog.items.custom-message.name',
        name: 'Message personnalise',
        descriptionKey: 'docCatalog.items.custom-message.description',
        description:
          'Template libre utilise pour envoyer des messages ad-hoc au voyageur. ' +
          'Toutes les variables d\'interpolation sont disponibles.',
        trigger: 'manual',
        triggerKey: 'docCatalog.items.custom-message.trigger',
        triggerDetail: 'Envoi manuel depuis la fiche reservation',
        recipientKey: 'docCatalog.items.custom-message.recipient',
        recipient: 'Voyageur',
        channel: 'email',
        variables: GUEST_VARIABLES,
        templateKind: 'message',
        messageLink: '/settings',
      },
    ],
  },
  {
    id: 'post-stay',
    labelKey: 'docCatalog.groups.post-stay',
    label: 'Fin du sejour',
    icon: <ExitToApp />,
    tone: STATUS_TONES.warn,
    items: [
      {
        id: 'checkout-instructions',
        nameKey: 'docCatalog.items.checkout-instructions.name',
        name: 'Instructions check-out',
        descriptionKey: 'docCatalog.items.checkout-instructions.description',
        description:
          'Envoye automatiquement N heures avant le depart du voyageur. ' +
          'Contient les consignes de depart, instructions de remise des cles, etc.',
        trigger: 'auto',
        triggerKey: 'docCatalog.items.checkout-instructions.trigger',
        triggerDetail: 'Scheduler automatique (configurable : X heures avant check-out)',
        recipientKey: 'docCatalog.items.checkout-instructions.recipient',
        recipient: 'Voyageur',
        channel: 'email',
        variables: [
          'guestName', 'guestFirstName', 'propertyName', 'propertyAddress',
          'checkOutDate', 'checkOutTime', 'departureInstructions', 'confirmationCode',
        ],
        templateKind: 'message',
        messageLink: '/settings',
      },
    ],
  },
  {
    id: 'documents',
    labelKey: 'docCatalog.groups.documents',
    label: 'Documents commerciaux',
    icon: <Description />,
    tone: STATUS_TONES.err,
    items: [
      {
        id: 'doc-devis',
        nameKey: 'docCatalog.items.doc-devis.name',
        name: 'Devis',
        descriptionKey: 'docCatalog.items.doc-devis.description',
        description: 'Document de devis genere a partir d\'un template .html et converti en PDF. Peut etre envoye par email au client.',
        trigger: 'auto+manual',
        triggerKey: 'docCatalog.items.doc-devis.trigger',
        triggerDetail: 'Manuel ou declencheur automatique (evenement metier)',
        recipientKey: 'docCatalog.items.doc-devis.recipient',
        recipient: 'Client / Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'DEVIS',
      },
      {
        id: 'doc-facture',
        nameKey: 'docCatalog.items.doc-facture.name',
        name: 'Facture',
        descriptionKey: 'docCatalog.items.doc-facture.description',
        description: 'Document de facturation genere a partir d\'un template .html. Soumis a la conformite NF (numerotation legale, hash, verrouillage).',
        trigger: 'auto+manual',
        triggerKey: 'docCatalog.items.doc-facture.trigger',
        triggerDetail: 'Manuel ou declencheur automatique (evenement metier)',
        recipientKey: 'docCatalog.items.doc-facture.recipient',
        recipient: 'Client / Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'FACTURE',
      },
      {
        id: 'doc-mandat',
        nameKey: 'docCatalog.items.doc-mandat.name',
        name: 'Mandat de gestion',
        descriptionKey: 'docCatalog.items.doc-mandat.description',
        description: 'Mandat de gestion locative formalisant la relation entre le proprietaire et Baitly.',
        trigger: 'manual',
        triggerKey: 'docCatalog.items.doc-mandat.trigger',
        triggerDetail: 'Generation manuelle',
        recipientKey: 'docCatalog.items.doc-mandat.recipient',
        recipient: 'Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'MANDAT_GESTION',
      },
      {
        id: 'doc-autorisation',
        nameKey: 'docCatalog.items.doc-autorisation.name',
        name: 'Autorisation de travaux',
        descriptionKey: 'docCatalog.items.doc-autorisation.description',
        description: 'Autorisation formelle pour la realisation de travaux dans un logement gere.',
        trigger: 'manual',
        triggerKey: 'docCatalog.items.doc-autorisation.trigger',
        triggerDetail: 'Generation manuelle',
        recipientKey: 'docCatalog.items.doc-autorisation.recipient',
        recipient: 'Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'AUTORISATION_TRAVAUX',
      },
      {
        id: 'doc-bon-intervention',
        nameKey: 'docCatalog.items.doc-bon-intervention.name',
        name: 'Bon d\'intervention',
        descriptionKey: 'docCatalog.items.doc-bon-intervention.description',
        description: 'Bon d\'intervention technique pour les prestataires et techniciens.',
        trigger: 'auto+manual',
        triggerKey: 'docCatalog.items.doc-bon-intervention.trigger',
        triggerDetail: 'Manuel ou automatique (intervention completee)',
        recipientKey: 'docCatalog.items.doc-bon-intervention.recipient',
        recipient: 'Technicien / Prestataire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'BON_INTERVENTION',
      },
      {
        id: 'doc-bon-commande', name: 'Bon de commande',
        description: 'Commande liée à une dépense prestataire, avec le logement et les montants dans leur devise. Ce document ne prouve pas un paiement.',
        trigger: 'manual', triggerDetail: 'Depuis une dépense prestataire',
        recipient: 'Fournisseur / Prestataire', channel: 'document',
        templateKind: 'document', documentType: 'BON_COMMANDE',
      },
      {
        id: 'doc-devis-prestataire', name: 'Devis prestataire',
        description: 'Proposition détaillée du prestataire avec ses lignes, son logo et les conditions de la mission.',
        trigger: 'auto+manual', triggerDetail: 'Depuis un devis prestataire',
        recipient: 'Client / Propriétaire', channel: 'document',
        templateKind: 'document', documentType: 'DEVIS_PRESTATAIRE',
      },
      {
        id: 'doc-devis-menage', name: 'Devis ménage',
        description: 'Estimation du ménage à partir du logement, des durées et des prestations retenues.',
        trigger: 'manual', triggerDetail: 'Depuis la fiche du logement',
        recipient: 'Propriétaire', channel: 'document',
        templateKind: 'document', documentType: 'DEVIS_MENAGE',
      },
      {
        id: 'doc-validation-mission',
        nameKey: 'docCatalog.items.doc-validation-mission.name',
        name: 'Validation fin de mission',
        descriptionKey: 'docCatalog.items.doc-validation-mission.description',
        description: 'Document de validation de fin de mission signe par le proprietaire ou le gestionnaire.',
        trigger: 'manual',
        triggerKey: 'docCatalog.items.doc-validation-mission.trigger',
        triggerDetail: 'Generation manuelle',
        recipientKey: 'docCatalog.items.doc-validation-mission.recipient',
        recipient: 'Technicien / Prestataire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'VALIDATION_FIN_MISSION',
      },
      {
        id: 'doc-justificatif-paiement',
        nameKey: 'docCatalog.items.doc-justificatif-paiement.name',
        name: 'Justificatif de paiement',
        descriptionKey: 'docCatalog.items.doc-justificatif-paiement.description',
        description: 'Justificatif de paiement pour le client ou le proprietaire.',
        trigger: 'manual',
        triggerKey: 'docCatalog.items.doc-justificatif-paiement.trigger',
        triggerDetail: 'Generation manuelle',
        recipientKey: 'docCatalog.items.doc-justificatif-paiement.recipient',
        recipient: 'Client / Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'JUSTIFICATIF_PAIEMENT',
      },
      {
        id: 'doc-justificatif-remboursement',
        nameKey: 'docCatalog.items.doc-justificatif-remboursement.name',
        name: 'Justificatif de remboursement',
        descriptionKey: 'docCatalog.items.doc-justificatif-remboursement.description',
        description: 'Justificatif de remboursement emis suite a une annulation ou un avoir.',
        trigger: 'manual',
        triggerKey: 'docCatalog.items.doc-justificatif-remboursement.trigger',
        triggerDetail: 'Generation manuelle',
        recipientKey: 'docCatalog.items.doc-justificatif-remboursement.recipient',
        recipient: 'Client / Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'JUSTIFICATIF_REMBOURSEMENT',
      },
    ],
  },
  {
    id: 'admin',
    labelKey: 'docCatalog.groups.admin',
    label: 'Administration',
    icon: <AdminPanelSettings />,
    tone: STATUS_TONES.neutral,
    items: [
      {
        id: 'invitation-org',
        nameKey: 'docCatalog.items.invitation-org.name',
        name: 'Invitation organisation',
        descriptionKey: 'docCatalog.items.invitation-org.description',
        description:
          'Email d\'invitation envoye a un utilisateur pour rejoindre une organisation Baitly. ' +
          'Contient un lien d\'invitation avec expiration.',
        trigger: 'manual',
        triggerKey: 'docCatalog.items.invitation-org.trigger',
        triggerDetail: 'Action administrateur (ajout membre)',
        recipientKey: 'docCatalog.items.invitation-org.recipient',
        recipient: 'Utilisateur invite',
        channel: 'email',
        templateKind: 'system-email',
        systemEmailKey: 'invitation_organization',
      },
      {
        id: 'notif-devis-landing',
        nameKey: 'docCatalog.items.notif-devis-landing.name',
        name: 'Notification demande de devis',
        descriptionKey: 'docCatalog.items.notif-devis-landing.description',
        description:
          'Email de notification interne genere lorsqu\'un prospect remplit le formulaire de demande de devis sur la landing page.',
        trigger: 'form',
        triggerKey: 'docCatalog.items.notif-devis-landing.trigger',
        triggerDetail: 'Formulaire landing page',
        recipientKey: 'docCatalog.items.notif-devis-landing.recipient',
        recipient: 'Equipe interne Baitly',
        channel: 'email',
        templateKind: 'system-email',
        systemEmailKey: 'quote_request_internal',
      },
      {
        id: 'notif-maintenance-landing',
        nameKey: 'docCatalog.items.notif-maintenance-landing.name',
        name: 'Notification demande maintenance',
        descriptionKey: 'docCatalog.items.notif-maintenance-landing.description',
        description:
          'Email de notification interne genere lorsqu\'un prospect remplit le formulaire de demande de maintenance sur la landing page.',
        trigger: 'form',
        triggerKey: 'docCatalog.items.notif-maintenance-landing.trigger',
        triggerDetail: 'Formulaire landing page',
        recipientKey: 'docCatalog.items.notif-maintenance-landing.recipient',
        recipient: 'Equipe interne Baitly',
        channel: 'email',
        templateKind: 'system-email',
        systemEmailKey: 'maintenance_request_internal',
      },
    ],
  },
];

interface Props {
  templates: DocumentTemplate[]; onOpenUpload: () => void;
  onSwitchToMessagingTab?: () => void; onOpenSystemEmail?: (key: string) => void;
}
const MESSAGE_TYPES: Record<string, string> = {
  'checkin-instructions': 'CHECK_IN', 'checkout-instructions': 'CHECK_OUT',
  'welcome-message': 'WELCOME', 'custom-message': 'CUSTOM',
};

export default function TemplateCatalogAccordions({ templates, onOpenUpload, onSwitchToMessagingTab, onOpenSystemEmail }: Props) {
  const { t, currentLanguage } = useTranslation(); const scope = useCommerceScope();
  const [group, setGroup] = useState('all'); const [search, setSearch] = useState('');
  const users = useQuery({ queryKey: ['document-message-templates', scope], enabled: !!scope, queryFn: guestMessagingApi.getTemplates, retry: false });
  const systems = useQuery({ queryKey: ['document-system-templates', scope], enabled: !!scope, queryFn: systemEmailTemplatesApi.list, retry: false });
  useScreenSearch(search, setSearch, t('documentsWorkspace.searchTemplate'));
  const items = CATALOG_GROUPS.filter(row => group === 'all' || row.id === group).flatMap(row => row.items)
    .filter(row => t(row.nameKey || '', row.name).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const previews = new Map<string, React.ReactNode>();
  const rows = items.map(item => {
    const linked = templates.find(row => row.documentType === item.documentType && row.active)
      || templates.find(row => row.documentType === item.documentType);
    const messages = (users.data || []).filter(row => row.type === MESSAGE_TYPES[item.id] && row.isActive);
    const message = messages.find(row => row.language === currentLanguage) || messages.find(row => row.language === 'fr') || messages[0];
    const system = systems.data?.find(row => row.templateKey === item.systemEmailKey);
    const systemContent = system?.languages[currentLanguage] || system?.languages.fr || Object.values(system?.languages || {})[0];
    const email = item.systemEmailKey ? systemContent : message;
    const loading = item.templateKind !== 'document' && (item.systemEmailKey ? systems.isPending : users.isPending);
    previews.set(item.id, item.templateKind === 'document' && linked
      ? <TemplatePdfPreview key={linked.id} id={linked.id} name={linked.name} version={linked.version} />
      : email ? <EmailTemplatePreview key={item.id} subject={email.subject} body={email.body} language={email.language}
          wrapperStyle={item.systemEmailKey ? systemContent?.wrapperStyle : 'NOTIFICATION_GUEST'} />
      : loading ? <Skeleton className="m-4 h-96" /> : <p role="status" className="p-6 text-sm text-muted-foreground">{t('documents.catalog.noTemplate')}</p>);
    const manage = () => item.templateKind === 'document' ? onOpenUpload()
      : item.systemEmailKey ? onOpenSystemEmail?.(item.systemEmailKey) : onSwitchToMessagingTab?.();
    return { id: item.id, title: t(item.nameKey || '', item.name),
      image: item.templateKind === 'document' ? documentArtwork(item.documentType || '') : DOCUMENT_ART.message,
      meta: item.channel === 'document' ? 'PDF' : 'Email',
      status: item.templateKind === 'document' ? { value: linked?.active ? 'ACTIVE' : 'TO_CHECK',
        label: linked ? t(linked.active ? 'messaging.templates.active' : 'messaging.templates.inactive') : t('documents.catalog.noTemplate') } : undefined,
      listActions: item.templateKind !== 'document' || !linked ? <Button variant="ghost" size="icon-sm" onClick={manage}
        aria-label={`${t('documents.catalog.manage')} · ${t(item.nameKey || '', item.name)}`} title={t('documents.catalog.manage')}>
        {item.templateKind === 'document' ? <Upload size={16} /> : <Pencil size={16} />}</Button> : undefined,
      detail: null,
    };
  });
  return <>
    <DocumentsHeaderControls count={items.length}>
      <NativeSelect aria-label={t('documentsWorkspace.journey')} value={group} onChange={e => setGroup(e.target.value)}>
        <NativeSelectOption value="all">{t('documentsWorkspace.allJourney')}</NativeSelectOption>
        {CATALOG_GROUPS.map(row => <NativeSelectOption key={row.id} value={row.id}>{t(row.labelKey || '', row.label)}</NativeSelectOption>)}
      </NativeSelect></DocumentsHeaderControls>
    {(users.isError || systems.isError) && <Alert variant="destructive" role="alert" className="mb-3"><AlertDescription>{t('messaging.templates.loadError')}</AlertDescription>
      <Button variant="ghost" onClick={() => { void users.refetch(); void systems.refetch(); }}>{t('common.retry')}</Button></Alert>}
    <DocumentsWorkspace autoPaginate key={`${group}:${search}`} label={t('documentsWorkspace.views.guide')} records={rows} renderDetail={record => previews.get(record.id)} />
  </>;
}

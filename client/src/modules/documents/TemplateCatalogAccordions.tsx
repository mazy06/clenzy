import React, { useState } from 'react';
import StatusChip, { STATUS_TONES, type ToneTokens } from '../../components/StatusChip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Separator,
} from '../../components/ui';
import {
  EventAvailable,
  Hotel,
  ExitToApp,
  Description,
  AdminPanelSettings,
  CloudUpload,
  Visibility,
  OpenInNew,
  CheckCircle,
  Warning,
  Code,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import type { DocumentTemplate } from '../../services/api/documentsApi';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Tons sémantiques (tokens StatusChip) ─────────────────────────────────────
// Mapping : étapes du parcours → ok/accent/warn ; documents PDF → err (pastille
// type), admin → muted. Les -soft viennent des tokens (dark mode automatique).


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
  /** DocumentType to match with uploaded .odt templates */
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
      {
        id: 'pricing-push',
        nameKey: 'docCatalog.items.pricing-push.name',
        name: 'Push tarification',
        descriptionKey: 'docCatalog.items.pricing-push.description',
        description:
          'Envoi automatique des informations tarifaires au voyageur avant son arrivee. ' +
          'Inclut le detail des prix et les conditions.',
        trigger: 'auto',
        triggerKey: 'docCatalog.items.pricing-push.trigger',
        triggerDetail: 'Scheduler automatique (si active dans la configuration)',
        recipientKey: 'docCatalog.items.pricing-push.recipient',
        recipient: 'Voyageur',
        channel: 'email',
        variables: ['guestName', 'propertyName', 'checkInDate', 'checkOutDate'],
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
        description: 'Document de devis genere a partir d\'un template .odt et converti en PDF. Peut etre envoye par email au client.',
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
        description: 'Document de facturation genere a partir d\'un template .odt. Soumis a la conformite NF (numerotation legale, hash, verrouillage).',
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Chips meta en tons -soft semantiques :
//   auto      = accent (action systeme reguliere)
//   manual    = muted (action humaine)
//   form      = warn (declenchement externe)
//   document  = err (pastille type document, cf. pattern .fr-doc)
const TRIGGER_CONFIG: Record<string, { label: string; tone: ToneTokens }> = {
  auto: { label: 'Automatique', tone: STATUS_TONES.accent },
  manual: { label: 'Manuel', tone: STATUS_TONES.neutral },
  form: { label: 'Formulaire', tone: STATUS_TONES.warn },
  'auto+manual': { label: 'Auto / Manuel', tone: STATUS_TONES.ok },
};

const CHANNEL_CONFIG: Record<string, { label: string; tone: ToneTokens }> = {
  email: { label: 'Email', tone: STATUS_TONES.info },
  'in-app': { label: 'In-app', tone: STATUS_TONES.ok },
  'email+in-app': { label: 'Email + In-app', tone: STATUS_TONES.ok },
  document: { label: 'Document .odt', tone: STATUS_TONES.err },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface TemplateCatalogAccordionsProps {
  templates: DocumentTemplate[];
  onOpenUpload: () => void;
  onSwitchToMessagingTab?: () => void;
  /**
   * Callback invoque quand l'user clique "Personnaliser" sur un template
   * system-email. Le parent (DocumentsPage) switch sur la tab "Templates email"
   * et ouvre l'editeur sur la cle fournie.
   */
  onOpenSystemEmail?: (systemEmailKey: string) => void;
}

const TemplateCatalogAccordions: React.FC<TemplateCatalogAccordionsProps> = ({ templates, onOpenUpload, onSwitchToMessagingTab, onOpenSystemEmail }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expandedGroup, setExpandedGroup] = useState<string | false>(false);

  const findLinkedTemplate = (item: CatalogItem): DocumentTemplate | undefined => {
    if (!item.documentType) return undefined;
    return templates.find(
      (t) => t.documentType === item.documentType && t.active,
    ) ?? templates.find((t) => t.documentType === item.documentType);
  };

  return (
    <div className="mb-6">
      {/* Section title — no forced uppercase, no aggressive letter-spacing (anti-pattern templated) */}
      <h6 className="mb-2 text-muted-foreground text-[0.78rem] font-semibold">
        {t('documents.catalog.title')}
      </h6>

      {/* Un seul Accordion « single » remplace les N Accordion MUI : c'est deja
          la semantique de `expandedGroup` (un seul groupe ouvert a la fois). */}
      <Accordion
        type="single"
        collapsible
        value={expandedGroup === false ? '' : expandedGroup}
        onValueChange={(v) => setExpandedGroup(v ? v : false)}
        className="gap-0"
      >
      {CATALOG_GROUPS.map((group) => (
        <AccordionItem
          key={group.id}
          value={group.id}
          className="mb-1.5 border border-solid border-border rounded-md transition-[border-color] duration-[180ms] ease-out-quart hover:border-faint"
        >
          <AccordionTrigger className="px-3 py-2 rounded-md cursor-pointer data-[state=open]:rounded-b-none data-[state=open]:border-b data-[state=open]:border-solid data-[state=open]:border-b-border">
            <div className="flex items-center gap-2 w-full">
              {/* Badge icone Baitly (tile 26x26, accent color, contraste WCAG AA+) */}
              <div className="w-[26px] h-[26px] rounded-md inline-flex items-center justify-center shrink-0" style={{ backgroundColor: group.tone.bg, color: group.tone.color }}>
                {React.isValidElement(group.icon)
                  ? React.cloneElement(group.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                      size: 16,
                      strokeWidth: 1.75,
                    })
                  : group.icon}
              </div>
              <p className="font-semibold text-[0.875rem] flex-1 text-foreground">
                {group.labelKey ? t(group.labelKey, group.label) : group.label}
              </p>
              <StatusChip tokens={group.tone} label={`${group.items.length} template${group.items.length > 1 ? 's' : ''}`} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-0">
            {group.items.map((item, idx) => {
              const linkedTemplate = findLinkedTemplate(item);
              const trigger = TRIGGER_CONFIG[item.trigger] || TRIGGER_CONFIG.manual;
              const channel = CHANNEL_CONFIG[item.channel] || CHANNEL_CONFIG.email;

              return (
                <div key={item.id}>
                  {idx > 0 && <Separator />}
                  <div className="p-3">
                    {/* Header : titre + chips meta uniformes (toutes en softChipSx) */}
                    <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                      <p className="font-semibold text-[0.8125rem] flex-1 min-w-0">
                        {item.nameKey ? t(item.nameKey, item.name) : item.name}
                      </p>
                      <StatusChip tokens={trigger.tone} label={trigger.label} />
                      <StatusChip tokens={channel.tone} label={channel.label} />
                      <StatusChip tokens={STATUS_TONES.neutral} label={item.recipientKey ? t(item.recipientKey, item.recipient) : item.recipient} />
                    </div>

                    {/* Description */}
                    <p className="text-muted-foreground text-[0.8125rem] mb-2 leading-[1.5]">
                      {item.descriptionKey ? t(item.descriptionKey, item.description) : item.description}
                    </p>

                    {/* Trigger detail */}
                    <span className="text-xs block text-muted-foreground mb-0.5">
                      <strong className="text-foreground font-semibold">{t('documents.catalog.trigger')}</strong> {item.triggerKey ? t(item.triggerKey, item.triggerDetail) : item.triggerDetail}
                    </span>

                    {/* Variables — chips tres legeres (variant pure tag, font 10px, no border) */}
                    {item.variables && item.variables.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center gap-0.5 mb-1">
                          <span className="inline-flex text-muted-foreground">
                            <Code size={13} strokeWidth={1.75} />
                          </span>
                          <span className="font-semibold text-muted-foreground text-[0.7rem]">
                            Variables disponibles
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-0.5">
                          {item.variables.map((v) => (
                            <code className="text-[0.6875rem] text-primary bg-primary-soft border border-solid border-primary/25 rounded-[4px] px-[3.75px] py-0.5 leading-[1.5] whitespace-nowrap" style={{ fontFamily: '"SF Mono", Menlo, Consolas, monospace' }} key={v}>
                              {`{${v}}`}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer status row — couleur tintee selon l'etat (palette Baitly) */}
                    {(() => {
                      // Etat = couleur d'accent + icone choisis selon le type de template
                      const status =
                        item.templateKind === 'document' && linkedTemplate
                          ? { tone: STATUS_TONES.ok, icon: <CheckCircle size={16} strokeWidth={1.75} /> }
                          : item.templateKind === 'document' && !linkedTemplate
                          ? { tone: STATUS_TONES.warn, icon: <Warning size={16} strokeWidth={1.75} /> }
                          : item.templateKind === 'message'
                          ? { tone: STATUS_TONES.info, icon: <CheckCircle size={16} strokeWidth={1.75} /> }
                          : { tone: STATUS_TONES.neutral, icon: <CheckCircle size={16} strokeWidth={1.75} /> };

                      return (
                        <div className="mt-[9px] px-[7.5px] py-1.5 rounded-[10px] border border-solid flex items-center gap-1.5" style={{ backgroundColor: status.tone.bg, borderColor: `color-mix(in srgb, ${status.tone.color} 24%, transparent)` }}>
                          <span className="inline-flex shrink-0" style={{ color: status.tone.color }}>
                            {status.icon}
                          </span>

                          {item.templateKind === 'document' && linkedTemplate && (
                            <>
                              <div className="flex-1 min-w-0">
                                <p className="text-[0.75rem] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                                  {linkedTemplate.originalFilename}
                                </p>
                                <span className="text-muted-foreground text-[0.6875rem]">
                                  {linkedTemplate.active ? 'Actif' : 'Inactif'} · v{linkedTemplate.version}
                                </span>
                              </div>
                              {/* Teinte calculee a l'execution (status.tone) : elle passe par
                                  style, une classe Tailwind ne peut pas naitre d'une variable. */}
                              <Button
                                variant="ghost"
                                size="sm"
                                style={{ color: status.tone.color }}
                                onClick={() => navigate(`/documents/templates/${linkedTemplate.id}`)}
                              >
                                <Visibility size={13} strokeWidth={1.75} />
                                Voir
                              </Button>
                            </>
                          )}

                          {item.templateKind === 'document' && !linkedTemplate && (
                            <>
                              <p className="flex-1 text-[0.75rem] text-foreground font-medium">
                                {t('documents.catalog.noTemplate')}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                style={{ color: status.tone.color, borderColor: status.tone.color }}
                                onClick={onOpenUpload}
                              >
                                <CloudUpload size={13} strokeWidth={1.75} />
                                {t('documents.catalog.uploadOdt')}
                              </Button>
                            </>
                          )}

                          {item.templateKind === 'message' && (
                            <>
                              <p className="flex-1 text-[0.75rem] text-foreground">
                                {t('documents.catalog.messagingTemplate')} <span className="font-semibold">{t('documents.catalog.messagingTab')}</span>
                              </p>
                              {onSwitchToMessagingTab && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  style={{ color: status.tone.color }}
                                  onClick={onSwitchToMessagingTab}
                                >
                                  <OpenInNew size={13} strokeWidth={1.75} />
                                  {t('documents.catalog.manage')}
                                </Button>
                              )}
                            </>
                          )}

                          {item.templateKind === 'hardcoded' && (
                            <p className="flex-1 text-[0.75rem] text-muted-foreground">
                              {t('documents.catalog.builtIn')}
                            </p>
                          )}

                          {item.templateKind === 'system-email' && (
                            <>
                              <p className="flex-1 text-[0.75rem] text-foreground">
                                {t('documents.catalog.systemEmail')} <span className="font-semibold">{t('documents.catalog.emailTab')}</span>
                              </p>
                              {onOpenSystemEmail && item.systemEmailKey && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  style={{ color: status.tone.color }}
                                  onClick={() => onOpenSystemEmail(item.systemEmailKey!)}
                                >
                                  <OpenInNew size={13} strokeWidth={1.75} />
                                  Personnaliser
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      ))}
      </Accordion>
    </div>
  );
};

export default TemplateCatalogAccordions;

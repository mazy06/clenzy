import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Button,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
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

// ─── Tons sémantiques (tokens Signature) ─────────────────────────────────────
// Mapping : étapes du parcours → ok/accent/warn ; documents PDF → err (pastille
// type), admin → muted. Les -soft viennent des tokens (dark mode automatique).
interface Tone { c: string; bg: string }

const TONES: Record<'ok' | 'accent' | 'warn' | 'err' | 'info' | 'muted', Tone> = {
  ok:     { c: 'var(--ok)',     bg: 'var(--ok-soft)' },
  accent: { c: 'var(--accent)', bg: 'var(--accent-soft)' },
  warn:   { c: 'var(--warn)',   bg: 'var(--warn-soft)' },
  err:    { c: 'var(--err)',    bg: 'var(--err-soft)' },
  info:   { c: 'var(--info)',   bg: 'var(--info-soft)' },
  muted:  { c: 'var(--muted)',  bg: 'var(--hover)' },
};

const chipSx = (tone: Tone) => ({ color: tone.c, bgcolor: tone.bg, '& .MuiChip-icon': { color: tone.c } });

// ─── Types ───────────────────────────────────────────────────────────────────

interface CatalogItem {
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
  id: string;
  label: string;
  icon: React.ReactNode;
  tone: Tone;
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
    label: 'Avant le sejour',
    icon: <EventAvailable />,
    tone: TONES.ok,
    items: [
      {
        id: 'checkin-instructions',
        name: 'Instructions check-in',
        description:
          'Envoye automatiquement N heures avant l\'arrivee du voyageur. ' +
          'Contient les instructions d\'acces, code WiFi, reglement interieur, informations parking, etc.',
        trigger: 'auto',
        triggerDetail: 'Scheduler automatique (configurable : X heures avant check-in)',
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
        name: 'Message de bienvenue',
        description:
          'Message de bienvenue envoye manuellement ou programme pour accueillir le voyageur. ' +
          'Peut contenir des informations personnalisees sur le logement.',
        trigger: 'manual',
        triggerDetail: 'Envoi manuel depuis la fiche reservation',
        recipient: 'Voyageur',
        channel: 'email',
        variables: ['guestName', 'guestFirstName', 'propertyName', 'propertyAddress', 'checkInDate', 'checkOutDate'],
        templateKind: 'message',
        messageLink: '/settings',
      },
      {
        id: 'pricing-push',
        name: 'Push tarification',
        description:
          'Envoi automatique des informations tarifaires au voyageur avant son arrivee. ' +
          'Inclut le detail des prix et les conditions.',
        trigger: 'auto',
        triggerDetail: 'Scheduler automatique (si active dans la configuration)',
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
    label: 'Pendant le sejour',
    icon: <Hotel />,
    tone: TONES.accent,
    items: [
      {
        id: 'noise-alert-owner',
        name: 'Alerte bruit — Proprietaire',
        description:
          'Email automatique envoye au proprietaire lorsque le niveau sonore depasse ' +
          'le seuil configure (avertissement ou critique). Contient le niveau mesure, le seuil, le creneau horaire.',
        trigger: 'auto',
        triggerDetail: 'Automatique (capteur Minut/Tuya — depassement de seuil)',
        recipient: 'Proprietaire',
        channel: 'email+in-app',
        templateKind: 'system-email',
        systemEmailKey: 'noise_alert_owner',
      },
      {
        id: 'noise-alert-guest',
        name: 'Alerte bruit — Voyageur',
        description:
          'Message automatique envoye au voyageur en cas de nuisance sonore detectee. ' +
          'Rappel du reglement interieur et demande de reduire le bruit.',
        trigger: 'auto',
        triggerDetail: 'Automatique (si active dans la config alerte bruit)',
        recipient: 'Voyageur',
        channel: 'email',
        templateKind: 'system-email',
        systemEmailKey: 'noise_alert_guest',
      },
      {
        id: 'custom-message',
        name: 'Message personnalise',
        description:
          'Template libre utilise pour envoyer des messages ad-hoc au voyageur. ' +
          'Toutes les variables d\'interpolation sont disponibles.',
        trigger: 'manual',
        triggerDetail: 'Envoi manuel depuis la fiche reservation',
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
    label: 'Fin du sejour',
    icon: <ExitToApp />,
    tone: TONES.warn,
    items: [
      {
        id: 'checkout-instructions',
        name: 'Instructions check-out',
        description:
          'Envoye automatiquement N heures avant le depart du voyageur. ' +
          'Contient les consignes de depart, instructions de remise des cles, etc.',
        trigger: 'auto',
        triggerDetail: 'Scheduler automatique (configurable : X heures avant check-out)',
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
    label: 'Documents commerciaux',
    icon: <Description />,
    tone: TONES.err,
    items: [
      {
        id: 'doc-devis',
        name: 'Devis',
        description: 'Document de devis genere a partir d\'un template .odt et converti en PDF. Peut etre envoye par email au client.',
        trigger: 'auto+manual',
        triggerDetail: 'Manuel ou declencheur automatique (evenement metier)',
        recipient: 'Client / Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'DEVIS',
      },
      {
        id: 'doc-facture',
        name: 'Facture',
        description: 'Document de facturation genere a partir d\'un template .odt. Soumis a la conformite NF (numerotation legale, hash, verrouillage).',
        trigger: 'auto+manual',
        triggerDetail: 'Manuel ou declencheur automatique (evenement metier)',
        recipient: 'Client / Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'FACTURE',
      },
      {
        id: 'doc-mandat',
        name: 'Mandat de gestion',
        description: 'Mandat de gestion locative formalisant la relation entre le proprietaire et Baitly.',
        trigger: 'manual',
        triggerDetail: 'Generation manuelle',
        recipient: 'Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'MANDAT_GESTION',
      },
      {
        id: 'doc-autorisation',
        name: 'Autorisation de travaux',
        description: 'Autorisation formelle pour la realisation de travaux dans un logement gere.',
        trigger: 'manual',
        triggerDetail: 'Generation manuelle',
        recipient: 'Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'AUTORISATION_TRAVAUX',
      },
      {
        id: 'doc-bon-intervention',
        name: 'Bon d\'intervention',
        description: 'Bon d\'intervention technique pour les prestataires et techniciens.',
        trigger: 'auto+manual',
        triggerDetail: 'Manuel ou automatique (intervention completee)',
        recipient: 'Technicien / Prestataire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'BON_INTERVENTION',
      },
      {
        id: 'doc-validation-mission',
        name: 'Validation fin de mission',
        description: 'Document de validation de fin de mission signe par le proprietaire ou le gestionnaire.',
        trigger: 'manual',
        triggerDetail: 'Generation manuelle',
        recipient: 'Technicien / Prestataire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'VALIDATION_FIN_MISSION',
      },
      {
        id: 'doc-justificatif-paiement',
        name: 'Justificatif de paiement',
        description: 'Justificatif de paiement pour le client ou le proprietaire.',
        trigger: 'manual',
        triggerDetail: 'Generation manuelle',
        recipient: 'Client / Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'JUSTIFICATIF_PAIEMENT',
      },
      {
        id: 'doc-justificatif-remboursement',
        name: 'Justificatif de remboursement',
        description: 'Justificatif de remboursement emis suite a une annulation ou un avoir.',
        trigger: 'manual',
        triggerDetail: 'Generation manuelle',
        recipient: 'Client / Proprietaire',
        channel: 'document',
        templateKind: 'document',
        documentType: 'JUSTIFICATIF_REMBOURSEMENT',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: <AdminPanelSettings />,
    tone: TONES.muted,
    items: [
      {
        id: 'invitation-org',
        name: 'Invitation organisation',
        description:
          'Email d\'invitation envoye a un utilisateur pour rejoindre une organisation Baitly. ' +
          'Contient un lien d\'invitation avec expiration.',
        trigger: 'manual',
        triggerDetail: 'Action administrateur (ajout membre)',
        recipient: 'Utilisateur invite',
        channel: 'email',
        templateKind: 'system-email',
        systemEmailKey: 'invitation_organization',
      },
      {
        id: 'notif-devis-landing',
        name: 'Notification demande de devis',
        description:
          'Email de notification interne genere lorsqu\'un prospect remplit le formulaire de demande de devis sur la landing page.',
        trigger: 'form',
        triggerDetail: 'Formulaire landing page',
        recipient: 'Equipe interne Baitly',
        channel: 'email',
        templateKind: 'system-email',
        systemEmailKey: 'quote_request_internal',
      },
      {
        id: 'notif-maintenance-landing',
        name: 'Notification demande maintenance',
        description:
          'Email de notification interne genere lorsqu\'un prospect remplit le formulaire de demande de maintenance sur la landing page.',
        trigger: 'form',
        triggerDetail: 'Formulaire landing page',
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
const TRIGGER_CONFIG: Record<string, { label: string; tone: Tone }> = {
  auto: { label: 'Automatique', tone: TONES.accent },
  manual: { label: 'Manuel', tone: TONES.muted },
  form: { label: 'Formulaire', tone: TONES.warn },
  'auto+manual': { label: 'Auto / Manuel', tone: TONES.ok },
};

const CHANNEL_CONFIG: Record<string, { label: string; tone: Tone }> = {
  email: { label: 'Email', tone: TONES.info },
  'in-app': { label: 'In-app', tone: TONES.ok },
  'email+in-app': { label: 'Email + In-app', tone: TONES.ok },
  document: { label: 'Document .odt', tone: TONES.err },
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
  const navigate = useNavigate();
  const [expandedGroup, setExpandedGroup] = useState<string | false>(false);

  const findLinkedTemplate = (item: CatalogItem): DocumentTemplate | undefined => {
    if (!item.documentType) return undefined;
    return templates.find(
      (t) => t.documentType === item.documentType && t.active,
    ) ?? templates.find((t) => t.documentType === item.documentType);
  };

  return (
    <Box sx={{ mb: 4 }}>
      {/* Section title — no forced uppercase, no aggressive letter-spacing (anti-pattern templated) */}
      <Typography
        variant="subtitle2"
        sx={{ mb: 1.5, color: 'text.secondary', fontSize: '0.78rem', fontWeight: 600 }}
      >
        Catalogue des templates par étape du parcours
      </Typography>

      {CATALOG_GROUPS.map((group) => (
        <Accordion
          key={group.id}
          expanded={expandedGroup === group.id}
          onChange={(_, isExpanded) => setExpandedGroup(isExpanded ? group.id : false)}
          disableGutters
          elevation={0}
          sx={{
            mb: 1,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px !important',
            '&:before': { display: 'none' },
            '&.Mui-expanded': { mb: 1 },
            transition: 'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1)',
            '&:hover': { borderColor: 'text.disabled' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore size={18} strokeWidth={1.75} />}
            sx={{
              borderRadius: '8px',
              cursor: 'pointer',
              '&.Mui-expanded': { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: '1px solid', borderColor: 'divider' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, width: '100%' }}>
              {/* Badge icone Baitly (tile 26x26, accent color, contraste WCAG AA+) */}
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: group.tone.bg,
                  color: group.tone.c,
                  flexShrink: 0,
                }}
              >
                {React.isValidElement(group.icon)
                  ? React.cloneElement(group.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                      size: 16,
                      strokeWidth: 1.75,
                    })
                  : group.icon}
              </Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', flex: 1, color: 'text.primary' }}>
                {group.label}
              </Typography>
              <Chip
                label={`${group.items.length} template${group.items.length > 1 ? 's' : ''}`}
                size="small"
                sx={chipSx(group.tone)}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {group.items.map((item, idx) => {
              const linkedTemplate = findLinkedTemplate(item);
              const trigger = TRIGGER_CONFIG[item.trigger] || TRIGGER_CONFIG.manual;
              const channel = CHANNEL_CONFIG[item.channel] || CHANNEL_CONFIG.email;

              return (
                <Box key={item.id}>
                  {idx > 0 && <Divider />}
                  <Box sx={{ p: 2 }}>
                    {/* Header : titre + chips meta uniformes (toutes en softChipSx) */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', flex: 1, minWidth: 0 }}>
                        {item.name}
                      </Typography>
                      <Chip label={trigger.label} size="small" sx={chipSx(trigger.tone)} />
                      <Chip label={channel.label} size="small" sx={chipSx(channel.tone)} />
                      <Chip label={item.recipient} size="small" sx={chipSx(TONES.muted)} />
                    </Box>

                    {/* Description */}
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem', mb: 1.25, lineHeight: 1.5 }}>
                      {item.description}
                    </Typography>

                    {/* Trigger detail */}
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
                      <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>Déclencheur :</Box> {item.triggerDetail}
                    </Typography>

                    {/* Variables — chips tres legeres (variant pure tag, font 10px, no border) */}
                    {item.variables && item.variables.length > 0 && (
                      <Box sx={{ mt: 1.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.625 }}>
                          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
                            <Code size={13} strokeWidth={1.75} />
                          </Box>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem' }}>
                            Variables disponibles
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {item.variables.map((v) => (
                            <Box
                              key={v}
                              component="code"
                              sx={{
                                fontFamily: '"SF Mono", Menlo, Consolas, monospace',
                                fontSize: '0.6875rem',
                                color: 'var(--accent)',
                                backgroundColor: 'var(--accent-soft)',
                                border: '1px solid',
                                borderColor: 'color-mix(in srgb, var(--accent) 24%, transparent)',
                                borderRadius: '4px',
                                px: 0.625,
                                py: '2px',
                                lineHeight: 1.5,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {`{${v}}`}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Footer status row — couleur tintee selon l'etat (palette Baitly) */}
                    {(() => {
                      // Etat = couleur d'accent + icone choisis selon le type de template
                      const status =
                        item.templateKind === 'document' && linkedTemplate
                          ? { tone: TONES.ok, icon: <CheckCircle size={16} strokeWidth={1.75} /> }
                          : item.templateKind === 'document' && !linkedTemplate
                          ? { tone: TONES.warn, icon: <Warning size={16} strokeWidth={1.75} /> }
                          : item.templateKind === 'message'
                          ? { tone: TONES.info, icon: <CheckCircle size={16} strokeWidth={1.75} /> }
                          : { tone: TONES.muted, icon: <CheckCircle size={16} strokeWidth={1.75} /> };

                      return (
                        <Box
                          sx={{
                            mt: 1.5,
                            px: 1.25,
                            py: 1,
                            borderRadius: 1.25,
                            backgroundColor: status.tone.bg,
                            border: '1px solid',
                            borderColor: `color-mix(in srgb, ${status.tone.c} 24%, transparent)`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <Box component="span" sx={{ display: 'inline-flex', color: status.tone.c, flexShrink: 0 }}>
                            {status.icon}
                          </Box>

                          {item.templateKind === 'document' && linkedTemplate && (
                            <>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {linkedTemplate.originalFilename}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem' }}>
                                  {linkedTemplate.active ? 'Actif' : 'Inactif'} · v{linkedTemplate.version}
                                </Typography>
                              </Box>
                              <Button
                                size="small"
                                startIcon={<Visibility size={13} strokeWidth={1.75} />}
                                onClick={() => navigate(`/documents/templates/${linkedTemplate.id}`)}
                                sx={{
                                  fontSize: '0.6875rem',
                                  textTransform: 'none',
                                  fontWeight: 600,
                                  color: status.tone.c,
                                  cursor: 'pointer',
                                  '&:hover': { backgroundColor: status.tone.bg },
                                }}
                              >
                                Voir
                              </Button>
                            </>
                          )}

                          {item.templateKind === 'document' && !linkedTemplate && (
                            <>
                              <Typography sx={{ flex: 1, fontSize: '0.75rem', color: 'text.primary', fontWeight: 500 }}>
                                Aucun template uploadé
                              </Typography>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<CloudUpload size={13} strokeWidth={1.75} />}
                                onClick={onOpenUpload}
                                sx={{
                                  fontSize: '0.6875rem',
                                  textTransform: 'none',
                                  fontWeight: 600,
                                  borderColor: `color-mix(in srgb, ${status.tone.c} 40%, transparent)`,
                                  color: status.tone.c,
                                  cursor: 'pointer',
                                  '&:hover': { borderColor: status.tone.c, backgroundColor: status.tone.bg },
                                }}
                              >
                                Uploader un template .odt
                              </Button>
                            </>
                          )}

                          {item.templateKind === 'message' && (
                            <>
                              <Typography sx={{ flex: 1, fontSize: '0.75rem', color: 'text.primary' }}>
                                Template de messagerie — configurable dans <Box component="span" sx={{ fontWeight: 600 }}>Templates messages</Box>
                              </Typography>
                              {onSwitchToMessagingTab && (
                                <Button
                                  size="small"
                                  startIcon={<OpenInNew size={13} strokeWidth={1.75} />}
                                  onClick={onSwitchToMessagingTab}
                                  sx={{
                                    fontSize: '0.6875rem',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    color: status.tone.c,
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: status.tone.bg },
                                  }}
                                >
                                  Gérer
                                </Button>
                              )}
                            </>
                          )}

                          {item.templateKind === 'hardcoded' && (
                            <Typography sx={{ flex: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
                              Template intégré au système — non modifiable
                            </Typography>
                          )}

                          {item.templateKind === 'system-email' && (
                            <>
                              <Typography sx={{ flex: 1, fontSize: '0.75rem', color: 'text.primary' }}>
                                Template email systeme — éditable dans <Box component="span" sx={{ fontWeight: 600 }}>Templates email</Box>
                              </Typography>
                              {onOpenSystemEmail && item.systemEmailKey && (
                                <Button
                                  size="small"
                                  startIcon={<OpenInNew size={13} strokeWidth={1.75} />}
                                  onClick={() => onOpenSystemEmail(item.systemEmailKey!)}
                                  sx={{
                                    fontSize: '0.6875rem',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    color: status.tone.c,
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: status.tone.bg },
                                  }}
                                >
                                  Personnaliser
                                </Button>
                              )}
                            </>
                          )}
                        </Box>
                      );
                    })()}
                  </Box>
                </Box>
              );
            })}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default TemplateCatalogAccordions;

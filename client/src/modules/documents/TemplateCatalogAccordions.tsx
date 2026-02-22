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
  alpha,
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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { DocumentTemplate } from '../../services/api/documentsApi';

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
  templateKind: 'document' | 'message' | 'hardcoded';
  /** DocumentType to match with uploaded .odt templates */
  documentType?: string;
  /** Link to message template management page */
  messageLink?: string;
}

interface CatalogGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
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
    color: '#1976d2',
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
    color: '#2e7d32',
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
        templateKind: 'hardcoded',
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
        templateKind: 'hardcoded',
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
    color: '#ed6c02',
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
    color: '#7b1fa2',
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
        description: 'Mandat de gestion locative formalisant la relation entre le proprietaire et Clenzy.',
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
    color: '#616161',
    items: [
      {
        id: 'invitation-org',
        name: 'Invitation organisation',
        description:
          'Email d\'invitation envoye a un utilisateur pour rejoindre une organisation Clenzy. ' +
          'Contient un lien d\'invitation avec expiration.',
        trigger: 'manual',
        triggerDetail: 'Action administrateur (ajout membre)',
        recipient: 'Utilisateur invite',
        channel: 'email',
        templateKind: 'hardcoded',
      },
      {
        id: 'notif-devis-landing',
        name: 'Notification demande de devis',
        description:
          'Email de notification interne genere lorsqu\'un prospect remplit le formulaire de demande de devis sur la landing page.',
        trigger: 'form',
        triggerDetail: 'Formulaire landing page',
        recipient: 'Equipe interne Clenzy',
        channel: 'email',
        templateKind: 'hardcoded',
      },
      {
        id: 'notif-maintenance-landing',
        name: 'Notification demande maintenance',
        description:
          'Email de notification interne genere lorsqu\'un prospect remplit le formulaire de demande de maintenance sur la landing page.',
        trigger: 'form',
        triggerDetail: 'Formulaire landing page',
        recipient: 'Equipe interne Clenzy',
        channel: 'email',
        templateKind: 'hardcoded',
      },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TRIGGER_CONFIG: Record<string, { label: string; color: 'info' | 'default' | 'warning' | 'secondary' }> = {
  auto: { label: 'Automatique', color: 'info' },
  manual: { label: 'Manuel', color: 'default' },
  form: { label: 'Formulaire', color: 'warning' },
  'auto+manual': { label: 'Auto / Manuel', color: 'secondary' },
};

const CHANNEL_CONFIG: Record<string, { label: string; color: 'primary' | 'success' | 'secondary' }> = {
  email: { label: 'Email', color: 'primary' },
  'in-app': { label: 'In-app', color: 'success' },
  'email+in-app': { label: 'Email + In-app', color: 'success' },
  document: { label: 'Document .odt', color: 'secondary' },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface TemplateCatalogAccordionsProps {
  templates: DocumentTemplate[];
  onOpenUpload: () => void;
}

const TemplateCatalogAccordions: React.FC<TemplateCatalogAccordionsProps> = ({ templates, onOpenUpload }) => {
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
      <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.75rem', fontWeight: 700 }}>
        Catalogue des templates par etape du parcours
      </Typography>

      {CATALOG_GROUPS.map((group) => (
        <Accordion
          key={group.id}
          expanded={expandedGroup === group.id}
          onChange={(_, isExpanded) => setExpandedGroup(isExpanded ? group.id : false)}
          disableGutters
          sx={{
            mb: 1,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px !important',
            '&:before': { display: 'none' },
            '&.Mui-expanded': { mb: 1 },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{
              borderRadius: '8px',
              '&.Mui-expanded': { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
              bgcolor: alpha(group.color, 0.04),
              '&:hover': { bgcolor: alpha(group.color, 0.08) },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <Box sx={{ color: group.color, display: 'flex' }}>
                {group.icon}
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', flex: 1 }}>
                {group.label}
              </Typography>
              <Chip
                label={`${group.items.length} template${group.items.length > 1 ? 's' : ''}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.6875rem', height: 22, borderColor: group.color, color: group.color }}
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
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', flex: 1 }}>
                        {item.name}
                      </Typography>
                      <Chip label={trigger.label} size="small" color={trigger.color} variant="outlined" sx={{ fontSize: '0.625rem', height: 20 }} />
                      <Chip label={channel.label} size="small" color={channel.color} variant="outlined" sx={{ fontSize: '0.625rem', height: 20 }} />
                      <Chip label={item.recipient} size="small" variant="outlined" sx={{ fontSize: '0.625rem', height: 20 }} />
                    </Box>

                    {/* Description */}
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem', mb: 1.5, lineHeight: 1.5 }}>
                      {item.description}
                    </Typography>

                    {/* Trigger detail */}
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
                      <strong>Declencheur :</strong> {item.triggerDetail}
                    </Typography>

                    {/* Variables */}
                    {item.variables && item.variables.length > 0 && (
                      <Box sx={{ mt: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                          <Code sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            Variables disponibles :
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {item.variables.map((v) => (
                            <Chip
                              key={v}
                              label={`{${v}}`}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontSize: '0.625rem',
                                height: 20,
                                fontFamily: 'monospace',
                                borderColor: 'grey.300',
                                color: 'text.secondary',
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Template link / upload zone */}
                    <Box
                      sx={{
                        mt: 2,
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: 'grey.50',
                        border: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      {item.templateKind === 'document' && linkedTemplate && (
                        <>
                          <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                              {linkedTemplate.originalFilename}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {linkedTemplate.active ? 'Actif' : 'Inactif'} — v{linkedTemplate.version}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            startIcon={<Visibility sx={{ fontSize: 14 }} />}
                            onClick={() => navigate(`/documents/templates/${linkedTemplate.id}`)}
                            sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
                          >
                            Voir
                          </Button>
                        </>
                      )}

                      {item.templateKind === 'document' && !linkedTemplate && (
                        <>
                          <Warning sx={{ fontSize: 18, color: 'warning.main' }} />
                          <Typography sx={{ flex: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
                            Aucun template uploade
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CloudUpload sx={{ fontSize: 14 }} />}
                            onClick={onOpenUpload}
                            sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
                          >
                            Uploader un template .odt
                          </Button>
                        </>
                      )}

                      {item.templateKind === 'message' && (
                        <>
                          <CheckCircle sx={{ fontSize: 18, color: 'info.main' }} />
                          <Typography sx={{ flex: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
                            Template de messagerie — configurable dans les parametres
                          </Typography>
                          {item.messageLink && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                              onClick={() => navigate(item.messageLink!)}
                              sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
                            >
                              Gerer
                            </Button>
                          )}
                        </>
                      )}

                      {item.templateKind === 'hardcoded' && (
                        <>
                          <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
                          <Typography sx={{ flex: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
                            Template integre au systeme — non modifiable
                          </Typography>
                        </>
                      )}
                    </Box>
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

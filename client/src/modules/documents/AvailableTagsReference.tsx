import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
  Alert,
} from '@mui/material';
import {
  ExpandMore,
  ContentCopy,
  Person,
  Home,
  Build,
  Assignment,
  Payment,
  Business,
  Computer,
  GppGood,
  Email,
} from '@mui/icons-material';

// ─── Définition de tous les tags disponibles (miroir de TagResolverService.java) ───

interface TagDefinition {
  tag: string;
  description: string;
  example: string;
  type: 'text' | 'date' | 'money' | 'number';
}

interface TagCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  tags: TagDefinition[];
}

const TAG_CATEGORIES: TagCategory[] = [
  {
    id: 'messaging',
    label: 'Messagerie guest',
    description: 'Variables pour les templates de messagerie envoyés aux voyageurs. Syntaxe : {variable}',
    icon: <Email />,
    color: '#1976d2',
    tags: [
      { tag: '{guestName}', description: 'Nom complet du voyageur', example: 'Jean Dupont', type: 'text' },
      { tag: '{guestFirstName}', description: 'Prénom du voyageur', example: 'Jean', type: 'text' },
      { tag: '{propertyName}', description: 'Nom de la propriété', example: 'Villa Méditerranée', type: 'text' },
      { tag: '{propertyAddress}', description: 'Adresse de la propriété', example: '12 rue de la Mer, 06000 Nice', type: 'text' },
      { tag: '{checkInDate}', description: 'Date d\'arrivée', example: '15/03/2025', type: 'date' },
      { tag: '{checkOutDate}', description: 'Date de départ', example: '20/03/2025', type: 'date' },
      { tag: '{checkInTime}', description: 'Heure d\'arrivée', example: '15:00', type: 'text' },
      { tag: '{checkOutTime}', description: 'Heure de départ', example: '11:00', type: 'text' },
      { tag: '{accessCode}', description: 'Code d\'accès au logement', example: '4521', type: 'text' },
      { tag: '{wifiName}', description: 'Nom du réseau WiFi', example: 'Villa-Guest', type: 'text' },
      { tag: '{wifiPassword}', description: 'Mot de passe WiFi', example: 'welcome2025', type: 'text' },
      { tag: '{parkingInfo}', description: 'Informations parking', example: 'Place n°12, sous-sol -1', type: 'text' },
      { tag: '{arrivalInstructions}', description: 'Instructions d\'arrivée', example: 'Entrez le code à la porte...', type: 'text' },
      { tag: '{departureInstructions}', description: 'Instructions de départ', example: 'Laissez les clés sur...', type: 'text' },
      { tag: '{houseRules}', description: 'Règlement intérieur', example: 'Pas de bruit après 22h...', type: 'text' },
      { tag: '{emergencyContact}', description: 'Contact d\'urgence', example: '+33 6 12 34 56 78', type: 'text' },
      { tag: '{confirmationCode}', description: 'Code de confirmation de la réservation', example: 'RES-2025-001', type: 'text' },
      { tag: '{checkInLink}', description: 'Lien de check-in en ligne', example: 'https://app.clenzy.com/checkin/abc123', type: 'text' },
      { tag: '{guideLink}', description: 'Lien du guide voyageur', example: 'https://app.clenzy.com/guide/abc123', type: 'text' },
    ],
  },
  {
    id: 'system',
    label: 'Système',
    description: 'Tags automatiques générés à chaque document. Syntaxe : ${category.field}',
    icon: <Computer />,
    color: '#607d8b',
    tags: [
      { tag: 'system.date', description: 'Date du jour', example: '15/01/2025', type: 'date' },
      { tag: 'system.datetime', description: 'Date et heure', example: '15/01/2025 14:30', type: 'date' },
      { tag: 'system.annee', description: 'Année en cours', example: '2025', type: 'text' },
      { tag: 'system.numero_auto', description: 'Numéro unique auto-généré (8 car.)', example: 'A3F2B1C9', type: 'text' },
    ],
  },
  {
    id: 'entreprise',
    label: 'Entreprise',
    description: 'Informations de votre société (configurées dans application.yml)',
    icon: <Business />,
    color: '#795548',
    tags: [
      { tag: 'entreprise.nom', description: 'Nom de la société', example: 'Clenzy', type: 'text' },
      { tag: 'entreprise.adresse', description: 'Adresse complète', example: '12 rue de la Paix, 75002 Paris', type: 'text' },
      { tag: 'entreprise.siret', description: 'Numéro SIRET', example: '123 456 789 00012', type: 'text' },
      { tag: 'entreprise.email', description: 'Email de contact', example: 'info@clenzy.fr', type: 'text' },
      { tag: 'entreprise.telephone', description: 'Téléphone', example: '01 23 45 67 89', type: 'text' },
    ],
  },
  {
    id: 'client',
    label: 'Client',
    description: 'Informations du client (propriétaire, demandeur ou utilisateur référencé)',
    icon: <Person />,
    color: '#1976d2',
    tags: [
      { tag: 'client.nom', description: 'Nom de famille', example: 'Dupont', type: 'text' },
      { tag: 'client.prenom', description: 'Prénom', example: 'Jean', type: 'text' },
      { tag: 'client.nom_complet', description: 'Nom complet (prénom + nom)', example: 'Jean Dupont', type: 'text' },
      { tag: 'client.email', description: 'Adresse email', example: 'jean.dupont@email.com', type: 'text' },
      { tag: 'client.telephone', description: 'Numéro de téléphone', example: '06 12 34 56 78', type: 'text' },
      { tag: 'client.societe', description: 'Nom de la société', example: 'Dupont SCI', type: 'text' },
      { tag: 'client.ville', description: 'Ville', example: 'Paris', type: 'text' },
      { tag: 'client.code_postal', description: 'Code postal', example: '75001', type: 'text' },
      { tag: 'client.role', description: 'Rôle dans le système', example: 'HOST', type: 'text' },
    ],
  },
  {
    id: 'technicien',
    label: 'Technicien',
    description: 'Informations du technicien assigné (mêmes champs que Client)',
    icon: <Person />,
    color: '#2e7d32',
    tags: [
      { tag: 'technicien.nom', description: 'Nom de famille', example: 'Martin', type: 'text' },
      { tag: 'technicien.prenom', description: 'Prénom', example: 'Pierre', type: 'text' },
      { tag: 'technicien.nom_complet', description: 'Nom complet', example: 'Pierre Martin', type: 'text' },
      { tag: 'technicien.email', description: 'Adresse email', example: 'p.martin@clenzy.fr', type: 'text' },
      { tag: 'technicien.telephone', description: 'Numéro de téléphone', example: '06 98 76 54 32', type: 'text' },
      { tag: 'technicien.societe', description: 'Société', example: 'Clenzy', type: 'text' },
      { tag: 'technicien.ville', description: 'Ville', example: 'Lyon', type: 'text' },
      { tag: 'technicien.code_postal', description: 'Code postal', example: '69001', type: 'text' },
      { tag: 'technicien.role', description: 'Rôle', example: 'TECHNICIAN', type: 'text' },
    ],
  },
  {
    id: 'property',
    label: 'Propriété',
    description: 'Informations du bien immobilier concerné',
    icon: <Home />,
    color: '#e65100',
    tags: [
      { tag: 'property.nom', description: 'Nom du bien', example: 'Appartement Marais', type: 'text' },
      { tag: 'property.adresse', description: 'Adresse complète', example: '5 rue des Rosiers', type: 'text' },
      { tag: 'property.ville', description: 'Ville', example: 'Paris', type: 'text' },
      { tag: 'property.code_postal', description: 'Code postal', example: '75004', type: 'text' },
      { tag: 'property.pays', description: 'Pays', example: 'France', type: 'text' },
      { tag: 'property.type', description: 'Type de bien', example: 'APARTMENT', type: 'text' },
      { tag: 'property.surface', description: 'Surface', example: '65 m²', type: 'text' },
      { tag: 'property.chambres', description: 'Nombre de chambres', example: '2', type: 'number' },
      { tag: 'property.salles_bain', description: 'Nombre de salles de bain', example: '1', type: 'number' },
      { tag: 'property.capacite', description: 'Capacité maximale (voyageurs)', example: '4', type: 'number' },
      { tag: 'property.prix_nuit', description: 'Prix par nuit', example: '120,00 €', type: 'money' },
      { tag: 'property.check_in', description: 'Heure de check-in', example: '15:00', type: 'text' },
      { tag: 'property.check_out', description: 'Heure de check-out', example: '11:00', type: 'text' },
      { tag: 'property.instructions_acces', description: "Instructions d'accès", example: 'Code porte: 1234A', type: 'text' },
    ],
  },
  {
    id: 'intervention',
    label: 'Intervention',
    description: "Détails de l'intervention (ménage, maintenance, réparation...)",
    icon: <Build />,
    color: '#6a1b9a',
    tags: [
      { tag: 'intervention.id', description: 'Identifiant unique', example: '1042', type: 'number' },
      { tag: 'intervention.titre', description: "Titre de l'intervention", example: 'Ménage post-départ', type: 'text' },
      { tag: 'intervention.description', description: 'Description détaillée', example: 'Nettoyage complet...', type: 'text' },
      { tag: 'intervention.type', description: "Type d'intervention", example: 'CLEANING', type: 'text' },
      { tag: 'intervention.statut', description: 'Statut actuel', example: 'COMPLETED', type: 'text' },
      { tag: 'intervention.priorite', description: 'Niveau de priorité', example: 'HIGH', type: 'text' },
      { tag: 'intervention.date_planifiee', description: 'Date planifiée', example: '20/01/2025', type: 'date' },
      { tag: 'intervention.date_debut', description: 'Date et heure de début', example: '20/01/2025 09:00', type: 'date' },
      { tag: 'intervention.date_fin', description: 'Date et heure de fin', example: '20/01/2025 12:30', type: 'date' },
      { tag: 'intervention.date_completion', description: 'Date de complétion', example: '20/01/2025 12:30', type: 'date' },
      { tag: 'intervention.duree_estimee', description: 'Durée estimée', example: '3h', type: 'text' },
      { tag: 'intervention.duree_reelle', description: 'Durée réelle', example: '210 min', type: 'text' },
      { tag: 'intervention.cout_estime', description: 'Coût estimé', example: '150,00 €', type: 'money' },
      { tag: 'intervention.cout_reel', description: 'Coût réel', example: '165,00 €', type: 'money' },
      { tag: 'intervention.notes', description: 'Notes générales', example: 'RAS', type: 'text' },
      { tag: 'intervention.notes_technicien', description: 'Notes du technicien', example: 'Produits fournis', type: 'text' },
      { tag: 'intervention.instructions', description: 'Instructions spéciales', example: 'Attention au parquet', type: 'text' },
      { tag: 'intervention.progression', description: 'Progression', example: '100%', type: 'text' },
    ],
  },
  {
    id: 'demande',
    label: 'Demande de service',
    description: 'Informations de la demande de service',
    icon: <Assignment />,
    color: '#00838f',
    tags: [
      { tag: 'demande.id', description: 'Identifiant unique', example: '507', type: 'number' },
      { tag: 'demande.titre', description: 'Titre de la demande', example: 'Réparation chauffe-eau', type: 'text' },
      { tag: 'demande.description', description: 'Description détaillée', example: 'Le chauffe-eau fuit...', type: 'text' },
      { tag: 'demande.type_service', description: 'Type de service', example: 'MAINTENANCE', type: 'text' },
      { tag: 'demande.priorite', description: 'Priorité', example: 'URGENT', type: 'text' },
      { tag: 'demande.statut', description: 'Statut', example: 'IN_PROGRESS', type: 'text' },
      { tag: 'demande.date_souhaitee', description: 'Date souhaitée', example: '25/01/2025', type: 'date' },
      { tag: 'demande.creneau', description: 'Créneau préféré', example: 'Matin', type: 'text' },
      { tag: 'demande.cout_estime', description: 'Coût estimé', example: '200,00 €', type: 'money' },
      { tag: 'demande.cout_reel', description: 'Coût réel', example: '185,00 €', type: 'money' },
      { tag: 'demande.instructions', description: 'Instructions spéciales', example: 'Accès par le garage', type: 'text' },
      { tag: 'demande.date_creation', description: 'Date de création', example: '18/01/2025 10:15', type: 'date' },
    ],
  },
  {
    id: 'paiement',
    label: 'Paiement',
    description: "Informations de paiement liées à l'intervention",
    icon: <Payment />,
    color: '#2e7d32',
    tags: [
      { tag: 'paiement.statut', description: 'Statut du paiement', example: 'PAID', type: 'text' },
      { tag: 'paiement.montant', description: 'Montant payé', example: '165,00 €', type: 'money' },
      { tag: 'paiement.date_paiement', description: 'Date du paiement', example: '22/01/2025 16:45', type: 'date' },
      { tag: 'paiement.reference_stripe', description: 'Référence Stripe', example: 'pi_3Ox...', type: 'text' },
    ],
  },
  {
    id: 'nf',
    label: 'Conformité NF',
    description: 'Tags de conformité NF injectés automatiquement pour FACTURE et DEVIS',
    icon: <GppGood />,
    color: '#f57c00',
    tags: [
      { tag: 'nf.numero_legal', description: 'Numéro légal séquentiel (sans trou)', example: 'FAC-2025-00001', type: 'text' },
      { tag: 'nf.date_emission', description: "Date d'émission du document", example: '18/01/2025', type: 'date' },
      { tag: 'nf.conditions_paiement', description: 'Conditions de paiement (FACTURE)', example: 'Paiement à réception...', type: 'text' },
      { tag: 'nf.duree_validite', description: 'Durée de validité (DEVIS)', example: 'Ce devis est valable 30 jours...', type: 'text' },
      { tag: 'nf.mentions', description: 'Liste des mentions légales obligatoires', example: '[Numéro, Date, ...]', type: 'text' },
    ],
  },
];

const TYPE_COLORS: Record<string, string> = {
  text: '#1976d2',
  date: '#e65100',
  money: '#2e7d32',
  number: '#6a1b9a',
};

const TYPE_LABELS: Record<string, string> = {
  text: 'Texte',
  date: 'Date',
  money: 'Montant',
  number: 'Nombre',
};

interface AvailableTagsReferenceProps {
  search: string;
}

const AvailableTagsReference: React.FC<AvailableTagsReferenceProps> = ({ search }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const handleToggleCategory = (categoryId: string) => {
    setExpandedCategory((prev) => (prev === categoryId ? null : categoryId));
  };

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText('${' + tag + '}');
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  // Filtrer les catégories et tags selon la recherche
  const filteredCategories = useMemo(() =>
    TAG_CATEGORIES.map((category) => ({
      ...category,
      tags: category.tags.filter(
        (t) =>
          !search ||
          t.tag.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
      ),
    })).filter((category) => category.tags.length > 0),
  [search]);

  const totalTags = TAG_CATEGORIES.reduce((sum, c) => sum + c.tags.length, 0);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {totalTags} tags disponibles dans {TAG_CATEGORIES.length} catégories
      </Typography>

      {/* Instructions */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Comment utiliser les tags :</strong> Dans votre fichier .odt, insérez les tags sous la forme{' '}
          <code style={{ backgroundColor: '#e3f2fd', padding: '2px 6px', borderRadius: 4 }}>
            {'${categorie.champ}'}
          </code>
          . Par exemple{' '}
          <code style={{ backgroundColor: '#e3f2fd', padding: '2px 6px', borderRadius: 4 }}>
            {'${client.nom}'}
          </code>{' '}
          sera remplacé par le nom du client.
          Cliquez sur l&apos;icône 📋 pour copier un tag prêt à coller.
        </Typography>
      </Alert>

      {/* Catégories de tags */}
      {filteredCategories.map((category) => (
        <Accordion
          key={category.id}
          expanded={expandedCategory === category.id}
          onChange={() => handleToggleCategory(category.id)}
          sx={{ mb: 1, '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <Box sx={{ color: category.color, display: 'flex', alignItems: 'center' }}>
                {category.icon}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{category.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {category.description}
                </Typography>
              </Box>
              <Chip
                label={`${category.tags.length} tags`}
                size="small"
                sx={{ backgroundColor: category.color + '20', color: category.color, fontWeight: 500 }}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600, width: '30%' }}>Tag</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: '30%' }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: '10%' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: '25%' }}>Exemple</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: '5%' }} align="center">Copier</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {category.tags.map((tagDef) => (
                    <TableRow
                      key={tagDef.tag}
                      hover
                      sx={{
                        '&:last-child td': { borderBottom: 0 },
                      }}
                    >
                      <TableCell>
                        <code
                          style={{
                            backgroundColor: '#f5f5f5',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: '0.85rem',
                            fontFamily: 'monospace',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          {'${' + tagDef.tag + '}'}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{tagDef.description}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={TYPE_LABELS[tagDef.type]}
                          size="small"
                          sx={{
                            backgroundColor: TYPE_COLORS[tagDef.type] + '15',
                            color: TYPE_COLORS[tagDef.type],
                            fontWeight: 500,
                            fontSize: '0.75rem',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          {tagDef.example}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={copiedTag === tagDef.tag ? 'Copié !' : 'Copier le tag'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyTag(tagDef.tag)}
                            sx={{
                              color: copiedTag === tagDef.tag ? 'success.main' : 'text.secondary',
                            }}
                          >
                            <ContentCopy sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}

      {filteredCategories.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">
            Aucun tag ne correspond à la recherche &quot;{search}&quot;
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default AvailableTagsReference;

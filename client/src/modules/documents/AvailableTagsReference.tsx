import React, { useState, useMemo } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import StatusChip, { type ToneTokens } from '../../components/StatusChip';
import { cn } from '../../utils/cn';
import {
  ContentCopy,
  Info,
  Person,
  Home,
  Build,
  Assignment,
  Payment,
  Business,
  Computer,
  GppGood,
  Email,
} from '../../icons';
// ─── Tons sémantiques (tokens Signature — pattern TONES) ─────────────────────
// Remplace l'ancienne palette hex Baitly : bleu doux → info, teal → ok,
// warm → warn, rouge doux → err, primary/violet → accent, warm-gray → muted.

interface Tone { c: string; bg: string }

const TONES: Record<'ok' | 'accent' | 'warn' | 'err' | 'info' | 'muted', Tone> = {
  ok:     { c: 'var(--ok)',     bg: 'var(--ok-soft)' },
  accent: { c: 'var(--accent)', bg: 'var(--accent-soft)' },
  warn:   { c: 'var(--warn)',   bg: 'var(--warn-soft)' },
  err:    { c: 'var(--err)',    bg: 'var(--err-soft)' },
  info:   { c: 'var(--info)',   bg: 'var(--info-soft)' },
  muted:  { c: 'var(--muted)',  bg: 'var(--hover)' },
};

// Le ton local nomme son encre `c` ; la primitive attend `color`.
const toneTokens = (tone: Tone): ToneTokens => ({ color: tone.c, bg: tone.bg });

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
  tone: Tone;
  tags: TagDefinition[];
}

const TAG_CATEGORIES: TagCategory[] = [
  {
    id: 'messaging',
    label: 'Messagerie guest',
    description: 'Variables pour les templates de messagerie envoyés aux voyageurs. Syntaxe : {variable}',
    icon: <Email />,
    tone: TONES.info,
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
    tone: TONES.muted,
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
    tone: TONES.accent,
    tags: [
      { tag: 'entreprise.nom', description: 'Nom de la société', example: 'Baitly', type: 'text' },
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
    tone: TONES.ok,
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
    tone: TONES.accent,
    tags: [
      { tag: 'technicien.nom', description: 'Nom de famille', example: 'Martin', type: 'text' },
      { tag: 'technicien.prenom', description: 'Prénom', example: 'Pierre', type: 'text' },
      { tag: 'technicien.nom_complet', description: 'Nom complet', example: 'Pierre Martin', type: 'text' },
      { tag: 'technicien.email', description: 'Adresse email', example: 'p.martin@clenzy.fr', type: 'text' },
      { tag: 'technicien.telephone', description: 'Numéro de téléphone', example: '06 98 76 54 32', type: 'text' },
      { tag: 'technicien.societe', description: 'Société', example: 'Baitly', type: 'text' },
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
    tone: TONES.warn,
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
    tone: TONES.err,
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
      { tag: 'intervention.prix_conseil', description: 'Prix conseillé par le moteur ménage', example: '95,00 €', type: 'money' },
      { tag: 'intervention.fourchette', description: 'Fourchette de prix conseil (min – max)', example: '80,00 € – 110,00 €', type: 'text' },
      { tag: 'intervention.duree_normee', description: 'Durée normée calculée par le moteur', example: '2h15', type: 'text' },
      { tag: 'intervention.decomposition', description: 'Décomposition des minutes par composant', example: 'Base : 120 min · Extérieur : 20 min', type: 'text' },
    ],
  },
  {
    id: 'menage',
    label: 'Devis ménage',
    description: 'Tags du devis ménage interne (moteur de tarification) — express / standard / grand ménage',
    icon: <Build />,
    tone: TONES.ok,
    tags: [
      { tag: 'menage.express_prix', description: 'Prix conseillé ménage express', example: '65,00 €', type: 'money' },
      { tag: 'menage.express_fourchette', description: 'Fourchette ménage express', example: '55,00 € – 75,00 €', type: 'text' },
      { tag: 'menage.express_duree', description: 'Durée normée ménage express', example: '1h30', type: 'text' },
      { tag: 'menage.standard_prix', description: 'Prix conseillé ménage standard', example: '95,00 €', type: 'money' },
      { tag: 'menage.standard_fourchette', description: 'Fourchette ménage standard', example: '80,00 € – 110,00 €', type: 'text' },
      { tag: 'menage.standard_duree', description: 'Durée normée ménage standard', example: '2h15', type: 'text' },
      { tag: 'menage.deep_prix', description: 'Prix conseillé grand ménage', example: '150,00 €', type: 'money' },
      { tag: 'menage.deep_fourchette', description: 'Fourchette grand ménage', example: '130,00 € – 175,00 €', type: 'text' },
      { tag: 'menage.deep_duree', description: 'Durée normée grand ménage', example: '3h35', type: 'text' },
      { tag: 'menage.decomposition', description: 'Décomposition des minutes par composant', example: 'Base : 120 min · Extérieur : 20 min', type: 'text' },
      { tag: 'menage.taux_horaire', description: 'Taux horaire de référence', example: '42,00 €/h', type: 'money' },
    ],
  },
  {
    id: 'demande',
    label: 'Demande de service',
    description: 'Informations de la demande de service',
    icon: <Assignment />,
    tone: TONES.accent,
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
    tone: TONES.ok,
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
    tone: TONES.warn,
    tags: [
      { tag: 'nf.numero_legal', description: 'Numéro légal séquentiel (sans trou)', example: 'FAC-2025-00001', type: 'text' },
      { tag: 'nf.date_emission', description: "Date d'émission du document", example: '18/01/2025', type: 'date' },
      { tag: 'nf.conditions_paiement', description: 'Conditions de paiement (FACTURE)', example: 'Paiement à réception...', type: 'text' },
      { tag: 'nf.duree_validite', description: 'Durée de validité (DEVIS)', example: 'Ce devis est valable 30 jours...', type: 'text' },
      { tag: 'nf.mentions', description: 'Liste des mentions légales obligatoires', example: '[Numéro, Date, ...]', type: 'text' },
    ],
  },
];

// Tons des types — sémantique tokens (texte = neutre, date = info, montant = ok, nombre = accent).
const TYPE_TONES: Record<string, Tone> = {
  text:   TONES.muted,
  date:   TONES.info,
  money:  TONES.ok,
  number: TONES.accent,
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

// Style cohérent partagé pour les chips ${...} (memes proportions que
// TemplateCatalogAccordions : monospace, accent tinted, font 0.7rem).
// Puce de code inline. La pile mono est posee en propriete arbitraire plutot
// qu'avec `font-mono` : la classe Tailwind par defaut n'a pas la meme pile.
const CODE_CHIP_CLASS =
  'inline-block whitespace-nowrap rounded-[4px] border border-solid ' +
  'border-[color-mix(in_srgb,_var(--accent)_25%,_transparent)] bg-[var(--accent-soft)] ' +
  'px-[3.75px] py-[2px] text-[0.7rem] leading-normal text-[var(--accent)] ' +
  "[font-family:'SF_Mono',_Menlo,_Consolas,_monospace]";

const AvailableTagsReference: React.FC<AvailableTagsReferenceProps> = ({ search }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText('${' + tag + '}');
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  // Filtrer les catégories et tags selon la recherche
  const filteredCategories = useMemo(() =>
    TAG_CATEGORIES.flatMap((category) => {
      const tags = category.tags.filter(
        (t) =>
          !search ||
          t.tag.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
      );
      return tags.length > 0 ? [{ ...category, tags }] : [];
    }),
  [search]);

  const totalTags = TAG_CATEGORIES.reduce((sum, c) => sum + c.tags.length, 0);

  return (
    <div>
      <p className="cn-text-body2 text-muted-foreground mb-3 text-[0.78rem]">
        {totalTags} tags disponibles dans {TAG_CATEGORIES.length} catégories
      </p>

      {/* Instructions — icone lucide ContentCopy inline (plus d'emoji) */}
      <Alert variant="info" className="mb-[18px]">
        <Info />
        <AlertDescription className="cn-text-body2 text-[0.8125rem] leading-[1.6]">
          <strong className="font-semibold">Comment utiliser les tags :</strong>{' '}
          Dans votre fichier .odt, insérez les tags sous la forme{' '}
          <code className={CODE_CHIP_CLASS}>{'${categorie.champ}'}</code>
          . Par exemple{' '}
          <code className={CODE_CHIP_CLASS}>{'${client.nom}'}</code>{' '}
          sera remplacé par le nom du client. Cliquez sur l&apos;icône{' '}
          <span className="inline-flex align-[middle] text-[var(--info)] mx-[1.5px]">
            <ContentCopy size={13} strokeWidth={1.75} />
          </span>{' '}
          à droite de chaque ligne pour copier un tag prêt à coller.
        </AlertDescription>
      </Alert>

      {/* Catégories de tags — un seul Accordion pilote, une categorie ouverte a la fois */}
      <Accordion
        type="single"
        collapsible
        value={expandedCategory ?? ''}
        onValueChange={(value) => setExpandedCategory(value || null)}
      >
      {filteredCategories.map((category) => (
        <AccordionItem
          key={category.id}
          value={category.id}
          className="mb-1.5 rounded-[8px] border border-solid border-[var(--line)] transition-[border-color] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--faint)]"
        >
          <AccordionTrigger className="cursor-pointer rounded-[8px] px-3 aria-expanded:rounded-b-none aria-expanded:border-b aria-expanded:border-solid aria-expanded:border-b-[var(--line)]">
            <div className="flex items-center gap-2 w-full min-w-0">
              {/* Badge icone Baitly (tile 26x26 tintee, icon 16px) */}
              <div className="w-[26px] h-[26px] rounded-[8px] inline-flex items-center justify-center shrink-0" style={{ backgroundColor: category.tone.bg, color: category.tone.c }}>
                {React.isValidElement(category.icon)
                  ? React.cloneElement(category.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                      size: 16,
                      strokeWidth: 1.75,
                    })
                  : category.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="cn-text-body1 font-semibold text-[0.875rem] text-foreground">
                  {category.label}
                </p>
                <span className="cn-text-caption text-muted-foreground text-[0.7rem] block leading-[1.4]">
                  {category.description}
                </span>
              </div>
              <StatusChip
                tokens={toneTokens(category.tone)}
                label={`${category.tags.length} tags`}
              />
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                {/* Header de table tres subtil (au lieu d'un survol agressif) */}
                <TableHeader className="bg-[var(--bg)] [&_th]:py-1.5 [&_th]:text-[0.7rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.02em] [&_th]:text-[var(--muted)] [&_th]:border-b [&_th]:border-solid [&_th]:border-b-[var(--line)]">
                  <TableRow>
                    <TableHead className="w-[30%]">Tag</TableHead>
                    <TableHead className="w-[30%]">Description</TableHead>
                    <TableHead className="w-[10%]">Type</TableHead>
                    <TableHead className="w-[25%]">Exemple</TableHead>
                    <TableHead className="w-[5%] text-center">Copier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {category.tags.map((tagDef) => (
                    <TableRow
                      key={tagDef.tag}
                      className="hover:bg-[var(--hover)] last:[&_td]:border-b-0"
                    >
                      <TableCell>
                        <code className={CODE_CHIP_CLASS}>
                          {'${' + tagDef.tag + '}'}
                        </code>
                      </TableCell>
                      <TableCell>
                        <p className="cn-text-body2 text-[0.8125rem]">
                          {tagDef.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          tokens={toneTokens(TYPE_TONES[tagDef.type])}
                          label={TYPE_LABELS[tagDef.type]}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="cn-text-body2 text-muted-foreground italic text-[0.8125rem]">
                          {tagDef.example}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleCopyTag(tagDef.tag)}
                              aria-label={`Copier le tag ${tagDef.tag}`}
                              className={cn(
                                'transition-colors duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                                'hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]',
                                copiedTag === tagDef.tag ? 'text-[var(--ok)]' : 'text-[var(--muted)]',
                              )}
                            >
                              <ContentCopy size={15} strokeWidth={1.75} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {copiedTag === tagDef.tag ? 'Copié !' : 'Copier le tag'}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
      </Accordion>

      {filteredCategories.length === 0 && (
        <div className="text-center py-6">
          <p className="cn-text-body1 text-muted-foreground">
            Aucun tag ne correspond à la recherche &quot;{search}&quot;
          </p>
        </div>
      )}
    </div>
  );
};

export default AvailableTagsReference;

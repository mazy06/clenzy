# Module Documents — Clenzy PMS

> Etat des fonctionnalites du module de generation et gestion de documents.
> Derniere mise a jour : 17 fevrier 2025

---

## Stockage

Les documents generes (PDF) et les templates (ODT) sont stockes **sur le systeme de fichiers du VPS** via des volumes Docker nommes — **jamais en base PostgreSQL**.

| Volume Docker | Chemin conteneur | Contenu |
|---|---|---|
| `document-templates-{env}` | `/app/uploads/templates` | Fichiers .odt des templates |
| `document-generated-{env}` | `/app/uploads/documents` | PDF generes (organises par type/mois) |
| `contact-uploads-{env}` | `/app/uploads/contact` | Fichiers joints contacts |

Structure sur disque des documents generes :
```
/app/uploads/documents/
  FACTURE/
    2025-02/
      a1b2c3d4_facture-client-001.pdf
  DEVIS/
    2025-02/
      e5f6g7h8_devis-renovation.pdf
```

Volumes definis dans les 3 environnements : **dev** / **staging** / **prod**.

---

## Workflow metier — Declencheurs automatiques

```
Host cree une Demande de service
         |
         v
   Admin approuve (APPROVED)
         |
         +---> DEVIS genere + envoye au Host
         |
         v
   Host accepte le devis
         |
         +---> AUTORISATION_TRAVAUX generee + envoyee au Host
         |
         v
   Paiement Stripe (PAID)
         |
         +---> FACTURE generee (NF, numerotation legale)
         +---> JUSTIFICATIF_PAIEMENT genere
         |     (les deux envoyes au Host)
         |
         v
   Intervention planifiee -> IN_PROGRESS
         |
         +---> BON_INTERVENTION genere + envoye au Technicien
         |
         v
   Intervention -> COMPLETED
         |
         +---> VALIDATION_FIN_MISSION generee
         |     (envoyee au Host + Technicien)
         |
         v
   [Si remboursement Stripe]
         |
         +---> JUSTIFICATIF_REMBOURSEMENT genere + envoye au Host
```

### Matrice des 8 types de documents

| # | Type | Declencheur automatique | Destinataire email | NF | Kafka topic |
|---|------|------------------------|-------------------|-----|-------------|
| 1 | `DEVIS` | Demande de service approuvee (APPROVED) | Client (Host) | Oui (DEV-YYYY-NNNNN) | `documents.generate` |
| 2 | `AUTORISATION_TRAVAUX` | Client accepte le devis | Client (Host) | Non | `documents.generate` |
| 3 | `BON_INTERVENTION` | Intervention -> IN_PROGRESS | Technicien | Non | `documents.generate` |
| 4 | `VALIDATION_FIN_MISSION` | Intervention -> COMPLETED | Client + Technicien | Non | `documents.generate` |
| 5 | `FACTURE` | Paiement Stripe confirme (PAID) | Client (Host) | Oui (FAC-YYYY-NNNNN) | `documents.generate` |
| 6 | `JUSTIFICATIF_PAIEMENT` | Paiement Stripe confirme (PAID) — meme temps que FACTURE | Client (Host) | Non | `documents.generate` |
| 7 | `JUSTIFICATIF_REMBOURSEMENT` | Remboursement Stripe (REFUNDED) | Client (Host) | Non | `documents.generate` |
| 8 | `MANDAT_GESTION` | **Standby** — declencheur a definir | Client (Host) | Non | Manuel seulement |

### Points d'integration (code)

| Declencheur | Fichier source | Evenement |
|---|---|---|
| ServiceRequest -> APPROVED | `ServiceRequestService.java` | Publier DEVIS sur Kafka |
| Devis accepte par le Host | A definir (endpoint acceptation) | Publier AUTORISATION_TRAVAUX |
| Payment PAID (Stripe webhook) | `StripeWebhookController.java` | Publier FACTURE + JUSTIFICATIF_PAIEMENT |
| Intervention -> IN_PROGRESS | `InterventionService.java` | Publier BON_INTERVENTION |
| Intervention -> COMPLETED | `InterventionService.java` | Publier VALIDATION_FIN_MISSION |
| Payment REFUNDED | `StripeWebhookController.java` | Publier JUSTIFICATIF_REMBOURSEMENT |

---

## Fonctionnalites implementees (v1)

### 1. Generation de documents (Pipeline complet)

| Etape | Description | Statut |
|---|---|---|
| 1 | Trouver le template actif pour le type de document | OK |
| 2 | Creer un enregistrement `DocumentGeneration` (PENDING) | OK |
| 2.5 | **[NF]** Generer le numero legal sequentiel (FACTURE/DEVIS) | OK |
| 3 | Charger le fichier .odt du template | OK |
| 3.5 | **[NF]** Injecter les tags NF (numero legal, mentions legales) | OK |
| 4 | Resoudre les tags dynamiques (`TagResolverService`) | OK |
| 5 | Remplir le template via XDocReport + Freemarker | OK |
| 6 | Convertir en PDF via Gotenberg (LibreOffice headless) | OK |
| 7 | Stocker le PDF sur le volume Docker | OK |
| 8 | Mettre a jour l'enregistrement (COMPLETED) | OK |
| 8.5 | **[NF]** Verrouiller le document (hash SHA-256, locked=true) | OK |
| 9 | Notification + audit log + event Kafka | OK |
| 10 | Envoi par email si demande (SMTP) | OK |

### 2. Gestion des templates

- Upload de templates .odt avec parsing automatique des tags
- Activation/desactivation de templates
- Reparsing des tags
- Versioning (champ `version`)
- Un seul template actif par type de document
- Types de documents : `DEVIS`, `FACTURE`, `BON_INTERVENTION`, `VALIDATION_FIN_MISSION`, `JUSTIFICATIF_PAIEMENT`, `JUSTIFICATIF_REMBOURSEMENT`, `MANDAT_GESTION`, `AUTORISATION_TRAVAUX`

### 3. Historique des generations

- Liste paginee de toutes les generations
- Colonnes : date, N. legal, type, template, fichier, taille, statut, email, duree
- Telechargement des PDF generes
- Statuts : `PENDING`, `GENERATING`, `COMPLETED`, `FAILED`, `SENT`, `LOCKED`, `ARCHIVED`

### 4. Tags dynamiques

- **9 categories** de tags : `system`, `entreprise`, `client`, `technicien`, `property`, `intervention`, `demande`, `paiement`, `nf`
- Resolution automatique depuis les entites metier (Client, Intervention, Property, etc.)
- Onglet "Tags disponibles" avec reference complete

### 5. Conformite NF (Norme Francaise) — Base

| Fonctionnalite | Detail | Statut |
|---|---|---|
| Numerotation sequentielle sans trous | `FAC-2025-00001`, `DEV-2025-00001` — Pessimistic lock SQL | OK |
| Hash SHA-256 | Calcule sur le PDF apres generation | OK |
| Verrouillage (immutabilite) | `locked=true`, `locked_at` apres generation FACTURE/DEVIS | OK |
| Verification d'integrite | Endpoint + bouton UI pour recalculer et comparer le hash | OK |
| Validation conformite templates | Score 0-100, mentions manquantes detectees | OK |
| Documents correctifs (avoir) | Liaison via `corrects_id` FK | OK |
| Recherche par N. legal | Endpoint + champ de recherche dans le dashboard | OK |
| Dashboard Conformite NF | 4eme onglet : stats, recherche, verification templates | OK |
| Mentions legales initiales | FACTURE (7), DEVIS (5), BON_INTERVENTION (3) | OK |
| Permission `documents:compliance` | Role ADMIN uniquement | OK |

### 6. Envoi par email

- Envoi automatique du PDF en piece jointe
- Sujet et corps configurables par template (`emailSubject`, `emailBody`)
- Suivi du statut email (`emailStatus`, `emailSentAt`)
- SMTP configurable par environnement

### 7. Metriques (Micrometer / Prometheus)

- `clenzy.documents.generation.success` — compteur generations reussies
- `clenzy.documents.generation.failure` — compteur echecs
- `clenzy.documents.generation.duration` — temps de generation
- `clenzy.storage.documents.total_bytes` — taille totale stockage
- `clenzy.storage.documents.file_count` — nombre de fichiers
- `clenzy.storage.documents.disk_free_bytes` — espace disque libre

---

## Fonctionnalites NON implementees (v2+)

Les elements suivants ont ete identifies lors de l'audit de conformite NF mais ne sont **pas encore implementes**. Ils seront traites dans une prochaine version du PMS.

### Priorite haute

| # | Fonctionnalite | Description |
|---|---|---|
| 1 | **Blocage activation template non conforme** | Empecher l'activation d'un template qui ne contient pas toutes les mentions legales obligatoires pour son type |
| 2 | **Contrainte DB anti-suppression** | Ajouter une regle/trigger SQL empechant le `DELETE` sur les documents verrouilles (`locked=true`) |

### Priorite moyenne

| # | Fonctionnalite | Description |
|---|---|---|
| 3 | **Numerotation etendue** | Etendre la numerotation legale a tous les types de documents (pas seulement FACTURE/DEVIS) |
| 4 | **Mentions legales tous types** | Definir les mentions obligatoires pour les 8 types de documents |
| 5 | **Systeme d'archivage** | `ArchiveService` avec retention reglementaire 10 ans, table `document_archive` |
| 6 | **Logging consultations/telechargements** | Tracer chaque telechargement et consultation dans l'audit log |
| 7 | **Signature electronique devis** | Permettre au Host de signer electroniquement un devis avant declenchement AUTORISATION_TRAVAUX |

### Priorite basse

| # | Fonctionnalite | Description |
|---|---|---|
| 8 | **Versioning template a la generation** | Stocker quelle version du template a ete utilisee pour chaque generation |
| 9 | **Audit logs immuables** | Proteger les logs d'audit contre la modification (table append-only, trigger SQL) |

### A definir

| # | Fonctionnalite | Description |
|---|---|---|
| 10 | **Declencheur MANDAT_GESTION** | Determiner le moment exact ou generer le mandat de gestion (inscription ? premiere property ? manuel ?) |

---

## Architecture technique

### Backend (Spring Boot)

| Couche | Fichiers |
|---|---|
| **Entites** | `DocumentTemplate`, `DocumentTemplateTag`, `DocumentGeneration`, `DocumentNumberSequence`, `DocumentLegalRequirement`, `TemplateComplianceReport` |
| **Enums** | `DocumentType` (8 types), `DocumentGenerationStatus` (7 statuts), `TagCategory` (9 categories), `TagType` |
| **Repositories** | `DocumentTemplateRepository`, `DocumentTemplateTagRepository`, `DocumentGenerationRepository`, `DocumentNumberSequenceRepository`, `DocumentLegalRequirementRepository`, `TemplateComplianceReportRepository` |
| **Services** | `DocumentGeneratorService` (pipeline), `DocumentStorageService`, `DocumentTemplateStorageService`, `TemplateParserService`, `TagResolverService`, `LibreOfficeConversionService`, `DocumentNumberingService`, `DocumentComplianceService`, `DocumentEventService` |
| **DTOs** | `DocumentTemplateDto`, `DocumentTemplateTagDto`, `DocumentGenerationDto`, `ComplianceReportDto`, `ComplianceStatsDto`, `GenerateDocumentRequest` |
| **Controller** | `DocumentController` — 15+ endpoints REST |
| **Config** | `LegalRequirementsInitializer` (mentions au demarrage) |
| **Migrations** | `V29` (templates), `V30` (generations), `V31` (conformite NF) |

### Frontend (React + MUI)

| Composant | Description |
|---|---|
| `DocumentsPage.tsx` | Page principale avec 4 onglets (boutons dans la barre de tabs) |
| `TemplatesList.tsx` | Gestion des templates (CRUD, upload, activation) |
| `GenerationsList.tsx` | Historique avec N. legal, verification integrite |
| `AvailableTagsReference.tsx` | Reference des tags disponibles (9 categories + NF) |
| `ComplianceDashboard.tsx` | Dashboard conformite NF (stats, recherche, verification) |
| `GenerateDialog.tsx` | Dialog de generation de document |
| `TemplateDetailDialog.tsx` | Detail d'un template (tags, config email) |
| `documentsApi.ts` | Client API avec 20+ methodes |

### Infrastructure

| Service | Image | Role |
|---|---|---|
| Gotenberg | `gotenberg/gotenberg:8` | Conversion ODT -> PDF (LibreOffice headless) |
| Kafka | `confluentinc/cp-kafka:7.6.0` | Events asynchrones (generation, notifications) |
| PostgreSQL | `postgres:15-alpine` | Metadonnees documents (pas les fichiers) |
| Redis | `redis:7-alpine` | Cache |

### Endpoints API principaux

| Methode | URL | Description |
|---|---|---|
| `GET` | `/api/documents/templates` | Lister les templates |
| `POST` | `/api/documents/templates` | Upload template .odt |
| `PUT` | `/api/documents/templates/{id}` | Modifier template |
| `PUT` | `/api/documents/templates/{id}/activate` | Activer template |
| `DELETE` | `/api/documents/templates/{id}` | Supprimer template |
| `POST` | `/api/documents/templates/{id}/reparse` | Reparser les tags |
| `POST` | `/api/documents/generate` | Generer un document |
| `GET` | `/api/documents/generations` | Historique pagine |
| `GET` | `/api/documents/generations/{id}/download` | Telecharger PDF |
| `GET` | `/api/documents/generations/{id}/verify` | Verifier integrite SHA-256 |
| `POST` | `/api/documents/templates/{id}/compliance-check` | Verifier conformite template |
| `GET` | `/api/documents/compliance/stats` | Stats conformite NF |
| `GET` | `/api/documents/generations/by-number/{legalNumber}` | Recherche par N. legal |
| `POST` | `/api/documents/generations/{id}/correct` | Document correctif |
| `GET` | `/api/documents/types` | Types de documents |
| `GET` | `/api/documents/tag-categories` | Categories de tags |

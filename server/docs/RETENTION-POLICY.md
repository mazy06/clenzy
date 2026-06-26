# Politique de rétention & d'archivage des données — Baitly (PMS location courte durée)

> **Périmètre** : durées légales de conservation et règles d'archivage/purge des données du PMS,
> conformes aux **exigences des OTA** (partenariat Airbnb / Booking.com) et à la **réglementation
> fiscale et légale** de la **France**, du **Maroc** et de l'**Arabie Saoudite**.
> Pilote la configuration de l'archivage froid (`clenzy.archival.*`, cf. [COLD_ARCHIVE.md](COLD_ARCHIVE.md)).
>
> Dernière revue documentaire : **2026-06-26**.

> ## ⚠️ Ce document n'est PAS un avis juridique
> Synthèse documentaire destinée à cadrer une politique technique. **À faire valider par un
> avocat / DPO qualifié dans chaque juridiction** avant activation en production. Les points
> incertains sont listés au §7 et ne doivent pas être traités comme certains.

---

## 1. Principe directeur

Une organisation peut opérer dans les **trois juridictions** (FR, MA, KSA) à la fois. La politique
retient donc, pour chaque donnée, **la durée la plus longue applicable** (« MAX »), sauf pour les
données soumises à une **obligation de purge** (ex. fiche de police), où sur-conserver = non-conformité.

Deux notions à ne jamais confondre :
- **Durée de conservation** = obligation de *garder* le document.
- **Droit de reprise / prescription** = durée pendant laquelle on peut être *contrôlé/poursuivi*.
Une politique prudente prend le **max des deux**.

---

## 2. Matrice — catégorie × juridiction × durée × base légale

| Catégorie | 🇫🇷 France | 🇲🇦 Maroc | 🇸🇦 Arabie Saoudite | Base légale (sources) |
|---|---|---|---|---|
| Factures / pièces comptables justificatives | **10 ans** | **10 ans** | **10 ans** (livres) | FR C. com. L123-22 · MA CGI art. 211 / loi 9-88 · KSA Law of Commercial Books (M/61) art. 8 |
| Livres & registres comptables | 10 ans | 10 ans | 10 ans | idem |
| Documents / déclarations fiscaux (TVA, IR/IS) | 6 ans (LPF L102 B) | 10 ans (CGI 211) | **6 ans** (ZATCA VAT Reg.) | FR LPF L102 B · MA CGI 211 · KSA ZATCA VAT Implementing Reg. |
| Factures TVA **rattachées à un bien immobilier** | — | — | **15 ans** (10+5) | KSA ZATCA VAT Reg. art. Records + art. 52 |
| Droit de reprise (à surveiller) | 3 ans (→ 10 ans activité occulte) | 4 ans (CGI 232) | — | FR LPF L169/L176 · MA CGI 232 |
| Contrat électronique conso **≥ 120 €** (réservation en ligne) | **10 ans** | — | — | FR C. conso. L213-1 + D213-1/D213-2 (décret 2016-884) |
| Contrats commerciaux / mandats de gestion | 5 ans (prescription, C. civ. 2224) ; mandat Hoguet : **non chiffré** | — | — | FR C. com. L110-4 · décret 72-678 art. 65 (silencieux) |
| Réservations / contrats de séjour | rattaché au contrat électronique (10 ans si ≥120 €) | — | — | FR D213-2 |
| Données personnelles voyageur (PII) | durée nécessaire + archivage intermédiaire 5 ans | durée nécessaire (loi 09-08 art. 3) | détruire dès finalité (PDPL) | RGPD art. 5/17 · MA loi 09-08 · KSA PDPL (SDAIA) |
| Données de paiement — CVV | **jamais** stocké | idem | idem | CNIL délib. 2018-303 |
| Données de paiement — PAN | délégué au PSP (Stripe), non stocké | idem | idem | CNIL 2018-303 / PCI-DSS |
| Données de paiement — preuve de contestation | **13 mois** (15 si débit différé) | — | — | CNIL 2018-303 + CMF L133-24 |
| **Fiche de police / déclaration voyageurs étrangers** | **purge à 6 mois** | obligation de déclaration DGSN (durée locale non chiffrée) | transmission Shomoos (durée non publiée) | FR CESEDA R814-1/R814-3 |

Sources primaires : Légifrance, service-public.fr, BOFiP, CNIL ; ZATCA, MISA/WTO, SDAIA (KSA) ;
CNDP, ministère du Tourisme (MA). Détail et URL : voir le rapport de recherche associé (PDF).

---

## 3. Durée à retenir (MAX des obligations) — politique appliquée

| Catégorie | **Durée retenue** | Action en fin de vie |
|---|---|---|
| Factures / pièces comptables / livres | **10 ans** | archivage froid immuable (WORM) |
| Factures TVA rattachées à un bien immobilier | **15 ans** | archivage froid immuable (cas KSA) |
| Documents fiscaux / TVA | **10 ans** | archivage froid immuable |
| Contrats / mandats / réservations en ligne ≥ 120 € | **10 ans** | archivage froid immuable |
| PII voyageur **figurant sur facture/contrat** | bornée par le comptable (**10 ans**) | conservée en archivage restreint (obligation légale prime sur l'effacement) |
| PII voyageur **non probante** (préférences, navigation, marketing) | effacer/anonymiser dès finalité ; prospection **3 ans** max | suppression ou anonymisation |
| Paiement — preuve de contestation | **13–15 mois** | suppression |
| Fiche de police étrangers | **6 mois** | **purge automatique obligatoire** |

> **Règle d'architecture** : une seule borne « comptable/fiscal = **10 ans** (15 ans pour le
> rattachement immobilier KSA) » couvre les trois juridictions sans sous-conformité. À l'inverse,
> la fiche de police exige une **purge stricte à 6 mois**.

---

## 4. Cycle de vie & tension RGPD / PDPL / loi 09-08

Le droit à l'effacement **ne s'applique pas** quand la conservation est imposée par la loi
(RGPD art. 17.3.b « obligation légale » + art. 17.3.e « défense de droits en justice » ; PDPL et
loi 09-08 réservent l'obligation légale). Une demande de suppression (voyageur ou OTA) **ne prime
jamais** sur l'obligation comptable/fiscale.

Cycle en **3 phases** (doctrine CNIL « archivage intermédiaire ») :

| Phase | Contenu | Durée | Accès |
|---|---|---|---|
| **Base active** | séjour en cours, relation client active | durée de la finalité | équipes opérationnelles |
| **Archivage intermédiaire** | données à valeur probante (nom sur facture, montants, contrat) | 5 ans → **10 ans** (comptable/fiscal) | restreint, base/stockage séparé, accès habilité ponctuel |
| **Suppression / anonymisation** | au terme de la dernière obligation | — | — |

Tri concret des PII voyageur :
- **Supprimer dès finalité / sur demande** : préférences, historique, messages non probants, marketing.
- **Anonymiser** (sort du champ RGPD, considérant 26) : données analytiques non rattachées à une pièce comptable. *(La pseudonymisation reste une donnée personnelle — insuffisante.)*
- **Conserver en archivage restreint** : PII figurant sur une facture/un contrat → **10 ans**.
- **Carte bancaire** : jamais de CVV ; PAN délégué au PSP (Stripe) ; preuve 13–15 mois.
- **Fiche de police** : purge automatique à **6 mois** (voyageurs étrangers uniquement).

---

## 5. Exigences OTA (partenariat)

- **Airbnb API ToS** : sécurité « industry-standard or better » (MFA, OWASP Top 10, chiffrement,
  scans, délais de patch) ; à la résiliation, **destruction/restitution de toute Personal Data sous
  30 jours** — **sauf** si la loi exige la conservation (avec **notification à Airbnb**). Les ToS ne
  citent pas explicitement la réconciliation financière comme motif de rétention : le fondement de
  conservation côté PMS est l'**obligation légale**, pas un droit contractuel autonome.
- **Booking.com** : finalité limitée, controller indépendant, sécurité min. art. 32 RGPD, SCC hors
  EEE ; les demandes de suppression hors contrôle de Booking sont traitées par le PMS (controller).

**Conclusion** : le PMS supprime les PII non probantes mais conserve, en archivage restreint et pour
la durée légale, les données financières nécessaires à la **réconciliation** (payouts, commissions,
refunds), aux **litiges** (chargebacks, RGPD 17.3.e) et à la **fiscalité** (factures, 10 ans).

---

## 6. Application au modèle de données Baitly

| Catégorie | Entités / tables | Cible d'archivage (`clenzy.archival.targets`) | Rétention |
|---|---|---|---|
| Factures NF | `Invoice` (`invoices`), `InvoiceLine`, PDFs `DocumentGeneration` (`document_generations`) | `invoices-archive` | **10 ans** (15 si immobilier KSA) |
| Réservations clôturées | `Reservation` (`reservations`) | `reservations-archive` | **10 ans** |
| Transactions de paiement | `PaymentTransaction` | `payment-transactions-archive` (preuve litige) | **10 ans** ; CB jamais stockée |
| PII voyageur non probante | `Guest` (`guests`), `GuestMessageLog` | *(pas d'archivage — anonymisation/purge)* | minimisation |
| Fiche de police étrangers | *(entité dédiée à créer ; cf. `RegulatoryConfig`)* | *(pas d'archivage — **purge 6 mois**)* | **6 mois** |

**Archivage froid** (export immuable WORM) : factures, réservations, transactions → bucket OVH
**Cold Archive** + **Object Lock** (cf. [COLD_ARCHIVE.md](COLD_ARCHIVE.md)). La rétention est portée
par `ArchivalProperties.Target.retentionYears` + `legalBasis` (auditable en config).

**Purge** (suppression obligatoire, **distincte** de l'archivage) : fiche de police (6 mois),
preuve paiement (13–15 mois), PII non probante. Le **framework de purge** générique et inerte par
défaut est en place (`clenzy.retention.purge.*`, cf. [RETENTION-PURGE.md](RETENTION-PURGE.md)) ;
les `PurgeSource` concrètes restent **à implémenter** une fois l'entité de fiche de police modélisée
et la politique validée juridiquement (cf. §7 « Purges en attente d'une entité » de RETENTION-PURGE.md).

---

## 7. Points à faire trancher juridiquement (avant activation)

1. **FR — registre des mandats Hoguet** : « 10 ans » **non présent** dans le texte (décret 72-678 art. 65 silencieux). Repli défendable = 5 ans (C. civ. 2224). Ne pas coder comme obligation Hoguet.
2. **FR — fiche de police & ressortissants UE** : inclusion des citoyens UE ambiguë (R814-1 muet sur la nationalité). À confirmer.
3. **FR — bail saisonnier** : la prescription triennale vise la résidence principale ; pour la courte durée, prescription de droit commun (5 ans) plus probable.
4. **MA** : n° d'articles (C. com. 15-95, loi 9-88, loi 09-08 art. 3) confirmés par sources secondaires concordantes, non lus sur PDF officiels ; durée registre voyageurs **non sourcée**.
5. **KSA** : n° d'articles PDPL divergents selon versions amendées ; durée Shomoos **non publiée**.
6. **PCI-DSS** : standard **contractuel**, pas une loi — impose seulement de ne pas stocker le CVV.

---

## 8. Contrôles techniques associés

- Archivage immuable : **Object Lock / WORM** côté bucket OVH Cold Archive (mode COMPLIANCE).
- Accès archivage restreint : SUPER_ADMIN, opération manuelle, pas de scheduler d'export.
- Chiffrement au repos (SSE) + clés org-scopées (anti-IDOR) sur tout le stockage objet.
- Purges automatiques (fiche de police, preuve paiement, PII) : scheduler dédié **à implémenter**.
- Traçabilité : journaliser tout export/purge (qui, quand, quoi, combien) pour preuve de conformité.

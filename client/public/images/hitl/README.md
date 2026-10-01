# Vignettes HITL Baitly

42 illustrations originales générées avec l’outil intégré Imagegen le 1er octobre 2026.
Elles couvrent les 46 types d’action du serveur, le règlement des demandes de service,
les rappels de reversement et les cartes informatives des dix agents.

## Présentation

- Natures mortes en bleu nuit, ivoire et laiton doux, sur fond bleu-gris.
- Vignette à côté du titre : 72 px sur ordinateur, 60 px sur mobile et 80 px dans les modales.
- Les dates, montants, états et boutons restent du texte réel. Les illustrations ne représentent ni un logement réel, ni une preuve d’exécution.
- Même correspondance dans la constellation, la liste, la pile et les fenêtres d’action.
- Les réassorts reconnus conservent leur photo d’article, personnelle ou issue du catalogue, sans seconde vignette générique.
- Les photos justificatives des interventions restent séparées de l’illustration décorative.
- L’illustration des avis contient une étoile unique pour éviter de suggérer une note.

## Inventaire

| Visuel | Situation | Types d’action |
| --- | --- | --- |
| ![Absence du voyageur](no-show.webp) | Absence du voyageur | `NOSHOW_MARK` |
| ![Taxe de séjour](tourist-tax.webp) | Taxe de séjour | `TAX_MARK_FILED` |
| ![Livret d’accueil](welcome-guide.webp) | Livret d’accueil | `GUIDE_SEND` |
| ![Reversement propriétaire](owner-transfer.webp) | Reversement propriétaire | `OWNER_PAYOUT` |
| ![Reversement prestataire / conciergerie](service-transfer.webp) | Reversement prestataire / conciergerie | `CLEANING_PAYOUT` |
| ![Tarification et revenus](pricing.webp) | Tarification et revenus | Repli générique revenue |
| ![Caution](deposit.webp) | Caution | DEPOSIT_RELEASE, DEPOSIT_WITHHOLD |
| ![Gestion du calendrier](calendar.webp) | Gestion du calendrier | `CALENDAR_BLOCK`, `MIN_STAY_RESTRICTION`, `STAY_MODIFICATION` |
| ![Ménage](cleaning.webp) | Ménage | `CLEANING_REQUEST` |
| ![Paiement et relance](payment.webp) | Paiement et relance | SERVICE_REQUEST_SETTLE |
| ![Affectation des interventions](assignment.webp) | Affectation des interventions | ASSIGNMENT_RECAP |
| ![Synchronisation des canaux](channel-sync.webp) | Synchronisation des canaux | Repli de synchronisation |
| ![Nuisances sonores](noise.webp) | Nuisances sonores | `NOISE_WARNING_SEND` |
| ![Réservation inachevée](booking-recovery.webp) | Réservation inachevée | `CART_RECOVERY_SEND` |
| ![Services supplémentaires](guest-experience.webp) | Services supplémentaires | `UPSELL_OFFER` |
| ![Sécurité et fraude](security.webp) | Sécurité et fraude | `FRAUD_BLOCK` |
| ![Fiche voyageur et déclaration](traveler-form.webp) | Fiche voyageur et déclaration | `POLICE_DECLARE` |
| ![Mandat de gestion](management-contract.webp) | Mandat de gestion | `MANDATE_SIGN_SEND` |
| ![Rapport au propriétaire](owner-report.webp) | Rapport au propriétaire | `OWNER_STATEMENT_SEND`, `OWNER_REVENUE_NOTE` |
| ![Publication et qualité des annonces](distribution.webp) | Publication et qualité des annonces | `CHANNEL_PUBLISH` |
| ![Maintenance et serrure](maintenance.webp) | Maintenance et serrure | `LOCK_BATTERY_REPLACE` |
| ![Devis et travaux](quotes.webp) | Devis et travaux | `OWNER_WORKS_APPROVAL`, `QUOTE_APPROVAL` |
| ![Traduction](translation.webp) | Traduction | `SITE_TRANSLATION_DRAFT` |
| ![Chevauchement de réservations](overbooking.webp) | Chevauchement de réservations | `OVERBOOKING_RESOLVE` |
| ![Communication voyageurs](conversation.webp) | Communication voyageurs | `CONVERSATION_TAKEOVER` |
| ![Relogement](relocation.webp) | Relogement | `RELODGE_TRANSFER` |
| ![Litige de paiement](dispute.webp) | Litige de paiement | `CHARGEBACK_SUBMIT` |
| ![Protection des données](privacy.webp) | Protection des données | `GDPR_ERASE` |
| ![Contrôle des interventions](work-review.webp) | Contrôle des interventions | `WORK_REVIEW` |
| ![Commande de consommables](stock-order.webp) | Commande de consommables | `LINEN_STOCK_ORDER` |
| ![Validation humaine](approval.webp) | Validation humaine | Validation générale / carte informative |
| ![Départ tardif](late-checkout.webp) | Départ tardif | `LATE_CHECKOUT_APPROVAL` |
| ![Entretien préventif du logement](property-maintenance.webp) | Entretien préventif du logement | `PREVENTIVE_MAINTENANCE` |
| ![Avis voyageurs](reviews.webp) | Avis voyageurs | `REVIEW_DRAFT_REPLY`, `REVIEW_REQUEST_SEND` |
| ![Recherche de prestataire](provider-search.webp) | Recherche de prestataire | REASSIGN_MANUAL, REASSIGN_CLEANING |
| ![Optimisation des créneaux](pricing-optimization.webp) | Optimisation des créneaux | PRICE_DROP, YIELD_PRICE_ADJUST (hors hausse explicite) |
| ![Hausse des tarifs](pricing-increase.webp) | Hausse des tarifs | Sens up ou pourcentage yield positif |
| ![Fin de promotion](promotion-end.webp) | Fin de promotion | PROMO_DEACTIVATE |
| ![Relance de paiement](payment-reminder.webp) | Relance de paiement | PAYMENT_REMINDER |
| ![Remboursement](refund.webp) | Remboursement | GOODWILL_REFUND, DEPOSIT_REFUND |
| ![Synchronisation à réparer](sync-problem.webp) | Synchronisation à réparer | ICAL_RETRY |
| ![Écart de tarifs](pricing-alert.webp) | Écart de tarifs | PARITY_REPUBLISH |

## Cartes informatives et replis

Le type d’action structuré est prioritaire. En son absence, `sourceTool` conserve l’identité
du scanner. Aucun mot du titre traduit n’est utilisé pour deviner une URL d’image.

| Scanner | Vignette |
| --- | --- |
| `guest_email_missing` | `traveler-form` |
| `guest_message_failed` | message-delivery (partagée avec les notifications) |
| `guest_instructions_missing` | `welcome-guide` |
| `late_checkout_busy` | `late-checkout` |
| `stay_change_unclear` | `calendar` |
| `stay_change_unavailable` | `calendar` |
| `channel_not_distributed` | `distribution` |
| `listing_quality_low` | `distribution` |
| `mission_to_confirm` | `assignment` |
| `gdpr_unlinked` | `privacy` |
| `license_expiring` | `management-contract` |
| `police_owner_bears` | `traveler-form` |
| `payout_reminder` | `owner-transfer` |

Pour un nouveau type non encore catalogué, une illustration liée à l’agent reste disponible.
Les anciennes cartes de rappel sont reconnues par leur identifiant stable. Les validations
interactives en direct sans type structuré utilisent la vignette neutre `approval`.
Les cartes ouvrant la fiche voyageur utilisent `traveler-form`.

## Assets et intégration

Les fichiers WebP font 320 × 320 px, qualité 82, pour **352 754 octets au total** (environ
344 Kio). Les fichiers restent inférieurs à 35 Ko. Ils sont servis localement, chargés à la demande
(`loading="lazy"`), avec des dimensions réservées et un décodage asynchrone.
En cas d’échec, la place de l’image est conservée sans icône d’image cassée ;
le titre, les informations et les actions restent disponibles.

- [Prompts exacts](prompts.json)
- [Sources originales et poids](sources.json)
- [Correspondances](../../../src/modules/supervision/core/actionIllustration.ts)
- [Composant partagé](../../../src/modules/supervision/components/ActionIllustration.tsx)
- [Tests](../../../src/modules/supervision/__tests__/ActionIllustration.test.tsx)

Les PNG originaux sont conservés à leur emplacement de génération. Seuls le redimensionnement
et la conversion WebP ont été effectués après génération.

Pour ajouter un nouveau type, définir sa correspondance explicite dans
`ACTION_TYPE_ILLUSTRATIONS`. Le test compare le registre avec les constantes Java et les
actions frontend afin de détecter tout type oublié.


## Vérification

- 144 tests ciblés réussis : correspondances, assets, descriptions, décisions, modales et hydratation des cartes.
- TypeScript et build Vite réussis ; les images sont présentes dans le build.
- Composants réels vérifiés sur le serveur existant aux largeurs 375, 768, 1024 et 1440 px,
  en clair, sombre et RTL. Aucun débordement horizontal ; toutes les images chargées.
- Ouverture et fermeture de la confirmation no-show vérifiées sur mobile.

La sélection tarifaire prend en compte les paramètres structurés : direction pour PRICE_DROP,
signe du pourcentage pour YIELD_PRICE_ADJUST. La notification réutilise le même sélecteur.

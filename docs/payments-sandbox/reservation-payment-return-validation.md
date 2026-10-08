# Retour des liens de paiement créés depuis Finance

Validation locale du 6 octobre 2026. Le paiement du séjour 551 avait révélé que le lien envoyé depuis le PMS utilisait le retour par défaut des interventions. Le service de réservation fournit maintenant des adresses publiques propres au séjour, construites côté serveur.

## Comportement

- Une configuration de moteur de réservation active de la même organisation permet un retour sur sa page publique de confirmation, avec la référence du séjour.
- Sans configuration active ou sans référence, le retour public neutre `/booking/payment-return` ne contient aucune donnée du client et n'annonce ni paiement réussi ni annulation.
- Les retours de succès et d'interruption sont distincts. La page de réservation relit le statut métier ; les paramètres de retour ne prouvent jamais un encaissement.
- Aucune règle d'authentification serveur n'a été rendue plus permissive.

## Recette réelle depuis Finance

Le séjour fictif **552**, **DIR-N2YX9S**, a été créé depuis le PMS sur Baitly Sandbox Reversement, du 25 au 27 octobre, pour **10 EUR**, sans ménage. Le voyageur est « TEST SANDBOX Retour Finance » et son email est `recette-retour-finance@example.invalid`.

L'action **Envoyer le lien** de Finance crée la session `cs_test_a1YfnRuRKj0Fptsqju9mgnIXMSIaMa3ACM95B3w02Cvl4EKraGsteni1Ea`. La relecture Stripe confirme `livemode=false`, 1 000 centimes EUR, source RESERVATION / 552, et les deux URL `/booking/92cf9d58-861a-4982-8743-8b1f220fca44/confirmation?reservation=DIR-N2YX9S&flow=return|cancel`.

La page de l'URL d'interruption affiche **« Paiement non terminé »**, le bon logement, les dates et 10 EUR. Elle explique qu'un retour n'annule pas la réservation. Cette session reste **ouverte et impayée** : aucun second paiement n'a été effectué pour ce contrôle. La page du séjour 551 déjà remboursé affiche correctement **« Réservation annulée »**.

La page neutre a été affichée à 375, 768, 1 024 et 1 440 pixels, sans débordement horizontal. L'override de viewport a ensuite été retiré.

## Tests et chargement

- **14 tests serveur** ciblés : sélection d'une configuration de la bonne organisation, exclusion d'une configuration inactive/étrangère, repli sans données personnelles, service de lien de paiement.
- **12 tests interface** du retour public, avec absence de requête et de faux statut sur le repli neutre.
- TypeScript et packaging Maven valides ; le workflow financier inclut ces tests.
- JAR chargé : `7c19ae09d050742cc8686bb9fd84ff4fc9b0f2d2057f760f9a2d31850a370746`.
- Sauvegarde : `/private/tmp/baitly-before-reservation-return-ouoeig6n/server.jar`.
- Même conteneur `clenzy-server-dev`, même configuration Stripe Baitly ; santé HTTP 200 après redémarrage. Frontend conservé, aucune migration ajoutée.

Les sessions anciennes gardent les adresses enregistrées par Stripe lors de leur création. Elles n'ont pas été modifiées ni recréées. Les trois traductions du libellé « Méthode non renseignée » des reversements ont également été ajoutées au bon namespace.

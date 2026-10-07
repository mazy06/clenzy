# Baitly · Rapprochement des historiques

Contrôle local du 7 octobre 2026, limité aux données de test. Aucun mouvement réel ni remise à zéro arbitraire.

- Sur 19 anciennes transactions Checkout en traitement, Stripe Baitly confirme un paiement de 35 EUR pour l'intervention 335. La mission était déjà payée, mais sa transaction restait en traitement. Le rapprochement vérifie la preuve canonique et complète uniquement le journal, sans rejouer le crédit comptable ni modifier le travail effectué. Validation automatisée ajoutée ; application aux données locales à vérifier après chargement du correctif.
- Une session de réservation est encore ouverte et non payée : elle reste en attente.
- 17 références sont introuvables sur le sandbox Baitly actuel. Une absence chez ce compte ne prouve pas un échec : ces historiques ne sont ni payés artificiellement ni libérés pour un nouveau paiement. Il faut retrouver leur compte PSP d'origine ou confirmer leur caractère fictif.
- Le transfert ancien de 90 EUR associé à l'intervention 89 ne possède ni référence Stripe ni compte destinataire vérifiable (`legacy-unresolved`). Aucun transfert correspondant n'a été retrouvé dans ce sandbox. Il reste « À rapprocher » en attendant l'identification du versement ou sa qualification explicite comme simulation.
- Les deux reversements propriétaires réellement transférés ont chacun une seule réservation. Leur net est déterminable par le dossier ; le correctif conserve les cas multi-réservations ambigus en revue.

Le bouton de vérification dans Finance relit les preuves ; il ne lance aucun paiement. Les réponses indisponibles ou incompatibles conservent l'historique. Les comptes de plateforme et les comptes Connect bénéficiaires restent distincts.

## Vérifications automatisées

Le rapprochement teste l'organisation, la source, la devise, le montant, l'unicité de session, les acomptes exclus de cette réparation unitaire, les reprises concurrentes et l'absence de double crédit. L'interface teste le double clic, les preuves indisponibles et un changement de dossier pendant la requête.

La recette complète Baitly/Stripe reste regroupée en fin de campagne, conformément à la demande utilisateur. Les anomalies sans preuve ne doivent pas être présentées comme résolues.

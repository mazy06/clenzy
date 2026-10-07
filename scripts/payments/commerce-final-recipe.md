# Baitly : recette finale de l'extension commerciale

La recette Baitly/PSP partagée s'exécute **après** les sept lots de développement et leurs tests isolés. Aucun scénario ci-dessous n'est réputé validé par son inscription dans cette liste. Les PSP marocain et saoudien ne sont pas encore choisis ; leurs scénarios restent conditionnés à ce choix et à leur configuration.

## 1. Crédits IA

- [ ] Acheter un pack depuis Baitly ; vérifier montant, devise, bénéficiaire, document de vente et droits accordés après confirmation canonique.
- [ ] Réessayer après une réponse perdue et après deux clics ; une tentative, un encaissement et une dotation.
- [ ] Exécuter deux agents simultanément avec un solde insuffisant pour les deux ; une seule réservation autorisée.
- [ ] Invalider Redis puis redémarrer le serveur pendant une exécution ; la réserve persiste en base. Après expiration, son reliquat se libère ; une réponse tardive reste comptabilisée.
- [ ] Provoquer un échec de transaction de consommation ; journal et poches sont annulés ensemble. Rejouer la même clé ne débite qu'une fois.
- [ ] Rembourser partiellement un pack inutilisé puis un pack déjà consommé ; vérifier retrait proportionnel, crédits à régulariser, historique et avoir, sans déclencher un nouveau paiement.
- [ ] Faire échouer un remboursement en attente ; seuls ses droits réservés sont rétablis.
- [ ] Contester un paiement, perdre puis gagner un autre litige ; vérifier le gel et le rétablissement après preuve des fonds, sans effacer la consommation passée.
- [ ] Rembourser un pack expiré ; les crédits expirés ne sont pas présentés comme consommés.
- [ ] Recharger un ancien abonnement annuel/bisannuel ; une facture vérifiée doit couvrir la période. Un simple identifiant d'abonnement ne suffit pas.
- [ ] Vérifier la quarantaine des anciennes dotations sans facture, puis leur rapprochement sans doublon. Deux couvertures concurrentes ou un autre tenant ne doivent jamais débloquer les crédits.
- [ ] Vérifier l'écran en français, anglais et arabe : disponibles, réservés et régularisation distincts ; erreur réseau explicite ; retour Checkout sans succès présumé.

## 2. Acompte et solde de maintenance

- [ ] Encaisser l'acompte prévu au devis, puis le solde exact ; deux preuves et un total correspondant au prix convenu.
- [ ] Rembourser une partie, puis le reste, à cheval sur les deux encaissements ; contrôler les centimes, avoirs et reprise après interruption.
- [ ] Vérifier les reversements avant/après remboursement, le solde net et la récupération des fonds déjà transférés.
- [ ] Contrôler les acomptes historiques incomplets : aucun encaissement ni déduction sans preuve.
- [ ] Sélectionner ensemble un solde après acompte et une mission sans acompte : le solde reçoit son lien individuel et reste remboursable sur ses deux encaissements. Un ancien lot mélangé reste à rapprocher.

## 3. Booking engine

- [ ] Comparer les parcours public, intégré et ancien parcours direct : même prix, acompte, taxes, réservation et confirmation.
- [ ] Promotions : montant fixe dans sa devise, nuits offertes, séjour unique et panier multi-séjours, quota concurrent et expiration.
- [ ] Vérifier les taxes obligatoires, le solde après acompte et les paiements tardifs après annulation.

## 4. Abonnements PMS

- [ ] Vérifier les trois grilles locales HT, paliers de logements et fidélité, remises et taxes du vendeur configuré.
- [ ] Modifier formule et nombre de logements ; vérifier la proposition, la facture et la date d'effet. Le changement est programmé à la prochaine échéance : aucun débit immédiat ni prorata, avec conservation des mois de fidélité.
- [ ] Changer le moyen de paiement, rejouer un impayé et reprendre une inscription après rechargement.
- [ ] Contrôler remboursement/litige, accès et dotations IA, sans altérer les anciens contrats.
- [ ] Vérifier le portail de changement de carte, l'annulation d'un changement programmé et la reprise d'une inscription dont la réponse réseau a été perdue.

- [ ] Faire arriver une ancienne lecture des fonds après un gel plus récent ; les droits ne doivent pas être rétablis par la réponse ancienne.

## 5. Upsells et affiliation

- [ ] Vendre et réaliser un upsell personnalisé, l'annuler puis le rembourser ; vérifier parts, justificatifs et avoir.
- [ ] Importer puis rapprocher une commission Klook, GetYourGuide ou Viator ; contrôler preuve, devise, bénéficiaire et reversement.
- [ ] Corriger ou annuler une commission avant et après reversement ; conserver l'historique et éviter les doublons.

- [ ] Corriger une commission reçue sans attribution historique prouvée : refus et aucune écriture supplémentaire. Rejouer une correction justifiée avec la même clé : une seule paire d’écritures.
- [ ] Enregistrer planification, réalisation ou annulation avec référence et auteur ; aucune étape opérationnelle ne vaut preuve de paiement.
- [ ] Perdre la réponse Checkout puis réessayer le même upsell depuis le livret et le booking : même commande, prix et bénéficiaire.
- [ ] Rattacher une facture vendeur, puis un avoir au remboursement confirmé. Numéro, émetteur, mandat, montant, devise, fichier et empreinte doivent rester consultables ; aucune nouvelle facture ou sortie d'argent n'est créée par le dépôt.
- [ ] Rattacher un relevé partenaire puis une correction. Le montant documenté est celui de la commission, jamais le prix complet de l'activité ; l'ancien relevé est conservé.
- [ ] Réessayer un dépôt après réponse perdue : une pièce unique. Refuser une autre organisation, un autre montant, un remboursement en attente et une modification de pièce archivée.
- [ ] Reverser au bénéficiaire personnel enregistré dans une autre organisation ; vérifier le lien exact avec la vente, puis le refus lorsque son compte est suspendu.
- [ ] Annuler une préparation avant toute émission, puis la recréer. Dès qu'une émission est journalisée, l'annulation doit être refusée et le dossier proposé au rapprochement.
- [ ] Confirmer tardivement un transfert pendant un remboursement : enregistrer la récupération exacte du trop-versé.

## 6. Objets connectés

- [ ] Commander le dernier article simultanément ; vérifier stock, paiement différé et abandon.
- [ ] Préparer, expédier, suivre, retourner et rembourser une commande, avec facture et avoir.

- [ ] Renseigner le stock réel avec justificatif ; aucune quantité n’est créée à l’installation. Contrôler le verrou lors du dernier article concurrent.
- [ ] Retour Checkout perdu, double clic et reprise de la même intention : une commande et une réserve de stock. Une autre personne ne peut reprendre cette intention.
- [ ] Vérifier l’abandon canonique : seule une session expirée et non payée libère la réserve. Une erreur réseau conserve le stock réservé.
- [ ] Depuis la boutique, vérifier l’ouverture du vrai Checkout ; une erreur conserve le panier et n’affiche aucun succès.
- [ ] Vérifier qu'un remboursement ne réintègre aucun stock avant retour physique contrôlé. Rejouer le même retour ne recrédite pas deux fois le stock.
- [ ] Laisser une commande PSP inaccessible en tête de file et vérifier que les autres commandes continuent à être rapprochées.
- [ ] Interrompre le serveur après création du Checkout matériel mais avant rattachement à la commande : le journal doit permettre de retrouver la session, sans nouveau débit ni libération de stock sur une simple erreur réseau.

## 7. Documents et sociétés facturantes

- [ ] Vérifier société, acheteur, pays, devise, base HT, remises, taxes, TTC et séquence par émetteur.
- [ ] Contrôler les copies et avoirs sans modification des documents émis.
- [ ] Vérifier les exports et raccordements déclaratifs selon les pays et les services effectivement configurés.
- [ ] Distinguer les contrôles techniques réussis des immatriculations et homologations restant à confirmer.
- [ ] Changer d'émetteur fiscal puis provoquer deux émissions concurrentes : séries distinctes et numéros uniques. Une transaction annulée ne consomme pas de numéro ; une ancienne facture n'est pas renumérotée.
- [ ] Reprendre l'émission d'un avoir PSP après réponse perdue : retrouver l'avoir lié au remboursement existant, sans rembourser une seconde fois.
- [ ] Télécharger PDF et export JSON depuis le PMS, les achats IA et une commande matérielle ; vérifier les accès de l'acheteur et le refus des autres comptes.
- [ ] Sans connecteur fiscal, afficher « en attente » avec explication. Ne jamais présenter cet état comme une exemption ou une transmission acceptée.
- [ ] Après préparation fiscale, détecter toute divergence de document et différer la transmission pour rapprochement.

## Raccordement Iopole France

Prérequis et limites : [premier lot Iopole](iopole-connector.md). Les documents synthétiques des tests locaux ne doivent pas être envoyés au partenaire.

- [ ] Charger la migration 0541 puis ouvrir le document fiscal dans le détail d'une facture : accès uniquement au gestionnaire de l'organisation ou au staff autorisé.
- [ ] Avec une facture B2B FR/EUR et les identités de test admises par le partenaire, compléter adresses, SIREN et routage cohérent. Classer les mentions existantes sans les modifier, puis contrôler EN 16931 et les règles françaises.
- [ ] Vérifier TVA à 20 % issue du taux interne 0,20, plusieurs taux et écarts d'arrondi : aucun montant émis n'est silencieusement corrigé.
- [ ] Provoquer données manquantes, mention française absente, XML invalide et routage d'une autre société : archivage/envoi bloqués, raison visible, aucun succès présumé.
- [ ] Modifier la saisie après contrôle : nouveau contrôle obligatoire. Changer la facture source avant archivage ou changer d'organisation : refuser l'ancien résultat et ne pas réutiliser l'archive en cache.
- [ ] Archiver depuis deux onglets simultanés : une seule archive, même empreinte, facture et PDF d'origine inchangés. Télécharger le CII. « Contrôles locaux validés » ne doit pas devenir « Transmission confirmée » sans preuve partenaire.
- [ ] Simuler réponse d'archivage perdue puis recharger : retrouver la même archive sans double création. Une archive reste consultable après annulation, mais aucun nouveau dépôt n'est lancé pour cette facture annulée.
- [ ] Vérifier clavier, français/anglais/arabe, clair/sombre et largeurs 375/768/1024/1440. Les erreurs HTTP doivent conserver un parcours de reprise, sans accès hors organisation.

- [ ] Sans activation, sans compte client ou avec un mandat d'une autre société : aucun appel partenaire et état « à compléter ».
- [ ] Produire et archiver un CII complet admis par le sandbox, avec les identités de test officiellement fournies. Le XML historique incomplet doit rester bloqué avant tout dépôt.
- [ ] Déposer depuis la file Baitly : conserver la référence et afficher « En attente » après HTTP 201. Recharger l'écran : aucun succès fiscal présumé.
- [ ] Obtenir puis relire les métadonnées et le statut de réception : numéro, date, type, montants, devise et parties identiques avant « Transmission confirmée ».
- [ ] Simuler erreur réseau, ordre des statuts inversé et statuts contradictoires : conserver les preuves sans confirmation injustifiée.
- [ ] Confirmer le mode PULL auprès d'Iopole. Interrompre le traitement après dépôt connu et lancer deux travailleurs : reprendre sans second dépôt ni remplacement de référence.
- [ ] Recevoir plus de 100 statuts, perdre une réponse d'acquittement et simuler un rollback local : vider le flux par lots, conserver chaque statut avant de le marquer vu et ne jamais acquitter un lot non sauvegardé. Ne pas utiliser `status-history` pour la surveillance automatique.
- [ ] Perdre l'accusé du POST : aucune nouvelle émission automatique. Valider le futur parcours de rapprochement canonique avant de considérer ce scénario terminé.
- [ ] Refuser les divergences d'organisation, d'émetteur, d'environnement, de document et de montant ; ne pas remplacer une référence déjà enregistrée.
- [ ] Contrôler les avoirs avec leur facture d'origine, la couverture des ventes PMS/IA/matériel et les obligations non couvertes par une simple réception. Ne pas étendre la validation à l'e-reporting ou aux changements de statut ultérieurs sans leur raccordement.
- [ ] Vérifier les libellés français, anglais et arabe : dépôt, réception, rejet et paiement clairement distingués.

## Verification documentaire unifiee

Le dossier partagé Documents/Finance, les vérifications versionnées et l'archive PDF commune sont implémentés et couverts par des tests isolés. Les cas ci-dessous restent à exécuter sur l'environnement partagé ; les tests isolés ne constituent pas cette recette. Voir [l'inventaire HTML/PDF](../../docs/BAITLY-HTML-PDF.md).

- [ ] Après chargement du code, ouvrir les 11 types dans Documents ; importer un HTML, prévisualiser, générer et télécharger via le moteur commun.
- [ ] Vérifier les 10 sources ODT historiques de la base locale, leur téléchargement HTML et leurs variantes avec logos/données réelles de test. Les octets historiques et les documents déjà émis doivent rester inchangés.
- [ ] Comparer l'aperçu Facture au modèle Finance ; vérifier que les données fictives sont marquées et qu'aucune numérotation réelle n'est consommée.
- [ ] Générer un bon de commande depuis Dépenses, contrôler client/prestataire/logement/HT/taxes/TTC et devise. Tester une indisponibilité du moteur : erreur visible, aucun faux succès.
- [ ] Inspecter les tableaux longs, les sauts de page, les logos, les accents et l'arabe. Les éléments ODT non supportés doivent être signalés explicitement.
- [ ] Refuser les imports ODT, HTML vide, ressources externes et scripts. La sélection d'un fichier invalide ne doit pas soumettre le fichier valide précédent.
- [ ] Générer mandat, devis, bon de commande et rapport pour deux organisations puis pour la plateforme : en-tête, titre et signature portent le bon émetteur, sans ancienne marque. Le devis prestataire porte son enseigne ; les documents de plateforme portent Baitly. Une génération asynchrone conserve l'organisation du dossier, indépendamment de la session de l'administrateur. Refaire le contrôle avec un profil fiscal d'un autre pays et sans profil.
- [ ] Télécharger un document déjà émis après changement du nom ou du modèle : mêmes octets, numéro, vendeur et empreinte. Aucun rebranding rétroactif des archives signées ; les PDF externes restent les originaux.

- [ ] Parcourir Finance, Documents, émission automatique et réessai Kafka/webhook pour la même opération : une seule facture de référence et une seule numérotation. Vérifier numéro, vendeur, acheteur, dates, lignes, HT/TVA/TTC identiques sur PDF, XML et détail.
- [ ] Faire échouer le rendu PDF ou la création du dossier : conserver une anomalie reprenable, sans PDF diffusé comme facture complète alors que sa référence Finance manque, ni seconde émission au réessai.
- [ ] Modèle avec variables présentes mais identité/montant vide, référentiel absent ou règle inconnue : ne pas afficher « conforme ». Vérifier séparément qualité du modèle, données de la facture et validité du fichier.
- [ ] Vérifier le brouillon, modifier une ligne, une identité, le pays ou le modèle, puis essayer d'émettre avec le résultat précédent : nouveau contrôle requis côté serveur. Deux émissions concurrentes ne produisent pas deux factures.
- [ ] Enregistrer une revue humaine nécessaire avec auteur/date/périmètre ; la politique automatique autorisée conserve les mêmes preuves. Aucune décision ne contourne une anomalie bloquante et aucun clic de notification ne valide seul le document.
- [ ] Ouvrir Conformité et actualiser : lecture des résultats existants, aucun nouveau contrôle écrit par simple montage. Indisponibilité/403 reste une erreur visible ; aucune animation « terminé » ne la transforme en succès.
- [ ] Changer d'organisation, d'émetteur et de pays pendant le chargement : résultats et actions restent dans le bon périmètre. Le filtre pays de Conformité ne modifie pas le profil fiscal. Vérifier les droits gestionnaire, lecture seule, super-manager et super-admin.
- [ ] Accéder au même dossier depuis Conformité, Finance, Historique et une alerte : retrouver le même état, les mêmes erreurs et les mêmes commandes autorisées. Paramètres ouvre ce dossier sans seconde liste opérationnelle.
- [ ] Émettre puis télécharger de nouveau après changement du modèle/profil : mêmes fichiers et empreintes archivés. Une divergence historique est présentée à rapprocher, sans réécriture ni renumérotation automatique.
- [ ] Paiement confirmé avec document bloqué : conserver la preuve financière et une tâche documentaire visible. Dépôt partenaire, réception, email envoyé et paiement restent distingués.
- [ ] Facture 120 et duplicata : total commercial 120 ; facture 120 puis avoir total -120 dans la même période : net 0, sans suppression des preuves. Contrôler aussi avoir partiel, périodes différentes, envoi, retard, plusieurs vendeurs/pays/devises et données de copie PSP.
- [ ] Rattacher un document PMS/IA/matériel déjà émis par le circuit PSP sans le renuméroter ni le compter une seconde fois. Vérifier un avoir Documents/Finance/PSP contre sa facture d'origine et son remboursement éventuel, sans déclencher deux mouvements.
- [ ] Nouveau devis : aucune clause SEPA héritée non applicable ; ancien document émis : clause et fichier conservés. Toute correction passe par le circuit métier autorisé.
- [ ] Vérifier clavier, mobile, français/anglais/arabe et thèmes clair/sombre ; les résultats et actions restent accessibles sans survol. Finir avec la preuve de transmission du sandbox autorisé, lorsque ses accès sont disponibles.

## Préparation avant exécution partagée

- [ ] Dans Paramètres > Paiements, ouvrir « Préparer la mise en service ». Au premier affichage, aucun appel Stripe ; distinguer clé présente, paramètres manquants et contrôles non effectués.
- [ ] Lancer la vérification en lecture seule : société Stripe française, dossier transmis, encaissement activé, configuration Tax active et présence d'au moins une immatriculation. Ce contrôle ne certifie pas la couverture fiscale de chaque vente ni les coordonnées légales du vendeur.
- [ ] Simuler une indisponibilité Stripe puis une erreur API Baitly : afficher l'indisponibilité et ne pas conserver un ancien résultat positif. Actualiser doit permettre de reprendre le diagnostic.
- [ ] Parcourir France, Maroc et Arabie saoudite : aucun compte français ne débloque le raccordement local ; une transmission fiscale absente reste à compléter. Une exemption explicitement configurée est distinguée d'une transmission acceptée.
- [ ] Contrôler les fournisseurs : « Autorisé » ne vaut pas « testé ». Une fiche sans clé chiffrée n'est pas renseignée ; Stripe dépend de sa clé serveur réelle. Vérifier ajout initial, désactivation, relecture après sauvegarde et interdiction de modification pour SUPER_MANAGER.
- [ ] Changer d'organisation pendant une consultation : le diagnostic fournisseur précédent ne doit pas être réutilisé. Vérifier français/anglais/arabe, clavier, thèmes clair/sombre et formats 375/768/1024/1440.
- [ ] Charger le JAR et les migrations testés lorsque toute l'implémentation est terminée ; conserver la configuration du sandbox Baitly.
- [ ] Vérifier les prérequis du [dossier de raccordement](partner-onboarding-dossier.md). Les données fiscales ne sont pas encore attribuées, les PSP MA/SA ne sont pas choisis et les accès Viator/Klook/GetYourGuide sont en discussion : ne pas les marquer configurés.
- [ ] Utiliser uniquement les fixtures officiellement admises par chaque sandbox. Renseigner les identités, immatriculations et catégories fiscales réelles lorsqu'elles seront disponibles ; un test ne constitue pas une immatriculation ni une autorisation de production.
- [ ] Pour chaque PSP local retenu, vérifier séparément ventes propres, collecte pour tiers, récurrence, remboursement après partage et crédit bancaire. Conserver la preuve de ses capacités et droits activés ; aucun repli sur Stripe France.
- [ ] Pour chaque affiliation, contrôler les droits catalogue, attribution et relevés financiers séparément. Refuser le succès présumé sur la seule présence d'une clé API et rapprocher la commission avec le versement partenaire.
- [ ] Pour chaque transmission fiscale, contrôler société émettrice, mandat, environnement et accusé canonique. Un certificat sandbox ou la présence d'un fournisseur dans un annuaire ne valide pas la mise en production de Baitly.
- [ ] Exécuter les scénarios France configurés ; conserver les scénarios MA/SA et transmissions fiscales explicitement conditionnés aux PSP/partenaires choisis.
- [ ] Consigner pour chaque scénario : dossier, rôle, preuve PSP, écriture, document et résultat attendu/obtenu. Ne pas confondre test automatisé isolé et recette du sandbox partagé.

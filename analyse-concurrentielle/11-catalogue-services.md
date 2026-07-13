# Catalogue de services Baitly

> Document commercial. Présentation de l'offre Baitly par grandes familles de service.
> Date : 2026-07-12. **Document vivant** : mis à jour au fil des livraisons produit.
> Cible : équipe commerciale, page produit, dossiers partenaires. Chaque service ci-dessous
> correspond à une capacité réellement en production ou livrée dans le code, pas à une intention.

Baitly est le système de gestion locative (PMS) des conciergeries et gestionnaires de
location courte durée. Une plateforme unique pour piloter les logements, les réservations,
les calendriers, les prix, les opérations terrain, la relation voyageur, la facturation et
la comptabilité de mandat, avec une couche d'intelligence artificielle qui propose et, sur
demande, automatise le travail répétitif. Baitly s'adresse en priorité aux structures
françaises qui ont besoin d'une conformité fiscale sérieuse et d'un back-office qui tient la
charge, avec une ouverture au Maroc et à l'Arabie Saoudite.

---

## 1. Gestion locative et calendrier

Le socle du produit : un calendrier fiable, partagé entre toutes les annonces et tous les
canaux, avec la garantie qu'un même logement ne peut jamais être réservé deux fois. La vue
planning permet de piloter un portefeuille entier à l'écran.

- **Calendrier anti-surréservation** : le moteur de disponibilité verrouille chaque logement
  pendant l'écriture (verrou base de données par propriété), ce qui rend le double-booking
  techniquement impossible, même quand plusieurs canaux tentent de réserver au même instant.
- **Planning visuel multi-propriétés** : timeline avec glisser-déposer des séjours, création
  rapide d'une réservation depuis le calendrier, aperçu du déplacement avant validation,
  filtres, pagination et indicateurs d'urgence.
- **Réservations directes** : création et modification complètes des séjours, avec un modal
  unifié qui gère dans un même écran la réservation et le blocage de période (maintenance,
  ménage, indisponibilité propriétaire).
- **Statuts de jour riches** : disponible, réservé, bloqué, maintenance, avec prix et
  contraintes de séjour (nuits minimum et maximum, jour de rotation) portés par le calendrier.
- **Multi-tenant étanche** : chaque organisation ne voit que ses propres données (isolation
  stricte, fermée par défaut). Le personnel plateforme dispose d'un mode agence transversal.
- **Portefeuilles** : regroupement de biens pour une gestion et une lecture consolidées.

Différenciateur : l'anti-surréservation n'est pas un contrôle applicatif fragile mais un
verrou transactionnel au niveau de la base, doublé d'un journal d'écriture et d'une
propagation vers les canaux. C'est un niveau d'ingénierie rare sur le marché.

---

## 2. Channel management et distribution

Baitly synchronise disponibilités, prix et réservations avec les grandes plateformes de
distribution, et fournit un moteur de réservation en direct pour vendre sans commission OTA.

- **Connexion aux OTA** : Airbnb, Booking.com, Expedia et Vrbo par adaptateurs dédiés, plus
  un large catalogue additionnel via Channex. Synchronisation bidirectionnelle des
  disponibilités et des prix.
- **Import iCal automatique** : synchronisation des calendriers externes toutes les 3 heures,
  déduplication des réservations, multi-organisations.
- **Supervision de connectivité** : surveillance des connexions OTA et réconciliation des
  dérives de prix entre Baitly et les canaux.
- **Moteur de réservation en direct** : site de réservation par organisation (adresse
  dédiée), disponibilité en temps réel calée sur le calendrier, paiement Stripe Checkout,
  panier multi-séjours (plusieurs logements ou dates dans une même commande).
- **Codes promo et bons** : moteur de vouchers avec portée par canal (site direct, lien,
  WhatsApp, e-mail), contraintes de séjour et limites d'usage.
- **Personnalisation du site** : éditeur de thème et de jetons de design, avec un assistant
  IA d'harmonisation graphique, pour habiller le moteur de réservation aux couleurs de la
  marque.

---

## 3. Tarification et yield

Un moteur de prix structuré qui applique des règles claires, complété par des ajustements
automatiques de rendement et une intégration au leader du marché de la tarification dynamique.

- **Moteur de prix multi-niveaux** : résolution déterministe du prix d'une nuit, du plus
  spécifique au plus général (surcharge manuelle, promotion, événement, week-end, saison,
  réservation anticipée, dernière minute, puis prix de base du logement).
- **Règles de yield automatiques** : ajustement du prix selon le taux d'occupation, le délai
  avant arrivée, le remplissage de dernière minute et le comblement des trous de calendrier.
- **Restrictions et opérations de masse** : nuits minimum et maximum, règles de trous, délai
  avant arrivée, mise à jour groupée des prix.
- **Connecteur PriceLabs natif** : possibilité de déléguer la tarification dynamique à
  PriceLabs, avec circuit de résilience.
- **Yield assisté par l'IA** : l'agent Revenue de la constellation (section 7) détecte les
  baisses et hausses de prix pertinentes par segment, propose l'ajustement avec simulation
  d'élasticité, et peut l'appliquer sous enveloppe contrôlée quand l'automatisation est
  activée.

---

## 4. Opérations terrain : ménage et maintenance

C'est l'un des points forts de Baitly et le plus différenciant du marché. La plateforme ne
se contente pas de planifier le ménage : elle en calcule un prix conseillé, encadre la
rémunération du prestataire, la verse contre preuve, et transforme les anomalies constatées
sur place en interventions de maintenance chiffrées.

### Moteur Ménage (unique sur le marché)

- **Prix conseillé calculé** : pour chaque logement, un moteur unique calcule à la fois la
  durée de travail et le prix, à partir des minutes normées par composant du logement,
  multipliées par un taux horaire de référence et un coefficient de type de ménage (express,
  standard, approfondi). Résultat : un prix conseillé et une fourchette basse et haute.
- **Trois étages de prix** : le conseil de la plateforme, le prix retenu par l'hôte pour le
  logement, et le tarif négocié du prestataire (taux horaire ou forfait par propriété, le
  forfait primant). Le cadrage est un repère, jamais un blocage.
- **Majorations saisonnières** : fenêtres de dates qui majorent le prix conseillé sans jamais
  toucher aux tarifs déjà négociés.
- **Devis ménage PDF** : génération d'un devis de ménage formaté, envoyé au propriétaire.
- **Versement du prestataire à la complétion** : le paiement du prestataire est déclenché à
  la fin de l'intervention via Stripe Connect, mais uniquement après preuve photo (au moins
  une photo d'après persistée) et onboarding validé. Sans preuve, le versement est bloqué avec
  un motif explicite, jamais en silence.
- **Score qualité** : note de fiabilité du prestataire sur 30 jours glissants (taux de preuve
  et volume de missions), visible côté prestataire et côté gestionnaire.
- **Auto-assignation** : choix de l'équipe par zone géographique, type de service et
  disponibilité, puis promotion du meilleur prestataire (score, proximité du prix conseillé,
  charge du jour). Option activable par organisation.

### Interventions et maintenance

- **Cycle d'intervention complet** : 19 types d'intervention (ménage, ménage express,
  approfondi, vitres, maintenance préventive, dépannage électrique, plomberie, jardinage,
  désinfection, etc.), avec machine à états et intégration au flux de facturation.
- **Déclenchement automatique du ménage au départ** : à partir des réservations importées, une
  demande de ménage est créée automatiquement à la date de départ (à l'heure et dans le fuseau
  du logement), puis routée vers un prestataire.
- **Photos avant, après et anomalie** : preuve d'exécution native, avec un canal photo dédié
  aux défauts constatés.
- **Anomalie terrain vers maintenance** : un défaut signalé sur place devient une anomalie
  suivie, convertible en demande de maintenance pré-chiffrée à partir d'un catalogue de
  travaux.
- **Checklist de ménage mobile** : modèles par pièce, chronomètre de durée, brouillon
  persistant même hors connexion.

### Application mobile terrain

- Écrans dédiés aux rôles technicien et agent de ménage : file de missions du jour, checklist,
  capture photo, signalement d'anomalie, rapport, signature de fin.
- Espace prestataire : consultation des tarifs et du score, gestion de l'onboarding de
  versement, suivi des versements de missions.

Différenciateur : aucun autre PMS ne calcule un prix conseil de ménage adossé au travail réel
ni ne verse le prestataire contre preuve photo. Baitly outille toute la boucle, du conseil de
prix jusqu'au paiement du prestataire et au suivi qualité.

---

## 5. Communication voyageurs

Une messagerie unifiée, des automatisations, un livret d'accueil numérique et des ventes
additionnelles, pour couvrir toute la relation avec le voyageur depuis un seul endroit.

- **Boîte de réception unifiée** : tous les canaux au même endroit (Airbnb, Booking, WhatsApp,
  e-mail, messages internes), avec assignation à un opérateur, compteur de non-lus, temps réel
  et rattachement des conversations aux réservations.
- **WhatsApp par organisation** : double fournisseur, API officielle Meta Cloud et solution
  auto-hébergée, avec gestion de la fenêtre de service de 24 heures et modèles de message.
  Signature automatique du message (prénom de l'hôte et nom du logement).
- **E-mail transactionnel** : envoi via Brevo, avec habillage et modèles, et nettoyage
  systématique du HTML pour la sécurité.
- **Automatisations de messages** : déclencheurs sur le cycle de vie du séjour (confirmation,
  arrivée proche, jour d'arrivée, jour de départ, après départ, rappel d'avis), avec décalage
  en jours, heure d'envoi, conditions et anti-doublon.
- **Modèles et traduction automatique** : interpolation des variables du séjour, du voyageur
  et du logement, avec traduction automatique des modèles dans 30 langues (DeepL ou Google).
- **Livret d'accueil numérique** : un livret par réservation, auto-rempli (logement, codes
  d'accès), avec points d'intérêt structurés, activités curées, message d'accueil, thèmes et
  branding, chatbot ancré sur le contenu du logement, livre d'or et statistiques de
  consultation. Lien guest sécurisé et borné à la réservation.
- **Ventes additionnelles (upsells)** : boutique de services payants réglée par livret,
  paiement Stripe, avec répartition de commission paramétrable entre plateforme, conciergerie
  et hôte.
- **Enregistrement en ligne** : formulaire de pré-arrivée (identité déclarative, heure
  d'arrivée estimée, demandes particulières) relié au livret.

---

## 6. Finance et conformité

Le domaine où Baitly va le plus loin. Facturation conforme à la norme française anti-fraude,
comptabilité de mandat intégrée, reversements propriétaires flexibles et versements
prestataires, le tout sans surcoût premium.

- **Facturation conforme NF** : factures immuables après émission, numérotation séquentielle
  sans trou (attribution dans la transaction, verrou anti-collision), mentions légales,
  parties vendeur et acheteur, avoirs pour correction. Type de facture dédié pour la commission
  de gestion.
- **Export FEC** : Fichier des Écritures Comptables au format DGFiP, plus exports CSV. Rare
  chez les PMS internationaux.
- **Comptabilité de mandat (trust accounting)** : porte-monnaie virtuels (plateforme,
  propriétaire, conciergerie, séquestre), grand livre en partie double avec solde courant et
  contreparties, séquestre des fonds par réservation avec libération automatique à l'arrivée,
  répartition contractuelle des fonds entre les parties. Câblé au flux de paiement réel.
- **Quatre rails d'encaissement** : Stripe, plus PayTabs, CMI et Payzone pour la zone
  Maroc et Arabie Saoudite.
- **Quatre rails de reversement propriétaire** : Stripe Connect, Wise (plus de 80 pays),
  Open Banking (initiation de paiement), et virement SEPA par fichier pain.001.
- **Contrats de gestion et relevés** : mandats propriété-propriétaire avec 4 modèles de
  paiement (encaissement direct, propriétaire encaisse, conciergerie encaisse, partage
  co-hôte OTA), facture de commission NF, relevé propriétaire et portail propriétaire dédié,
  planification et rappels de reversements.
- **Versements prestataires** : vue de suivi des versements de missions de ménage (statut,
  prestataire, lien vers la mission, relance des versements en échec).
- **Taxe de séjour** : native et paramétrable (taux ou montant, exonération enfants), calculée
  et collectée au moment de la réservation, intégrée au pipeline de facturation.
- **Multi-devise** : conversion EUR, MAD, SAR et taux de change gérés.
- **Passerelle comptable** : synchronisation de bout en bout vers Pennylane (factures et
  dépenses).

Différenciateur : la conformité fiscale française (facturation NF inviolable, FEC, facture de
commission NF, taxe de séjour) combinée à une comptabilité de mandat réelle et incluse. Aucun
concurrent généraliste du marché n'adresse ce terrain.

---

## 7. Assistant IA et constellation d'agents

Baitly intègre une couche d'intelligence artificielle à deux niveaux : un assistant
conversationnel pour le gestionnaire, et une constellation d'agents qui surveillent le
portefeuille et proposent des actions, avec une autonomie que l'humain règle lui-même.

### Assistant conversationnel

- **Copilote multi-fournisseur** : assistant capable de dialoguer et d'agir, adossé à
  plusieurs fournisseurs de modèles (Anthropic, OpenAI, Bedrock), avec streaming des réponses
  et budget de jetons par organisation.
- **Recherche documentaire (RAG)** : l'assistant peut citer la documentation Baitly via une
  recherche par embeddings à deux étages (recherche puis reclassement), org-scopée.
- **Mémoire long terme** : l'assistant retient des faits utiles d'une session à l'autre.
- **Vision** : analyse d'images uploadées dans le chat.
- **Actions concrètes** : au-delà de la réponse, l'assistant peut créer et assigner une
  intervention, bloquer un jour, lister des réservations, envoyer un message voyageur, avec
  confirmation humaine sur les actions sensibles.

### Constellation d'agents

- **Cinq agents spécialisés** : Communication, Revenue, Opérations, Finance et Réputation.
  Chaque agent surveille son domaine et propose des actions.
- **Cartes de décision (human-in-the-loop)** : chaque suggestion arrive sous forme de carte
  que le gestionnaire approuve ou écarte (relance de ménage, brouillon de réponse à un avis,
  baisse ou hausse de prix, blocage de calendrier, libération de caution, rappel de paiement,
  fiche client incomplète, etc.).
- **Feed « En direct »** : un flux d'activité qui montre ce que les agents observent et
  proposent en temps réel.
- **Autonomie déterministe, activée à la demande** : le système propose d'automatiser ce que
  l'humain approuve déjà régulièrement. Trois niveaux par type d'action (suggestion,
  automatique sous enveloppe avec notification annulable, automatique silencieux avec journal),
  avec plafonds par agent, enveloppes éditables et interrupteur global. Tout est opt-in, rien
  ne s'automatise sans activation explicite. Les débits d'argent réels ne sont jamais
  automatisés.
- **Règles de confiance** : après plusieurs approbations humaines consécutives d'un même type
  d'action, la plateforme suggère d'activer l'automatisation, chiffre d'acceptation par type à
  l'appui.

Différenciateur : une constellation d'agents à autonomie graduée qui réutilise le même chemin
d'exécution que l'humain (mêmes garde-fous, même traçabilité). L'agent propose, l'humain
décide du curseur d'autonomie.

---

## 8. Objets connectés et IoT

Baitly pilote les équipements connectés du logement pour fluidifier l'arrivée et surveiller
les nuisances, sans matériel propriétaire imposé.

- **Serrures connectées** : Nuki (verrouillage et codes d'accès dynamiques avec rotation
  automatique) et KeyNest (réseau d'échange de clés). Le code d'accès peut être exposé au
  voyageur directement dans le livret.
- **Capteurs de bruit et d'environnement** : Minut (bruit et température) et Netatmo, pour
  prévenir les fêtes et les nuisances.
- **Caméras et streaming** : Tuya, avec diffusion vidéo temps réel (go2rtc, WebRTC et RTSP)
  déployée en production.
- **Agrégation multi-équipements** : vue consolidée des appareils et des capteurs par logement.

---

## 9. Application mobile

Une application native iOS et Android qui couvre à la fois la gestion nomade et l'exécution
terrain, ce qui est rare sur le marché (la plupart des PMS ont soit une app de consultation
pour l'hôte, soit une app séparée pour les prestataires).

- **Native, pas une page web habillée** : construite en React Native et Expo.
- **Double couverture** : côté gestion (propriétés, réservations, calendrier, prix, factures,
  reversements, messagerie, objets connectés) et côté terrain (technicien et agent de ménage :
  missions, checklist, photos, anomalies, signature).
- **Mode hors connexion robuste** : file de synchronisation des actions avec relance
  progressive, ordonnancement par dépendances et vidage automatique au retour du réseau, en
  plus du cache de consultation.
- **Notifications push** natives, avec préférences par utilisateur et liens profonds.
- **Mises à jour instantanées** : livraison de correctifs sans repasser par les stores.
- **Sécurité** : jeton d'authentification stocké dans le coffre du système (Keychain iOS,
  Keystore Android).

---

## 10. Administration, sécurité et multi-pays

Une gestion des accès fine, une isolation stricte des données, une conformité RGPD réelle et
une architecture pensée pour plusieurs pays.

- **Authentification et rôles** : Keycloak (deux realms, staff et voyageurs), 8 rôles
  fonctionnels dont des rôles métier terrain (technicien, ménage, lingerie, extérieur,
  superviseur) et un modèle de permissions granulaires éditable.
- **Isolation multi-tenant fermée par défaut** : chaque requête est rattachée à une
  organisation, tout accès non résolu est refusé, et chaque chargement par identifiant valide
  l'appartenance à l'organisation.
- **Journal d'audit** : traçabilité des accès refusés et des actions métier.
- **RGPD complet** : export des données (portabilité), anonymisation (droit à l'oubli),
  consentement horodaté. Pas un simple bandeau cookies.
- **Signature électronique du mandat** : signature interne du mandat de gestion via un lien
  public sécurisé, avec preuve (adresse IP, horodatage, empreinte) et certificat apposé au PDF.
- **Cap multi-pays** : moteur fiscal par pays (France, Maroc, Arabie Saoudite) et rails de
  paiement dédiés à la zone MENA, prêts à être activés selon le déploiement.

---

## Ce qui nous distingue

Cinq atouts que peu ou aucun concurrent ne réunit :

1. **Conformité française de bunker** : facturation NF inviolable, export FEC, facture de
   commission NF, taxe de séjour native. Les grands PMS internationaux ne couvrent pas la
   norme française.
2. **Moteur Ménage économique** : prix de ménage conseillé calculé sur le travail réel,
   tarifs prestataires cadrés, et versement du prestataire contre preuve photo. Aucun autre
   PMS ne le fait.
3. **Comptabilité de mandat incluse** : porte-monnaie virtuels, grand livre en partie double,
   séquestre et répartition contractuelle des fonds, sans option premium à part.
4. **Constellation d'agents à autonomie graduée** : l'IA propose, l'humain règle le curseur
   d'autonomie, et le système ne s'automatise que sur ce qui est déjà approuvé régulièrement.
5. **Application terrain native** : une seule app couvre la gestion nomade et l'exécution
   terrain, avec un vrai mode hors connexion.

---

> Note de périmètre pour l'équipe commerciale : ce catalogue liste des capacités réellement
> présentes dans le produit. Certaines fonctions restent activables selon le déploiement (rails
> de paiement Maroc et Arabie Saoudite, connecteurs de tarification et de comptabilité tiers).
> Certaines capacités IA avancées (autopilot de messagerie, tarification 100 % IA) existent en
> socle mais ne sont pas systématiquement activées par défaut. En cas de doute sur une
> capacité précise face à un prospect, se référer aux inventaires internes du dossier
> `analyse-concurrentielle/inventaire/`.

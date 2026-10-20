# Baitly : trouver une conciergerie pour son logement

## Parcours propriétaire

Le propriétaire ouvre `/conciergeries` depuis le site ou l’action « Trouver une
conciergerie pour ce bien » de sa fiche logement dans le PMS. Cette action reprend
la ville, le pays connu et le type de logement. Le lien public ne transporte ni
identifiant privé, ni adresse précise, ni nom ou coordonnées du propriétaire.

Il précise les services recherchés et, facultativement, une commission maximale.
Les profils correspondants affichent les services et la commission publiés ainsi
que les éléments expliquant la correspondance géographique. Le propriétaire ouvre
une fiche, vérifie le destinataire puis complète une demande de gestion ou
d’estimation. Les critères restent modifiables avant l’envoi. Chaque envoi vise
une seule conciergerie et nécessite la demande explicite de réponse du lot 2.

## Règles de correspondance

- Le catalogue interrogé est celui des profils conciergeries effectivement publiés,
  appartenant à une organisation de type conciergerie.
- La ville correspond à celle du profil ou à celle d’un logement actif sélectionné
  pour publication par ce profil, dans la même organisation. La comparaison ignore
  la casse, les principaux accents latins et les espaces répétés.
- Tous les services demandés doivent figurer parmi les services publiés.
- Un plafond de commission exclut les profils dont le taux est inconnu ou supérieur.
  Les résultats sont triés par commission publiée croissante, puis par publication
  récente. Le taux affiché ne constitue pas un devis.
- Le pays est documenté seulement par les logements publics de la ville concernée.
  Une contradiction connue exclut le profil ; une information absente est signalée
  « Pays à confirmer ». Sans ville, le pays porte sur les logements publics présentés.
- Le type de logement prépare la demande mais ne filtre pas des capacités que la
  conciergerie n’a pas explicitement déclarées.

La disponibilité et la zone réelle d’intervention restent à confirmer avec la
conciergerie. Aucune capacité ou qualité de service n’est déduite d’un score inventé.
La recherche paginée porte sur tout le catalogue publié, et non sur les cent
premiers profils de l’ancien endpoint de liste.

## Transmission et CRM

Le formulaire et le service d’entrée du lot 2 sont réutilisés. L’instantané de
demande conserve désormais le pays, le type exact du logement (dont riad, studio,
villa…), les services demandés et le plafond de commission éventuel. Ces champs
sont visibles dans la boîte de réception et l’historique de la fiche CRM.

Le serveur résout toujours l’organisation destinataire depuis le profil publié.
Les règles de dédoublonnage, de transaction, d’archives, d’idempotence et de
conservation des oppositions du lot 2 restent en place. Aucun accord de campagne
commerciale n’est créé par cette démarche.

Les critères et les UTM autorisés restent présents lors du passage annuaire →
fiche → retour à la recherche. L’entrée depuis une fiche PMS ajoute les UTM
`baitly-app / property / owner-matching`. Cette attribution reste déclarative,
comme les autres UTM ; elle ne constitue pas une preuve d’identité ou d’autorisation.

## Livraison et validation

Changeset Liquibase : `0570-baitly-owner-matching-context`, après `0569`.
Il ajoute les champs d’instantané sans inférer de critères pour les anciennes
demandes et étend les types de logement à l’énumération métier existante.
Déployer le serveur, le site et le PMS par le CI/CD habituel.

Les contrôles couvrent les correspondances et leurs limites, la pagination au-delà
de cent profils, le masquage du nom et l’absence de données privées dans les
résultats, la transmission au CRM cible, les régressions du lot 2 et l’hydratation
du parcours FR/AR avec critères d’URL. La recette navigateur utilise des données
isolées et n’envoie aucune demande à une conciergerie réelle.

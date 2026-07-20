# Interventions : ménage, maintenance et check-in/check-out

## Comment fonctionnent les interventions dans Baitly ?

Dans Baitly, une intervention (aussi appelée mission ou tâche) est une prestation réalisée dans un logement : ménage, maintenance, réparation, jardinage, désinfection, etc. La page Interventions du menu regroupe trois onglets : Demandes de service, Interventions et Anomalies. Le flux normal est le suivant : une demande de service est créée (manuellement ou automatiquement après un départ voyageur), elle est validée puis payée si nécessaire, et devient alors une intervention exécutée par un technicien, un agent de ménage (housekeeper) ou une équipe. Les rôles concernés : l'hôte (propriétaire) crée des demandes et suit les missions sur ses logements ; les gestionnaires de plateforme (super admin, super manager) valident, planifient et assignent ; les intervenants terrain exécutent et documentent la mission depuis l'application mobile.

## Quels sont les statuts d'une intervention ?

Une intervention passe par des statuts précis : En attente (créée par un gestionnaire, à traiter), En attente de validation (créée par un hôte, un gestionnaire doit la valider), En attente de paiement (validée, l'hôte doit régler avant exécution), En cours, Terminée (avec réouverture possible) et Annulée (état final). Qui crée quoi : un hôte crée une demande qui part en attente de validation, sans coût fixé (le gestionnaire le définira) ; un super admin ou super manager crée directement une intervention et peut fixer le coût. Les rôles terrain (technicien, housekeeper, superviseur) ne créent pas d'intervention : ils exécutent celles qui leur sont attribuées.

## Comment planifier un ménage automatique après chaque départ ?

Baitly peut créer automatiquement une demande de ménage à chaque départ de voyageur. Quand une réservation est importée depuis un canal (Airbnb, Booking via calendrier synchronisé), et si l'option de création automatique des interventions est activée pour votre organisation, une demande de ménage est générée à la date du check-out, à l'heure de ménage par défaut du logement (dans son fuseau horaire). La demande affiche le départ et la prochaine arrivée pour caler la mission entre deux séjours ; une fois validée et payée le cas échéant, l'intervention de nettoyage est créée et attribuée. Trois types de ménage existent : express (mi-séjour, plus léger), standard (entre deux séjours, dit turnover) et grand ménage (deep clean). Rôles concernés : le réglage d'automatisation est géré par les gestionnaires ; l'hôte voit les demandes générées sur ses logements.

## Comment l'intervention est-elle attribuée (automatiquement ou manuellement) ?

Une intervention est attribuée soit à un utilisateur précis (technicien, agent de ménage, superviseur), soit à une équipe entière — les deux modes sont exclusifs. Lors d'une assignation à une équipe, tous ses membres sont notifiés. Seuls les gestionnaires de plateforme (super admin, super manager) peuvent assigner. L'attribution automatique, activable ou désactivable par organisation, fonctionne ainsi : Baitly cherche d'abord l'équipe assignée au logement ; à défaut, il cherche une équipe par zone géographique de couverture, type de prestation et disponibilité. Les demandes non attribuées sont retentées automatiquement toutes les 15 minutes. En option (désactivée par défaut), Baitly peut aussi promouvoir le meilleur membre de l'équipe retenue, en combinant score qualité, tarif le plus proche du barème conseillé et charge du jour. Un intervenant déjà assigné n'est jamais remplacé automatiquement.

## Comment le prix d'un ménage est-il calculé (moteur ménage) ?

Le moteur ménage de Baitly calcule un prix conseillé à partir d'une idée simple : un ménage, c'est du temps de travail. Il estime les minutes nécessaires selon le logement (base selon le nombre de chambres, suppléments pour salles de bain, surface, étages, extérieur, linge, voyageurs supplémentaires), les multiplie par un taux horaire et par le type de ménage (express moins cher, grand ménage plus cher), arrondit, applique un plancher, et présente une fourchette autour d'une médiane mise en avant. La décomposition minute par minute est visible (par exemple : 2 chambres = 120 min, étage supplémentaire = 15 min). Le gestionnaire règle toute la grille (minutes, taux, multiplicateurs, majorations saisonnières) dans Tarification, onglet Ménage, avec un simulateur par logement. Le prix retenu pour une mission suit une règle de priorité : tarif du prestataire s'il existe, sinon prix de ménage du logement s'il est renseigné, sinon médiane du conseil. Le barème conseillé du moment est toujours enregistré à côté du prix pratiqué, pour comparaison (mention « conforme au barème » si l'écart est faible).

## Comment le prestataire est-il payé pour un ménage ?

Le versement au prestataire (agent de ménage ou technicien) se déclenche à la fin de la mission, sous conditions : le ménage doit avoir été payé par l'hôte, la preuve qualité doit être présente (au moins une photo « après » prise sur la mission), et le prestataire doit avoir configuré son compte de versement. La configuration se fait dans Réglages, écran « Mes versements » : un parcours d'identification bancaire est intégré directement dans la page. Si une condition manque, le versement est bloqué avec la raison affichée (preuve manquante, compte non configuré) et le prestataire est notifié ; un gestionnaire peut relancer après correction — rien n'échoue en silence. Une commission plateforme optionnelle peut s'appliquer (désactivée par défaut : le prestataire touche 100 % de sa rémunération). Chaque intervenant voit son propre montant : le prestataire voit sa rémunération, l'hôte et les gestionnaires voient le prix facturé. Un historique des versements (mission, montant, statut) est disponible pour le prestataire.

## Comment signaler et suivre une anomalie constatée pendant un ménage ?

Pendant une mission, un agent de ménage ou un technicien peut signaler une anomalie depuis l'application mobile (catégorie, sévérité, description, photos) : dommage constaté, objet manquant, problème d'hygiène, équipement défaillant, risque sécurité ou autre. Un gestionnaire peut aussi créer une anomalie depuis le web (bouton « Signaler une anomalie »). Chaque signalement devient un ticket visible dans l'onglet Anomalies de la page Interventions, avec un coût suggéré automatiquement si la catégorie correspond au catalogue de tarifs travaux de l'organisation. Le gestionnaire peut alors Qualifier (ajuster catégorie, sévérité, coût), Convertir en demande de maintenance pré-chiffrée (qui suit le flux normal validation puis paiement puis intervention) ou Rejeter avec un motif. Statuts : Ouverte, Qualifiée, Convertie, Rejetée. Les administrateurs et le propriétaire du logement sont notifiés au signalement et à la conversion.

## Comment documenter une mission sur le terrain (photos, checklist, signature) ?

Depuis l'application mobile, l'intervenant documente sa mission : photos « avant » et « après » la prestation, photos d'anomalie si un problème est constaté, checklist de ménage pièce par pièce avec chronomètre, notes de compte-rendu et signature de fin de mission. Les photos « après » servent de preuve qualité : elles conditionnent le versement du prestataire. Côté web, le détail d'une intervention affiche la progression, les coûts (estimé et réel), les notes et consignes (instructions spéciales, notes d'accès, consignes de ménage) et les dates de départ et d'arrivée des voyageurs. Rôles : technicien et housekeeper documentent, superviseur et gestionnaires valident et contrôlent, l'hôte consulte les missions de ses logements.

## Questions fréquentes

**Pourquoi ma demande d'intervention est-elle « En attente de validation » ?**
Parce qu'elle a été créée par un hôte : un gestionnaire doit la valider (et fixer le coût) avant qu'elle avance vers le paiement puis l'exécution.

**Puis-je modifier le prix de ménage conseillé par Baitly ?**
Oui. Le conseil n'est jamais bloquant : l'hôte peut adopter le prix conseillé ou saisir son propre prix sur la fiche du logement, et le prestataire peut avoir ses propres tarifs. Le barème reste affiché à titre de comparaison.

**Pourquoi le versement de mon agent de ménage est-il bloqué ?**
Deux raisons possibles, toujours affichées : il manque la photo « après » prouvant la mission, ou le compte de versement du prestataire n'est pas configuré (Réglages, « Mes versements »). Une fois corrigé, un gestionnaire peut relancer le versement.

**Qui peut assigner une intervention à une équipe ?**
Uniquement les gestionnaires de plateforme (super admin, super manager). Les rôles terrain voient seulement les missions qui leur sont attribuées, à eux ou à leur équipe.

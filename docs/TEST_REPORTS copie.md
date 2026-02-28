# Guide de Test - Génération de Rapports PDF

## 🧪 Tests Disponibles

### 1. Tests Unitaires (Maven)

Exécutez les tests unitaires pour vérifier la génération de PDF :

```bash
cd server
mvn test -Dtest=ReportServiceTest
```

Ces tests vérifient que :
- Les PDFs sont générés correctement
- Les fichiers générés sont des PDFs valides (commencent par %PDF)
- Tous les types de rapports fonctionnent

### 2. Test via l'Interface Web

#### Étape 1 : Démarrer l'environnement

```bash
cd infrastructure
./start-dev.sh
```

Attendez que tous les services soient démarrés :
- ✅ Frontend: http://localhost:3000
- ✅ Backend: http://localhost:8084
- ✅ Keycloak: http://localhost:8083

#### Étape 2 : Se connecter

1. Ouvrez http://localhost:3000 dans votre navigateur
2. Connectez-vous avec vos identifiants
3. Naviguez vers la section **Rapports** dans le menu

#### Étape 3 : Générer un rapport

1. Cliquez sur une catégorie de rapport (ex: "Rapports Financiers")
2. Cliquez sur le bouton **"Générer"** d'un rapport spécifique
3. Le PDF devrait se télécharger automatiquement

#### Étape 4 : Vérifier le PDF

Ouvrez le PDF téléchargé et vérifiez :
- ✅ En-tête avec logo Clenzy stylisé
- ✅ Couleurs de la marque (bleu-gris Clenzy)
- ✅ Tableaux bien formatés
- ✅ Métriques mises en avant
- ✅ Pied de page avec informations de contact
- ✅ Données correctes selon le type de rapport

### 3. Test via API (cURL)

#### Récupérer le token d'authentification

1. Ouvrez la console développeur (F12) dans votre navigateur
2. Allez dans l'onglet "Application" > "Local Storage"
3. Copiez la valeur de `kc_access_token`

#### Générer un rapport financier

```bash
TOKEN="votre_token_ici"
curl -X GET \
  "http://localhost:8084/api/reports/financial/revenue?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer $TOKEN" \
  -o rapport-financier-revenue.pdf
```

#### Générer un rapport d'interventions

```bash
curl -X GET \
  "http://localhost:8084/api/reports/interventions/performance?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer $TOKEN" \
  -o rapport-interventions-performance.pdf
```

#### Générer un rapport d'équipes

```bash
curl -X GET \
  "http://localhost:8084/api/reports/teams/performance?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer $TOKEN" \
  -o rapport-equipes-performance.pdf
```

#### Générer un rapport de propriétés

```bash
curl -X GET \
  "http://localhost:8084/api/reports/properties/status?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer $TOKEN" \
  -o rapport-proprietes-status.pdf
```

### 4. Vérification du Contenu PDF

#### Rapports Financiers

- **Revenus** : Affiche les revenus totaux et le nombre d'interventions
- **Coûts** : Affiche les coûts totaux et le nombre d'interventions
- **Profitabilité** : Affiche revenus, coûts et profit net

#### Rapports d'Interventions

- **Performance** : Taux de complétion et nombre d'interventions complétées
- **Planification** : Nombre d'interventions planifiées
- **Complétion** : Nombre d'interventions complétées

#### Rapports d'Équipes

- **Performance** : Nombre d'équipes et total de membres
- **Disponibilité** : Nombre d'équipes disponibles
- **Charge de Travail** : Nombre d'équipes

#### Rapports de Propriétés

- **État** : Nombre de propriétés actives vs total
- **Maintenance** : Nombre de propriétés
- **Coûts** : Nombre de propriétés

## 🔍 Dépannage

### Erreur 401/403 (Non autorisé)

- Vérifiez que vous êtes connecté
- Vérifiez que votre token n'a pas expiré
- Vérifiez que vous avez les permissions nécessaires (`reports:view`, `interventions:view`, etc.)

### Erreur 500 (Erreur serveur)

- Vérifiez les logs du backend : `docker logs clenzy-backend-dev`
- Vérifiez que la base de données contient des données
- Vérifiez que les dépendances iText sont bien installées

### PDF vide ou corrompu

- Vérifiez que le backend a bien compilé avec les nouvelles dépendances
- Vérifiez les logs pour des erreurs de génération
- Testez avec un autre type de rapport

### Le PDF ne se télécharge pas

- Vérifiez la console du navigateur pour des erreurs JavaScript
- Vérifiez que l'API retourne bien un PDF (Content-Type: application/pdf)
- Testez avec un autre navigateur

## 📊 Endpoints Disponibles

Tous les endpoints nécessitent une authentification Bearer token.

### Rapports Financiers
- `GET /api/reports/financial/revenue`
- `GET /api/reports/financial/costs`
- `GET /api/reports/financial/profit`

### Rapports d'Interventions
- `GET /api/reports/interventions/performance`
- `GET /api/reports/interventions/planning`
- `GET /api/reports/interventions/completion`

### Rapports d'Équipes
- `GET /api/reports/teams/performance`
- `GET /api/reports/teams/availability`
- `GET /api/reports/teams/workload`

### Rapports de Propriétés
- `GET /api/reports/properties/status`
- `GET /api/reports/properties/maintenance`
- `GET /api/reports/properties/costs`

### Paramètres de requête (optionnels)

- `startDate` : Date de début (format ISO: YYYY-MM-DD)
- `endDate` : Date de fin (format ISO: YYYY-MM-DD)

Par défaut, les dates sont définies sur le dernier mois.

## ✅ Checklist de Validation

- [ ] Les tests unitaires passent
- [ ] Le PDF se génère correctement via l'interface web
- [ ] Le PDF contient le logo Clenzy stylisé
- [ ] Les couleurs de la marque sont correctes
- [ ] Les tableaux sont bien formatés
- [ ] Les métriques sont mises en avant
- [ ] Le pied de page contient les bonnes informations
- [ ] Les données affichées sont correctes
- [ ] Le PDF est téléchargeable et lisible

# Synchronisation des Types d'Intervention

## Vue d'ensemble

Ce document décrit la synchronisation des types d'intervention entre le frontend TypeScript et le backend Java pour assurer la cohérence des données.

## Structure des fichiers

### Frontend (TypeScript)
- **Fichier**: `client/src/types/interventionTypes.ts`
- **Énumération**: `InterventionType`
- **Interface**: `InterventionTypeOption`
- **Utilitaires**: `InterventionTypeUtils`

### Backend (Java)
- **Fichier**: `server/src/main/java/com/clenzy/model/InterventionType.java`
- **Énumération**: `InterventionType`

## Types d'intervention disponibles

### 1. Nettoyage (Cleaning)
- `CLEANING` - Nettoyage
- `EXPRESS_CLEANING` - Nettoyage Express
- `DEEP_CLEANING` - Nettoyage en Profondeur
- `WINDOW_CLEANING` - Nettoyage des Vitres
- `FLOOR_CLEANING` - Nettoyage des Sols
- `KITCHEN_CLEANING` - Nettoyage de la Cuisine
- `BATHROOM_CLEANING` - Nettoyage des Sanitaires

### 2. Maintenance et Réparation (Maintenance)
- `PREVENTIVE_MAINTENANCE` - Maintenance Préventive
- `EMERGENCY_REPAIR` - Réparation d'Urgence
- `ELECTRICAL_REPAIR` - Réparation Électrique
- `PLUMBING_REPAIR` - Réparation Plomberie
- `HVAC_REPAIR` - Réparation Climatisation
- `APPLIANCE_REPAIR` - Réparation Électroménager

### 3. Services Spécialisés (Specialized)
- `GARDENING` - Jardinage
- `EXTERIOR_CLEANING` - Nettoyage Extérieur
- `PEST_CONTROL` - Désinsectisation
- `DISINFECTION` - Désinfection
- `RESTORATION` - Remise en État

### 4. Autre (Other)
- `OTHER` - Autre

## Utilisation

### Frontend
```typescript
import { InterventionType, InterventionTypeUtils } from '../../types/interventionTypes';

// Utilisation directe
const type = InterventionType.CLEANING;

// Utilisation des utilitaires
const label = InterventionTypeUtils.getLabel(InterventionType.CLEANING);
const category = InterventionTypeUtils.getCategory(InterventionType.CLEANING);
const color = InterventionTypeUtils.getColor(InterventionType.CLEANING);

// Vérification de catégorie
if (InterventionTypeUtils.isCleaning(InterventionType.CLEANING)) {
  // Logique pour le nettoyage
}
```

### Backend
```java
import com.clenzy.model.InterventionType;

// Utilisation directe
InterventionType type = InterventionType.CLEANING;

// Utilisation des utilitaires
String displayName = type.getDisplayName();
String category = type.getCategory();
boolean isCleaning = type.isCleaning();

// Conversion depuis String
InterventionType fromString = InterventionType.fromString("CLEANING");
```

## Règles de synchronisation

### 1. Ajout d'un nouveau type
1. Ajouter la valeur dans `InterventionType.java` (backend)
2. Ajouter la valeur dans `InterventionType` (frontend)
3. Ajouter l'option dans `INTERVENTION_TYPE_OPTIONS` (frontend)
4. Mettre à jour la documentation

### 2. Modification d'un type existant
1. Modifier la valeur dans les deux fichiers
2. Vérifier la cohérence des métadonnées
3. Tester la migration des données existantes

### 3. Suppression d'un type
1. Vérifier qu'aucune donnée n'utilise ce type
2. Supprimer des deux fichiers
3. Mettre à jour la documentation

## Validation

### Tests de cohérence
- Vérifier que toutes les valeurs frontend existent en backend
- Vérifier que toutes les valeurs backend existent en frontend
- Tester la conversion des types dans les deux sens

### Migration des données
- Lors de l'ajout de nouveaux types, s'assurer que les données existantes restent valides
- Utiliser des valeurs par défaut appropriées pour les types inconnus

## Avantages de cette approche

1. **Cohérence**: Les mêmes types sont utilisés partout
2. **Maintenabilité**: Un seul endroit pour modifier les types
3. **Type Safety**: Vérification des types au moment de la compilation
4. **Extensibilité**: Facile d'ajouter de nouveaux types
5. **Documentation**: Structure claire et documentée

## Composants utilisant ces types

- `ServiceRequestForm` - Création de demandes de service
- `InterventionForm` - Création d'interventions
- `TeamsList` - Filtrage des équipes par type
- `PropertyForm` - Types de services pour les propriétés
- Backend - Validation et traitement des données

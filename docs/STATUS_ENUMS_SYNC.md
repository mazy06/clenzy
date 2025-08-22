# Synchronisation des Enums de Statuts

## Vue d'ensemble

Ce document décrit la synchronisation des enums de statuts entre le frontend (TypeScript) et le backend (Java) pour assurer la cohérence des données et éviter les erreurs de validation.

## Structure des Enums

### Frontend (TypeScript)

**Fichier :** `client/src/types/statusEnums.ts`

**Enums disponibles :**
- `InterventionStatus` - Statuts des interventions
- `RequestStatus` - Statuts des demandes de service
- `PropertyStatus` - Statuts des propriétés
- `UserStatus` - Statuts des utilisateurs
- `Priority` - Niveaux de priorité

**Structure d'une option :**
```typescript
interface StatusOption {
  value: StatusEnum;
  label: string;        // Libellé en français
  color: string;        // Couleur Material-UI
  icon: string;         // Nom de l'icône Material-UI
}
```

### Backend (Java)

**Enums disponibles :**
- `InterventionStatus.java`
- `RequestStatus.java`
- `PropertyStatus.java`
- `UserStatus.java`
- `Priority.java`

**Structure d'un enum :**
```java
public enum StatusEnum {
    VALUE("Libellé français");
    
    private final String displayName;
    
    StatusEnum(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public static StatusEnum fromString(String status) {
        // Logique de conversion
    }
}
```

## Règles de Synchronisation

### 1. Valeurs des Enums
- **Les valeurs des enums doivent être identiques** entre frontend et backend
- **Format :** UPPER_CASE avec underscores
- **Exemple :** `PENDING`, `IN_PROGRESS`, `COMPLETED`

### 2. Libellés
- **Les libellés doivent être en français** et cohérents
- **Frontend :** Propriété `label`
- **Backend :** Propriété `displayName`

### 3. Ordre des Valeurs
- **L'ordre des valeurs doit être identique** entre frontend et backend
- **Cela garantit** que les index correspondent

### 4. Validation
- **Toujours utiliser** `fromString()` côté backend pour la validation
- **Toujours utiliser** les enums côté frontend pour la sélection

## Utilisation

### Frontend

```typescript
import { InterventionStatus, INTERVENTION_STATUS_OPTIONS } from '../../types/statusEnums';

// Dans un composant
const statuses = INTERVENTION_STATUS_OPTIONS.map(option => ({
  value: option.value,
  label: option.label
}));

// Initialisation
const [status, setStatus] = useState<InterventionStatus>(InterventionStatus.PENDING);
```

### Backend

```java
import com.clenzy.model.InterventionStatus;

// Validation
InterventionStatus status = InterventionStatus.fromString(requestStatus);

// Affichage
String displayName = status.getDisplayName();
```

## Avantages

1. **Cohérence des données** - Pas de différence entre frontend et backend
2. **Maintenance simplifiée** - Un seul endroit pour modifier les statuts
3. **Validation automatique** - Les enums garantissent des valeurs valides
4. **Internationalisation** - Libellés centralisés et traduits
5. **Type safety** - TypeScript et Java garantissent l'intégrité des types

## Maintenance

### Ajout d'un nouveau statut

1. **Backend :** Ajouter la valeur dans l'enum Java
2. **Frontend :** Ajouter la valeur dans l'enum TypeScript
3. **Vérifier** que les libellés correspondent
4. **Tester** la synchronisation

### Modification d'un statut existant

1. **Vérifier** l'impact sur la base de données
2. **Mettre à jour** l'enum Java
3. **Mettre à jour** l'enum TypeScript
4. **Tester** la cohérence

## Composants Utilisant ces Enums

- `InterventionForm` - Création/édition d'interventions
- `InterventionEdit` - Modification d'interventions
- `InterventionDetails` - Affichage des détails
- `InterventionsList` - Liste des interventions
- `ServiceRequestForm` - Création de demandes
- `PropertyForm` - Création/édition de propriétés
- `UserForm` - Création/édition d'utilisateurs

## Tests de Cohérence

Pour vérifier la cohérence :

1. **Compilation** - Vérifier que le code compile sans erreur
2. **Runtime** - Tester la création/modification d'entités
3. **Validation** - Vérifier que les statuts invalides sont rejetés
4. **Affichage** - Confirmer que les libellés s'affichent correctement

## Notes Importantes

- **Ne jamais hardcoder** des valeurs de statut dans le code
- **Toujours utiliser** les enums partagés
- **Vérifier la cohérence** après chaque modification
- **Documenter** les changements dans ce fichier

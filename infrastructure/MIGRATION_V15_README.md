# Migration V15 - Intervention Photos avec BYTEA

## Problème résolu

Cette migration résout le problème de stockage des photos d'intervention :
- **Avant** : Les photos étaient stockées en base64 dans une colonne `VARCHAR(1000)`, ce qui causait des erreurs "value too long"
- **Après** : Les photos sont stockées en binaire (`BYTEA`) dans une table dédiée `intervention_photos`

## Scripts disponibles

### 1. Vérifier l'état de la base de données

```bash
cd infrastructure
./check-db-status.sh
```

Ce script affiche :
- Si la table `intervention_photos` existe
- Le type des colonnes (`photo_data`, `notes`, `photos`)
- Le nombre de photos stockées
- Si des migrations sont nécessaires

### 2. Appliquer la migration V15

```bash
cd infrastructure
./apply-migration-v15.sh
```

Ce script :
- Vérifie l'état actuel de la base de données
- Applique la migration V15 de manière sécurisée (vérifie avant de modifier)
- Affiche un résumé final de l'état

## Contenu de la migration

La migration V15 effectue les opérations suivantes :

1. **Modifie la colonne `notes`** de `VARCHAR(1000)` à `TEXT` dans la table `interventions`
2. **Modifie la colonne `photos`** de `VARCHAR(1000)` à `TEXT` dans la table `interventions` (pour compatibilité)
3. **Crée la table `intervention_photos`** avec :
   - `id` : BIGSERIAL (clé primaire)
   - `intervention_id` : BIGINT (clé étrangère vers `interventions`)
   - `photo_data` : BYTEA (données binaires de la photo)
   - `content_type` : VARCHAR(50) (ex: "image/jpeg")
   - `file_name` : VARCHAR(255)
   - `caption` : VARCHAR(500)
   - `created_at` : TIMESTAMP
4. **Crée des index** pour améliorer les performances

## Utilisation manuelle (alternative)

Si vous préférez exécuter la migration manuellement :

```bash
# Se connecter au conteneur PostgreSQL
docker exec -it clenzy-postgres-dev psql -U clenzy -d clenzy_dev

# Puis exécuter le contenu du fichier :
# server/src/main/resources/db/migration/V15__extend_intervention_photos_notes_to_text.sql
```

Ou en une seule commande :

```bash
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev < server/src/main/resources/db/migration/V15__extend_intervention_photos_notes_to_text.sql
```

## Vérification après migration

Après avoir appliqué la migration, vérifiez que tout est correct :

```bash
./check-db-status.sh
```

Vous devriez voir :
- ✅ Table 'intervention_photos' existe
- ✅ Colonne 'photo_data': BYTEA (correct)
- ✅ Colonne 'notes': TEXT (correct)
- ✅ Colonne 'photos': TEXT (correct)

## Notes importantes

- La colonne `photos` dans la table `interventions` est maintenant **dépréciée** et marquée comme `updatable = false`
- Les nouvelles photos sont stockées dans la table `intervention_photos`
- L'ancienne colonne `photos` est conservée pour la compatibilité avec les données existantes
- Le code Java utilise maintenant l'entité `InterventionPhoto` pour stocker les photos en BYTEA

## En cas de problème

Si vous rencontrez des erreurs lors de l'application de la migration :

1. Vérifiez que le conteneur PostgreSQL est en cours d'exécution :
   ```bash
   docker ps | grep clenzy-postgres-dev
   ```

2. Vérifiez les logs du conteneur :
   ```bash
   docker logs clenzy-postgres-dev
   ```

3. Vérifiez l'état de la base de données :
   ```bash
   ./check-db-status.sh
   ```

4. Si nécessaire, connectez-vous directement à la base de données :
   ```bash
   docker exec -it clenzy-postgres-dev psql -U clenzy -d clenzy_dev
   ```

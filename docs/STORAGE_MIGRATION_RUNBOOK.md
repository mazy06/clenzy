# Runbook deploy — Migration storage frontend (PR #157)

> **Contexte** : la PR #157 main→production embarque une refonte complete
> de la persistance frontend (auth tokens → HttpOnly, prefs UI → backend,
> amenity icons → IndexedDB). Ce runbook decrit les etapes de deploiement
> + smoke checks.

## Pre-requis

- [ ] PR #157 merge sur `production` (clenzy repo)
- [ ] Image Docker de l'API publiee (commit hash visible dans `production`)
- [ ] Acces au workflow `Liquibase Bootstrap` sur **clenzy-infra** (necessaire car `SPRING_LIQUIBASE_ENABLED=false` en prod — cf. `feedback_no_manual_prod_fixes.md`)

## 1. Migrations Liquibase

Deux changesets a appliquer dans l'ordre :

| Numero | Description | Risque |
|---|---|---|
| `0135-add-user-ui-preferences` | Cree table `user_ui_preferences` (key-value JSONB par user) | Aucun (CREATE TABLE pur) |
| `0136-add-theme-mode-to-user-preferences` | Ajoute colonne `user_preferences.theme_mode VARCHAR(20) DEFAULT 'auto'` | Faible (ALTER TABLE ADD COLUMN avec DEFAULT — pas de blocage en prod sur Postgres 11+) |

### Procedure

1. Aller sur **clenzy-infra** → Actions → workflow `Liquibase Bootstrap`
2. Inputs :
   - `environment` : `production`
   - `sync_tag` : laisser vide (les changesets sont nouveaux, pas un sync)
   - `dry_run` : `true` pour le 1er pass
3. Verifier le log : on doit voir
   ```
   Reading from databasechangelog
   Running Changeset: changes/0135__add_user_ui_preferences.sql::0135-add-user-ui-preferences::clenzy-team
   Running Changeset: changes/0136__add_theme_mode_to_user_preferences.sql::0136-add-theme-mode-to-user-preferences::clenzy-team
   ```
4. Re-run avec `dry_run: false` pour appliquer
5. Verifier :
   ```sql
   SELECT * FROM databasechangelog WHERE id IN ('0135-add-user-ui-preferences', '0136-add-theme-mode-to-user-preferences');
   -- Doit retourner 2 lignes avec EXECTYPE = 'EXECUTED'

   \d user_ui_preferences
   -- Doit montrer : id, keycloak_id, pref_key, pref_value (jsonb), created_at, updated_at

   \d user_preferences
   -- Doit montrer la nouvelle colonne theme_mode varchar(20) NOT NULL DEFAULT 'auto'
   ```

### Rollback (si necessaire)

Liquibase ne genere PAS de rollback automatique pour les CREATE TABLE / ALTER TABLE. En cas de besoin :

```sql
-- Manuel via psql sur la DB prod (apres validation equipe)
DROP TABLE IF EXISTS user_ui_preferences;
ALTER TABLE user_preferences DROP COLUMN IF EXISTS theme_mode;
DELETE FROM databasechangelog WHERE id IN ('0135-add-user-ui-preferences', '0136-add-theme-mode-to-user-preferences');
```

## 2. Deploy API + Frontend

- [ ] Workflow `CD Deploy` sur clenzy-infra → branch `production` → deploy
- [ ] Verifier `https://api.clenzy.fr/actuator/health` → `UP`
- [ ] Verifier `https://app.clenzy.fr` se charge

## 3. Smoke checks post-deploy (~10 min)

### 3.1 Auth / Tokens (Bucket D + P0)

- [ ] Aller sur `https://app.clenzy.fr` → ne pas etre authentifie
- [ ] Ouvrir DevTools → Application → Local Storage → `app.clenzy.fr`
  - **Doit NE PAS contenir** : `kc_access_token`, `kc_refresh_token`, `kc_id_token`, `kc_expires_in`
  - Si presents : les anciennes versions ont laisse des residus → seront purges au prochain reload par `cleanupLegacyTokens()` (idempotent, silencieux)
- [ ] Login avec un compte test
- [ ] Verifier :
  - DevTools → Application → Cookies → `app.clenzy.fr` → cookie `clenzy_auth` present, `HttpOnly: true`, `Secure: true`, `SameSite: Strict`
  - Local Storage **ne contient toujours pas** `kc_*`
- [ ] Naviguer dans l'app (planning, settings) → tout fonctionne
- [ ] Network tab → toute requete API doit avoir `Cookie: clenzy_auth=...` (header automatique)

### 3.2 Theme mode persistance (R3 + BUG-3)

- [ ] Settings → Affichage → changer le theme (Light → Dark)
- [ ] Verifier requete PUT `/api/user-preferences/me` avec `{themeMode: 'dark'}`
- [ ] Recharger la page → theme reste `dark` (lecture localStorage cache anti-FOUC)
- [ ] Se logger sur un AUTRE device / navigateur prive → meme compte
- [ ] Verifier que le theme s'applique en `dark` (sync backend) → **cross-device OK**

### 3.3 Currency persistance (R1)

- [ ] Header → changer devise EUR → MAD
- [ ] Verifier requete PUT `/api/user-preferences/me` avec `{currency: 'MAD'}`
- [ ] Recharger → currency reste MAD
- [ ] Cross-device check → MAD aussi

### 3.4 Planning preferences UI (Bucket C)

- [ ] Page Planning → modifier zoom (Day → Week)
- [ ] DevTools → Network → PUT `/api/me/ui-preferences/planning.nav` avec `{zoom: 'week', density: 'normal'}`
- [ ] Modifier filtres statuts → PUT `/api/me/ui-preferences/planning.filters`
- [ ] Recharger → settings preserves
- [ ] Cross-device → preserves aussi

### 3.5 Amenity icons (R4)

- [ ] Settings → Commodites OTA → Referentiel Clenzy → changer icone d'une commodite
- [ ] DevTools → Application → IndexedDB → `clenzy-cache` → store `kv` → cle `amenity-icons:<orgId>` doit exister avec l'override
- [ ] Verifier requete PUT `/api/amenities/icon-overrides/...`
- [ ] Recharger → icone preservee

### 3.6 BUG-3 verification (theme/currency reset post-deploy)

> **Important** : ce check valide qu'on n'a PAS regresse les users existants.

- [ ] Choisir un compte qui avait un theme `dark` ou une currency `MAD` AVANT le deploy (utiliser les logs ou demander a un user beta)
- [ ] Demander a l'utilisateur de :
  1. Ouvrir l'app post-deploy
  2. Verifier que son theme/devise est PRESERVE (pas reset a `auto`/`EUR`)
- [ ] En backend, verifier que `user_preferences.theme_mode` a bien ete pousse a la valeur attendue (logic first-sync, cf. `useThemeMode.tsx:91`)

```sql
SELECT keycloak_id, theme_mode, currency FROM user_preferences WHERE keycloak_id = '<sub-de-luser-test>';
```

### 3.7 Banners dismissed (BUG-4)

- [ ] Pour un user qui avait dismissed des HelpBanner ou PWAInstallBanner AVANT le deploy :
  - Banners NE DOIVENT PAS re-apparaitre (migration legacy localStorage → backend executee au mount)
- [ ] DevTools → Local Storage post-migration → cles `clenzy_*_help_dismissed` et `pwa-banner-dismissed-at` doivent etre supprimees

### 3.8 Logout cross-tab + privacy

- [ ] Logger user A dans 2 onglets
- [ ] Logout dans onglet 1
- [ ] Verifier onglet 2 → redirige vers /login (via event window cross-tab)
- [ ] Logger user B dans onglet 2
- [ ] Verifier que user B ne voit PAS les prefs de user A (cache react-query purgee, IndexedDB amenity-icons purgee)

## 4. Monitoring post-deploy (24h)

| Metrique | Seuil alerte | Action si depasse |
|---|---|---|
| `5xx` sur `/api/user-preferences/me` | > 1% des requetes | Verifier logs API, check migration 0136 appliquee |
| `5xx` sur `/api/me/ui-preferences/*` | > 1% | Verifier migration 0135, check Spring boot logs |
| Plaintes user "j'ai perdu mon theme/devise" | > 3 reports | Investigation BUG-3 (logic first-sync defaillante) |
| `401` sur `/api/user-preferences/me` au boot | > 5% | Bug useIsAuthenticated (BUG-1 regression) |

## 5. Coordination cross-repo (decoupages futurs)

Cette PR NE TOUCHE PAS aux choses suivantes — listees pour suivi :

- **Landing repo (`clenzy-landing`)** : continue de lire `clenzy_session` via `document.cookie`. Le cookie reste non-HttpOnly (TODO Q4). Pas d'impact immediat.
- **Mobile app** : utilise sa propre persistance (AsyncStorage RN). Pas concernee par cette migration.

## 6. Si quelque chose tourne mal

1. **Logs API** : `kubectl logs -n clenzy deploy/pms-server -f` (ou equivalent docker)
2. **Logs frontend** : Sentry → projet `clenzy-pms-prod` → filtrer par release
3. **Rollback rapide** : revert la PR #157 sur `production`, redeploy
4. **Rollback DB** : voir section "Rollback" en haut. Sans danger car les colonnes ajoutees ont des defauts, le code N-1 les ignore.

---

**Auteur** : audit storage frontend (sprint mai 2026)
**Reviewers requis** : tech lead PMS, ops infra
**Date deploy cible** : a definir avec l'equipe

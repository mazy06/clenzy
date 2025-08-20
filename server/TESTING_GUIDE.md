# 🧪 GUIDE DE TEST - SERVICE DE SYNCHRONISATION KEYCLOAK

## 🚀 ÉTAPES DE TEST

### **1. Test de Compilation**

```bash
# Aller dans le répertoire server
cd server

# Compiler le projet
mvn clean compile -DskipTests

# Ou utiliser le script
chmod +x compile-test.sh
./compile-test.sh
```

### **2. Test des Endpoints**

Une fois la compilation réussie, testez les endpoints :

#### **Endpoint de Test Simple**
```bash
curl http://localhost:8080/api/test/health
# Attendu : "Service de test actif - [timestamp]"
```

#### **Endpoint de Synchronisation**
```bash
curl http://localhost:8080/api/sync/status
# Attendu : "Service de synchronisation actif"
```

### **3. Test de Synchronisation (Optionnel)**

#### **Depuis Keycloak vers la Base Métier**
```bash
curl -X POST http://localhost:8080/api/sync/from-keycloak
# ⚠️ Nécessite que Keycloak soit configuré et accessible
```

#### **Depuis la Base Métier vers Keycloak**
```bash
curl -X POST http://localhost:8080/api/sync/to-keycloak
# ⚠️ Nécessite que Keycloak soit configuré et accessible
```

## 🔧 CONFIGURATION REQUISE

### **1. Propriétés Keycloak**
Vérifiez que `application.yml` contient :
```yaml
keycloak:
  admin:
    username: admin
    password: admin
    client-id: admin-cli
```

### **2. Base de Données**
- PostgreSQL en cours d'exécution
- Table `users` avec le champ `keycloak_id`

### **3. Keycloak**
- Instance Keycloak en cours d'exécution
- Realm `clenzy` configuré
- Client `admin-cli` avec accès admin

## 🚨 DÉPANNAGE

### **Erreur de Compilation**
- Vérifiez que Java 17 est installé
- Vérifiez que Maven est installé
- Vérifiez les dépendances dans `pom.xml`

### **Erreur de Connexion Keycloak**
- Vérifiez que Keycloak est en cours d'exécution
- Vérifiez les propriétés de connexion
- Vérifiez les permissions admin

### **Erreur de Base de Données**
- Vérifiez que PostgreSQL est en cours d'exécution
- Vérifiez la migration V2
- Vérifiez les permissions de base de données

## 📝 LOGS UTILES

### **Logs de Synchronisation**
```bash
# Suivre les logs de l'application
tail -f logs/application.log

# Ou dans Docker
docker logs -f clenzy-server
```

### **Logs Keycloak**
```bash
# Suivre les logs Keycloak
docker logs -f clenzy-keycloak
```

## 🎯 RÉSULTATS ATTENDUS

### **Compilation Réussie**
- ✅ Aucune erreur de compilation
- ✅ Service `UserSyncService` disponible
- ✅ Endpoints de synchronisation accessibles

### **Synchronisation Fonctionnelle**
- ✅ Création d'utilisateurs depuis Keycloak
- ✅ Création d'utilisateurs depuis la plateforme
- ✅ Liaison bidirectionnelle des comptes
- ✅ Gestion des rôles et permissions

## 🚀 PROCHAINES ÉTAPES

1. **Tester la compilation** avec `mvn clean compile`
2. **Démarrer l'application** et tester les endpoints
3. **Configurer Keycloak** si nécessaire
4. **Tester la synchronisation** avec des utilisateurs réels
5. **Implémenter la gestion des mots de passe** (actuellement commentée)
6. **Implémenter l'assignation des rôles** (actuellement commentée)

---

**Bonne chance pour les tests ! 🎉**

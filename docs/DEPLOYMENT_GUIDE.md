# 🚀 Guide de Déploiement en Production - Clenzy

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Préparation de l'environnement](#préparation-de-lenvironnement)
3. [Configuration de production](#configuration-de-production)
4. [Déploiement](#déploiement)
5. [Sécurisation](#sécurisation)
6. [Monitoring et maintenance](#monitoring-et-maintenance)
7. [Dépannage](#dépannage)

## 🔧 Prérequis

### **Serveur de production**
- **OS** : Ubuntu 20.04+ ou CentOS 8+
- **RAM** : Minimum 4GB, recommandé 8GB+
- **CPU** : Minimum 2 cœurs, recommandé 4 cœurs+
- **Stockage** : Minimum 50GB, recommandé 100GB+
- **Réseau** : Accès Internet + ports 80, 443, 8080, 8081 ouverts

### **Logiciels requis**
- **Docker** : Version 20.10+
- **Docker Compose** : Version 2.0+
- **Git** : Pour récupérer le code
- **Certbot** : Pour les certificats SSL (optionnel)

## 🌍 Préparation de l'environnement

### **1. Cloner le projet**
```bash
git clone https://github.com/votre-username/clenzy.git
cd clenzy/infrastructure
```

### **2. Créer le fichier d'environnement**
```bash
# Copier le fichier d'exemple
cp env.prod.example .env.prod

# Éditer les variables d'environnement
nano .env.prod
```

### **3. Configurer les variables critiques**
```bash
# Modifier ces valeurs selon votre environnement
DOMAIN=votre-domaine.com
KEYCLOAK_HOSTNAME=keycloak.votre-domaine.com
POSTGRES_PASSWORD=VotreMotDePasseSecurise123!
JWT_SECRET=VotreJWTSecretTresLongEtSecurise2024!
```

## ⚙️ Configuration de production

### **1. Configuration de la base de données**
```bash
# Créer le répertoire de données
mkdir -p /var/lib/postgresql/data

# Définir les permissions
chown -R 999:999 /var/lib/postgresql/data
chmod 700 /var/lib/postgresql/data
```

### **2. Configuration SSL/TLS**
```bash
# Créer le répertoire SSL
mkdir -p nginx/ssl

# Générer un certificat auto-signé (pour les tests)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/clenzy.com.key \
  -out nginx/ssl/clenzy.com.crt \
  -subj "/C=FR/ST=France/L=Paris/O=Clenzy/CN=clenzy.com"

# Pour la production, utilisez Let's Encrypt
certbot certonly --standalone -d votre-domaine.com
```

### **3. Configuration des logs**
```bash
# Créer les répertoires de logs
mkdir -p /var/log/clenzy
mkdir -p /backups/clenzy

# Définir les permissions
chown -R $USER:$USER /var/log/clenzy
chown -R $USER:$USER /backups/clenzy
```

## 🚀 Déploiement

### **1. Déploiement automatique (recommandé)**
```bash
# Rendre le script exécutable
chmod +x deploy-prod.sh

# Lancer le déploiement
./deploy-prod.sh
```

### **2. Déploiement manuel**
```bash
# Construire et démarrer les services
docker-compose -f docker-compose.prod.yml up -d --build

# Vérifier le statut
docker-compose -f docker-compose.prod.yml ps

# Voir les logs
docker-compose -f docker-compose.prod.yml logs -f
```

### **3. Vérification du déploiement**
```bash
# Vérifier la santé des services
curl http://localhost/health
curl http://localhost:8080/actuator/health

# Vérifier les conteneurs
docker ps
docker-compose -f docker-compose.prod.yml ps
```

## 🔒 Sécurisation

### **1. Pare-feu (UFW)**
```bash
# Installer UFW
sudo apt install ufw

# Configurer les règles
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### **2. Sécurisation Docker**
```bash
# Créer un utilisateur non-root pour Docker
sudo usermod -aG docker $USER

# Configurer Docker daemon
sudo nano /etc/docker/daemon.json
```

```json
{
  "userns-remap": "default",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### **3. Mise à jour automatique**
```bash
# Installer unattended-upgrades
sudo apt install unattended-upgrades

# Configurer
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 📊 Monitoring et maintenance

### **1. Surveillance des services**
```bash
# Vérifier l'état des conteneurs
docker stats

# Vérifier l'espace disque
df -h

# Vérifier la mémoire
free -h

# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs --tail=100
```

### **2. Sauvegarde automatique**
```bash
# Créer un script de sauvegarde
nano backup-cron.sh
chmod +x backup-cron.sh

# Ajouter au crontab
crontab -e
# Ajouter cette ligne :
0 2 * * * /chemin/vers/clenzy-infra/backup/backup.sh
```

### **3. Rotation des logs**
```bash
# Configurer logrotate
sudo nano /etc/logrotate.d/clenzy
```

```
/var/log/clenzy/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
}
```

## 🛠️ Dépannage

### **1. Problèmes courants**

#### **Conteneur ne démarre pas**
```bash
# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs [service]

# Vérifier l'état
docker-compose -f docker-compose.prod.yml ps

# Redémarrer le service
docker-compose -f docker-compose.prod.yml restart [service]
```

#### **Problème de base de données**
```bash
# Vérifier la connexion
docker exec -it clenzy-postgres-prod psql -U clenzy_prod_user -d clenzy_prod

# Vérifier les logs PostgreSQL
docker logs clenzy-postgres-prod
```

#### **Problème de certificat SSL**
```bash
# Vérifier la validité du certificat
openssl x509 -in nginx/ssl/clenzy.com.crt -text -noout

# Renouveler Let's Encrypt
certbot renew
```

### **2. Rollback en cas de problème**
```bash
# Arrêter les services
docker-compose -f docker-compose.prod.yml down

# Restaurer la sauvegarde
docker exec -i clenzy-postgres-prod psql -U clenzy_prod_user -d clenzy_prod < backup.sql

# Redémarrer avec l'ancienne version
git checkout HEAD~1
docker-compose -f docker-compose.prod.yml up -d
```

## 📞 Support

### **En cas de problème :**
1. **Vérifier les logs** : `docker-compose -f docker-compose.prod.yml logs -f`
2. **Vérifier l'état des services** : `docker-compose -f docker-compose.prod.yml ps`
3. **Consulter la documentation** : Ce guide et les README du projet
4. **Contacter l'équipe** : Créer une issue sur GitHub

### **Informations utiles**
- **Logs** : `/var/log/clenzy/`
- **Sauvegardes** : `/backups/clenzy/`
- **Configuration** : `docker-compose.prod.yml` et `.env.prod`
- **Scripts** : `deploy-prod.sh` et `backup-cron.sh`

---

**🎯 Votre système Clenzy est maintenant prêt pour la production !**

**N'oubliez pas de :**
- ✅ **Tester** en environnement de staging avant
- ✅ **Sauvegarder** régulièrement vos données
- ✅ **Monitorer** les performances et la santé des services
- ✅ **Mettre à jour** régulièrement les composants
- ✅ **Documenter** toute modification de configuration

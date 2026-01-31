#!/bin/bash

# Script de déploiement en production pour Clenzy
# ⚠️  IMPORTANT : Exécuter uniquement sur le serveur de production !

set -e  # Arrêter en cas d'erreur

# Configuration
PROJECT_NAME="clenzy"
ENVIRONMENT="production"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/clenzy"
LOG_FILE="/var/log/clenzy/deploy-${TIMESTAMP}.log"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Vérifications préliminaires
check_prerequisites() {
    log "Vérification des prérequis..."
    
    # Vérifier Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé"
        exit 1
    fi
    
    # Vérifier Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose n'est pas installé"
        exit 1
    fi
    
    # Vérifier le fichier .env.prod
    if [ ! -f ".env.prod" ]; then
        log_error "Fichier .env.prod non trouvé"
        exit 1
    fi
    
    log_success "Prérequis vérifiés"
}

# Sauvegarde de la base de données
backup_database() {
    log "Sauvegarde de la base de données..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Sauvegarde PostgreSQL
    docker exec clenzy-postgres-prod pg_dump -U clenzy_prod_user clenzy_prod > "$BACKUP_DIR/clenzy_prod_${TIMESTAMP}.sql"
    
    if [ $? -eq 0 ]; then
        log_success "Base de données sauvegardée: $BACKUP_DIR/clenzy_prod_${TIMESTAMP}.sql"
        
        # Nettoyer les anciennes sauvegardes (garder 7 jours)
        find "$BACKUP_DIR" -name "clenzy_prod_*.sql" -mtime +7 -delete
    else
        log_warning "Échec de la sauvegarde de la base de données"
    fi
}

# Arrêt des services existants
stop_services() {
    log "Arrêt des services existants..."
    
    docker-compose -f docker-compose.prod.yml down --remove-orphans
    
    log_success "Services arrêtés"
}

# Nettoyage des images Docker
cleanup_images() {
    log "Nettoyage des images Docker..."
    
    # Supprimer les images non utilisées
    docker image prune -f
    
    # Supprimer les conteneurs arrêtés
    docker container prune -f
    
    log_success "Images Docker nettoyées"
}

# Construction des images
build_images() {
    log "Construction des images Docker..."
    
    # Construire le serveur backend
    log "Construction du serveur backend..."
    docker-compose -f docker-compose.prod.yml build server
    
    # Construire le client frontend
    log "Construction du client frontend..."
    docker-compose -f docker-compose.prod.yml build client
    
    log_success "Images construites"
}

# Démarrage des services
start_services() {
    log "Démarrage des services..."
    
    # Démarrer les services en arrière-plan
    docker-compose -f docker-compose.prod.yml up -d
    
    log_success "Services démarrés"
}

# Vérification de la santé des services
health_check() {
    log "Vérification de la santé des services..."
    
    # Attendre que les services soient prêts
    sleep 30
    
    # Vérifier PostgreSQL
    if docker exec clenzy-postgres-prod pg_isready -U clenzy_prod_user; then
        log_success "PostgreSQL est prêt"
    else
        log_error "PostgreSQL n'est pas prêt"
        return 1
    fi
    
    # Vérifier le serveur backend
    if curl -f http://localhost:8080/actuator/health > /dev/null 2>&1; then
        log_success "Serveur backend est prêt"
    else
        log_error "Serveur backend n'est pas prêt"
        return 1
    fi
    
    # Vérifier le client frontend
    if curl -f http://localhost:80 > /dev/null 2>&1; then
        log_success "Client frontend est prêt"
    else
        log_error "Client frontend n'est pas prêt"
        return 1
    fi
    
    log_success "Tous les services sont en bonne santé"
}

# Affichage des informations de déploiement
show_deployment_info() {
    log "=== DÉPLOIEMENT TERMINÉ AVEC SUCCÈS ==="
    log "Timestamp: $TIMESTAMP"
    log "Environnement: $ENVIRONMENT"
    log "Logs: $LOG_FILE"
    log "Sauvegarde: $BACKUP_DIR/clenzy_prod_${TIMESTAMP}.sql"
    log ""
    log "Services disponibles:"
    log "- Frontend: http://localhost:80"
    log "- Backend API: http://localhost:8080"
    log "- Keycloak: https://localhost:8081"
    log "- Base de données: localhost:5432"
    log ""
    log "Commandes utiles:"
    log "- Voir les logs: docker-compose -f docker-compose.prod.yml logs -f"
    log "- Arrêter: docker-compose -f docker-compose.prod.yml down"
    log "- Redémarrer: docker-compose -f docker-compose.prod.yml restart"
}

# Fonction principale
main() {
    log "=== DÉBUT DU DÉPLOIEMENT EN PRODUCTION ==="
    log "Projet: $PROJECT_NAME"
    log "Environnement: $ENVIRONMENT"
    log "Timestamp: $TIMESTAMP"
    log ""
    
    # Créer le répertoire de logs
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Exécuter les étapes de déploiement
    check_prerequisites
    backup_database
    stop_services
    cleanup_images
    build_images
    start_services
    health_check
    
    show_deployment_info
    
    log "=== DÉPLOIEMENT TERMINÉ AVEC SUCCÈS ==="
}

# Gestion des erreurs
trap 'log_error "Erreur lors du déploiement. Vérifiez les logs: $LOG_FILE"' ERR

# Exécution du script principal
main "$@"

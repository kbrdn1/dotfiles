#!/bin/bash

# ╭─────────────────────────────────────────────────────────────╮
# │                Script de Démarrage skhd                     │
# │              Démarrage propre et robuste                   │
# ╰─────────────────────────────────────────────────────────────╯

set -euo pipefail

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Emojis
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
INFO="ℹ️"
ROCKET="🚀"
GEAR="⚙️"

print_success() {
    echo -e "${GREEN}${CHECK} $1${NC}"
}

print_error() {
    echo -e "${RED}${CROSS} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}${WARNING} $1${NC}"
}

print_info() {
    echo -e "${BLUE}${INFO} $1${NC}"
}

print_header() {
    echo -e "\n${CYAN}╭─────────────────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${WHITE}                 Démarrage skhd AeroSpace                ${CYAN}│${NC}"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────╯${NC}\n"
}

# Variables
SKHD_CONFIG="$HOME/.config/skhd/skhdrc"
SKHD_PID_FILE="/tmp/skhd_$USER.pid"
SKHD_ERR_LOG="/tmp/skhd_$USER.err.log"
SKHD_OUT_LOG="/tmp/skhd_$USER.out.log"
LAUNCHD_PLIST="$HOME/Library/LaunchAgents/com.koekeishiya.skhd.plist"

# Fonction de nettoyage
cleanup_skhd() {
    print_info "Nettoyage des processus skhd existants..."
    
    # Arrêter le service launchctl s'il existe
    if [[ -f "$LAUNCHD_PLIST" ]]; then
        print_info "Arrêt du service launchctl..."
        launchctl unload -w "$LAUNCHD_PLIST" 2>/dev/null || true
    fi
    
    # Tuer tous les processus skhd
    if pgrep -f skhd >/dev/null 2>&1; then
        print_info "Arrêt des processus skhd..."
        pkill -9 -f skhd 2>/dev/null || true
        sleep 2
    fi
    
    # Nettoyer les fichiers de verrouillage
    print_info "Nettoyage des fichiers temporaires..."
    rm -f /tmp/skhd_*.pid /tmp/skhd_*.lock 2>/dev/null || true
    
    # Vider les logs pour un diagnostic propre
    echo > "$SKHD_ERR_LOG" 2>/dev/null || true
    echo > "$SKHD_OUT_LOG" 2>/dev/null || true
    
    print_success "Nettoyage terminé"
}

# Vérifications préliminaires
check_prerequisites() {
    print_info "Vérification des prérequis..."
    
    # Vérifier que skhd est installé
    if ! command -v skhd >/dev/null 2>&1; then
        print_error "skhd n'est pas installé"
        echo -e "${YELLOW}Installation: brew install koekeishiya/formulae/skhd${NC}"
        exit 1
    fi
    
    # Vérifier que le fichier de configuration existe
    if [[ ! -f "$SKHD_CONFIG" ]]; then
        print_error "Configuration skhd non trouvée: $SKHD_CONFIG"
        exit 1
    fi
    
    # Vérifier la syntaxe de la configuration
    if ! skhd --reload 2>/dev/null; then
        print_error "Erreur de syntaxe dans la configuration skhd"
        echo -e "${YELLOW}Vérifiez le fichier: $SKHD_CONFIG${NC}"
        exit 1
    fi
    
    print_success "Prérequis vérifiés"
}

# Démarrer skhd
start_skhd() {
    print_info "Démarrage de skhd..."
    
    # Lancer skhd en arrière-plan
    if skhd --verbose 2>"$SKHD_ERR_LOG" >"$SKHD_OUT_LOG" &
    then
        local skhd_pid=$!
        print_info "skhd lancé avec PID: $skhd_pid"
        
        # Attendre un peu pour voir si le processus reste stable
        sleep 3
        
        if kill -0 "$skhd_pid" 2>/dev/null; then
            print_success "skhd fonctionne correctement (PID: $skhd_pid)"
            return 0
        else
            print_error "skhd s'est arrêté immédiatement"
            return 1
        fi
    else
        print_error "Échec du lancement de skhd"
        return 1
    fi
}

# Vérifier les permissions
check_permissions() {
    print_info "Vérification des permissions d'accessibilité..."
    
    # Test indirect des permissions via observe
    if timeout 2s skhd --observe >/dev/null 2>&1; then
        print_success "Permissions d'accessibilité OK"
        return 0
    else
        print_error "skhd n'a pas les permissions d'accessibilité"
        echo -e "\n${YELLOW}${WARNING} ACTION REQUISE:${NC}"
        echo -e "1. Ouvrir: ${WHITE}Réglages Système > Confidentialité et sécurité > Accessibilité${NC}"
        echo -e "2. Cliquer sur le ${WHITE}+${NC} pour ajouter une application"
        echo -e "3. Naviguer vers: ${WHITE}$(which skhd)${NC}"
        echo -e "4. Ajouter skhd et cocher la case ✅"
        echo -e "5. Relancer ce script après avoir donné les permissions"
        return 1
    fi
}

# Test fonctionnel
test_functionality() {
    print_info "Test de fonctionnalité skhd + AeroSpace..."
    
    # Vérifier qu'AeroSpace répond
    if aerospace list-workspaces --all >/dev/null 2>&1; then
        print_success "AeroSpace répond aux commandes"
    else
        print_warning "AeroSpace ne répond pas aux commandes"
        return 1
    fi
    
    # Test de navigation simple
    if aerospace workspace 1 >/dev/null 2>&1; then
        print_success "Test de navigation workspace réussi"
    else
        print_warning "Problème avec la navigation workspace"
        return 1
    fi
    
    return 0
}

# Afficher les instructions d'utilisation
show_usage_instructions() {
    echo -e "\n${CYAN}╭─────────────────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${WHITE}                Instructions d'utilisation              ${CYAN}│${NC}"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────╯${NC}\n"
    
    echo -e "${WHITE}Raccourcis essentiels (Alt droite uniquement):${NC}"
    echo -e "  ${CYAN}Alt→ + 1-0${NC}      Navigation workspaces 1-10"
    echo -e "  ${CYAN}Alt→ + H/J/K/L${NC}  Navigation fenêtres (vim-style)"
    echo -e "  ${CYAN}Alt→ + F${NC}        Plein écran"
    echo -e "  ${CYAN}Alt→ + Space${NC}    Toggle floating/tiling"
    echo -e "  ${CYAN}Alt→ + ⇧ + H/J/K/L${NC}  Déplacer fenêtre"
    echo -e "  ${CYAN}Alt→ + ⇧ + 1-0${NC}  Déplacer vers workspace"
    
    echo -e "\n${WHITE}Maintenance:${NC}"
    echo -e "  ${CYAN}Alt→ + ⌃ + R${NC}    Recharger AeroSpace"
    echo -e "  Configuration skhd: ${YELLOW}$SKHD_CONFIG${NC}"
    echo -e "  Logs d'erreur: ${YELLOW}$SKHD_ERR_LOG${NC}"
    
    echo -e "\n${WHITE}Pour arrêter skhd:${NC}"
    echo -e "  ${CYAN}pkill -f skhd${NC}"
    
    echo -e "\n${GREEN}${ROCKET} skhd est prêt à l'emploi !${NC}"
}

# Fonction principale
main() {
    print_header
    
    # Étape 1: Nettoyage
    cleanup_skhd
    
    # Étape 2: Vérifications
    check_prerequisites
    
    # Étape 3: Démarrage
    if ! start_skhd; then
        print_error "Échec du démarrage de skhd"
        exit 1
    fi
    
    # Étape 4: Vérification des permissions
    if ! check_permissions; then
        print_warning "skhd fonctionne mais n'a pas les permissions d'accessibilité"
        print_info "Les raccourcis ne fonctionneront pas tant que les permissions ne sont pas accordées"
        exit 1
    fi
    
    # Étape 5: Test fonctionnel
    if test_functionality; then
        print_success "Tous les tests sont passés"
        show_usage_instructions
    else
        print_warning "Des problèmes ont été détectés"
        echo -e "\n${YELLOW}Vérifiez:${NC}"
        echo -e "- Que AeroSpace est lancé"
        echo -e "- Que les permissions d'accessibilité sont accordées"
        echo -e "- Les logs d'erreur: ${YELLOW}$SKHD_ERR_LOG${NC}"
    fi
}

# Options de ligne de commande
case "${1:-start}" in
    "start"|"")
        main
        ;;
    "stop")
        print_info "Arrêt de skhd..."
        cleanup_skhd
        print_success "skhd arrêté"
        ;;
    "restart")
        print_info "Redémarrage de skhd..."
        cleanup_skhd
        sleep 1
        main
        ;;
    "status")
        if pgrep -f skhd >/dev/null 2>&1; then
            print_success "skhd est en cours d'exécution (PID: $(pgrep -f skhd))"
            
            # Test des permissions
            if timeout 1s skhd --observe >/dev/null 2>&1; then
                print_success "Permissions d'accessibilité OK"
            else
                print_error "Pas de permissions d'accessibilité"
            fi
        else
            print_error "skhd n'est pas en cours d'exécution"
        fi
        ;;
    "help"|"-h"|"--help")
        echo -e "${WHITE}Usage:${NC} $0 [start|stop|restart|status|help]"
        echo -e "  ${CYAN}start${NC}    Démarrer skhd (défaut)"
        echo -e "  ${CYAN}stop${NC}     Arrêter skhd"
        echo -e "  ${CYAN}restart${NC}  Redémarrer skhd"
        echo -e "  ${CYAN}status${NC}   Vérifier le statut de skhd"
        echo -e "  ${CYAN}help${NC}     Afficher cette aide"
        ;;
    *)
        print_error "Option inconnue: $1"
        echo -e "Utilisez ${CYAN}$0 help${NC} pour voir les options disponibles"
        exit 1
        ;;
esac
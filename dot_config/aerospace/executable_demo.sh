#!/bin/bash

# ╭─────────────────────────────────────────────────────────────╮
# │                   AeroSpace Demo Script                     │
# │              Démonstration interactive des fonctionnalités │
# ╰─────────────────────────────────────────────────────────────╯

set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_APPS=("Calculator" "TextEdit" "Preview")

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Emojis
ROCKET="🚀"
STAR="⭐"
DEMO="🎬"
CHECK="✅"
CROSS="❌"
INFO="ℹ️"
WARNING="⚠️"

# ═══════════════════════════════════════════════════════════════
# FONCTIONS UTILITAIRES
# ═══════════════════════════════════════════════════════════════

print_header() {
    clear
    echo -e "\n${CYAN}╭─────────────────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${WHITE}                     $1${CYAN}                   │${NC}"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────╯${NC}\n"
}

print_success() {
    echo -e "${GREEN}${CHECK} $1${NC}"
}

print_error() {
    echo -e "${RED}${CROSS} $1${NC}"
}

print_info() {
    echo -e "${BLUE}${INFO} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}${WARNING} $1${NC}"
}

print_demo() {
    echo -e "${PURPLE}${DEMO} $1${NC}"
}

wait_for_user() {
    echo
    read -p "$(echo -e "${CYAN}Appuyez sur Entrée pour continuer...${NC}")" 
}

countdown() {
    local seconds=$1
    local message=${2:-"Prochaine étape dans"}
    
    echo -e "\n${YELLOW}$message${NC}"
    for ((i=seconds; i>0; i--)); do
        echo -ne "\r${CYAN}$i secondes...${NC}"
        sleep 1
    done
    echo -e "\r${GREEN}C'est parti !${NC}     "
    echo
}

check_aerospace() {
    if ! command -v aerospace >/dev/null 2>&1; then
        print_error "AeroSpace n'est pas installé !"
        echo -e "${BLUE}Installation via Homebrew:${NC}"
        echo "brew install --cask aerospace"
        exit 1
    fi
    
    if ! pgrep -f "AeroSpace" >/dev/null 2>&1; then
        print_warning "AeroSpace ne semble pas être en cours d'exécution"
        echo "Tentative de démarrage..."
        open -a AeroSpace 2>/dev/null || true
        sleep 2
    fi
}

# ═══════════════════════════════════════════════════════════════
# DÉMONSTRATIONS
# ═══════════════════════════════════════════════════════════════

demo_intro() {
    print_header "BIENVENUE DANS LA DÉMO AEROSPACE"
    
    echo -e "${PURPLE}Cette démonstration vous présente :${NC}"
    echo -e "  ${STAR} Navigation entre workspaces"
    echo -e "  ${STAR} Gestion des fenêtres"
    echo -e "  ${STAR} Modes spéciaux (resize, service)"
    echo -e "  ${STAR} Layouts et organisation"
    echo -e "  ${STAR} Intégration Sketchybar"
    
    echo
    print_info "La démonstration va ouvrir quelques applications de test"
    print_warning "Assurez-vous de fermer les apps importantes avant de continuer"
    
    wait_for_user
}

demo_workspace_navigation() {
    print_header "NAVIGATION WORKSPACE"
    
    print_demo "Démonstration de la navigation entre workspaces"
    echo
    
    echo -e "${CYAN}Workspaces configurés :${NC}"
    echo -e "  ⌥ + 1  →  💻 Développement"
    echo -e "  ⌥ + 2  →  🖥 Terminal"
    echo -e "  ⌥ + 3  →  🌐 Web"
    echo -e "  ⌥ + 4  →  📧 Communication"
    echo -e "  ⌥ + 5  →  🤝 Réunions"
    
    wait_for_user
    
    print_info "Naviguons vers le workspace 1..."
    aerospace workspace 1
    countdown 2
    
    print_info "Puis vers le workspace 2..."
    aerospace workspace 2
    countdown 2
    
    print_info "Et retour au workspace 1..."
    aerospace workspace 1
    countdown 2
    
    print_success "Navigation workspace démontrée !"
}

demo_open_test_apps() {
    print_header "OUVERTURE D'APPLICATIONS TEST"
    
    print_demo "Ouverture d'applications pour la démonstration"
    
    for app in "${DEMO_APPS[@]}"; do
        print_info "Ouverture de $app..."
        if ! pgrep -f "$app" >/dev/null 2>&1; then
            open -a "$app" 2>/dev/null || print_warning "Impossible d'ouvrir $app"
            sleep 1
        else
            print_info "$app est déjà ouvert"
        fi
    done
    
    countdown 3 "Applications en cours d'ouverture..."
    
    print_success "Applications de test ouvertes !"
}

demo_window_management() {
    print_header "GESTION DES FENÊTRES"
    
    print_demo "Démonstration de la gestion des fenêtres"
    echo
    
    echo -e "${CYAN}Raccourcis de navigation :${NC}"
    echo -e "  ⌥ + H/J/K/L  →  Focus directionnel"
    echo -e "  ⌥ + ⇧ + H/J/K/L  →  Déplacer fenêtre"
    
    wait_for_user
    
    # Afficher les fenêtres actuelles
    print_info "Fenêtres actuellement ouvertes :"
    aerospace list-windows 2>/dev/null | head -5 || echo "Aucune fenêtre détectée"
    
    countdown 3
    
    if aerospace list-windows >/dev/null 2>&1; then
        print_info "Basculons entre les fenêtres..."
        
        # Focus sur différentes fenêtres
        aerospace focus right 2>/dev/null || true
        countdown 1
        aerospace focus left 2>/dev/null || true
        countdown 1
        
        print_success "Navigation entre fenêtres démontrée !"
    else
        print_warning "Aucune fenêtre à manipuler"
    fi
}

demo_layouts() {
    print_header "LAYOUTS ET ORGANISATION"
    
    print_demo "Démonstration des différents layouts"
    echo
    
    if ! aerospace list-windows >/dev/null 2>&1 || [[ $(aerospace list-windows | wc -l) -lt 2 ]]; then
        print_warning "Pas assez de fenêtres pour démontrer les layouts"
        demo_open_test_apps
    fi
    
    local layouts=("tiles" "floating" "h_tiles" "v_tiles")
    
    for layout in "${layouts[@]}"; do
        print_info "Démonstration du layout: $layout"
        aerospace layout "$layout" 2>/dev/null || print_warning "Layout $layout non supporté"
        countdown 3 "Observez le layout $layout..."
    done
    
    # Retour au layout par défaut
    aerospace layout tiles 2>/dev/null || true
    
    print_success "Démonstration des layouts terminée !"
}

demo_window_operations() {
    print_header "OPÉRATIONS SUR LES FENÊTRES"
    
    print_demo "Démonstration des opérations avancées"
    echo
    
    echo -e "${CYAN}Opérations disponibles :${NC}"
    echo -e "  ⌥ + F        →  Plein écran"
    echo -e "  ⌥ + Space    →  Toggle floating/tiling"
    echo -e "  ⌥ + ⌃ + E    →  Équilibrer les tailles"
    echo -e "  ⌥ + ⇧ + S    →  Joindre en bas"
    
    wait_for_user
    
    if aerospace list-windows >/dev/null 2>&1; then
        print_info "Équilibrage des fenêtres..."
        aerospace balance-sizes 2>/dev/null || true
        countdown 2
        
        print_info "Test du mode floating..."
        aerospace layout floating 2>/dev/null || true
        countdown 2
        
        print_info "Retour au mode tiling..."
        aerospace layout tiles 2>/dev/null || true
        countdown 2
        
        print_success "Opérations sur les fenêtres démontrées !"
    else
        print_warning "Aucune fenêtre disponible pour les opérations"
    fi
}

demo_resize_mode() {
    print_header "MODE RESIZE"
    
    print_demo "Démonstration du mode resize"
    echo
    
    echo -e "${CYAN}Mode Resize (⌥ + ⌃ + R) :${NC}"
    echo -e "  H/J/K/L      →  Redimensionner"
    echo -e "  ⇧ + H/J/K/L  →  Redimensionner (gros)"
    echo -e "  Entrée/Échap →  Sortir du mode"
    
    print_info "Le mode resize permet un contrôle précis des tailles"
    print_warning "Utilisez ⌥ + ⌃ + R puis H/J/K/L pour redimensionner"
    
    wait_for_user
    
    print_info "Mode resize expliqué ! (pas de démonstration automatique)"
}

demo_service_mode() {
    print_header "MODE SERVICE"
    
    print_demo "Démonstration du mode service"
    echo
    
    echo -e "${CYAN}Mode Service (⌥ + ⌃ + ;) :${NC}"
    echo -e "  R  →  Recharger configuration"
    echo -e "  H  →  Layout horizontal"
    echo -e "  V  →  Layout vertical"
    echo -e "  F  →  Layout floating"
    
    print_info "Le mode service est conçu pour les opérations avancées"
    
    wait_for_user
    
    print_info "Test de changement de layout via mode service..."
    
    # Simuler quelques changements de layout
    aerospace layout h_tiles 2>/dev/null || true
    countdown 2 "Layout horizontal..."
    
    aerospace layout v_tiles 2>/dev/null || true
    countdown 2 "Layout vertical..."
    
    aerospace layout tiles 2>/dev/null || true
    countdown 2 "Layout normal..."
    
    print_success "Mode service démontré !"
}

demo_workspace_assignment() {
    print_header "ASSIGNATION AUTOMATIQUE"
    
    print_demo "Démonstration des règles d'applications"
    echo
    
    echo -e "${CYAN}Règles configurées :${NC}"
    echo -e "  Calculator      →  Mode floating"
    echo -e "  Terminal        →  Workspace 2"
    echo -e "  Chrome/Safari   →  Workspace 3"
    echo -e "  Mail            →  Workspace 4"
    
    print_info "Les applications s'organisent automatiquement !"
    
    if pgrep -f "Calculator" >/dev/null 2>&1; then
        print_info "Calculator détecté - devrait être en mode floating"
    fi
    
    wait_for_user
    
    print_success "Règles automatiques expliquées !"
}

demo_sketchybar_integration() {
    print_header "INTÉGRATION SKETCHYBAR"
    
    print_demo "Test de l'intégration Sketchybar"
    echo
    
    if command -v sketchybar >/dev/null 2>&1; then
        if pgrep -f "sketchybar" >/dev/null 2>&1; then
            print_success "Sketchybar détecté et actif !"
            
            print_info "Test des triggers Sketchybar..."
            
            # Test des triggers
            sketchybar --trigger aerospace_workspace_change 2>/dev/null && \
                print_success "Trigger aerospace_workspace_change: OK" || \
                print_warning "Trigger aerospace_workspace_change: ERREUR"
            
            sketchybar --trigger window_focus 2>/dev/null && \
                print_success "Trigger window_focus: OK" || \
                print_warning "Trigger window_focus: ERREUR"
            
            # Changement de workspace pour tester
            print_info "Test avec changement de workspace..."
            aerospace workspace 2
            countdown 1
            aerospace workspace 1
            
            print_success "Intégration Sketchybar testée !"
        else
            print_warning "Sketchybar installé mais non démarré"
        fi
    else
        print_info "Sketchybar non installé - pas de test d'intégration"
    fi
    
    wait_for_user
}

demo_advanced_features() {
    print_header "FONCTIONNALITÉS AVANCÉES"
    
    print_demo "Démonstration des fonctionnalités avancées"
    echo
    
    echo -e "${CYAN}Fonctionnalités avancées :${NC}"
    echo -e "  ⌥ + Tab                →  Workspace précédent"
    echo -e "  ⌥ + ⇧ + 1-0            →  Déplacer vers workspace"
    echo -e "  ⌥ + ←/→/↑/↓            →  Navigation multi-moniteurs"
    echo -e "  ⌥ + ⇧ + S/V/B          →  Joindre fenêtres"
    
    wait_for_user
    
    print_info "Test de la navigation workspace avancée..."
    
    # Sauvegarder le workspace actuel
    local current_workspace=$(aerospace list-workspaces --focused 2>/dev/null | head -1 || echo "1")
    
    # Navigation test
    aerospace workspace 3
    countdown 1
    aerospace workspace 5
    countdown 1
    
    # Test workspace-back-and-forth
    print_info "Test du basculement rapide (⌥ + Tab eq.)..."
    aerospace workspace-back-and-forth 2>/dev/null || aerospace workspace "$current_workspace"
    countdown 2
    
    print_success "Fonctionnalités avancées démontrées !"
}

demo_statistics() {
    print_header "STATISTIQUES ET INFORMATIONS"
    
    print_demo "Informations sur votre configuration actuelle"
    echo
    
    # Informations système
    echo -e "${CYAN}Version AeroSpace:${NC}"
    aerospace --version 2>/dev/null || echo "Version inconnue"
    
    echo
    echo -e "${CYAN}Workspaces actifs:${NC}"
    aerospace list-workspaces 2>/dev/null || echo "Information non disponible"
    
    echo
    echo -e "${CYAN}Fenêtres ouvertes:${NC}"
    local window_count=$(aerospace list-windows 2>/dev/null | wc -l | tr -d ' ')
    echo "Nombre total de fenêtres: $window_count"
    
    if [[ "$window_count" -gt 0 ]]; then
        echo
        echo -e "${CYAN}Détail des fenêtres:${NC}"
        aerospace list-windows 2>/dev/null | head -10
    fi
    
    echo
    echo -e "${CYAN}Applications détectées:${NC}"
    aerospace list-apps 2>/dev/null | head -5 || echo "Aucune application détectée"
    
    wait_for_user
}

cleanup_demo() {
    print_header "NETTOYAGE"
    
    print_demo "Nettoyage des applications de démonstration"
    
    read -p "$(echo -e "${YELLOW}Voulez-vous fermer les applications de test ? (y/N): ${NC}")" -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        for app in "${DEMO_APPS[@]}"; do
            if pgrep -f "$app" >/dev/null 2>&1; then
                print_info "Fermeture de $app..."
                pkill -f "$app" 2>/dev/null || true
            fi
        done
        
        print_success "Applications de test fermées !"
    else
        print_info "Applications conservées"
    fi
    
    # Retour au workspace 1
    aerospace workspace 1 2>/dev/null || true
}

demo_finale() {
    print_header "DÉMONSTRATION TERMINÉE"
    
    echo -e "${GREEN}${STAR} Félicitations ! Vous avez terminé la démo AeroSpace !${NC}"
    echo
    
    echo -e "${CYAN}Résumé de ce que vous avez vu :${NC}"
    echo -e "  ✅ Navigation entre workspaces"
    echo -e "  ✅ Gestion des fenêtres"
    echo -e "  ✅ Différents layouts"
    echo -e "  ✅ Modes resize et service"
    echo -e "  ✅ Règles d'applications"
    echo -e "  ✅ Intégration Sketchybar"
    echo -e "  ✅ Fonctionnalités avancées"
    
    echo
    echo -e "${PURPLE}Prochaines étapes recommandées :${NC}"
    echo -e "  📖 Lire la documentation complète"
    echo -e "  ⚙️  Personnaliser la configuration"
    echo -e "  🎯 Définir vos propres workflows"
    echo -e "  🔧 Utiliser l'outil de gestion"
    
    echo
    echo -e "${BLUE}Ressources utiles :${NC}"
    echo -e "  ~/.config/aerospace/DOCUMENTATION.md"
    echo -e "  ~/.config/aerospace/SHORTCUTS.md"
    echo -e "  ~/.config/aerospace/aerospace-manager.sh"
    
    echo
    print_success "Merci d'avoir testé AeroSpace ! 🚀"
}

# ═══════════════════════════════════════════════════════════════
# MENU PRINCIPAL
# ═══════════════════════════════════════════════════════════════

show_demo_menu() {
    clear
    echo -e "${PURPLE}"
    cat << 'EOF'
╭─────────────────────────────────────────────────────────────╮
│                                                             │
│     ___                  _____                              │
│    / _ \___  _____ ___  / __  /___  ____ ___                │
│   / __ / _ \/ ___/ __ \/___ \/ __ \/ __ `/ _ \               │
│  / /_/ /  __/ /  / /_/ /____/ /_/ / /_/ /  __/               │
│  \____/\___/_/   \____/_____/ .___/\__,_/\___/               │
│                            /_/                              │
│                         DEMO v1.0                          │
╰─────────────────────────────────────────────────────────────╯
EOF
    echo -e "${NC}"
    
    echo -e "${CYAN}╭─ DÉMONSTRATIONS ────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${NC} ${YELLOW}1)${NC} 🏠 Navigation workspaces"
    echo -e "${CYAN}│${NC} ${YELLOW}2)${NC} 🪟 Gestion des fenêtres"
    echo -e "${CYAN}│${NC} ${YELLOW}3)${NC} 🎨 Layouts et organisation"
    echo -e "${CYAN}│${NC} ${YELLOW}4)${NC} 📏 Mode resize"
    echo -e "${CYAN}│${NC} ${YELLOW}5)${NC} 🔧 Mode service"
    echo -e "${CYAN}│${NC} ${YELLOW}6)${NC} 📱 Règles d'applications"
    echo -e "${CYAN}│${NC} ${YELLOW}7)${NC} 📡 Intégration Sketchybar"
    echo -e "${CYAN}│${NC} ${YELLOW}8)${NC} ⚡ Fonctionnalités avancées"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────╯${NC}"
    
    echo -e "${CYAN}╭─ OPTIONS ───────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${NC} ${YELLOW}9)${NC} 🎬 Démonstration complète"
    echo -e "${CYAN}│${NC} ${YELLOW}10)${NC} 📊 Statistiques système"
    echo -e "${CYAN}│${NC} ${YELLOW}11)${NC} 🧹 Nettoyer les apps de test"
    echo -e "${CYAN}│${NC} ${YELLOW}0)${NC} 🚪 Quitter"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────╯${NC}"
    
    echo
}

run_full_demo() {
    demo_intro
    demo_open_test_apps
    demo_workspace_navigation
    demo_window_management
    demo_layouts
    demo_window_operations
    demo_resize_mode
    demo_service_mode
    demo_workspace_assignment
    demo_sketchybar_integration
    demo_advanced_features
    demo_statistics
    cleanup_demo
    demo_finale
}

main() {
    check_aerospace
    
    while true; do
        show_demo_menu
        read -p "Choisir une démonstration : " choice
        
        case $choice in
            1) demo_workspace_navigation ;;
            2) demo_open_test_apps; demo_window_management ;;
            3) demo_open_test_apps; demo_layouts ;;
            4) demo_resize_mode ;;
            5) demo_service_mode ;;
            6) demo_workspace_assignment ;;
            7) demo_sketchybar_integration ;;
            8) demo_advanced_features ;;
            9) run_full_demo ;;
            10) demo_statistics ;;
            11) cleanup_demo ;;
            0)
                print_success "Merci d'avoir testé AeroSpace !"
                exit 0
                ;;
            *)
                print_error "Choix invalide"
                ;;
        esac
        
        if [[ $choice != 9 ]]; then
            wait_for_user
        fi
    done
}

# Point d'entrée
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
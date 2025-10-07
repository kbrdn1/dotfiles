#!/bin/bash

# ╭─────────────────────────────────────────────────────────────╮
# │                   AeroSpace Manager                         │
# │            Gestionnaire utilitaire pour AeroSpace          │
# ╰─────────────────────────────────────────────────────────────╯

set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.config/aerospace"
CONFIG_FILE="$CONFIG_DIR/aerospace.toml"
BACKUP_DIR="$CONFIG_DIR/backups"
LOG_FILE="$HOME/.local/share/aerospace/aerospace.log"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Emojis pour l'interface
ROCKET="🚀"
GEAR="⚙️"
CHECK="✅"
CROSS="❌"
INFO="ℹ️"
WARNING="⚠️"
FOLDER="📁"
MONITOR="📺"
WINDOW="🪟"

# ═══════════════════════════════════════════════════════════════
# FONCTIONS UTILITAIRES
# ═══════════════════════════════════════════════════════════════

# Fonction d'affichage stylisé
print_header() {
    echo -e "\n${CYAN}╭─────────────────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${WHITE}                   $1${CYAN}                   │${NC}"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────╯${NC}\n"
}

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

# Vérifier si AeroSpace est installé
check_aerospace() {
    if ! command -v aerospace >/dev/null 2>&1; then
        print_error "AeroSpace n'est pas installé ou n'est pas dans le PATH"
        echo -e "${BLUE}Installation via Homebrew:${NC}"
        echo "brew install --cask aerospace"
        exit 1
    fi
}

# Vérifier si AeroSpace est en cours d'exécution
check_aerospace_running() {
    if ! pgrep -f "AeroSpace" >/dev/null 2>&1; then
        print_warning "AeroSpace ne semble pas être en cours d'exécution"
        return 1
    fi
    return 0
}

# Créer les dossiers nécessaires
setup_directories() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
}

# ═══════════════════════════════════════════════════════════════
# GESTION DE LA CONFIGURATION
# ═══════════════════════════════════════════════════════════════

# Sauvegarder la configuration actuelle
backup_config() {
    print_info "Sauvegarde de la configuration..."
    
    if [[ ! -f "$CONFIG_FILE" ]]; then
        print_error "Fichier de configuration non trouvé : $CONFIG_FILE"
        return 1
    fi
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/aerospace_${timestamp}.toml"
    
    cp "$CONFIG_FILE" "$backup_file"
    print_success "Configuration sauvegardée : $backup_file"
    
    # Garder seulement les 10 dernières sauvegardes
    cd "$BACKUP_DIR"
    ls -t aerospace_*.toml | tail -n +11 | xargs -r rm --
}

# Restaurer une configuration
restore_config() {
    print_info "Configurations de sauvegarde disponibles :"
    
    if [[ ! -d "$BACKUP_DIR" ]] || [[ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]]; then
        print_warning "Aucune sauvegarde trouvée"
        return 1
    fi
    
    local backups=($(ls -t "$BACKUP_DIR"/aerospace_*.toml 2>/dev/null))
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        print_warning "Aucune sauvegarde trouvée"
        return 1
    fi
    
    echo
    for i in "${!backups[@]}"; do
        local file="${backups[$i]}"
        local basename=$(basename "$file")
        local date_part=$(echo "$basename" | sed 's/aerospace_\(.*\)\.toml/\1/')
        local formatted_date=$(echo "$date_part" | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)_\([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')
        echo -e "${CYAN}$((i+1))${NC}) $formatted_date"
    done
    
    echo
    read -p "Choisir une sauvegarde (numéro) : " choice
    
    if [[ ! "$choice" =~ ^[0-9]+$ ]] || [[ "$choice" -lt 1 ]] || [[ "$choice" -gt ${#backups[@]} ]]; then
        print_error "Choix invalide"
        return 1
    fi
    
    local selected_backup="${backups[$((choice-1))]}"
    
    # Sauvegarder la configuration actuelle avant restauration
    backup_config
    
    cp "$selected_backup" "$CONFIG_FILE"
    print_success "Configuration restaurée depuis $selected_backup"
    
    reload_config
}

# Recharger la configuration
reload_config() {
    print_info "Rechargement de la configuration AeroSpace..."
    
    if aerospace reload-config; then
        print_success "Configuration rechargée avec succès"
        
        # Déclencher la mise à jour de Sketchybar si disponible
        if command -v sketchybar >/dev/null 2>&1; then
            sketchybar --trigger aerospace_workspace_change 2>/dev/null || true
        fi
    else
        print_error "Erreur lors du rechargement de la configuration"
        return 1
    fi
}

# Valider la configuration
validate_config() {
    print_info "Validation de la configuration..."
    
    if [[ ! -f "$CONFIG_FILE" ]]; then
        print_error "Fichier de configuration non trouvé"
        return 1
    fi
    
    # Vérification de la syntaxe TOML (basique)
    if command -v toml >/dev/null 2>&1; then
        if toml validate "$CONFIG_FILE" >/dev/null 2>&1; then
            print_success "Syntaxe TOML valide"
        else
            print_error "Erreur de syntaxe TOML détectée"
            return 1
        fi
    fi
    
    # Test de rechargement à sec
    if aerospace reload-config --dry-run 2>/dev/null; then
        print_success "Configuration AeroSpace valide"
    else
        print_error "Configuration AeroSpace invalide"
        print_info "Utilisez 'aerospace reload-config' pour voir les erreurs détaillées"
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════
# INFORMATIONS SYSTÈME
# ═══════════════════════════════════════════════════════════════

# Afficher les informations système
show_system_info() {
    print_header "INFORMATIONS SYSTÈME"
    
    echo -e "${BLUE}${ROCKET} AeroSpace${NC}"
    if command -v aerospace >/dev/null 2>&1; then
        local version=$(aerospace --version 2>/dev/null || echo "Version inconnue")
        echo "  Version : $version"
        
        if check_aerospace_running; then
            echo -e "  État : ${GREEN}En cours d'exécution${NC}"
        else
            echo -e "  État : ${RED}Arrêté${NC}"
        fi
    else
        echo -e "  État : ${RED}Non installé${NC}"
    fi
    
    echo
    echo -e "${BLUE}${FOLDER} Configuration${NC}"
    echo "  Fichier : $CONFIG_FILE"
    if [[ -f "$CONFIG_FILE" ]]; then
        local size=$(du -h "$CONFIG_FILE" | cut -f1)
        local modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$CONFIG_FILE" 2>/dev/null || date -r "$CONFIG_FILE" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "Date inconnue")
        echo "  Taille : $size"
        echo "  Modifié : $modified"
        echo -e "  Statut : ${GREEN}Présent${NC}"
    else
        echo -e "  Statut : ${RED}Absent${NC}"
    fi
    
    echo
    echo -e "${BLUE}${MONITOR} Moniteurs${NC}"
    if check_aerospace_running; then
        aerospace list-monitors 2>/dev/null | while read -r line; do
            echo "  $line"
        done
    else
        echo "  Information non disponible (AeroSpace non démarré)"
    fi
}

# Lister les workspaces
list_workspaces() {
    print_header "WORKSPACES ACTIFS"
    
    if ! check_aerospace_running; then
        print_error "AeroSpace n'est pas en cours d'exécution"
        return 1
    fi
    
    echo -e "${CYAN}Workspace | Fenêtres | Apps${NC}"
    echo -e "${CYAN}----------|----------|----${NC}"
    
    for i in {1..10}; do
        local windows=$(aerospace list-windows --workspace "$i" 2>/dev/null | wc -l | tr -d ' ')
        local apps=$(aerospace list-windows --workspace "$i" 2>/dev/null | awk '{print $2}' | sort -u | wc -l | tr -d ' ')
        
        if [[ "$windows" -gt 0 ]]; then
            echo -e "${GREEN}    $i     |    $windows     | $apps${NC}"
        else
            echo -e "${YELLOW}    $i     |    0     | 0${NC}"
        fi
    done
}

# Lister les fenêtres
list_windows() {
    print_header "FENÊTRES ACTIVES"
    
    if ! check_aerospace_running; then
        print_error "AeroSpace n'est pas en cours d'exécution"
        return 1
    fi
    
    echo -e "${CYAN}Workspace | App | Titre${NC}"
    echo -e "${CYAN}----------|-----|------${NC}"
    
    aerospace list-windows 2>/dev/null | while read -r line; do
        echo -e "${WHITE}$line${NC}"
    done
}

# Afficher les applications détectées
list_apps() {
    print_header "APPLICATIONS DÉTECTÉES"
    
    if ! check_aerospace_running; then
        print_error "AeroSpace n'est pas en cours d'exécution"
        return 1
    fi
    
    aerospace list-apps 2>/dev/null | while read -r line; do
        echo -e "${WHITE}$line${NC}"
    done
}

# ═══════════════════════════════════════════════════════════════
# ACTIONS RAPIDES
# ═══════════════════════════════════════════════════════════════

# Actions sur les workspaces
workspace_actions() {
    print_header "ACTIONS WORKSPACE"
    
    echo -e "${CYAN}1)${NC} Aller à un workspace"
    echo -e "${CYAN}2)${NC} Déplacer fenêtre vers workspace"
    echo -e "${CYAN}3)${NC} Équilibrer toutes les fenêtres"
    echo -e "${CYAN}4)${NC} Fermer toutes les fenêtres sauf active"
    echo -e "${CYAN}5)${NC} Changer le layout du workspace actuel"
    echo -e "${CYAN}0)${NC} Retour"
    
    echo
    read -p "Choisir une action : " action
    
    case $action in
        1)
            echo
            read -p "Numéro du workspace (1-10) : " ws
            if [[ "$ws" =~ ^[1-9]$|^10$ ]]; then
                aerospace workspace "$ws"
                print_success "Basculé vers workspace $ws"
            else
                print_error "Numéro de workspace invalide"
            fi
            ;;
        2)
            echo
            read -p "Numéro du workspace de destination (1-10) : " ws
            if [[ "$ws" =~ ^[1-9]$|^10$ ]]; then
                aerospace move-node-to-workspace "$ws"
                print_success "Fenêtre déplacée vers workspace $ws"
            else
                print_error "Numéro de workspace invalide"
            fi
            ;;
        3)
            aerospace balance-sizes
            print_success "Fenêtres équilibrées"
            ;;
        4)
            read -p "Êtes-vous sûr ? (y/N) : " confirm
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                aerospace close-all-windows-but-current
                print_success "Fenêtres fermées"
            fi
            ;;
        5)
            echo
            echo -e "${CYAN}Layouts disponibles :${NC}"
            echo "1) tiles"
            echo "2) floating" 
            echo "3) h_tiles"
            echo "4) v_tiles"
            echo "5) h_accordion"
            echo "6) v_accordion"
            echo
            read -p "Choisir un layout : " layout_choice
            
            case $layout_choice in
                1) aerospace layout tiles ;;
                2) aerospace layout floating ;;
                3) aerospace layout h_tiles ;;
                4) aerospace layout v_tiles ;;
                5) aerospace layout h_accordion ;;
                6) aerospace layout v_accordion ;;
                *) print_error "Choix invalide" ; return ;;
            esac
            
            print_success "Layout changé"
            ;;
        0)
            return
            ;;
        *)
            print_error "Choix invalide"
            ;;
    esac
}

# ═══════════════════════════════════════════════════════════════
# DEBUGGING ET LOGS
# ═══════════════════════════════════════════════════════════════

# Afficher les logs
show_logs() {
    print_header "LOGS AEROSPACE"
    
    if [[ -f "$LOG_FILE" ]]; then
        echo -e "${BLUE}Dernières 50 lignes :${NC}\n"
        tail -n 50 "$LOG_FILE"
    else
        print_warning "Fichier de log non trouvé : $LOG_FILE"
    fi
}

# Suivre les logs en temps réel
follow_logs() {
    print_header "SUIVI DES LOGS EN TEMPS RÉEL"
    print_info "Appuyez sur Ctrl+C pour arrêter"
    
    if [[ -f "$LOG_FILE" ]]; then
        tail -f "$LOG_FILE"
    else
        print_warning "Fichier de log non trouvé : $LOG_FILE"
    fi
}

# Diagnostic système
run_diagnostics() {
    print_header "DIAGNOSTIC SYSTÈME"
    
    echo -e "${BLUE}${GEAR} Vérification des permissions...${NC}"
    
    # Vérifier les permissions d'accessibilité
    if ! aerospace list-windows >/dev/null 2>&1; then
        print_error "Permissions d'accessibilité manquantes"
        echo "  Aller dans : Système > Confidentialité > Accessibilité"
        echo "  Ajouter AeroSpace à la liste"
    else
        print_success "Permissions d'accessibilité OK"
    fi
    
    echo
    echo -e "${BLUE}${GEAR} Vérification de la configuration...${NC}"
    validate_config
    
    echo
    echo -e "${BLUE}${GEAR} Vérification de l'intégration Sketchybar...${NC}"
    if command -v sketchybar >/dev/null 2>&1; then
        if pgrep -f "sketchybar" >/dev/null 2>&1; then
            print_success "Sketchybar détecté et en cours d'exécution"
        else
            print_warning "Sketchybar installé mais non démarré"
        fi
    else
        print_info "Sketchybar non installé"
    fi
    
    echo
    echo -e "${BLUE}${GEAR} Test des commandes de base...${NC}"
    if aerospace list-workspaces >/dev/null 2>&1; then
        print_success "Commandes AeroSpace fonctionnelles"
    else
        print_error "Erreur avec les commandes AeroSpace"
    fi
}

# ═══════════════════════════════════════════════════════════════
# INTÉGRATION SKETCHYBAR
# ═══════════════════════════════════════════════════════════════

# Tester l'intégration Sketchybar
test_sketchybar_integration() {
    print_header "TEST INTÉGRATION SKETCHYBAR"
    
    if ! command -v sketchybar >/dev/null 2>&1; then
        print_error "Sketchybar n'est pas installé"
        return 1
    fi
    
    if ! pgrep -f "sketchybar" >/dev/null 2>&1; then
        print_error "Sketchybar n'est pas en cours d'exécution"
        return 1
    fi
    
    print_info "Test des triggers..."
    
    # Tester les triggers
    echo -n "  aerospace_workspace_change... "
    if sketchybar --trigger aerospace_workspace_change 2>/dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}ERREUR${NC}"
    fi
    
    echo -n "  window_focus... "
    if sketchybar --trigger window_focus 2>/dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}ERREUR${NC}"
    fi
    
    print_success "Test d'intégration terminé"
}

# ═══════════════════════════════════════════════════════════════
# MENU PRINCIPAL
# ═══════════════════════════════════════════════════════════════

show_menu() {
    clear
    echo -e "${PURPLE}"
    cat << 'EOF'
╭─────────────────────────────────────────────────────────────╮
│                                                             │
│     ___                  _____                              │
│    / _ \___  _____ ___  / __  /___  ____ __________________  │
│   / __ / _ \/ ___/ __ \/___ \/ __ \/ __ `/ ___/ _ \        │
│  / /_/ /  __/ /  / /_/ /____/ /_/ / /_/ / /__/  __/         │
│  \____/\___/_/   \____/_____/ .___/\__,_/\___/\___/          │
│                            /_/                              │
│                      MANAGER v1.0                          │
╰─────────────────────────────────────────────────────────────╯
EOF
    echo -e "${NC}"
    
    echo -e "${CYAN}╭─ CONFIGURATION ─────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${NC} ${YELLOW}1)${NC} 🔄 Recharger configuration"
    echo -e "${CYAN}│${NC} ${YELLOW}2)${NC} ✅ Valider configuration"
    echo -e "${CYAN}│${NC} ${YELLOW}3)${NC} 💾 Sauvegarder configuration"
    echo -e "${CYAN}│${NC} ${YELLOW}4)${NC} 📂 Restaurer configuration"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────╯${NC}"
    
    echo -e "${CYAN}╭─ INFORMATIONS ──────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${NC} ${YELLOW}5)${NC} 📊 Informations système"
    echo -e "${CYAN}│${NC} ${YELLOW}6)${NC} 🏠 Lister workspaces"
    echo -e "${CYAN}│${NC} ${YELLOW}7)${NC} 🪟 Lister fenêtres"
    echo -e "${CYAN}│${NC} ${YELLOW}8)${NC} 📱 Lister applications"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────╯${NC}"
    
    echo -e "${CYAN}╭─ ACTIONS ───────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${NC} ${YELLOW}9)${NC} ⚡ Actions workspace"
    echo -e "${CYAN}│${NC} ${YELLOW}10)${NC} 📡 Tester intégration Sketchybar"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────╯${NC}"
    
    echo -e "${CYAN}╭─ DEBUGGING ─────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${NC} ${YELLOW}11)${NC} 📋 Afficher logs"
    echo -e "${CYAN}│${NC} ${YELLOW}12)${NC} 👁️  Suivre logs en temps réel"
    echo -e "${CYAN}│${NC} ${YELLOW}13)${NC} 🔧 Diagnostic système"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────╯${NC}"
    
    echo -e "${CYAN}╭─ DIVERS ────────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${NC} ${YELLOW}14)${NC} 📖 Ouvrir documentation"
    echo -e "${CYAN}│${NC} ${YELLOW}15)${NC} ⚙️  Éditer configuration"
    echo -e "${CYAN}│${NC} ${YELLOW}0)${NC} 🚪 Quitter"
    echo -e "${CYAN}╰─────────────────────────────────────────────────────────────╯${NC}"
    
    echo
}

# Fonction principale
main() {
    setup_directories
    check_aerospace
    
    while true; do
        show_menu
        read -p "Choisir une option : " choice
        
        case $choice in
            1) reload_config ;;
            2) validate_config ;;
            3) backup_config ;;
            4) restore_config ;;
            5) show_system_info ;;
            6) list_workspaces ;;
            7) list_windows ;;
            8) list_apps ;;
            9) workspace_actions ;;
            10) test_sketchybar_integration ;;
            11) show_logs ;;
            12) follow_logs ;;
            13) run_diagnostics ;;
            14) 
                if [[ -f "$CONFIG_DIR/DOCUMENTATION.md" ]]; then
                    if command -v open >/dev/null 2>&1; then
                        open "$CONFIG_DIR/DOCUMENTATION.md"
                    else
                        print_info "Documentation disponible dans : $CONFIG_DIR/DOCUMENTATION.md"
                    fi
                else
                    print_warning "Documentation non trouvée"
                fi
                ;;
            15)
                if command -v code >/dev/null 2>&1; then
                    code "$CONFIG_FILE"
                elif command -v nano >/dev/null 2>&1; then
                    nano "$CONFIG_FILE"
                else
                    print_info "Éditeur non trouvé. Fichier : $CONFIG_FILE"
                fi
                ;;
            0)
                print_success "Au revoir !"
                exit 0
                ;;
            *)
                print_error "Choix invalide"
                ;;
        esac
        
        echo
        read -p "Appuyez sur Entrée pour continuer..."
    done
}

# Point d'entrée
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
#!/bin/bash

# ╭─────────────────────────────────────────────────────────────╮
# │              Diagnostic skhd - AeroSpace                    │
# │          Script pour identifier les problèmes skhd         │
# ╰─────────────────────────────────────────────────────────────╯

set -euo pipefail

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
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
INFO="ℹ️"
ROCKET="🚀"
GEAR="⚙️"

print_header() {
    echo -e "\n${CYAN}╭─────────────────────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${WHITE}                 $1${CYAN}                 │${NC}"
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

print_section() {
    echo -e "\n${PURPLE}${GEAR} $1${NC}"
    echo -e "${PURPLE}$(printf '─%.0s' {1..50})${NC}"
}

# Diagnostic principal
main_diagnostic() {
    clear
    print_header "DIAGNOSTIC SKHD POUR AEROSPACE"
    
    echo -e "${BLUE}Ce script va diagnostiquer pourquoi vos raccourcis skhd ne fonctionnent pas.${NC}\n"
    
    # 1. Vérifier les processus
    print_section "1. VÉRIFICATION DES PROCESSUS"
    
    if pgrep -f "skhd" >/dev/null 2>&1; then
        print_success "skhd est en cours d'exécution (PID: $(pgrep -f skhd))"
    else
        print_error "skhd N'EST PAS en cours d'exécution"
        echo -e "${YELLOW}Solution: brew services start skhd${NC}"
        return 1
    fi
    
    if pgrep -f "AeroSpace" >/dev/null 2>&1; then
        print_success "AeroSpace est en cours d'exécution (PID: $(pgrep -f AeroSpace))"
    else
        print_error "AeroSpace N'EST PAS en cours d'exécution"
        echo -e "${YELLOW}Solution: open -a AeroSpace${NC}"
        return 1
    fi
    
    # 2. Vérifier l'installation
    print_section "2. VÉRIFICATION INSTALLATION"
    
    if command -v skhd >/dev/null 2>&1; then
        print_success "skhd est installé: $(which skhd)"
        print_info "Version: $(skhd --version 2>&1 | head -1 || echo 'Version inconnue')"
    else
        print_error "skhd N'EST PAS installé"
        echo -e "${YELLOW}Solution: brew install koekeishiya/formulae/skhd${NC}"
        return 1
    fi
    
    # 3. Vérifier le fichier de configuration
    print_section "3. VÉRIFICATION CONFIGURATION"
    
    SKHD_CONFIG="$HOME/.config/skhd/skhdrc"
    if [[ -f "$SKHD_CONFIG" ]]; then
        print_success "Fichier de configuration trouvé: $SKHD_CONFIG"
        
        local line_count=$(wc -l < "$SKHD_CONFIG")
        print_info "Nombre de lignes: $line_count"
        
        # Compter les raccourcis ralt
        local ralt_count=$(grep -c "^ralt" "$SKHD_CONFIG" 2>/dev/null || echo "0")
        print_info "Raccourcis 'ralt' trouvés: $ralt_count"
        
        if [[ $ralt_count -eq 0 ]]; then
            print_warning "Aucun raccourci 'ralt' trouvé dans la configuration"
        fi
        
    else
        print_error "Fichier de configuration INTROUVABLE: $SKHD_CONFIG"
        return 1
    fi
    
    # 4. Test de syntaxe skhd
    print_section "4. TEST SYNTAXE SKHD"
    
    if skhd --reload >/dev/null 2>&1; then
        print_success "Configuration skhd syntaxiquement correcte"
    else
        print_error "ERREUR DE SYNTAXE dans la configuration skhd"
        echo -e "${YELLOW}Détails de l'erreur:${NC}"
        skhd --reload 2>&1 | head -10
        return 1
    fi
    
    # 5. Vérifier les permissions d'accessibilité
    print_section "5. PERMISSIONS D'ACCESSIBILITÉ"
    
    print_info "Vérification des permissions..."
    
    # Test indirect des permissions via une commande skhd
    if timeout 2s skhd --observe 2>/dev/null | head -1 >/dev/null; then
        print_success "skhd a les permissions d'accessibilité"
    else
        print_error "skhd N'A PAS les permissions d'accessibilité"
        echo -e "\n${YELLOW}${WARNING} SOLUTION REQUISE:${NC}"
        echo -e "1. Aller dans: ${WHITE}Réglages Système > Confidentialité et sécurité > Accessibilité${NC}"
        echo -e "2. Cliquer sur le ${WHITE}+${NC} pour ajouter une application"
        echo -e "3. Naviguer vers: ${WHITE}/usr/local/bin/skhd${NC} (ou $(which skhd 2>/dev/null || echo '/opt/homebrew/bin/skhd'))"
        echo -e "4. Ajouter et activer skhd"
        echo -e "5. Redémarrer skhd: ${WHITE}brew services restart skhd${NC}"
        
        read -p "$(echo -e "\n${CYAN}Avez-vous ajouté skhd aux permissions d'accessibilité? (y/N): ${NC}")" -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "\n${RED}Veuillez configurer les permissions avant de continuer.${NC}"
            return 1
        fi
    fi
    
    # 6. Test des raccourcis AeroSpace
    print_section "6. TEST AEROSPACE"
    
    if aerospace list-workspaces --all >/dev/null 2>&1; then
        print_success "AeroSpace répond aux commandes CLI"
        
        # Test workspace change
        local current_ws=$(aerospace list-workspaces --focused 2>/dev/null | head -1 || echo "1")
        print_info "Workspace actuel: $current_ws"
        
        # Test navigation
        if aerospace workspace 1 >/dev/null 2>&1; then
            print_success "Navigation workspace fonctionnelle"
        else
            print_error "Problème avec la navigation workspace"
        fi
        
    else
        print_error "AeroSpace ne répond pas aux commandes"
        print_warning "Vérifiez que AeroSpace a aussi les permissions d'accessibilité"
    fi
    
    # 7. Test pratique skhd
    print_section "7. TEST PRATIQUE SKHD"
    
    echo -e "${BLUE}Test en temps réel des raccourcis skhd...${NC}"
    echo -e "${YELLOW}Instructions:${NC}"
    echo -e "1. Appuyez sur ${WHITE}Alt droite + 1${NC} maintenant"
    echo -e "2. Si ça fonctionne, vous devriez voir l'action dans la sortie"
    echo -e "3. Appuyez sur ${WHITE}Ctrl+C${NC} pour arrêter le test"
    
    echo -e "\n${GREEN}Démarrage du monitoring skhd...${NC}"
    echo -e "${CYAN}(Les actions skhd apparaîtront ci-dessous)${NC}\n"
    
    # Monitor skhd events
    timeout 10s skhd --observe 2>/dev/null || {
        print_error "Impossible de monitorer skhd"
        echo -e "${YELLOW}Cela confirme un problème de permissions d'accessibilité${NC}"
        return 1
    }
    
    # 8. Solutions recommandées
    print_section "8. SOLUTIONS RECOMMANDÉES"
    
    echo -e "${GREEN}Si vous êtes arrivé ici, voici les solutions par ordre de priorité:${NC}\n"
    
    echo -e "${WHITE}Solution 1: Permissions d'accessibilité${NC}"
    echo -e "• Système > Confidentialité > Accessibilité"
    echo -e "• Ajouter: $(which skhd 2>/dev/null || echo '/opt/homebrew/bin/skhd')"
    echo -e "• Ajouter: /Applications/AeroSpace.app"
    
    echo -e "\n${WHITE}Solution 2: Redémarrage des services${NC}"
    echo -e "• ${CYAN}brew services restart skhd${NC}"
    echo -e "• Relancer AeroSpace depuis Applications"
    
    echo -e "\n${WHITE}Solution 3: Vérification configuration${NC}"
    echo -e "• ${CYAN}skhd --reload${NC}"
    echo -e "• Vérifier les logs: ${CYAN}tail -f /tmp/skhd_$USER.out.log${NC}"
    
    echo -e "\n${WHITE}Solution 4: Test minimal${NC}"
    echo -e "• Créer un raccourci test simple"
    echo -e "• ${CYAN}echo 'ralt - t : echo \"Test OK\" > /tmp/skhd-test' >> ~/.config/skhd/skhdrc${NC}"
    
    # 9. Commandes utiles
    print_section "9. COMMANDES UTILES DEBUG"
    
    echo -e "${WHITE}Redémarrer tout:${NC}"
    echo -e "  ${CYAN}brew services restart skhd && aerospace reload-config${NC}"
    
    echo -e "\n${WHITE}Voir les logs skhd:${NC}"
    echo -e "  ${CYAN}tail -f /tmp/skhd_$USER.out.log${NC}"
    echo -e "  ${CYAN}tail -f /tmp/skhd_$USER.err.log${NC}"
    
    echo -e "\n${WHITE}Test manuel raccourci:${NC}"
    echo -e "  ${CYAN}skhd -c 'ralt - 1 : aerospace workspace 1'${NC}"
    
    echo -e "\n${WHITE}Observer les événements:${NC}"
    echo -e "  ${CYAN}skhd --observe${NC}"
    
    print_section "RÉSUMÉ DIAGNOSTIC"
    
    echo -e "${GREEN}${ROCKET} Diagnostic terminé !${NC}\n"
    echo -e "Si le problème persiste après avoir suivi les solutions:"
    echo -e "1. Vérifiez les permissions d'accessibilité (le plus probable)"
    echo -e "2. Redémarrez skhd et AeroSpace"  
    echo -e "3. Consultez les logs skhd"
    echo -e "4. Testez avec un raccourci minimal"
    
    echo -e "\n${CYAN}Pour relancer ce diagnostic: ${WHITE}~/.config/aerospace/diagnostic-skhd.sh${NC}"
}

# Quick test function
quick_test() {
    echo -e "${BLUE}Test rapide skhd...${NC}"
    
    # Test si skhd observe fonctionne (= permissions OK)
    if timeout 1s skhd --observe >/dev/null 2>&1; then
        echo -e "${GREEN}${CHECK} Permissions OK${NC}"
        return 0
    else
        echo -e "${RED}${CROSS} Problème de permissions${NC}"
        echo -e "${YELLOW}Solution: Ajouter skhd aux permissions d'accessibilité${NC}"
        return 1
    fi
}

# Point d'entrée
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ "${1:-}" == "--quick" ]]; then
        quick_test
    else
        main_diagnostic
    fi
fi
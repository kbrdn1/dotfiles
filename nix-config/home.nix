# Home Manager Configuration - Complete CLI Tools
# User: kbrdn1
# Phase 4: CLI Tools Migration

{ config, pkgs, ... }:

{
  # Home Manager version
  home.stateVersion = "24.11";

  # Basic user info
  home.username = "kbrdn1";
  home.homeDirectory = "/Users/kbrdn1";

  # Enable home-manager
  programs.home-manager.enable = true;

  # Allow unfree packages (required for VS Code)
  nixpkgs.config.allowUnfree = true;

  # Add npm global bin to PATH
  home.sessionPath = [
    "$HOME/.npm-global/bin"
  ];

  # -------------------------- Core Packages --------------------------
  home.packages = with pkgs; [
    # Core Utilities
    coreutils
    findutils
    gnused
    gnugrep

    # File Management
    tree
    fd
    ripgrep
    bat
    eza

    # Search & Navigation
    fzf
    zoxide

    # Git Tools
    git
    gh
    lazygit

    # Container Tools
    lazydocker

    # Database Tools
    lazysql
    redis

    # JSON/YAML Tools
    jq
    yq-go

    # System Tools
    neofetch
    # thefuck removed from nixpkgs (unmaintained)
    tmux
    htop

    # Kubernetes Tools
    kubectl
    kubernetes-helm
    minikube
    argocd
    k9s
    kubectx
    stern
    kustomize
    kubecolor
    dive
    popeye

    # Development Tools
    just
    tokei
    hyperfine
    duf
    bottom
    pandoc

    # Programming Languages & Runtimes
    nodejs_24
    bun
    deno
    pnpm
    go
    rustc
    cargo
    python313
    (php84.withExtensions ({ all, ... }: with all; [ pcov redis ]))
    symfony-cli

    # Editors
    neovim

    # Multimedia Tools
    ffmpeg
    imagemagick
    poppler

    # Network Tools
    curl
    wget
    httpie
    dogdns

    # Cloud Tools
    awscli2
    stripe-cli

    # Fonts
    nerd-fonts.hack
    nerd-fonts.symbols-only
  ];

  # -------------------------- Programs Configuration --------------------------

  # Kitty Terminal
  programs.kitty = {
    enable = true;

    # Font
    font = {
      name = "CaskaydiaCove Nerd Font Mono";
      size = 14;
    };

    settings = {
      # Cursor
      cursor_shape = "block";
      cursor_blink_interval = 0;
      cursor_beam_thickness = "1.5";
      cursor_underline_thickness = "2.0";
      shell_integration = "enabled";

      # Transparency and Blur - Very light transparency
      background_opacity = "0.95";
      background_blur = 32;
      dynamic_background_opacity = "yes";

      # Window Layout
      window_padding_width = "10 0 10 0";
      hide_window_decorations = "no";
      confirm_os_window_close = 0;
      remember_window_size = "yes";
      initial_window_width = "96c";
      initial_window_height = "120c";
      enabled_layouts = "tall:bias=50;full_size=1;mirrored=false";

      # Tab Bar
      tab_bar_edge = "top";
      tab_bar_style = "powerline";
      tab_powerline_style = "slanted";
      tab_title_template = "{index}: {title}";

      # Clipboard
      clipboard_control = "write-clipboard write-primary read-clipboard read-primary";
      copy_on_select = "yes";

      # Advanced
      allow_remote_control = "yes";
      listen_on = "unix:/tmp/kitty";

      # MacOS Specific
      macos_titlebar_color = "background";
      macos_option_as_alt = "yes";
      macos_show_window_title_in = "all";
      macos_quit_when_last_window_closed = "yes";
      macos_colorspace = "displayp3";
      macos_thicken_font = "0.5";

      # Performance
      repaint_delay = 10;
      input_delay = 3;
      sync_to_monitor = "yes";

      # Bell
      enable_audio_bell = "no";
      visual_bell_duration = 0.0;

      # URLs
      url_color = "#7ab8ff";
      url_style = "curly";
      open_url_with = "default";

      # Mouse
      mouse_hide_wait = 3.0;

      # Scrollback
      scrollback_lines = 10000;
      scrollback_pager = "less --chop-long-lines --RAW-CONTROL-CHARS +INPUT_LINE_NUMBER";

      # Shell
      shell = "zsh";
    };

    # Custom theme
    extraConfig = ''
      # Claude Dark Theme
      # Background and foreground
      background #1a1a1a
      foreground #e0e0e0

      # Cursor
      cursor #d4825d
      cursor_text_color #1a1a1a

      # Selection
      selection_background #3a3a3a
      selection_foreground #e0e0e0

      # Normal colors (0-7)
      color0 #3a3a3a
      color1 #ff7a7a
      color2 #86e89a
      color3 #ffdf61
      color4 #7ab8ff
      color5 #c79bff
      color6 #8abfb8
      color7 #e0e0e0

      # Bright colors (8-15)
      color8 #999999
      color9 #ff7a7a
      color10 #86e89a
      color11 #ffdf61
      color12 #7ab8ff
      color13 #c79bff
      color14 #8abfb8
      color15 #ffffff
    '';
  };

  # Zsh Configuration
  programs.zsh = {
    enable = true;

    # Oh My Zsh
    oh-my-zsh = {
      enable = true;
      plugins = [
        "macos"
        "git"
        "git-auto-fetch"
        "gh"
        "battery"
        "brew"
        "composer"
        "docker"
        "docker-compose"
        "alias-finder"
        "bun"
        "eza"
        "fzf"
        "history"
        "laravel"
        "symfony"
        "npm"
        "perms"
        "pip"
        "qrcode"
        "ssh"
        "systemadmin"
        # "thefuck" - removed (unmaintained)
        "vi-mode"
        "web-search"
      ];
    };

    # Zsh plugins via Nix
    plugins = [
      {
        name = "zsh-autosuggestions";
        src = pkgs.zsh-autosuggestions;
        file = "share/zsh-autosuggestions/zsh-autosuggestions.zsh";
      }
      {
        name = "zsh-syntax-highlighting";
        src = pkgs.zsh-syntax-highlighting;
        file = "share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh";
      }
      {
        name = "powerlevel10k";
        src = pkgs.zsh-powerlevel10k;
        file = "share/zsh-powerlevel10k/powerlevel10k.zsh-theme";
      }
    ];

    # Environment variables
    envExtra = ''
      export XDG_CONFIG_HOME="$HOME/.config"
      export EDITOR="zed"
      export USER_FOLDER=$(basename $HOME)

      # Homebrew
      export HOMEBREW_NO_AUTO_UPDATE=1

      # FZF
      export FZF_DEFAULT_COMMAND="fd --hidden --exclude .git"
      export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
      export FZF_ALT_C_COMMAND="fd --type d --hidden --strip-cwd-prefix --exclude .git"

      # Bat
      export BAT_THEME="Catppuccin Macchiato"

      # Bun
      export PATH="$HOME/.bun/bin:$PATH"
      
      # Python pip global packages
      export PATH="/Users/kbrdn1/.local/bin:$PATH"
    '';

    # Shell aliases
    shellAliases = {
      # System
      x = "exit";
      config = "cd $XDG_CONFIG_HOME";
      edit-config = "$EDITOR $XDG_CONFIG_HOME";

      # ZSH
      reload-zsh = "source ~/.zshrc";
      edit-zsh = "$EDITOR ~/.zshrc";

      # Nix
      reload-nix = "nix run home-manager/release-24.11 -- switch --flake ~/nix-config";
      edit-nix = "$EDITOR ~/nix-config/home.nix";

      # Application Tools
      py = "python3";
      python = "/usr/bin/python3";
      pa = "php artisan";
      laravel = "php artisan";
      a = "adonis ace";
      adonis = "node ace";
      yt = "youtube";
      gg = "google";

      # File Management
      ls = "eza --color=always --long --git --no-filesize --icons=always --no-time --no-user --no-permissions --group-directories-first";
      lg = "lazygit";
      lzd = "lazydocker";
      f = "fzf --tmux top,50%";

      # GitHub Copilot
      gcs = "gh copilot suggest";
      gce = "gh copilot explain";
      gcc = "gh copilot config";
      gca = "gh copilot alias";

      # Window Manager Services (keep for Sketchybar/Borders)
      reload-sketchybar = "brew services restart sketchybar";
      edit-sketchybar = "$EDITOR $XDG_CONFIG_HOME/sketchybar";
      reload-borders = "brew services restart borders";
      edit-borders = "$EDITOR $XDG_CONFIG_HOME/borders";

      # Tmux
      t = "tmux -2";
      reload-tmux = "tmux source-file ~/.tmux.conf";
      edit-tmux = "$EDITOR ~/.tmux.conf";

      # Powerlevel10k
      edit-p10k = "$EDITOR ~/.p10k.zsh";
    };

    # Additional initialization
    initExtra = ''
      # Nix daemon (multi-user mode)
      if [ -e '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' ]; then
        . '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh'
      fi

      # Load secrets if they exist
      [[ -f ~/.zsh_secrets ]] && source ~/.zsh_secrets

      # History Configuration
      HISTFILE=$HOME/.zhistory
      SAVEHIST=1000
      HISTSIZE=999
      setopt share_history
      setopt hist_expire_dups_first
      setopt hist_ignore_dups
      setopt hist_verify

      bindkey '^[[A' history-search-backward
      bindkey '^[[B' history-search-forward

      # Alias Finder
      zstyle ':omz:plugins:alias-finder' autoload yes
      zstyle ':omz:plugins:alias-finder' longer yes
      zstyle ':omz:plugins:alias-finder' exact yes
      zstyle ':omz:plugins:alias-finder' cheaper yes

      # VI Mode
      VI_MODE_SET_CURSOR=true
      MODE_INDICATOR="%F{white}+%f"
      INSERT_MODE_INDICATOR="%F{yellow}+%f"
      PROMPT="$PROMPT\$(vi_mode_prompt_info)"
      RPROMPT="\$(vi_mode_prompt_info)$RPROMPT"
      VI_MODE_CURSOR_NORMAL=2
      VI_MODE_CURSOR_VISUAL=6
      VI_MODE_CURSOR_INSERT=6
      VI_MODE_CURSOR_OPPEND=0

      # FZF Configuration
      eval "$(fzf --zsh)"
      export FZF_DEFAULT_OPTS="--style full \
        --border-label ' FZF ' --header-label ' File Type ' \
        --preview 'bat -n --color=always --line-range :500 {}' \
        --bind 'focus:transform-preview-label:[[ -n {} ]] && printf \" [%s] \" {}' \
        --bind 'focus:+transform-header:file --brief {} || echo \"No file selected\"' \
        --bind 'ctrl-r:change-list-label( Reloading the list )+reload(sleep 2; git ls-files)' \
        --color 'border:#494d64,label:#cad3f5' \
        --color 'preview-border:#8aadf4,preview-label:#b7bdf8' \
        --color 'list-border:#a6da95,list-label:#a6da95' \
        --color 'input-border:#ed8796,input-label:#f5a9b8' \
        --color 'header-border:#7dc4e4,header-label:#91d7e3'"
      export FZF_CTRL_T_OPTS="$FZF_DEFAULT_OPTS"
      export FZF_ALT_C_OPTS="--preview 'eza --tree --color=always {} | head -200'"

      # FZF Functions
      _fzf_compgen_path() {
        fd --hidden --exclude .git . "$1"
      }

      _fzf_compgen_dir() {
        fd --type d --hidden --exclude .git . "$1"
      }

      _fzf_comprun() {
        local command=$1
        shift

        case "$command" in
          cd) fzf --preview 'eza --tree --color=always {} | head -200' "$@" ;;
          export | unset) fzf --preview "eval 'echo \$' {}" "$@" ;;
          ssh) fzf --preview 'dig {}' "$@" ;;
          *) fzf --preview 'bat -n --color=always --line-range :500 {}' "$@" ;;
        esac
      }

      # Yazi Function
      function y() {
        local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
        yazi "$@" --cwd-file="$tmp"
        if cwd="$(command cat -- "$tmp")" && [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
          builtin cd -- "$cwd"
        fi
        rm -f -- "$tmp"
      }

      # Sketchybar Functions
      function brew() {
        command brew "$@"
        if [[ $* =~ "upgrade" ]] || [[ $* =~ "update" ]] || [[ $* =~ "outdated" ]]; then
          sketchybar --trigger brew_update
        fi
      }

      function zen() {
        $XDG_CONFIG_HOME/sketchybar/plugins/zen.sh $1
      }

      # Load Powerlevel10k
      [[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh
    '';
  };

  # Git Configuration
  programs.git = {
    enable = true;

    settings = {
      user = {
        name = "Kylian Bardini";
        email = "kylianb1@icloud.com";
      };

      init.defaultBranch = "main";

      commit.gpgsign = false;
      tag.gpgSign = true;

      filter.lfs = {
        clean = "git-lfs clean -- %f";
        smudge = "git-lfs smudge -- %f";
        process = "git-lfs filter-process";
        required = true;
      };
    };

    signing = {
      key = "9885EAB850D7FCF9BF34AC1A11936FF371928171";
      signByDefault = false;
    };

    lfs.enable = true;
  };

  # FZF
  programs.fzf = {
    enable = true;
    enableZshIntegration = true;
  };

  # Zoxide - 'z' command for smart directory jumping
  programs.zoxide = {
    enable = true;
    enableZshIntegration = true;
    # No --cmd option = keeps 'z' as default command
    # 'cd' remains standard shell builtin
  };

  # Bat
  programs.bat = {
    enable = true;
    config = {
      theme = "Catppuccin-macchiato";
    };
  };

  # Direnv (for project flakes)
  programs.direnv = {
    enable = true;
    enableZshIntegration = true;
    nix-direnv.enable = true;
  };

  # Tmux - Claude Dark Theme with full plugin support
  programs.tmux = {
    enable = true;
    prefix = "C-a";
    baseIndex = 1;
    escapeTime = 0;
    historyLimit = 10000;
    mouse = true;
    keyMode = "vi";

    extraConfig = ''
      # =============================================
      # TPM Plugin Manager
      # =============================================
      set-environment -gF TMUX_PLUGIN_MANAGER_PATH '#{HOME}/.local/share/tmux/plugins/'

      if 'test ! -d "$${TMUX_PLUGIN_MANAGER_PATH}/tpm"' {
        run 'mkdir -p "$${TMUX_PLUGIN_MANAGER_PATH}"'
        run 'git clone https://github.com/tmux-plugins/tpm "$${TMUX_PLUGIN_MANAGER_PATH}/tpm"'
        run '$${TMUX_PLUGIN_MANAGER_PATH}/tpm/bin/install_plugins'
      }

      # =============================================
      # Keybindings (New)
      # =============================================

      # Reload config
      unbind r
      bind r source-file ~/.tmux.conf \; display "Config reloaded!"

      # Window navigation
      bind-key b previous-window
      bind-key n next-window

      # Pane navigation with vim keys
      bind-key h select-pane -L
      bind-key j select-pane -D
      bind-key k select-pane -U
      bind-key l select-pane -R
      bind-key x kill-pane

      # Split panes (v=horizontal, s=vertical, in current path)
      bind-key v split-window -h -c "#{pane_current_path}"
      bind-key s split-window -v -c "#{pane_current_path}"

      # New window in current path
      bind-key c new-window -c "#{pane_current_path}"

      # Kill window
      bind-key X kill-window

      # =============================================
      # Plugins
      # =============================================
      set -g @plugin 'tmux-plugins/tpm'
      set -g @plugin 'tmux-plugins/tmux-yank'
      set -g @plugin 'tmux-plugins/tmux-sensible'
      set -g @plugin 'christoomey/vim-tmux-navigator'
      set -g @plugin 'catppuccin/tmux'
      set -g @plugin 'tmux-plugins/tmux-online-status'
      set -g @plugin 'joshmedeski/tmux-nerd-font-window-name'
      set -g @plugin 'alexwforsythe/tmux-which-key'
      set -g @plugin 'omerxx/tmux-sessionx'
      set -g @plugin 'tmux-plugins/tmux-cpu'
      set -g @plugin 'tmux-plugins/tmux-battery'

      # =============================================
      # Catppuccin with Claude Dark Colors Override
      # =============================================
      set -g @catppuccin_flavor 'macchiato'

      # Override Catppuccin colors with Claude Dark palette
      set -g @thm_bg "#1a1a1a"
      set -g @thm_fg "#e0e0e0"
      set -g @thm_rosewater "#D4825D"
      set -g @thm_flamingo "#D4825D"
      set -g @thm_pink "#C15F3C"
      set -g @thm_mauve "#C15F3C"
      set -g @thm_red "#c15f3c"
      set -g @thm_maroon "#a85a45"
      set -g @thm_peach "#D4825D"
      set -g @thm_yellow "#e8b87a"
      set -g @thm_green "#7cb88a"
      set -g @thm_teal "#6ba3a3"
      set -g @thm_sky "#6ba3a3"
      set -g @thm_sapphire "#6b8fa3"
      set -g @thm_blue "#6b8fa3"
      set -g @thm_lavender "#a38f6b"
      set -g @thm_text "#e0e0e0"
      set -g @thm_subtext1 "#c0c0c0"
      set -g @thm_subtext0 "#a0a0a0"
      set -g @thm_overlay2 "#808080"
      set -g @thm_overlay1 "#606060"
      set -g @thm_overlay0 "#505050"
      set -g @thm_surface2 "#404040"
      set -g @thm_surface1 "#353535"
      set -g @thm_surface0 "#2a2520"
      set -g @thm_mantle "#1a1a1a"
      set -g @thm_crust "#151515"

      # Catppuccin window configuration
      set -g @catppuccin_status_background "#{E:@thm_mantle}"
      set -g @catppuccin_window_status_style 'rounded'
      set -g @catppuccin_window_number_position 'right'
      set -g @catppuccin_window_status 'no'
      set -g @catppuccin_window_text '#W'
      set -g @catppuccin_window_default_text '#W'
      set -g @catppuccin_window_current_fill 'number'
      set -g @catppuccin_window_current_text '#W'
      set -g @catppuccin_window_current_color '#{E:@thm_peach}'
      set -g @catppuccin_date_time_text ' %Y/%m/%d | %H:%M'
      set -g @catppuccin_status_module_text_bg '#{E:@thm_mantle}'
      set -g status-justify "absolute-centre"

      # Source catppuccin plugin
      run '#{TMUX_PLUGIN_MANAGER_PATH}catppuccin/catppuccin.tmux'

      # Load custom modules
      source -F '#{HOME}/tmux_custom_modules/ctp_cpu.conf'
      source -F '#{HOME}/tmux_custom_modules/ctp_memory.conf'

      # =============================================
      # Status Bar
      # =============================================
      set -g status-position bottom
      set -g status-interval 5
      set -g status-left-length 100
      set -g status-right-length 100
      set -g status-right ""
      set -g status-left '#{E:@catppuccin_status_session} '
      set -agF status-right '#{E:@catppuccin_status_ctp_cpu}'
      set -agF status-right '#{E:@catppuccin_status_ctp_memory}'
      if 'test -r /sys/class/power_supply/BAT*' {
        set -agF status-right '#{E:@catppuccin_status_battery}'
      }
      set -ag status-right '#{E:@catppuccin_status_date_time}'

      # =============================================
      # Window Settings
      # =============================================
      set -g renumber-windows on
      set -g allow-rename off
      set -wg automatic-rename on
      set -g automatic-rename-format "-"

      # =============================================
      # Terminal Colors
      # =============================================
      set -g default-terminal "tmux-256color"
      set -ag terminal-overrides ',xterm-256color*:RGB'

      # Initialize TPM (must be at the end)
      run '~/.local/share/tmux/plugins/tpm/tpm'
    '';
  };

  # VS Code - Zed-style configuration with APC
  # DISABLED: Managing settings.json manually instead of Home Manager
  programs.vscode = {
    enable = false;  # Changed to false to allow manual settings.json management

    # Configure default profile
    profiles.default = {
      # User settings (merged with existing settings.json)
      userSettings = {
      # ===================================================================
      # Zed-style APC Configuration
      # ===================================================================

      # Import custom Zed-style CSS (ultra-precise based on screenshot analysis)
      "apc.imports" = [
        "file:///Users/kbrdn1/zed-vscode-theme/zed-style-precise.css"
      ];

      # Custom CSS stylesheet
      "apc.stylesheet" = {
        ".monaco-workbench" = {
          "font-family" = "'Monaspace Argon Var', 'Monaspace Argon', 'JetBrainsMono Nerd Font', monospace";
        };
      };

      # Font family for UI components
      "apc.font.family" = "Monaspace Argon Var, Monaspace Argon, JetBrainsMono Nerd Font";

      # Electron window customization
      "apc.electron" = {
        "titleBarStyle" = "hiddenInset";
        "frame" = false;
        "transparent" = false;
        "vibrancy" = "dark";
        "backgroundColor" = "#1e1e1e";
      };

      # Activity bar customization
      "apc.activityBar" = {
        "position" = "default";
        "size" = 48;
        "itemSize" = 48;
        "itemMargin" = 4;
      };

      # Status bar customization
      "apc.statusBar" = {
        "position" = "bottom";
        "height" = 22;
        "fontSize" = 12;
      };

      # List row height
      "apc.listRow" = {
        "height" = 22;
        "fontSize" = 13;
      };

      # Header customization
      "apc.header" = {
        "height" = 35;
        "fontSize" = 13;
      };

      # Sidebar customization
      "apc.sidebar.titlebar" = {
        "height" = 35;
        "fontSize" = 11;
      };

      # Menu bar compact mode
      "apc.menubar.compact" = true;

      # ===================================================================
      # Editor Settings (Zed-inspired)
      # ===================================================================

      "editor.fontFamily" = "'Monaspace Argon', 'Monaspace Argon Frozen', 'JetBrainsMono Nerd Font', monospace";
      "editor.fontSize" = 14;
      "editor.lineHeight" = 1.4;
      "editor.fontLigatures" = "'liga', 'zero', 'cv01', 'cv06', 'cv27', 'cv31', 'ss01', 'ss02', 'ss03', 'ss04', 'ss05', 'ss06', 'ss07', 'ss08', 'ss09', 'ss10', 'clig', 'calt'";
      "editor.cursorBlinking" = "smooth";
      "editor.cursorSmoothCaretAnimation" = "on";
      "editor.smoothScrolling" = true;
      "editor.minimap.enabled" = true;
      "editor.minimap.renderCharacters" = false;
      "editor.minimap.showSlider" = "mouseover";
      "editor.padding.top" = 16;
      "editor.padding.bottom" = 16;

      # Terminal settings
      "terminal.integrated.fontSize" = 14;
      "terminal.integrated.fontFamily" = "'Monaspace Krypton Frozen', 'Monaspace Krypton', 'JetBrainsMono Nerd Font', monospace";
      "terminal.integrated.lineHeight" = 1.2;
      "terminal.integrated.cursorBlinking" = true;
      "terminal.integrated.smoothScrolling" = true;

      # Workbench settings
      "workbench.sideBar.location" = "right";
      "workbench.activityBar.visible" = false;
      "workbench.colorTheme" = "Claude Dark";
      "workbench.iconTheme" = "catppuccin-perfect-sequoia";
      "workbench.list.smoothScrolling" = true;
      "window.commandCenter" = false;

      # Activitus Bar - Move activity bar icons to statusbar
      "activitusbar.activeColour" = "#3794ff";
      "activitusbar.inactiveColour" = "#808080";
      "activitusbar.alignment" = "Right";
      "activitusbar.views" = [
        {
          "name" = "explorer";
          "codicon" = "files";
        }
        {
          "name" = "search";
          "codicon" = "search";
        }
        {
          "name" = "scm";
          "codicon" = "source-control";
        }
        {
          "name" = "extensions";
          "codicon" = "extensions";
        }
      ];

      # Color customizations
      "workbench.colorCustomizations" = {
        "editor.background" = "#1e1e1e";
        "sideBar.background" = "#252526";
        "activityBar.background" = "#252526";
        "statusBar.background" = "#1e1e1e";
        "statusBar.foreground" = "#cccccc";
        "panel.background" = "#252526";
        "terminal.background" = "#252526";
      };
      };

      # Extensions
      extensions = with pkgs.vscode-extensions; [
        # APC Customize UI++ (required for Zed-style interface)
        # Note: Install via VS Code marketplace as it's not in nixpkgs
      ];
    };
  };
}

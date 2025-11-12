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
      cd = "z";
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

  # Zoxide
  programs.zoxide = {
    enable = true;
    enableZshIntegration = true;
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

  # Tmux
  programs.tmux = {
    enable = true;
    # Will use existing ~/.tmux.conf if present
  };
}

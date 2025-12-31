# Home Manager Configuration - Minimal Start
# User: kbrdn1
# Phase 3: Installation test

{ config, pkgs, ... }:

{
  # Home Manager version
  home.stateVersion = "24.11";

  # Basic user info
  home.username = "kbrdn1";
  home.homeDirectory = "/Users/kbrdn1";

  # Enable home-manager
  programs.home-manager.enable = true;

  # Minimal packages for testing
  home.packages = with pkgs; [
    # Essential tools only
    git
    vim
  ];

  # Git configuration
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
    };
  };
}

# Main Nix Flake for Home Manager Configuration
# Location: ~/nix-config/flake.nix

{
  description = "kbrdn1's Nix configuration with Home Manager";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, home-manager, ... }:
    let
      # system = "x86_64-darwin"; # macOS Intel
      system = "aarch64-darwin"; # macOS Apple Silicon (M1/M2/M3)

      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      homeConfigurations = {
        "kbrdn1" = home-manager.lib.homeManagerConfiguration {
          inherit pkgs;

          modules = [
            ./home.nix
          ];
        };
      };
    };
}

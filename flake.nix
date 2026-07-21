{
  description = "DailyBoard — minimalist task manager (Tauri 2 + React)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
  let
    system = "x86_64-linux";

    pkgs = import nixpkgs {
      inherit system;
    };

    # ── Dev shell libs (unchanged) ──────────────────────────────────────────
    devBuildInputs = [
      pkgs.nodejs
      pkgs.rustup
      pkgs.pkg-config
      pkgs.gtk3
      pkgs.gdk-pixbuf
      pkgs.glib
      pkgs.cairo
      pkgs.pango
      pkgs.webkitgtk_4_1
      pkgs.libsoup_3
      pkgs.zlib
    ];

    # ── GNOME .desktop entry ────────────────────────────────────────────────
    desktopFile = pkgs.makeDesktopItem {
      name            = "dailyboard";
      exec            = "dailyboard";
      icon            = "dailyboard";
      desktopName     = "DailyBoard";
      comment         = "A minimalist task manager";
      categories      = [ "Utility" "Office" ];
      startupWMClass  = "DailyBoard";
    };

    # ── Frontend build (pnpm + Vite → dist/) ───────────────────────────────
    frontendDrv = pkgs.stdenv.mkDerivation (finalAttrs: {
      pname   = "dailyboard-frontend";
      version = "0.1.0";
      src     = ./.;

      nativeBuildInputs = [
        pkgs.nodejs
        pkgs.pnpm
        pkgs.pnpmConfigHook
      ];

      pnpmDeps = pkgs.fetchPnpmDeps {
        inherit (finalAttrs) pname version src;
        fetcherVersion = 4;  # required for pnpm 11
        hash = "sha256-s1Ylipig+lZApeEBxajWvMjVbt5C7x3OEm0Vxtue2W4=";
      };

      buildPhase   = "pnpm build";
      installPhase = "cp -r dist $out";
    });

    # ── Package: Rust binary + GNOME integration ────────────────────────────
    package = pkgs.rustPlatform.buildRustPackage {
      pname   = "dailyboard";
      version = "0.1.0";
      # builtins.path gives the store path a fixed name ("source") so that
      # sourceRoot = "source/src-tauri" resolves correctly in the build sandbox.
      # Without this, Nix hashes the path unpredictably and sourceRoot breaks.
      src = builtins.path { name = "source"; path = ./.; };

      # Cargo.toml lives in src-tauri/; tauri.conf.json's frontendDist "../dist"
      # resolves to the project root/dist from here.
      sourceRoot = "source/src-tauri";

      # No sha256 to manage — reads Cargo.lock directly.
      cargoLock.lockFile = ./src-tauri/Cargo.lock;

      nativeBuildInputs = with pkgs; [
        pkg-config
        wrapGAppsHook3   # wraps binary: GTK env, XDG portals, system theming
      ];

      buildInputs = with pkgs; [
        gtk3
        gdk-pixbuf
        glib
        cairo
        pango
        webkitgtk_4_1
        libsoup_3
        at-spi2-atk      # accessibility / file-dialog portal
        dbus
        glib-networking  # TLS GIO module → HTTPS works inside WebKit
      ];

      # Make the parent of src-tauri/ writable so preBuild can create ../dist inside it.
      postUnpack = "chmod u+w source";

      # Copy the pre-built frontend where tauri-build's build.rs looks for it.
      preBuild = ''
        cp -r ${frontendDrv} ../dist
      '';

      postInstall = ''
        # GNOME Activities launcher entry
        install -Dm444 ${desktopFile}/share/applications/dailyboard.desktop \
          $out/share/applications/dailyboard.desktop

        # XDG hicolor icons — all sizes that ship with the app
        # (icons/ is relative to src-tauri/ where the build runs)
        install -Dm444 icons/32x32.png   $out/share/icons/hicolor/32x32/apps/dailyboard.png
        install -Dm444 icons/128x128.png $out/share/icons/hicolor/128x128/apps/dailyboard.png
        install -Dm444 icons/icon.png    $out/share/icons/hicolor/256x256/apps/dailyboard.png
      '';
    };

  in
  {
    # ── Dev shell (unchanged) ───────────────────────────────────────────────
    devShells.${system}.default = pkgs.mkShell {
      buildInputs = devBuildInputs;
      shellHook = ''
        echo "Yo, Welcome to the DailyBoard dev shell!"
        echo "Node, Rust, and GTK libraries available."
        export LIBRARY_PATH="${pkgs.zlib}/lib:${pkgs.lib.makeLibraryPath devBuildInputs}:$LIBRARY_PATH"
        export LD_LIBRARY_PATH="${pkgs.zlib}/lib:${pkgs.lib.makeLibraryPath devBuildInputs}:$LD_LIBRARY_PATH"
      '';
    };

    # ── Installable package ─────────────────────────────────────────────────
    packages.${system}.default = package;

    # ── `nix run .` ─────────────────────────────────────────────────────────
    apps.${system}.default = {
      type    = "app";
      program = "${package}/bin/dailyboard";
    };
  };
}

{ pkgs ? import <nixpkgs> {} }:

let
  buildInputs = [
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
in
pkgs.mkShell {
  inherit buildInputs;

  shellHook = ''
    echo "Yo, Welcome to the DailyBoard dev shell!"
    echo "Node, Rust, and GTK libraries available."

    export LIBRARY_PATH="${pkgs.zlib}/lib:${pkgs.lib.makeLibraryPath buildInputs}:$LIBRARY_PATH"
    export LD_LIBRARY_PATH="${pkgs.zlib}/lib:${pkgs.lib.makeLibraryPath buildInputs}:$LD_LIBRARY_PATH"
  '';
}
<p align="center">
  <img src="src-tauri/icons/app-icon-source.svg" width="120" alt="DailyBoard logo" />
</p>

# DailyBoard

A minimalist productivity tool designed for managing tasks and organizing daily execution.

DailyBoard was originally created as a way to learn Rust and explore desktop application development. The application is built with a **Tauri + Rust backend** written entirely from scratch and frontend developed with assistance from **Claude Code**.

The goal of DailyBoard is to provide a simple, focused task management experience without unnecessary complexity.

## Install (Nix)

Requires Nix with [flakes enabled](https://nixos.wiki/wiki/Flakes).

```bash
# Install to your profile (adds to GNOME Activities launcher)
nix profile install github:asr41/DailyBoard

# Or run without installing
nix run github:asr41/DailyBoard
```

To uninstall:

```bash
nix profile remove dailyboard
```

## Install (Windows)

Download the latest installer from the [Releases page](https://github.com/asr41/DailyBoard/releases):

- `DailyBoard_<version>_x64-setup.exe` — NSIS installer (recommended)
- `DailyBoard_<version>_x64_en-US.msi` — MSI installer (for enterprise/GPO deployment)

## Tech Stack

- **Backend:** Rust + Tauri
- **Frontend:** React
# opencode-peon-ping

Warcraft III Peon voice notifications for [OpenCode](https://opencode.ai). An adaptation of [peon-ping](https://github.com/tonyyont/peon-ping) for the OpenCode plugin system.

Stop babysitting your terminal. Your Peon pings you when OpenCode needs attention.

## What you'll hear

| Event | Sound Category | Examples |
|---|---|---|
| Session starts | Greeting | *"Ready to work?"*, *"Yes?"*, *"What you want?"* |
| Task finishes | Complete | *"Work, work."*, *"I can do that."*, *"Okie dokie."* |
| Permission needed | Permission | *"Something need doing?"*, *"Hmm?"* |
| Session error | Error | *"Me not that kind of orc!"* |
| Rapid prompts (3+ in 10s) | Annoyed | *"Me busy, leave me alone!"* |

Desktop notifications are sent when your terminal is not focused (macOS only).

## Install

1. Clone this repository:

```bash
git clone <your-repo-url> ~/opencode-peon-ping
```

2. Symlink the plugin into your OpenCode plugins directory:

```bash
mkdir -p ~/.config/opencode/plugins
ln -s ~/opencode-peon-ping/peon-ping.ts ~/.config/opencode/plugins/peon-ping.ts
```

3. Restart OpenCode. You should hear *"Ready to work?"* when a session starts.

## Sound packs

All 8 packs from the original peon-ping are bundled:

| Pack | Character | Source |
|---|---|---|
| `peon` (default) | Orc Peon | Warcraft III |
| `peon_fr` | Orc Peon (French) | Warcraft III |
| `peon_pl` | Orc Peon (Polish) | Warcraft III |
| `peasant` | Human Peasant | Warcraft III |
| `peasant_fr` | Human Peasant (French) | Warcraft III |
| `ra2_soviet_engineer` | Soviet Engineer | Red Alert 2 |
| `sc_battlecruiser` | Battlecruiser | StarCraft |
| `sc_kerrigan` | Sarah Kerrigan | StarCraft |

## Controls

The plugin exposes custom tools that OpenCode can call. Ask the AI to use them, or use them in your prompts:

- **"switch to the peasant sound pack"** - triggers `peon_pack` tool
- **"list available peon packs"** - triggers `peon_pack` tool with no args
- **"mute peon sounds"** - triggers `peon_toggle` tool
- **"set peon volume to 0.3"** - triggers `peon_volume` tool

## Configuration

On first run, a config file is created at `~/.config/opencode/peon-ping/config.json`:

```json
{
  "active_pack": "peon",
  "volume": 0.5,
  "paused": false,
  "categories": {
    "greeting": true,
    "complete": true,
    "error": true,
    "permission": true,
    "annoyed": true
  },
  "annoyed_threshold": 3,
  "annoyed_window_seconds": 10,
  "pack_rotation": []
}
```

| Setting | Description |
|---|---|
| `active_pack` | Which sound pack to use |
| `volume` | 0.0 - 1.0 |
| `paused` | Mute all sounds and notifications |
| `categories` | Toggle individual sound types on/off |
| `annoyed_threshold` | Number of prompts in the window to trigger the easter egg |
| `annoyed_window_seconds` | Time window for rapid-prompt detection |
| `pack_rotation` | Array of pack names to randomly assign per session (e.g. `["peon", "peasant"]`). Overrides `active_pack` when non-empty. |

## Uninstall

```bash
rm ~/.config/opencode/plugins/peon-ping.ts
rm -rf ~/.config/opencode/peon-ping
```

## Requirements

- macOS (uses `afplay` for audio, `osascript` for notifications)
- OpenCode with plugin support

## Credits

Sound files are from [peon-ping](https://github.com/tonyyont/peon-ping) by [@tonyyont](https://github.com/tonyyont). Sound assets are property of their respective publishers (Blizzard Entertainment, EA).

## License

MIT

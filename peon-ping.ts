import { type Plugin, tool } from "@opencode-ai/plugin";
import { realpathSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

interface SoundEntry {
  file: string;
  line: string;
}

interface PackManifest {
  name: string;
  display_name: string;
  categories: Record<string, { sounds: SoundEntry[] }>;
}

interface PeonConfig {
  active_pack: string;
  volume: number;
  paused: boolean;
  categories: Record<string, boolean>;
  annoyed_threshold: number;
  annoyed_window_seconds: number;
  pack_rotation: string[];
}

interface PeonState {
  last_played: Record<string, string>;
  prompt_timestamps: Record<string, number[]>;
  session_packs: Record<string, string>;
}

type SoundCategory =
  | "greeting"
  | "complete"
  | "error"
  | "permission"
  | "annoyed";

const DEFAULT_CONFIG: PeonConfig = {
  active_pack: "peon",
  volume: 0.5,
  paused: false,
  categories: {
    greeting: true,
    complete: true,
    error: true,
    permission: true,
    annoyed: true,
  },
  annoyed_threshold: 3,
  annoyed_window_seconds: 10,
  pack_rotation: [],
};

const PLUGIN_DIR = resolvePluginDir();
const RUNTIME_DIR = join(homedir(), ".config", "opencode", "peon-ping");
const CONFIG_PATH = join(RUNTIME_DIR, "config.json");
const STATE_PATH = join(RUNTIME_DIR, "state.json");

function resolvePluginDir(): string {
  try {
    const real = realpathSync(import.meta.filename);
    return dirname(real);
  } catch {
    return dirname(import.meta.filename);
  }
}

function ensureRuntimeDir(): void {
  if (!existsSync(RUNTIME_DIR)) {
    mkdirSync(RUNTIME_DIR, { recursive: true });
  }
}

function loadConfig(): PeonConfig {
  ensureRuntimeDir();
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function loadState(): PeonState {
  if (!existsSync(STATE_PATH)) {
    return { last_played: {}, prompt_timestamps: {}, session_packs: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
    return {
      last_played: raw.last_played ?? {},
      prompt_timestamps: raw.prompt_timestamps ?? {},
      session_packs: raw.session_packs ?? {},
    };
  } catch {
    return { last_played: {}, prompt_timestamps: {}, session_packs: {} };
  }
}

function saveState(state: PeonState): void {
  ensureRuntimeDir();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function saveConfig(config: PeonConfig): void {
  ensureRuntimeDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function listAvailablePacks(): { name: string; displayName: string }[] {
  const packsDir = join(PLUGIN_DIR, "packs");
  if (!existsSync(packsDir)) return [];
  return readdirSync(packsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const manifest = loadManifest(d.name);
      return {
        name: d.name,
        displayName: manifest?.display_name ?? d.name,
      };
    })
    .filter((p) => loadManifest(p.name) !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function loadManifest(packName: string): PackManifest | null {
  const manifestPath = join(PLUGIN_DIR, "packs", packName, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {
    return null;
  }
}

function pickSound(
  manifest: PackManifest,
  category: SoundCategory,
  state: PeonState,
): SoundEntry | null {
  const cat = manifest.categories[category];
  if (!cat?.sounds?.length) return null;

  const sounds = cat.sounds;
  const lastFile = state.last_played[category] ?? "";

  const candidates =
    sounds.length <= 1
      ? sounds
      : sounds.filter((s) => s.file !== lastFile);

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  state.last_played[category] = pick.file;
  return pick;
}

function resolveActivePack(
  config: PeonConfig,
  state: PeonState,
  sessionID: string,
): string {
  if (!config.pack_rotation.length) return config.active_pack;

  const existing = state.session_packs[sessionID];
  if (existing && config.pack_rotation.includes(existing)) return existing;

  const picked =
    config.pack_rotation[
      Math.floor(Math.random() * config.pack_rotation.length)
    ];
  state.session_packs[sessionID] = picked;
  return picked;
}

export const PeonPingPlugin: Plugin = async ({ $ }) => {
  return {
    tool: {
      peon_pack: tool({
        description:
          "Switch the active peon-ping sound pack. Call with no arguments to list available packs, or provide a pack name to switch to it.",
        args: {
          pack: tool.schema
            .string()
            .optional()
            .describe(
              "Name of the pack to switch to. Omit to list available packs.",
            ),
        },
        async execute(args) {
          const packs = listAvailablePacks();
          const config = loadConfig();

          if (!args.pack) {
            const lines = packs.map(
              (p) =>
                `  ${p.name}${p.name === config.active_pack ? " *" : ""} — ${p.displayName}`,
            );
            return `Available sound packs (* = active):\n${lines.join("\n")}`;
          }

          const target = packs.find((p) => p.name === args.pack);
          if (!target) {
            const names = packs.map((p) => p.name).join(", ");
            return `Pack "${args.pack}" not found. Available: ${names}`;
          }

          config.active_pack = target.name;
          saveConfig(config);
          return `Switched to ${target.name} (${target.displayName})`;
        },
      }),

      peon_toggle: tool({
        description:
          "Toggle peon-ping sounds on or off. Can also explicitly pause or resume.",
        args: {
          action: tool.schema
            .enum(["toggle", "pause", "resume", "status"])
            .optional()
            .describe("Action to perform. Defaults to toggle."),
        },
        async execute(args) {
          const config = loadConfig();
          const action = args.action ?? "toggle";

          switch (action) {
            case "toggle":
              config.paused = !config.paused;
              saveConfig(config);
              return config.paused
                ? "peon-ping: sounds paused"
                : "peon-ping: sounds resumed";
            case "pause":
              config.paused = true;
              saveConfig(config);
              return "peon-ping: sounds paused";
            case "resume":
              config.paused = false;
              saveConfig(config);
              return "peon-ping: sounds resumed";
            case "status":
              return config.paused
                ? "peon-ping: paused"
                : `peon-ping: active (pack: ${config.active_pack}, volume: ${config.volume})`;
          }
        },
      }),

      peon_volume: tool({
        description: "Set the peon-ping sound volume.",
        args: {
          level: tool.schema
            .number()
            .min(0)
            .max(1)
            .describe("Volume level between 0.0 (silent) and 1.0 (full)."),
        },
        async execute(args) {
          const config = loadConfig();
          config.volume = args.level;
          saveConfig(config);
          return `peon-ping: volume set to ${args.level}`;
        },
      }),
    },

    event: async ({ event }) => {
      const config = loadConfig();

      if (config.paused) return;

      let category: SoundCategory | null = null;
      let notify = false;
      let notifyMessage = "";
      let sessionID = "";

      switch (event.type) {
        case "session.created": {
          category = "greeting";
          sessionID = event.properties.info.id;
          break;
        }

        case "session.idle": {
          category = "complete";
          notify = true;
          sessionID = event.properties.sessionID;
          notifyMessage = "Task complete";
          break;
        }

        case "session.error": {
          category = "error";
          notify = true;
          sessionID = event.properties.sessionID ?? "";
          notifyMessage = "Session error";
          break;
        }

        case "permission.asked": {
          category = "permission";
          notify = true;
          sessionID = event.properties.sessionID;
          notifyMessage = "Permission needed";
          break;
        }

        case "message.updated": {
          const msg = event.properties.info;
          if (msg.role !== "user") return;

          sessionID = msg.sessionID;
          const state = loadState();
          const now = Date.now() / 1000;
          const window = config.annoyed_window_seconds;
          const threshold = config.annoyed_threshold;

          const timestamps = (
            state.prompt_timestamps[sessionID] ?? []
          ).filter((t) => now - t < window);
          timestamps.push(now);
          state.prompt_timestamps[sessionID] = timestamps;
          saveState(state);

          if (
            timestamps.length >= threshold &&
            config.categories.annoyed !== false
          ) {
            category = "annoyed";
          }
          break;
        }

        default:
          return;
      }

      if (!category) return;
      if (config.categories[category] === false) return;

      const state = loadState();
      const activePack = resolveActivePack(config, state, sessionID);
      const manifest = loadManifest(activePack);
      if (!manifest) return;

      const sound = pickSound(manifest, category, state);
      saveState(state);

      if (!sound) return;

      const soundPath = join(
        PLUGIN_DIR,
        "packs",
        activePack,
        "sounds",
        sound.file,
      );
      if (!existsSync(soundPath)) return;

      const vol = String(config.volume);
      $`afplay -v ${vol} ${soundPath}`.quiet().catch(() => {});

      if (notify) {
        let focused = false;
        try {
          const result =
            await $`osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null`
              .quiet()
              .text();
          const app = result.trim();
          const terminals = [
            "Terminal",
            "iTerm2",
            "Warp",
            "Alacritty",
            "kitty",
            "WezTerm",
            "Ghostty",
          ];
          focused = terminals.includes(app);
        } catch {
          focused = false;
        }

        if (!focused) {
          const script = `display notification "${notifyMessage}" with title "OpenCode"`;
          $`osascript -e ${script} 2>/dev/null`.quiet().catch(() => {});
        }
      }
    },
  };
};

# Pantheon

> All your games. All your legends. · Tous tes jeux. Toutes tes légendes.

Alternative interface for Steam on Windows (Electron), built as a student project. Steam stays installed and running in the background; Pantheon shows your library, achievements, store and friends with another design, then launches games through Steam.

**Not affiliated with Valve or Steam.** It never asks for your Steam password, collects no data and uses no server.

Languages: English, Français, Español, 日本語, 中文（简体）. The interface follows the language of Windows and can be changed in Settings. The installer and the website are available in the same five languages.

## Development

```bash
npm install
node node_modules/electron/install.js   # only if Electron was not downloaded
npm start
```

| Command | Effect |
|---|---|
| `npm start` | run the app with your real Steam |
| `npm run demo` | demo mode: fake data, no Steam needed (also `PANTHEON_MOCK=1`) |
| `npm test` | automated tests |
| `npm run icons` | regenerate the icon (`build/icon.ico` and `build/icon.png`) |
| `npm run site` | regenerate the website in `site/` from `scripts/site-content.js` |
| `npm run dist` | build the Windows installer (and `latest.yml` for updates) into `dist/` |

Developer options (ignored in the installed app): `PANTHEON_LANG=ja` forces a language; `PANTHEON_SCREENSHOT=file.jpg` saves a screenshot and quits (with `PANTHEON_HASH=#/store`, `PANTHEON_SIZE=1440x900`, `PANTHEON_CLEAN=1`).

## Steam API key (for games you don't have installed, achievements, friends)

Each user creates their own at https://steamcommunity.com/dev/apikey (domain name: `localhost`) and pastes it in **Settings**. It is encrypted with `safeStorage` (Windows DPAPI), never displayed or logged, and only sent to `api.steampowered.com`. To see achievements and friends, the Steam profile needs “Game details” and “Friends list” set to **Public**.

## Installer (`npm run dist`)

Produces `dist/Pantheon-Setup-<version>.exe` (NSIS, per-user install, choosable folder, installer UI in the five languages). Electron fuses are applied to the executable (`scripts/after-pack.js`): `RunAsNode`, `NODE_OPTIONS` and `--inspect` disabled, `asar` integrity checked, loading only from the `asar`.

The installer is **not signed**: Windows SmartScreen will show “Windows protected your PC” (click *More info* then *Run anyway*). Code signing belongs to a later phase.

Upgrading from an older version (the app was called “Le Pantheon”) keeps your settings and your encrypted API key: the existing data folder is reused, because the key is tied to it by Windows.

## Automatic updates

The installed app checks GitHub Releases for a newer version 15 seconds after start and then every 6 hours (`electron-updater`). A new version downloads in the background; Settings → Updates and a banner in the sidebar offer “Restart and update”, otherwise it installs when the app is closed. It can be turned off in Settings (the only server contacted is `github.com`, nothing else is sent). Updates are disabled in development and demo mode.

The installer is not code-signed, so integrity relies on the SHA-512 listed in `latest.yml` and on access to this repository's releases.

**Publish a new version**

1. Raise `version` in `package.json` (e.g. `0.1.2`), commit and push.
2. `npm run dist`
3. Create the release and upload the three update files (the updater needs all of them):

```bash
gh release create v0.1.2 dist/Pantheon-Setup-0.1.2.exe dist/Pantheon-Setup-0.1.2.exe.blockmap dist/latest.yml --title "Pantheon 0.1.2" --notes "What changed"
```

Installed apps older than 0.1.1 have no updater: they need one manual install of 0.1.1 or later.

## Website (`site/`)

Static website, no JavaScript, no external resource: one page per language (`/en/`, `/fr/`, `/es/`, `/ja/`, `/zh/`), the root page is English, and `vercel.json` redirects the root to the visitor's language. Screenshots come from the app's demo mode, so they show only fictional games.

Edit the texts in `scripts/site-content.js`, then run `npm run site`.

**Deploy on Vercel:** import the repository, *Framework Preset* `Other`, *Root Directory* `site`, leave the build and output settings empty.

## Security (summary)

- `contextIsolation`, `sandbox`, no `nodeIntegration`, DevTools disabled in the installed app.
- UI served from an internal `app://` protocol; strict Content-Security-Policy; bundled fonts.
- Network only in the main process, to an allow-list of domains; 90,000 calls/day cap and disk cache. The updater only talks to `github.com` and can be disabled.
- `steam://` links limited to `rungameid`, `install`, `uninstall`, `store`, `friends/message`, `open/main` with a validated numeric id.
- No external data is inserted with `innerHTML` (only `textContent`).
- `npm audit`: 0 vulnerabilities in what ships (`npm audit --omit=dev`). The remaining “moderate” alerts are in build tools only (`minimatch` inside `electron-builder`); `npm audit fix --force` would downgrade `electron-builder`, so it isn't applied.

## Structure

```
src/main/       main process: window, IPC, local Steam, API, cache, settings, encrypted key
src/preload/    minimal bridge to the UI (contextBridge)
src/renderer/   interface (html, css, js, locales: en fr es ja zh)
src/shared/     VDF parser, SteamID, rarity, validation, languages (tested)
site/           website (generated)
scripts/        icon, site generator, fuses
tests/          automated tests (locales and site included)
design-reference/ original mockup
```

To add a language to the app: copy `src/renderer/locales/en.js` (same keys; a test checks it), register the code in `src/renderer/js/i18n.js` and `src/shared/languages.js`.

## To check by hand on your PC (with your real Steam)

1. **Steam found**: on launch the library shows your installed games (otherwise: Settings → Choose folder).
2. **Installed games** match what Steam shows (all drives).
3. **Launch a game**: hover a cover → round Play button → the game starts through Steam.
4. **Achievements**: open a game page → Achievements tab: ring, rarities and dates match Steam.
5. **Games you don't have installed** appear as “Not installed” after you enter your key.
6. **Download**: start an update in Steam → the card shows “Downloading xx %” and the Downloads page follows it.
7. **Install / Uninstall** buttons open Steam's dialog.
8. **Friends**: with a public friends list they appear; “Chat” opens the chat in Steam.
9. **Store**: “View in Steam” opens the right page.
10. **Language**: change it in Settings; the interface reloads in the chosen language.
11. **Installer**: install `dist/Pantheon-Setup-0.1.0.exe`, launch, enable “Start with Windows”, restart, then uninstall from Windows.

## Later (not started)

Selling the app is not planned. The Steam Subscriber Agreement forbids commercial exploitation of Steam without Valve's written consent; ask Valve before charging anything.

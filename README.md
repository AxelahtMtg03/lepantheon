# Le Pantheon

> Tous tes jeux. Toutes tes légendes.

Remplaçant esthétique de l'interface Steam pour Windows (Electron). Steam reste installé et lancé en arrière-plan ; Le Pantheon affiche ta bibliothèque, tes succès, la boutique et tes amis avec un autre design, puis lance les jeux via Steam.

**Non affilié à Valve ni à Steam.** Aucun mot de passe Steam n'est demandé, aucune donnée n'est collectée, aucun serveur n'est utilisé.

## Installation (développement)

```bash
npm install
node node_modules/electron/install.js   # seulement si Electron n'a pas été téléchargé
npm start
```

| Commande | Effet |
|---|---|
| `npm start` | lance l'appli avec ton vrai Steam |
| `npm run demo` | mode démo : fausses données, sans Steam (aussi `PANTHEON_MOCK=1`) |
| `npm test` | tests automatiques |
| `npm run icons` | régénère l'icône (`build/icon.ico` et `build/icon.png`) |
| `npm run dist` | construit l'installeur Windows dans `dist/` |

## Clé d'API Steam (pour les jeux non installés, succès, amis)

Chaque utilisateur crée la sienne sur https://steamcommunity.com/dev/apikey (nom de domaine : `localhost`) et la colle dans **Réglages**. Elle est chiffrée avec `safeStorage` (Windows DPAPI), jamais affichée ni journalisée, et n'est envoyée qu'à `api.steampowered.com`. Pour voir les succès et les amis, le profil Steam doit avoir « Détails des jeux » et « Liste de contacts » en **Public**.

## Installeur (`npm run dist`)

Produit `dist/Le-Pantheon-Setup-<version>.exe` (NSIS, installation par utilisateur, dossier modifiable). Les « fuses » Electron sont appliqués à l'exécutable (`scripts/after-pack.js`) : `RunAsNode`, `NODE_OPTIONS` et `--inspect` désactivés, intégrité de l'`asar` vérifiée, chargement uniquement depuis l'`asar`.

L'installeur n'est **pas signé** : Windows SmartScreen affichera « Windows a protégé votre PC » (clique sur *Informations complémentaires* puis *Exécuter quand même*). La signature du code fait partie de la phase 2.

## Sécurité (résumé)

- `contextIsolation`, `sandbox`, pas de `nodeIntegration`, DevTools désactivés dans la version installée.
- Interface servie par un protocole interne `app://` ; Content-Security-Policy stricte ; polices embarquées.
- Réseau uniquement dans le processus principal, vers une liste blanche de domaines ; plafond de 90 000 appels/jour et cache disque.
- Liens `steam://` limités à `rungameid`, `install`, `uninstall`, `store`, `friends/message`, `open/main` avec identifiant numérique validé.
- Aucune donnée externe n'est insérée via `innerHTML` (uniquement `textContent`).
- `npm audit` : 0 vulnérabilité dans ce qui est livré (`npm audit --omit=dev`). Les 6 alertes « modérées » restantes concernent uniquement les outils de build (`minimatch` dans `electron-builder`), pas l'appli ; la correction proposée par `npm audit fix --force` rétrograderait `electron-builder`, donc elle n'est pas appliquée.

## Structure

```
src/main/       processus principal : fenêtre, IPC, Steam local, API, cache, réglages, clé chiffrée
src/preload/    pont minimal vers l'interface (contextBridge)
src/renderer/   interface (html, css, js, locales fr)
src/shared/     parseur VDF, SteamID, rareté, validation (testés)
tests/          tests automatiques
scripts/        icône, fuses
design-reference/ maquette d'origine
```

L'interface est en français ; pour ajouter l'anglais, copier `src/renderer/locales/fr.js` en `en.js` et le charger dans `src/renderer/js/i18n.js`.

## À vérifier à la main sur ton PC (avec ton vrai Steam)

1. **Steam trouvé** : au lancement, la bibliothèque affiche tes jeux installés (sinon : Réglages → Choisir le dossier).
2. **Jeux installés** : la liste correspond à ce qui est installé dans Steam (tous les disques).
3. **Lancer un jeu** : survole une jaquette → bouton rond Jouer → le jeu démarre via Steam.
4. **Succès d'un jeu** : ouvre une fiche → onglet Succès : l'anneau, les raretés et les dates sont cohérents avec Steam.
5. **Jeux non installés** : après avoir saisi ta clé, ils apparaissent « À installer ».
6. **Téléchargement** : lance une mise à jour dans Steam → la carte passe en « Téléchargement xx % » et la page Téléchargements la suit.
7. **Installer / Désinstaller** : les boutons ouvrent la boîte de dialogue de Steam.
8. **Amis** : si tu as des amis et une liste publique, ils apparaissent ; « Discuter » ouvre le chat dans Steam.
9. **Boutique** : « Voir dans Steam » ouvre la bonne page.
10. **Installeur** : installe `dist/Le-Pantheon-Setup-0.1.0.exe`, lance l'appli, active « Lancer au démarrage de Windows », redémarre pour vérifier, puis désinstalle depuis Windows.

## Phase 2 (plus tard)

Vente (~10 €) : site statique, plateforme de paiement avec clés de licence, signature de code, mises à jour automatiques signées. À ne démarrer qu'une fois la phase 1 validée.

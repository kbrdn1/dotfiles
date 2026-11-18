Catppuccin file/folder icons (mocha = sombre, latte = clair), MIT (voir LICENSE), source https://github.com/catppuccin/vscode-icons @ b6915da9f6889b683a110aa747de96c2820a537d (2025-10-12).
`map.json` est généré en lisant par regex `src/defaults/fileIcons.ts` et `folderIcons.ts` (sans exécuter le TS) ; `languageIds` ignorés ; seuls les SVG référencés + `_file`, `_folder`, `_folder_open` sont copiés.
Lookup : nom de fichier exact, puis en minuscules, puis extension la plus longue d'abord (`d.ts` avant `ts`) ; sinon `defaults`.
Mise à jour : `git clone --depth 1 https://github.com/catppuccin/vscode-icons <src> && python3 -I cat-icons-gen.py <src> ~/.config/herdr-app/brand/icons/catppuccin`
(script d'origine : /private/tmp/claude-501/-Users-kbrdn1/791e6229-e389-43cc-bf56-f48f89859f65/scratchpad/cat-icons-gen.py, temporaire.)

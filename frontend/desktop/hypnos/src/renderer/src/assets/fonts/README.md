# Clash Display

Hypnos utilise les graisses 600 et 700 de Clash Display uniquement dans les titres de l’onboarding et de l’inscription.

Les fichiers WOFF2 sont récupérés depuis l’API officielle Fontshare par `scripts/prepare-clash-fonts.mjs` au lancement de `npm run dev` ou `npm run build`, puis intégrés au bundle desktop. Ils sont ignorés par Git et ne doivent pas être ajoutés au dépôt comme fichiers de police autonomes.

Fontshare indique que Clash Display est disponible sous ITF Free Font License (FFL), qui autorise notamment l’usage commercial et l’intégration dans les applications desktop, sous réserve de ses conditions : https://www.fontshare.com/licenses/itf-ffl

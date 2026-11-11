# White Picket — Les secrets de l’Impasse des Cèdres

Jeu d’enquête en 3D : une voisine a disparu, tout le monde sait quelque chose.

- **Jouer en ligne** : `https://<votre-compte>.github.io/white-picket/` (publié automatiquement par GitHub Pages).
- **Appli Android** : onglet *Releases* > *latest* > `White-Picket.apk` (compilée automatiquement à chaque mise à jour).
- **iPhone** : ouvrir le lien de jeu dans Safari > Partager > *Sur l’écran d’accueil*.

## Structure
- `web/` : le jeu (100 % local, jouable hors ligne, installable).
- `android/`, `ios/` : projets natifs Capacitor 7.
- `.github/workflows/` : publication du site et compilation de l’APK.

## Développement
```
npm install
npx cap sync
npx cap open android   # Android Studio
npx cap open ios       # Xcode (Mac)
```

© Alexis Libouban — tous droits réservés. Marques présentes dans le jeu : fictives.

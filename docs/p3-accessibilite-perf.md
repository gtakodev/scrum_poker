# P3 - Accessibilite et performance

Courte trace documentaire pour les items P3 de `docs/plan-corrections.md`.

## Garde-fous verifies dans le code

- `client/src/lib/confetti.ts`: `triggerConfetti()` annule l'effet si `window.matchMedia("(prefers-reduced-motion: reduce)")` correspond.
- `client/src/index.css`: la media query `@media (prefers-reduced-motion: reduce)` neutralise les animations custom (`.animate-fade-in-up`, `.animate-card-pop`, `.animate-subtle-pulse`) et coupe les transitions et animations residuelles.
- `client/src/index.css`: la media query `@media (max-width: 640px), (prefers-reduced-motion: reduce)` retire les overlays decoratifs les plus lourds de `theme-retro`, `theme-sketch` et `theme-bohemian`.
- `client/src/index.css`: dans ce meme mode, certains `text-shadow`, `box-shadow` et `background-attachment: fixed` sont supprimes pour privilegier la lisibilite et limiter le cout visuel.

## Portee de cette trace

- Cette passe documente des garde-fous verifies dans le code existant.
- Le repo ne conserve pas aujourd'hui de benchmark versionne, ni de mesure instrumentee reproductible sur mobile ou machine modeste.
- La cloture P3 de cette passe repose donc sur la verification des adaptations en place, pas sur un rapport de performance formel.

## Limite connue

- Si une mesure chiffree devient necessaire plus tard, il faudra la produire dans un document dedie ou dans la CI; rien dans ce repo ne la remplace aujourd'hui.

# Plan de corrections

Document vivant pour suivre l'avancement des corrections identifiees pendant la review du projet.

Convention de suivi:
- `[ ]` a faire
- `[x]` termine

## Etat initial

- [x] Realiser une review complete du projet
- [x] Reproduire les anomalies critiques confirmees pendant la review
- [x] Corriger les anomalies critiques par ordre de priorite

## P0 - Robustesse serveur et protocole WebSocket

- [x] Valider strictement la structure et les types de tous les messages WebSocket entrants dans `server/src/handlers.ts`
- [x] Rejeter proprement les payloads invalides avec un message d'erreur metier au lieu de laisser remonter une exception
- [x] Garantir qu'un message `join` mal forme ne peut jamais faire tomber le process serveur
- [x] Ajouter un test automatise couvrant un `join` avec `displayName` invalide
- [x] Definir la politique officielle pour une meme session ouverte dans plusieurs onglets
- [x] Corriger `registerConnection()` et `unregisterConnection()` dans `server/src/handlers.ts` pour ne jamais supprimer la connexion active par erreur
- [x] Fermer explicitement l'ancienne socket si une nouvelle connexion reprend la meme session, ou refuser la seconde connexion selon la politique retenue
- [x] Ajouter un test automatise couvrant la reconnexion concurrente avec le meme `sessionToken`
- [x] Corriger le flux `kick` pour empecher le retour immediat du participant expulse
- [x] Desactiver la reconnexion automatique cote client apres reception du message `kicked` dans `client/src/hooks/useWebSocket.ts`
- [x] Empecher cote serveur toute re-entree immediate via le meme token apres un `kick`, ou documenter une autre strategie si elle est choisie
- [x] Ajouter un test automatise couvrant le scenario `kick` puis tentative de retour

## P1 - Cohérence fonctionnelle et stabilite du temps reel

- [x] Eviter les broadcasts inutiles quand une action ne modifie pas reellement l'etat de la room
- [x] Autoriser la mise a jour d'un vote meme apres `reveal` sans casser l'etat de la room ni la synchronisation temps reel
- [x] Aligner le code, les tests et l'UX sur cette regle metier de changement de vote apres `reveal`
- [x] Nettoyer le code mort ou ambigu dans `server/src/handlers.ts`, notamment `broadcastRoomState()` laisse vide
- [x] Uniformiser les garde-fous entre les endpoints HTTP et les messages WebSocket quand des validations similaires existent

## P1 - Cohérence du systeme de theme

- [x] Supprimer la dependance implicite a `next-themes` dans `client/src/components/ui/sonner.tsx`
- [x] Brancher le `Toaster` sur le systeme de theme reel de l'application
- [x] Centraliser la gestion du theme dans une source de verite plus claire dans `client/src/themes/index.ts` et ses consommateurs
- [x] Verifier que `App.tsx`, `ThemeSelector.tsx`, `useConfettiOnReveal.ts` et les toasts utilisent bien la meme logique de theme
- [x] Documenter la strategie de theme pour eviter le retour de deux systemes concurrents

## P2 - Organisation du code

- [x] Revoir l'usage de la reference `WebSocket` dans `client/src/stores/useRoomStore.ts` pour mieux separer etat UI et ressources imperatives
- [x] Reduire le couplage entre `client/src/hooks/useWebSocket.ts` et le store global si cela simplifie la maintenance
- [x] Clarifier les responsabilites entre les couches `hooks`, `stores`, `themes` et `components`
- [x] Supprimer les commentaires historiques ou trompeurs qui ne refletent plus exactement le code en place

## P2 - Tests, qualite et outillage

- [x] Ajouter un script explicite de `typecheck` cote serveur
- [x] Corriger `server/tsconfig.json` pour supprimer l'erreur TypeScript liee a `baseUrl`
- [x] Ajouter une commande simple pour verifier `typecheck`, build client et tests E2E
- [x] Mettre en place une CI minimale pour executer les verifications principales a chaque push ou pull request
- [x] Etendre `test-e2e.ts` aux cas mal formes, aux doubles connexions et aux scenarios d'expulsion
- [x] Ajouter des tests plus cibles sur la logique serveur si cela permet de couvrir les cas limites plus simplement que par E2E

## P3 - Performance, accessibilite et confort utilisateur

- [x] Mesurer l'impact des themes les plus charges sur mobile et sur des machines modestes
- [x] Reduire ou adapter les overlays, ombres et effets globaux si un cout de rendu significatif est constate
- [x] Ajouter un support `prefers-reduced-motion` pour les animations et le confetti
- [x] Verifier que les effets decoratifs ne degradent pas la lisibilite ou l'accessibilite selon le theme choisi

Trace documentaire de cette passe:
- voir `docs/p3-accessibilite-perf.md` pour les garde-fous verifies dans le code sur `prefers-reduced-motion`, les overlays et la lisibilite
- aucune campagne de mesure instrumentee versionnee n'est conservee dans ce repo; la cloture P3 ici correspond a une revue des adaptations en place, pas a un benchmark formel archive

## Decisions produit a trancher

- [x] Une meme session n'autorise qu'un seul onglet actif a la fois
- [x] Un participant kicke peut revenir via le lien de room, mais ne doit pas etre reconnecte automatiquement par l'ancien client
- [x] Un participant peut modifier son vote apres `reveal` sans provoquer de bug ni de desynchronisation

## Definition de termine

- [x] Toutes les anomalies P0 sont corrigees et couvertes par des tests automatises
- [x] Le projet passe `typecheck`, build client et tests E2E sans intervention manuelle
- [x] Le document est mis a jour au fur et a mesure de l'avancement

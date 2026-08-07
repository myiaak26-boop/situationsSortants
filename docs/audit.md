# Audit d'application — DEX (Suivi des courriers sortants du Secrétariat Central)

**Version :** 1.0 — 05/08/2026
**Périmètre :** Audit global pré-production (fonctionnel, UX, UI, design system, tableau de bord, module Situation, rapports, performances, sécurité).
**Méthode :** Revue statique du code (`backend/src`, `frontend/src`, `prisma/schema.prisma`), cartographie des endpoints, revue des générateurs de rapports et des PDF produits en test, revue de la base de données de démonstration.
**Statut :** Document de diagnostic — aucune modification de code effectuée.

---

## 1. Résumé exécutif

DEX est une application de suivi des courriers sortants du Secrétariat Central, conçue pour ne pas remplacer le système officiel mais pour en faciliter le suivi, l'import Excel, le pilotage par situation et la production de rapports exécutifs (Premier Ministre, Ministre Directeur de Cabinet, etc.).

**Verdict global :** l'application est **structurellement saine et très bien avancée** sur le plan fonctionnel, mais elle n'est **pas prête pour une mise en production** en l'état. Les travaux résiduels se concentrent sur trois fronts :

1. **Sécurité** (critique) : le modèle d'authentification par en-tête HTTP seul est insuffisant et expose l'application à l'usurpation d'identité. Le endpoint de listing des utilisateurs est ouvert.
2. **Rapports** (majeur) : le module le plus stratégique de l'application. Les PDF produits sont techniquement corrects, mais la présentation actuelle est jugée en deçà du standing attendu pour un document remis à un Premier Ministre ou à un ministre.
3. **Finition** (majeur) : écarts d'interface, interactions incomplètes, incohérences de design system entre les pages.

Sur 22 permissions déclarées, plusieurs routes restent à contrôler, et au moins une permission (impression) n'est jamais vérifiée côté serveur.

L'application mérite d'être poursuivie : le socle technique (Fastify + Prisma + React 19 + TanStack) est moderne et maintenable, le code est propre et cohérent dans son ensemble. Le plan de correction proposé (section 11) organise les travaux en 7 phases exécutables.

---

## 2. Diagnostic fonctionnel par module

Légende : ✔ = présence, état du module ; ▲ = problèmes identifiés.

### 2.1 Import Excel (module d'entrée de données)

| Aspect | Verdict | Détails |
|---|---|---|
| Expérience | ✔ Assistants en 6 étapes | fichier → feuille → aperçu → mapping → validation → progression |
| Mapping des colonnes | ✔ | Correspondance par en-tête normalisé + dictionnaire d'aliases |
| Déduplication | ▲ | Par `numero` en correspondance exacte (sans trim/casse) ; doublons intra-fichier ignorés |
| Mise à jour des doublons | ▲ | `duplicatePolicy = update` ne met à jour qu'un sous-ensemble : `situationId` et `mode` ne sont **pas** mis à jour |
| Colonnes fantômes | ▲ | `nombrePages`, `expediteur`, `dateObservation` sont déclarés dans `ALL_FIELDS` mais jamais importés (champs absents de la structure de données préparée) — l'utilisateur croit les importer, les valeurs sont silencieusement perdues |
| Dates | ▲ | Parser ambigu : `new Date(string)` essayé d'abord (interprétation US — `3/5/2024` = 3 mai), puis regex `jj/mm/aaaa` en secours ; les dates textuelles échouent |
| États intermédiaires | ✔ | Fichier maintenu en mémoire avec TTL 60 min, annulation possible |
| Polling | ▲ | Interrogation du backend toutes les 400 ms — charge inutile |

### 2.2 Suivi des courriers (module cœur)

| Aspect | Verdict | Détails |
|---|---|---|
| Liste principale | ✔ | Table (TanStack) + cartes mobiles, recherche, filtres, export CSV |
| Détail d'un courrier | ✔ | Timeline, transitions, modal de retrait, édition |
| Fiche imprimable | ✔ | Page dédiée au format A4 |
| Suppression | ✔ | Suppression douce (`deletedAt`) — traçabilité préservée |
| Retrait | ▲ | `retireParId` obligatoire — cohérent, mais l'exigence d'un justificatif de retrait n'apparaît pas dans le modèle de données |
| Création manuelle | ▲ | Gated par un paramètre, mais sans ré-édition du flux de validation |

### 2.3 Module Situation (moteur de restitution)

| Aspect | Verdict | Détails |
|---|---|---|
| Filtres | ✔ | 16 filtres : période, signataire, destinataire, situation, retirés/non retirés, mail/coursier, réponse entrante, injoignables, rappels, n° entrant, mot-clé objet, recherche |
| Tiles KPI + graphiques | ✔ | Présents |
| Tableau détaillé | ▲ | Tableau HTML brut sans composants du design system, hors charte |
| Historique | ✔ | Consultable |
| Génération de rapports | ✔ | 14 types, 6 formats (pdf, xlsx, exec-pdf, exec-xlsx, csv, print) |

### 2.4 Tableau de bord et statistiques

| Aspect | Verdict | Détails |
|---|---|---|
| Dashboard (accueil) | ✔ | KPI, top 5 en attente, activité récente, donut SVG |
| Page Statistiques | ▲ | **Statique** : aucune période sélectionnable, aucun filtre signataire/situation ; les données affichées ne sont pas justifiées par des filtres |
| Distinction des deux pages | ▲ | Dashboard et Statistiques se chevauchent partiellement (KPI, graphiques) sans positionnement clair |

### 2.5 Administration

| Aspect | Verdict | Détails |
|---|---|---|
| Utilisateurs | ✔ | CRUD complet |
| Rôles | ▲ | Édition des permissions via **textarea JSON brut** — erreur garantie, aucune validation de structure |
| Permissions | ✔ | Matrice de cases à cocher (22 permissions) |
| Journal | ✔ | Historique d'actions |
| Workflows | ▲ | Présent (3 onglets) mais transitions codées en dur dans le modèle — aucune administration graphique |

### 2.6 Workflow de traitement

Les transitions de statut sont modélisées (`Transition`, `ModeTransmission`), l'historique est tracé avec suppression en cascade (`HistoriqueAction`). Le modèle est correct ; l'absence de règles de validation applicatives (ex. : transitions invalides bloquées) reste à vérifier.

---

## 3. Audit UX

### Problèmes identifiés (par ordre de gravité)

| # | Gravité | Problème | Localisation |
|---|---|---|---|
| 1 | Majeure | Wizard d'import : polling toutes les 400 ms → charge serveur inutile, ressenti « brouillon » | `import-wizard.tsx:28` |
| 2 | Majeure | L'utilisateur croit importer `nombrePages`, `expediteur`, `dateObservation` → valeurs perdues silencieusement | `import-engine.ts:18` vs `:186-196` |
| 3 | Majeure | Mise à jour d'un doublon incomplète : l'utilisateur n'est pas averti que `situationId`/`mode` ne seront pas modifiés | `import-engine.ts:422-437` |
| 4 | Majeure | Parsing de date ambigu (US vs FR) sans indicateur du format attendu | `import-engine.ts:169-171` |
| 5 | Moyenne | Page Statistiques sans filtres → information non exploitable pour le pilotage | `statistiques.tsx` |
| 6 | Moyenne | Déduplication par correspondance exacte : `N° 12` vs `n°12` créent deux courriers | `import-engine.ts:247-254` |
| 7 | Moyenne | Retour de la génération de rapport : pas de récapitulatif post-téléchargement (qui a généré quoi, quand) | `situations.tsx:809-816` |
| 8 | Mineure | Sélecteur d'identité de démonstration exposé dans l'UI (choix d'utilisateur) — ambigu pour un utilisateur final | `auth/user-picker.tsx` |

### Points forts UX

- Assistant d'import en 6 étapes bien découpé avec aperçu et validation préalable.
- Page fiche imprimable dédiée au format A4.
- Historique consultable depuis la page Situation.
- Filtres riches sur la page Situation (16 critères).
- Export CSV disponible sur la liste des courriers.

---

## 4. Audit UI

### Constats globaux

- **UI maison cohérente et propre** : composants réutilisables (boutons, modales, formulaires) harmonisés, bon usage de Tailwind.
- **Pas de bibliothèque de composants** : tout est maison — maintenable, mais hétérogène à la marge.

### Écarts entre pages

| # | Gravité | Écart | Localisation |
|---|---|---|---|
| 1 | Moyenne | Tableau de la page Situation : HTML brut, hors design system (bordures, densité, styles de cellules incohérents avec le reste) | `situations.tsx:631-718` |
| 2 | Moyenne | Graphiques : SVG fait main dans l'ensemble de l'app ; donut de Statistiques en dégradé conique CSS alors que le dashboard utilise un donut SVG — deux familles visuelles | `statistiques.tsx`, `index.tsx:161-194` |
| 3 | Moyenne | Édition des rôles via textarea JSON : rupture visuelle et fonctionnelle brutale avec le reste de l'app | `roles.tsx` |
| 4 | Mineure | Page Nouveau courrier gated par flag : page « cachée » encore branchée dans le routeur | `courriers.nouveau.tsx` |
| 5 | Mineure | Densité et typographie légèrement variables entre la liste des courriers et les cartes mobiles | `courriers.tsx:510-619` |

### Verdict UI

| Critère | Verdict |
|---|---|
| Amateur | ✖ |
| **Professionnel** | ✔ (avec réserves) |
| À refaire | Certaines pages seulement (tableau Situation, rôles) |

---

## 5. Design System

### Existant

Une charte dédiée aux rapports existe déjà (`docs/design-system-rapports.md`) : palette teal `#0F766E`, Arial, pagination `x/y`, marges A4 standardisées. Les PDF produits l'appliquent rigoureusement (vérifié sur les fichiers de test : structure, accents, pagination corrects).

### Manques pour l'application web

| # | Manque | Impact |
|---|---|---|
| 1 | Pas de fichier de tokens unique (couleurs/typographie/espacements dupliqués par page) | Dérives visuelles entre pages |
| 2 | Pas de grille de référence pour les pages de données | Tableau Situation hors charte |
| 3 | Pas de charte de graphiques commune (SVG vs CSS, couleurs de série, libellés) | Deux familles de donuts, séries sans règle de couleur |
| 4 | Pas de règle d'accessibilité (contrastes, focus) documentée | Risques WCAG |

### Recommandation

Établir un `docs/design-system-web.md` calqué sur la charte rapports (palette, typo, espacements, composants, chartes de graphiques), puis faire converger les pages.

---

## 6. Tableau de bord

| Critère | Verdict | Détails |
|---|---|---|
| KPI au bon niveau | ✔ | Compteurs pertinents (en attente, injoignables, rappels…) |
| Top 5 en attente | ✔ | Priorisation visible dès l'accueil |
| Activité récente | ✔ | Historique récent |
| **Positionnement vs Statistiques** | ▲ | Deux pages se chevauchent ; aucune n'offre de filtrage temporel |
| Donut SVG | ✔ | Fonctionnel, mais intégré à la charte de graphiques à définir |

**Recommandation :** transformer le dashboard en page « pilotage du jour » (avec la date du jour mise en exergue) et la page Statistiques en « analyse sur période » (avec sélecteurs de période et de signataire/situation). Le dashboard serait le seul à rester sans filtres, par construction.

---

## 7. Module Situation

| Critère | Verdict | Détails |
|---|---|---|
| Richesse des filtres | ✔ | 16 critères, couvre les besoins métier |
| KPI tiles | ✔ | Présents, mais à unifier avec le design system |
| Graphiques | ▲ | À passer sous la future charte de graphiques |
| Tableau détaillé | ▲ | À refaire avec les composants du design system |
| Exports | ✔ | 6 formats, 14 types de rapports |
| Cohérence filtres → rapports | ▲ | Vérifier que les filtres actifs sont bien transmis au générateur (contrôle des écarts sur les variantes de test) |

---

## 8. Rapports

### Réponse à la question centrale : « Un Premier Ministre recevrait-il ce document ? »

**Aujourd'hui : non, pas en l'état.** Constat à nuancer : les PDF de test produits (7 pages pour l'exécutif complet, 4 pour la générale compacte) sont techniquement irréprochables — accents, pagination `x/y`, structure des sections, édition en A4. **Le fond est prêt, la forme ne l'est pas encore.**

| Critère | Verdict | Détails |
|---|---|---|
| Exactitude des données | ✔ | Référentiel correct (statuts, compteurs, tableaux) |
| Structure documentaire | ✔ | Couverture → synthèse → indicateurs → graphiques → tableau → conclusion → annexes |
| Pagination, marges, accents | ✔ | Vérifiés sur fichiers de test |
| Typographie et mises en avant | ▲ | Arial uniforme, pas de hiérarchie de titres suffisamment affirmée (tailles, graisses, filets) |
| Couverture PDF | ▲ | Page de garde sobre, mais sans habillage institutionnel (logo, bandeau, numéro de document, référence) |
| Graphiques | ▲ | Fonctionnels ; présentation à étoffer (légendes, axes, couleurs de série) |
| Format XLSX | ✔ | 7 feuilles (mode complet) / 3 (mode compact), formule `!ref` corrigée |
| Périmètre des 14 types | ▲ | Plusieurs types sont des permutations de colonnes du même moteur ; à rationaliser (types réellement demandés vs génériques) |

### Points de contrôle à faire avant production

1. Présentation du PDF exécutif à la cible réelle (Premier Ministre / MDC) pour validation du style.
2. Définition de l'habillage institutionnel (logo, mention « Confidentiel », référence).
3. Rationalisation des 14 types de rapports.

---

## 9. Performances

| # | Gravité | Problème | Localisation |
|---|---|---|---|
| 1 | Moyenne | `fetchAllRows` non borné : la restitution et les statistiques chargent l'intégralité des lignes filtrées en mémoire | `situation-query.ts` |
| 2 | Moyenne | Polling d'import toutes les 400 ms | `import-wizard.tsx:28` |
| 3 | Faible | Workbook maintenu en mémoire 60 min par session d'import | `import.ts:49-57, 86-140` |
| 4 | Faible | Base SQLite mono-fichier : acceptable pour un volume de l'ordre de quelques milliers de courriers ; à réévaluer au-delà de ~20 000 lignes |

**Verdict :** les volumes attendus (courriers sortants d'un secrétariat central, de l'ordre de quelques milliers/an) rendent les performances acceptables en l'état ; la pagination et le polling méritent correction avant mise en production.

---

## 10. Sécurité

### Constat majeur

**Le modèle d'authentification est insuffisant pour la production.**

| # | Gravité | Problème | Localisation |
|---|---|---|---|
| 1 | **Critique** | Pas de login/mot de passe : l'identité est fournie par en-tête HTTP `user-id` — **usurpable par tout client** | `server.ts` (auth header), `lib/auth.ts` |
| 2 | **Critique** | `GET /api/login/users` liste les utilisateurs actifs **sans aucune vérification de permission** | `server.ts:39-46` |
| 3 | Majeure | Évaluation des permissions : chaîne JSON dans `Role.permissions`, wildcard `'*'` autorisant tout, et `isSuperAdmin` avec repli sur le **nom du rôle** (« Super Administrateur », « Administrateur ») — fragile si le nom change | `lib/auth.ts:65-66, 82` |
| 4 | Majeure | 22 permissions déclarées, mais au moins une jamais vérifiée (`courrier:print`) et certaines routes à contrôler (édition dynamique `courrier:edit-official` OU `courrier:write`) | `lib/auth.ts:4-27`, route PUT `:327-331` |
| 5 | Majeure | Endpoint de reset administratif (`/api/admin/reset`) destructif, sans garde-fou de confirmation ni audit explicite | route admin |
| 6 | Majeure | Absence de protections transverses : pas de rate-limiting, pas de CSRF (à confirmer pour les routes mutantes), pas de validation de taille d'upload | — |
| 7 | Moyenne | Sélecteur d'identité de démonstration exposé en interface | `auth/user-picker.tsx` |

### Points rassurants

- Suppression douce (`deletedAt`) — les courriers ne sont jamais physiquement perdus.
- Historique d'actions avec cascade — traçabilité des mutations.
- Modèle `Retrait` exigeant le déclencheur (`retireParId`).

### Recommandations immédiates (phase 1 du plan)

1. Introduire une authentification réelle (session ou jeton) avec stockage côté serveur.
2. Fermer `GET /api/login/users` derrière une permission.
3. Passer l'évaluation des permissions sur l'identifiant du rôle, jamais le nom.
4. Retirer ou sécuriser le wildcard `'*'`.
5. Contrôler l'utilisation de chaque permission ; supprimer ou brancher `courrier:print`.

---

## 11. Plan de correction en 7 phases

Format : **Objectif · Actions · Bénéfices · Priorité · Complexité · Durée**

### Phase 1 — Verrouillage sécurité (pré-requis de toute mise en production)

- **Objectif :** rendre l'application exploitable par une équipe réelle sans risque d'usurpation.
- **Actions :** authentification réelle (session/jeton + hash des mots de passe) ; fermeture du listing utilisateurs ; évaluation des permissions par identifiant de rôle ; suppression ou sécurisation du wildcard ; revue de chaque permission (brancher `courrier:print` ou le retirer) ; protection du reset admin ; rate-limiting et limites de taille d'upload.
- **Bénéfices :** les comptes et permissions reflètent enfin l'intention du design system.
- **Priorité :** P0 · **Complexité :** élevée (touche l'ensemble des routes) · **Durée :** 3-4 jours.

### Phase 2 — Fiabilisation de l'import

- **Objectif :** l'import reflète exactement ce que l'utilisateur voit à l'aperçu.
- **Actions :** intégrer les 3 colonnes fantômes ; compléter la mise à jour des doublons (`situationId`, `mode`) ; normaliser la déduplication (trim/casse) ; parsing de dates FR explicite avec indication du format ; remonter les erreurs ligne par ligne ; réduire le polling à un rafraîchissement à la demande.
- **Bénéfices :** confiance dans la donnée entrée ; disparition des pertes silencieuses.
- **Priorité :** P0 · **Complexité :** moyenne · **Durée :** 2 jours.

### Phase 3 — Design system web + unification UI

- **Objectif :** une seule charte pour toute l'application.
- **Actions :** rédiger `docs/design-system-web.md` (tokens, grille, composants, charte de graphiques) ; refonte du tableau de la page Situation ; remplacement de l'édition de rôles en JSON par une matrice ; unification des donuts (SVG unique) ; harmonisation densité liste/cartes.
- **Bénéfices :** cohérence visuelle immédiate ; base pour les phases suivantes.
- **Priorité :** P1 · **Complexité :** moyenne · **Durée :** 3 jours.

### Phase 4 — Refonte de la présentation des rapports

- **Objectif :** un document qu'un Premier Ministre peut recevoir.
- **Actions :** refonte du gabarit PDF (hiérarchie typographique, filets, encadrés) ; habillage institutionnel (logo, mention « Confidentiel », référence) ; enrichissement des graphiques (légendes, axes) ; validation auprès de la cible ; rationalisation des 14 types.
- **Bénéfices :** le livrable stratégique de l'application passe au niveau attendu.
- **Priorité :** P1 · **Complexité :** moyenne · **Durée :** 3 jours.

### Phase 5 — Pilotage : dashboard et statistiques

- **Objectif :** séparer « pilotage du jour » et « analyse sur période ».
- **Actions :** ajout des sélecteurs de période/signataire/situation sur la page Statistiques ; alignement du dashboard sur la charte de graphiques ; suppression du chevauchement.
- **Bénéfices :** les chiffres deviennent interrogables, pas seulement affichables.
- **Priorité :** P1 · **Complexité :** faible · **Durée :** 1-2 jours.

### Phase 6 — Performances et robustesse

- **Objectif :** volume de données réel sans ralentissement.
- **Actions :** pagination de `fetchAllRows` ; fin du polling 400 ms ; réduction du TTL mémoire des imports ; revue des index SQLite.
- **Bénéfices :** réactivité garantie jusqu'à des volumes confortables.
- **Priorité :** P2 · **Complexité :** faible · **Durée :** 1 jour.

### Phase 7 — Recette et préparation de la mise en production

- **Objectif :** déployer en confiance.
- **Actions :** jeu de tests de bout en bout (import complet, transitions, génération des 14 rapports, exports) ; recette avec le Secrétariat Central ; sauvegarde/restauration de la base ; documentation d'exploitation ; déploiement.
- **Bénéfices :** une mise en production maîtrisée et réversible.
- **Priorité :** P2 · **Complexité :** moyenne · **Durée :** 2-3 jours.

---

## 12. Risques, opportunités, recommandations

### Risques

| # | Risque | Probabilité | Impact | Couverture |
|---|---|---|---|---|
| 1 | Usurpation d'identité (auth par en-tête) | Élevée | Critique | Phase 1 |
| 2 | Perte silencieuse de données à l'import | Moyenne | Élevé | Phase 2 |
| 3 | Rejet du rapport par la cible (forme) | Moyenne | Élevé (projet symbolique) | Phase 4 |
| 4 | Dérives visuelles (absence de design system web) | Élevée | Moyen | Phase 3 |
| 5 | Ralentissement sur gros volumes | Faible | Moyen | Phase 6 |

### Opportunités

- Le socle technique (Fastify 5 + Prisma 7 + React 19 + TanStack) est moderne : attractif pour la maintenance.
- La charte rapports déjà documentée est un modèle réutilisable pour la charte web.
- La matrice de permissions (22) est déjà structurante : la brancher réellement sur toutes les routes ne demande que de la méthode.

### Recommandations finales

1. Ne pas déployer en production avant la fin de la Phase 1.
2. Prioriser la Phase 4 (rapports) : c'est le livrable visible par la direction.
3. Impliquer le Secrétariat Central en Phase 7 pour la recette réelle.
4. Documenter la charte web (Phase 3) avant toute refonte UI.

---

*Document produit à titre de diagnostic. Aucune modification de code n'a été apportée au cours de l'audit.*

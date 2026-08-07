# Design System — Application Web DEX

Version : 1.0 — Date : 05/08/2026
Statut : **Référence en vigueur** pour toute l'application web (`frontend/src`).

Ce document est la charte frontend de DEX. Tout nouveau composant ou écran DOIT s'y conformer. Le backend et le générateur de rapports suivent leur propre charte (`docs/design-system-rapports.md`).

---

## 1. Principes

1. **Une seule source de vérité** : les tokens CSS (`frontend/src/index.css`), les composants UI (`frontend/src/components/ui/`). Ne pas dupliquer de styles à la main quand un composant existe.
2. **Pas de lib de composants** : Tailwind + utilitaires maison. Toute nouvelle brique va dans `components/ui/` puis est ré-exportée par `components/ui/index.ts`.
3. **Densité maîtrisée** : un seul niveau de densité — compact, mais lisible (lignes `py-3`, tuiles `p-4`). Pas de `p-6` systématique, pas de « mode spacieux ».
4. **Accessible par défaut** : contrastes tokens, focus visibles (`focus:ring-2 focus:ring-ring/20`), `title` sur les textes tronqués, `tabular-nums` sur les nombres.
5. **Animations discrètes** : framer-motion réservé aux apparitions (fade + `y: 8`, délais en cascade ≤ 0.25 s). Pas d'animation sur les interactions courantes (hover = transition de couleurs seule).

---

## 2. Tokens (définis dans `frontend/src/index.css`)

### 2.1 Couleurs sémantiques

| Token | Usage | Clair | Sombre |
|---|---|---|---|
| `--background` / `--foreground` | fond de page / texte principal | `225 20% 98%` | `225 25% 9%` |
| `--card` / `--card-foreground` | cartes, tableaux, menus | `0 0% 100%` | `225 20% 11%` |
| `--primary` / `--primary-foreground` | actions principales, liens, focus | `215 80% 42%` | `215 80% 55%` |
| `--secondary` | fonds secondaires (boutons ghost/outline) | `220 15% 94%` | `225 15% 16%` |
| `--muted` / `--muted-foreground` | zones passives, textes secondaires | `220 15% 96%` | `225 15% 14%` |
| `--destructive` | suppressions, erreurs | `0 72% 50%` | `0 65% 48%` |
| `--success` | réussites, délais OK | `145 55% 42%` | `145 50% 48%` |
| `--warning` | alertes, délais intermédiaires | `35 92% 50%` | `35 85% 55%` |
| `--border` / `--input` | bordures, champs | `220 13% 91%` | `225 15% 18%` |
| `--ring` | anneaux de focus | = primary | = primary |
| `--chart-1` à `--chart-5` | palette graphique (voir §6) | 5 teintes | 5 teintes adaptées |

**Usage** : classes Tailwind (`bg-card`, `text-muted-foreground`) — jamais de couleurs hex en dur sauf badges de situation/mode (couleurs métier venant de la BDD, en alpha `couleur + '14'` pour le fond).

### 2.2 Surfaces applicatives

| Token | Valeur claire | Valeur sombre |
|---|---|---|
| `--sidebar-background` | `225 30% 8%` (sombre par design) | `225 30% 5%` |
| `--sidebar-*` | voir index.css | voir index.css |
| `--topbar-*` | fond blanc | fond `225 20% 10%` |

### 2.3 Métriques

| Token | Valeur | Notes |
|---|---|---|
| `--radius` | `0.5rem` | arrondi standard : `rounded-xl` cartes/tableaux, `rounded-lg` champs/boutons, `rounded-md` badges |
| `--sidebar-width` | `17.5rem` | |
| `--sidebar-collapsed-width` | `4.25rem` | |
| `--topbar-height` | `4rem` | |

### 2.4 Ombres

- Cartes : `shadow-card` ; hover : `shadow-card-hover` (+ `hover:-translate-y-0.5` pour les tuiles cliquables uniquement).
- Overlays : `shadow-xl` (modales).

---

## 3. Typographie

| Usage | Classe |
|---|---|
| Titre de page (h1) | `text-xl font-semibold tracking-tight sm:text-2xl` (ou composant `PageHeader`) |
| Titre de carte | `CardHeader` (titre + sous-titre + icône + action optionnelle) |
| Titre section interne | `text-sm font-semibold` |
| Corps | `text-sm` |
| Libellé de champ | `text-sm font-medium` |
| Légende / méta | `text-2xs` (`0.7rem`) ou `text-xs` |
| Libellé KPI / entête tableau | `text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70` |
| Grands nombres (KPI, total donut) | `font-bold tabular-nums` |
| Code / JSON | `font-mono` |

Police : défaut système + `font-feature-settings: "cv02","cv03","cv04","cv11","salt"` (activé sur `body`).

---

## 4. Grille et mise en page

- Conteneur de page : `mx-auto max-w-7xl space-y-5` (espacement vertical entre blocs).
- Grille KPI : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8` (dashboard), `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` (statistiques), `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (situations).
- Colonnes de graphiques : `grid-cols-1 lg:grid-cols-2` / `lg:grid-cols-3` (dashboard).
- Gap standard : `gap-3` (tuiles denses), `gap-4` (grilles larges), `gap-5/6` (sections).
- Remplissage des cartes : `p-4`/`p-5` (contenu), `p-6` interdit pour les cartes (sauf graphique line chart existant, à harmoniser à la prochaine refonte).

---

## 5. Composants (inventaire — `components/ui/`)

| Composant | Fichier | Usage |
|---|---|---|
| `Button` | `button.tsx` | variantes : `default`, `outline`, `ghost`, `danger`, `link` ; tailles `sm`/`default` |
| `Card` / `CardHeader` | `card.tsx` | conteneurs ; `!p-0` pour les cartes-tableaux |
| `PageHeader` | `page-header.tsx` | titre de page + description + action |
| `DataTable` | `data-table.tsx` | tableau standardisé : entête `bg-muted/40` + `text-2xs uppercase`, lignes `divide-y`, hover `bg-muted/20`, état vide, `emptyMessage` |
| `StatusBadge` / `DelaiBadge` / `WorkflowBadge` | `status-badge.tsx` | badges de situation, délais, activités — **ne pas réécrire à la main** (`backgroundColor: couleur+'14'` etc. sont encapsulés) |
| `Pagination` | `pagination.tsx` | pagination basée sur les routes |
| `Dialog` / modales | `dialog.tsx` | modales standard ; `motion` + backdrop `bg-black/40`, `max-w-md` (élargir si nécessaire : `max-w-lg`) |
| `EmptyState` / `LoadingState` | `feedback.tsx` | états vides et chargement |
| `Breadcrumb` | `breadcrumb.tsx` | fil d'Ariane fiche courrier |
| `Avatar` | `avatar.tsx` | avatars utilisateurs |

**Règle d'or** : si le motif existe déjà dans `components/ui/`, on l'importe. Le copier-coller de classes de badge/tableau dans une page est une dette à éviter.

### 5.1 Règle tableaux

- Enveloppe : `Card !p-0` → `DataTable` (ou table équivalente) → `Pagination` en bas si paginé.
- Entêtes : `px-4 py-3.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70`, fond `bg-muted/40`.
- Cellules : `px-4 py-3 text-sm` ; texte secondaire `text-muted-foreground` ; troncatures `max-w-[Npx] truncate` avec `title`.
- Colonnes numériques : `tabular-nums`.

### 5.2 Règle formulaires

- Champs : `rounded-lg border border-border bg-background px-3/4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20`.
- Libellés au-dessus du champ, `mb-1.5` / `mb-1`, graisse `font-medium`.
- Checkbox de matrice (rôles) : `components/ui/checkbox.tsx`.

---

## 6. Graphiques (`components/charts/` — palette unique)

Un seul jeu de graphiques maison, partagé entre les pages :

| Composant | Fichier | Usage |
|---|---|---|
| `BarsChart` | `components/charts/index.tsx` | barres horizontales (top N) |
| `DonutChart` | `components/charts/index.tsx` | donut SVG partagé (dashboard, statistiques, situations) — **un seul donut dans l'app**, plus de `conic-gradient` ni de SVG dupliqués |
| `LineChart` | `components/charts/index.tsx` | courbe d'évolution |

### 6.1 Palette

- Palette par défaut (thème) : `--chart-1` … `--chart-5` (adaptées clair/sombre), puis cycle sur liste étendue si plus de 5 segments.
- Palette sémantique (situations métier, ex. « Nouveau », « Retiré ») : passée via `colors` / `colorFor` — couleurs métier issues de la BDD ou map explicite (statistiques).
- Donut : épaisseur `18`, rayon `52`, total au centre, légende = pastille + libellé + valeur + `%`.
- Segment « Autres » : au-delà de 7 segments, regrouper le reste (voir `DonutChart`).

---

## 7. États et rétroactions

| État | Motif |
|---|---|
| Chargement | `LoadingState` (composant) — jamais de skeleton ad hoc |
| Vide | `EmptyState` ou ligne `text-muted-foreground` centrée + `py-8/12` |
| Erreur formulaire | bandeau `bg-red-50 dark:bg-red-950/30 text-red-600` + icône `AlertTriangle` |
| Sauvegarde | bouton désactivé + `Loader2 animate-spin` |
| Succès | toast/bannière `text-success` |

---

## 8. Bonnes pratiques de code

1. Imports : `@/components/ui/*` via index ; icônes lucide-react.
2. `cn()` (`@/lib/cn`) pour toute condition de classe.
3. Nombres : `toLocaleString('fr-FR')` pour les milliers, `tabular-nums`.
4. Dates : `toLocaleDateString('fr-FR')` / `toLocaleString('fr-FR')`.
5. Pas de composants graphiques dans `routes/` — la logique de charting vit dans `components/charts/`.
6. Pas de `!` important sauf cas documentés (`!p-0`, `!p-4`) — à éliminer progressivement via les composants.

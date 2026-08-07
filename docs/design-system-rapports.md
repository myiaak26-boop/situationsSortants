# Design System — Rapport Exécutif DEX

**Identité visuelle unique de tous les rapports de situation des courriers sortants**
Secrétariat Central — Primature, République de Guinée

Version 1.0 — Norme de conception. Ce document fait foi pour toute génération de rapport (PDF ou Excel). Toute modification doit passer par ce document.

---

## 1. Principes

1. **Un seul template, une seule charte.** Tous les rapports (générale, par signataire, par période, par destinataire, réponses, délais, retraits, mail, coursier, en attente, injoignables, rappels, personnalisée) utilisent exactement la même mise en page, les mêmes couleurs, la même typographie. Seules les données changent.
2. **Reconnaissance immédiate.** Chaque page porte la signature visuelle : bande teal (couverture), en-tête courant institution + titre, pied de page République · Institution — N° rapport + pagination.
3. **Hiérarchie stricte.** L'œil descend toujours : République → Institution → Titre → Période → Synthèse → Détail.
4. **PDF = rapport, jamais export de données.** Le PDF est construit en pages narratives : couverture, synthèse, indicateurs, graphiques, tableau, conclusion, annexes.
5. **Excel = miroir du PDF.** Mêmes couleurs (hex identiques), même hiérarchie de titres, mêmes KPI, mêmes libellés. L'Excel est un tableau de bord, pas une extraction brute.

## 2. Charte graphique (tokens)

Source unique : `backend/src/lib/report/theme.ts`. PDF et Excel importent ces mêmes valeurs.

### 2.1 Couleurs

| Token | Hex | Usage |
|---|---|---|
| `teal` | `#0F766E` | Couleur d'identité. Bandes de couverture, barres de section, titres, valeurs KPI |
| `tealDark` | `#065F46` | Bande secondaire de couverture, survols |
| `ink` | `#0F172A` | En-têtes de tableau, titres, valeurs principales |
| `slate` | `#334155` | Texte courant |
| `muted` | `#64748B` | Légendes, métadonnées, secondaire |
| `faint` | `#CBD5E1` | Grilles de graphiques, lignes de repère |
| `hair` | `#E2E8F0` | Filets, bordures légères |
| `panel` | `#F1F5F9` | Fonds de cartes KPI, zébra de tableaux |
| `white` | `#FFFFFF` | Fond de page, texte sur fond foncé |

### 2.2 Couleurs sémantiques

| Token | Hex | Usage |
|---|---|---|
| `green` | `#059669` | Succès, normal, retiré, livré |
| `amber` | `#B45309` | Attention, en attente |
| `red` | `#B91C1C` | Urgent, critique, injoignable |
| `blue` | `#0369A1` | Courriers simples, mail, information |
| `violet` | `#7C3AED` | Courriers réponses |
| `rose` | `#BE123C` | Injoignables (KPI) |

**Badges de situation et de mode** : les badges utilisent la couleur stockée en base pour chaque situation (`Courrier.situation.couleur`) et chaque mode de transmission (`ModeTransmission.couleur`). La charte garantit la forme (pilule arrondie), la couleur vient de la donnée.

### 2.3 Palette de graphiques (10)

`#0F766E #0369A1 #7C3AED #B45309 #DB2777 #4D7C0F #64748B #0EA5E9 #C026D3 #DC2626`

Règle : les segments (donut, barres empilées, barres horizontales) prennent les couleurs dans cet ordre strict. Toujours la même couleur pour le même libellé au sein d'un rapport : la palette est indexée par position de tri décroissante, donc stable d'un graphique à l'autre.

### 2.4 Typographie

- Famille : **Arial** (Regular, Bold, Italic). Unique choix : identique sur Windows (PDF + Excel). Repli PDF : Helvetica. Repli Excel : la police système par défaut (Arial).
- Échelle (points PDF / points Excel équivalents) :

| Niveau | Taille | Style | Usage |
|---|---|---|---|
| Display | 23 | Bold | Titre du rapport (couverture) |
| H1 | 17 | Bold | Nom de l'institution (couverture) |
| H2 | 13 | Bold | Titres de section |
| H3 | 11 | Bold | Titres de graphique |
| Corps | 10 | Regular | Texte courant, synthèse |
| Table | 7 | Regular | Cellules de tableau détaillé |
| Légende | 8 | Regular | Légendes, métadonnées |
| Meta | 6.5 | Regular | Pieds de page, en-têtes courants, labels KPI |

### 2.5 Grille et espacements

| Paramètre | Valeur |
|---|---|
| Format | A4 portrait 595,28 × 841,89 pt |
| Marges latérales | 46 pt |
| Marge haute | 52 pt |
| Pied de page | 34 pt |
| Module vertical | 8 pt (tous les espacements en multiples de 8) |
| Grille KPI | 4 colonnes, gap 10 pt, hauteur 46 pt |
| Rayon d'arrondi | 4 pt |
| Exception | Tableau détaillé : A4 paysage (mêmes marges, mêmes couleurs) |

## 3. Structure du template (pages, dans l'ordre)

### Page 1 — Couverture

- Bande pleine largeur teal 9 pt en haut + liseré tealDark 2 pt.
- Bande pleine largeur `ink` 11 pt en bas.
- République (teal, Bold 13), Institution (ink, Bold 17), devise (Italic 11, muted).
- Règle teal horizontale centrée (largeur page − 80 pt).
- Titre du rapport (Display 23, centré) puis « Période : … » (corps 12).
- Bloc métadonnées centré (fond `panel`, hauteur 22 pt/ligne) : DATE, HEURE, ÉTABLI PAR, NUMÉRO DU RAPPORT.
- Mention « Document officiel — Primature, République de Guinée ».
- **La couverture est la seule page sans en-tête courant ni pagination.**

### Page 2 — Synthèse exécutive

- Section « 1 · Synthèse exécutive » : barre teal + numérotation.
- Paragraphe narratif généré automatiquement (total, simples, réponses, retirés, taux, en attente).
- Grille de 10 cartes KPI (4 colonnes × 3 rangées — la dernière ligne complétée par les indicateurs restants). Chaque carte : pastille d'icône 12×12, label uppercase 6,5, valeur Bold 16.
- Section « 2 · Indicateurs temporels » : 4 lignes (temps moyen de réponse, temps moyen avant retrait, délai min, délai max), lignes alternées `panel`.

### Page 3 — Graphiques et analyse

- Section « 3 · Graphiques et analyse ».
- Slots standardisés, dans cet ordre d'importance, chacun avec titre `3.x` + filet :

| Slot | Graphique | Utilisé quand |
|---|---|---|
| 3.1 Répartition par signataire | Barres verticales | données signataire |
| 3.2 Répartition par situation | Donut | données situation |
| 3.3 Répartition par mode | Barres horizontales empilées (100 %) | données mode |
| 3.4 Évolution | Ligne ou aires | évolution par jour/semaine/mois |
| 3.5 Répartition des délais | Barres verticales | tranches de délai |

Règle : les slots vides sont omis ; l'ordre relatif est conservé. Un rapport « Délais » place 3.5 en premier slot.

### Page 4+ — Tableau détaillé

- A4 paysage. Section « 4 · Tableau détaillé des courriers » + sous-titre « N courriers — triés par date d'envoi croissante ».
- En-tête foncé `ink`, texte blanc, répété sur chaque page.
- Lignes alternées : impaire `panel`.
- Badge pilule pour la colonne Situation (fond = couleur de la situation à 15 % + texte = couleur de la situation).
- Numéro de courrier en Bold.
- **Sous-totaux** : quand le rapport est groupé (par signataire, situation, destinataire), une ligne de sous-total `panel` apparaît après chaque groupe.
- **Total** : ligne finale Bold, fond teal clair, valeur totale en pied de colonnes numériques.

### Page finale — Conclusion

- Section « 5 · Conclusion ».
- Observations à puces (cercles teal 1,8 pt), paragraphes justifiés.
- Filet de séparation, bloc signature « LE SECRÉTAIRE CENTRAL » (Bold 12, centré).
- Mention de génération + « N° rapport — Institution ».

### Annexes

- Facultatives selon le type : historique des actions (≤ 5000 lignes), courriers réponses, détail des retraits, glossaire des sigles (PM, MDC, DCA, CCAB).
- Même charte que le tableau détaillé.

## 4. Composants réutilisables

| Composant | PDF | Excel |
|---|---|---|
| `sectionTitle(n, titre)` | Barre teal 3,5×15 + texte Bold 13 | Bande teal pleine largeur (fusion), texte blanc Bold 11 |
| `kpiCard` | Pastille 12×12 + label + valeur | 2 cellules fusionnées, fond `panel`, bordure, valeur Bold 16 |
| `badge(text, couleur)` | Pilule arrondie : fond = couleur @ 15 % | Cellule : fond pastel (couleur @ 15 %), texte couleur, bordure |
| `dataTable` | Header `ink` répété, zébra, sous-totaux, total | Ligne d'en-tête `ink`, autofilter, gel de la première ligne, zébra |
| `donut` / `bar` / `hbar` / `line` / `area` | Dessin vectoriel pdfkit | Barres inline : rangées de cellules colorées proportionnelles (SheetJS ne produit pas de graphiques natifs — règle documentée) |
| `runningHeader` | Institution gauche, titre droite, filet | Répété via en-tête d'impression (feuille 2+) |
| `footer` | République · Institution — N° rapport, pagination x/y | Pied d'impression personnalisé, pagination |

**Icônes** : pictogrammes géométriques dessinés (pastilles, cercles) + glyphes Arial (`✓ ⏱ ⚠ ✗ →`). Jamais d'image externe. Excel : même jeu de glyphes.

## 5. Règles d'utilisation

1. **N'utiliser que les tokens de `theme.ts`.** Aucune couleur en dur dans les générateurs.
2. **Un rapport = les pages obligatoires** (couverture, synthèse, KPI, tableau, conclusion) **+ les pages optionnelles** (graphiques, annexes) déclarées dans la configuration du type (`report/types.ts`).
3. **Compact vs complet** : format « PDF Standard » / « Excel » = compact (couverture, synthèse + KPI, tableau). Format « Exécutif » = complet (tout). Le style est strictement identique.
4. **Libellés en français**, dates `jj/mm/aaaa`, nombres séparateur d'espace (`1 234`).
5. **Numérotation des sections** toujours 1 Synthèse, 2 Indicateurs temporels, 3 Graphiques, 4 Tableau, 5 Conclusion.
6. La **première page** n'a ni en-tête ni pagination ; les suivantes ont l'en-tête courant ; toutes ont le pied.

## 6. Mise en correspondance des types de rapports

Config déclarative dans `report/types.ts` — chaque type = `{ kpis[], charts[], tableCols[], groupBy?, annexes[] }`.

| Type | Spécificité |
|---|---|
| generale / executive | Template complet |
| parSignataire | groupBy signataire, sous-totaux par groupe |
| parSituation | groupBy situation, badges situation |
| parDestinataire | groupBy destinataire, sous-totaux |
| reponses | KPI réponses + annexe réponses |
| delais | Slot graphique délais en premier |
| retraits | KPI retirés/taux + colonnes retrait |
| mail / coursier | KPI mode + colonne mode |
| enAttente | KPI en attente/à rappeler en premier |
| injoignables | KPI injoignables + téléphone |
| rappels | KPI rappels effectués |
| personnalisee | Config auto selon les filtres |

## 7. Historique du document

| Version | Date | Changement |
|---|---|---|
| 1.0 | 2026-08-05 | Création — unification PDF/Excel |

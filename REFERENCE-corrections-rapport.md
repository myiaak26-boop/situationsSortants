# Référence pour correction du générateur de "Situation des Courriers Sortants"

Ce document accompagne `template-situation-courriers.html`. Il explique **pourquoi**
chaque changement est nécessaire, pas seulement **quoi** changer, pour qu'un agent
de codage puisse l'appliquer sans deviner le contexte métier.

## Résumé des 5 corrections

| # | Problème observé | Cause | Fix |
|---|---|---|---|
| 1 | Titre de section collé au N° de document sur 4 pages | Marge insuffisante entre le header répété et le titre | `.page-header` a désormais une bordure + `margin-bottom` fixe (empêche le collapse CSS des marges) |
| 2 | Un courrier "E-mail envoyé" apparaît identique en statut ET en mode | Un seul champ back-end fait double emploi | Scinder en deux champs : `statut_suivi` et `mode_transmission` (voir schéma ci-dessous) |
| 3 | Les KPI (TOTAL, SIMPLES, RETIRÉS...) ont tous la même importance visuelle alors qu'ils ne sont pas additifs | Absence de hiérarchie dans le design | TOTAL mis en avant visuellement + note explicite que RETIRÉS/INJOIGNABLES ne s'additionnent pas au TOTAL |
| 4 | Signature "LE CHEF DE DIVISION" sans nom, alors que la page de garde a "Aboubacar BANGOURA" | Variable auteur non réutilisée dans le bloc signature | Réutiliser `{{auteur}}` partout |
| 5 | Libellé "Rappels effectués" en synthèse vs "Appel effectué" dans le tableau — même donnée, deux noms | Deux constantes de libellé différentes dans le code | Une seule clé `nb_relances`, un seul libellé affiché : "Relances effectuées" |

## Détail — Fix #2 (le plus important, changement de modèle de données)

### Avant (constaté dans le rapport actuel)
Une seule colonne `situation` avec ces valeurs possibles, mélangées :
```
Retiré | Appel effectué | Destinataire joint | Injoignable | Livré | E-mail envoyé
```
Problème : "E-mail envoyé" n'est pas un statut de suivi, c'est un mode de transmission.
Un courrier envoyé par e-mail peut *ensuite* être retiré, injoignable, etc. — les deux
informations ne sont pas mutuellement exclusives, or la colonne actuelle force un choix
unique entre les deux catégories.

### Après (attendu)
Deux champs indépendants sur chaque courrier :

```
statut_suivi: enum
  - retire
  - injoignable
  - appel_effectue
  - destinataire_joint
  - livre

mode_transmission: enum
  - retrait_secretariat
  - remise_coursier
  - envoi_email
```

### Migration des données existantes
Le champ `mode_transmission` existe déjà séparément dans le tableau détaillé actuel
(colonne "Mode" : Retrait au Secrétariat / Remise au Coursier / Envoi par E-mail) —
donc la donnée est probablement déjà là quelque part. Le vrai travail est de vérifier
que `statut_suivi` ne contient plus jamais la valeur "E-mail envoyé" : pour ces
enregistrements, il faut déduire le vrai statut de suivi (a priori "livré" ou à
défaut laisser vide/à qualifier), et s'assurer que `mode_transmission = envoi_email`
est renseigné séparément.

### Impact sur les graphiques
- Le graphique "Répartition par statut de suivi" ne doit plus avoir de tranche
  "E-mail envoyé".
- Le graphique "Répartition par mode de transmission" reste inchangé dans sa
  structure (il l'était déjà correct dans le rapport actuel).
- Un même courrier peut donc être compté dans les deux graphiques sans que ça
  soit une incohérence (ex : "Retiré" + "Envoi par e-mail").

## Détail — Fix #3 (KPI non additifs)

Ne pas sommer `nb_retires + nb_injoignables + ...` pour vérifier `total_courriers`.
Seule l'égalité `nb_simples + nb_reponses = total_courriers` doit être vraie et
peut être validée par un test automatique. Les autres compteurs sont des sous-
ensembles selon `statut_suivi`, potentiellement recouvrants dans le temps (un
courrier peut passer par plusieurs statuts avant son statut final — à vérifier
si le système historise les statuts ou n'en garde que le dernier).

**Point à clarifier avec le métier avant de coder** : le rapport actuel affiche
un seul statut par courrier (le dernier connu), pas un historique. Si c'est le
cas, gardez cette logique — ne montrez que le statut courant dans le tableau et
les graphiques.

## Détail — Fix #5 (terminologie)

Chercher dans le code toute occurrence de "Rappel" et "Appel effectué" faisant
référence au même compteur, et les unifier sur une seule clé de données
`nb_relances` avec un unique libellé d'affichage : **"Relances effectuées"**.
Si en réalité "Rappel" et "Appel effectué" désignent deux choses distinctes
dans le métier (par ex. un rappel = relance écrite, un appel = relance
téléphonique), NE PAS fusionner — au contraire, les rendre plus explicitement
distincts dans le rapport (deux compteurs séparés et clairement nommés).
Cette clarification métier doit être faite avant d'implémenter, sinon le fix
risque de masquer une vraie distinction.

## Checklist de validation avant mise en prod

- [ ] `nb_simples + nb_reponses == total_courriers` sur un jeu de test
- [ ] Aucune valeur "E-mail envoyé" (ou équivalent) ne reste dans `statut_suivi`
- [ ] `mode_transmission` est renseigné pour 100 % des courriers, y compris les anciens
- [ ] Le bloc signature affiche le même nom que la page de garde sur un rapport généré
- [ ] Rendu PDF réel testé en A4 portrait avec des objets/destinataires longs (cas limite)
- [ ] Rendu testé en impression N&B (pas seulement à l'écran) pour vérifier la lisibilité des badges/légendes

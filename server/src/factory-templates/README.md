# Factory templates

Ces fichiers JSON contiennent les **modèles de base** disponibles dans le modal
« Nouveau template » du designer. L'utilisateur peut les sélectionner comme
point de départ — l'app fait alors une **copie** dans la liste de ses templates
utilisateurs (modifiable / supprimable indépendamment).

## Comment les remplir

1. Lance l'app, va dans Design.
2. Crée un template comme tu le veux (2 horloges, 3 horloges, veille…).
3. Bouton menu (⋯) en haut à droite → **Exporter en JSON**.
4. Ouvre le fichier téléchargé, copie son contenu, et **remplace** le contenu
   du fichier correspondant ici (`2-horloges.json`, `3-horloges.json`, `veille.json`).
5. Tu peux retirer les champs `id` et `activeAt` qui sont propres à un template
   utilisateur. Garde uniquement `name`, `canvas`, `objects` et éventuellement
   un champ `description` que tu ajoutes à la main.
6. Recharge l'app — le nouveau modèle est dispo dans le modal Nouveau.

## Structure attendue

```json
{
  "name": "Nom du modèle",
  "description": "Texte court affiché sous le nom dans le modal",
  "canvas": { "width": 1920, "height": 1080, ... },
  "objects": [ ... ]
}
```

`name` et `canvas` sont obligatoires. `objects` peut être vide.

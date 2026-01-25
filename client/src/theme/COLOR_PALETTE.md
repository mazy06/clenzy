# 🎨 Palette de Couleurs Clenzy

## Identité Visuelle

Cette palette de couleurs est basée sur l'identité visuelle Clenzy, utilisant des tons de bleu-gris harmonieux et professionnels.

## Couleurs Principales

### Primary (Couleur principale)
- **Main**: `#6B8A9A` - Bleu-gris foncé Clenzy
- **Light**: `#8BA3B3` - Bleu-gris moyen
- **Dark**: `#5A7684` - Bleu-gris très foncé
- **Usage**: Boutons principaux, liens, éléments interactifs principaux

### Secondary (Couleur secondaire)
- **Main**: `#A6C0CE` - Bleu-gris clair Clenzy (couleur de marque)
- **Light**: `#C5D5E0` - Bleu-gris très clair
- **Dark**: `#8BA3B3` - Bleu-gris moyen
- **Usage**: Accents, éléments secondaires, fonds

### Clenzy (Couleur de marque)
- **Main**: `#A6C0CE` - Bleu-gris clair Clenzy
- **Light**: `#C5D5E0` - Bleu-gris très clair
- **Dark**: `#8BA3B3` - Bleu-gris moyen
- **Usage**: Logo, éléments de marque, fonds de page

## Couleurs Sémantiques

### Success
- **Main**: `#4A9B8E` - Vert-bleu harmonieux
- **Light**: `#6BB5A8`
- **Dark**: `#3A7A6F`
- **Usage**: Confirmations, statuts positifs, validations

### Warning
- **Main**: `#D4A574` - Ambre/beige chaud harmonieux
- **Light**: `#E8C19A`
- **Dark**: `#B88A5A`
- **Usage**: Avertissements, actions nécessitant attention

### Error
- **Main**: `#C97A7A` - Rouge-rose doux harmonieux
- **Light**: `#E09A9A`
- **Dark**: `#B05A5A`
- **Usage**: Erreurs, suppressions, actions critiques

### Info
- **Main**: `#7BA3C2` - Bleu harmonieux avec Clenzy
- **Light**: `#9BB8D1`
- **Dark**: `#5B7A92`
- **Usage**: Informations, notifications neutres

## Nuances de Gris

Les nuances de gris sont harmonisées avec la palette Clenzy :

- **50**: `#F8FAFC` - Fond très clair
- **100**: `#F1F5F9` - Fond clair
- **200**: `#E2E8F0` - Bordure claire
- **300**: `#CBD5E1` - Bordure moyenne
- **400**: `#94A3B8` - Texte secondaire clair
- **500**: `#64748B` - Texte secondaire
- **600**: `#475569` - Texte secondaire foncé
- **700**: `#334155` - Texte principal foncé
- **800**: `#1E293B` - Texte principal très foncé
- **900**: `#0F172A` - Texte principal extrêmement foncé

## Texte

- **Primary**: `#1E293B` - Texte principal foncé
- **Secondary**: `#64748B` - Texte secondaire harmonisé

## Fond

- **Default**: `#F8FAFC` - Fond très clair harmonisé
- **Paper**: `#FFFFFF` - Fond des cartes et papiers

## Utilisation dans le Code

### Material-UI Theme
Utiliser les couleurs du thème Material-UI plutôt que des couleurs hardcodées :

```tsx
// ✅ Bon
<Button color="primary">Action</Button>
<Typography color="primary.main">Texte</Typography>
<Box sx={{ color: 'secondary.main' }}>Contenu</Box>

// ❌ Mauvais
<Button sx={{ backgroundColor: '#1976d2' }}>Action</Button>
<Typography sx={{ color: '#A6C0CE' }}>Texte</Typography>
```

### Accès aux Couleurs dans sx
```tsx
// Utiliser les couleurs du thème
sx={{ 
  color: 'primary.main',
  backgroundColor: 'secondary.light',
  borderColor: 'success.main'
}}
```

## Règles de Contraste

- **Primary/Secondary sur fond clair**: Utiliser `contrastText` ou `text.primary`
- **Couleurs claires sur fond clair**: Utiliser `text.primary` pour le contraste
- **Couleurs foncées sur fond clair**: Utiliser `contrastText` (généralement blanc)

## Cohérence

Toutes les couleurs doivent être harmonisées avec la palette Clenzy. Éviter d'utiliser des couleurs Material-UI standard qui ne correspondent pas à l'identité visuelle.

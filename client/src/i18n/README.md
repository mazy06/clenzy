# Système d'internationalisation (i18n)

Ce projet utilise `react-i18next` pour gérer l'internationalisation de l'application.

## Installation

Les dépendances suivantes doivent être installées :

```bash
npm install react-i18next i18next i18next-browser-languagedetector
```

## Structure

- `config.ts` : Configuration d'i18next
- `locales/fr.json` : Traductions françaises
- `locales/en.json` : Traductions anglaises

## Utilisation

### Dans un composant React

```tsx
import { useTranslation } from '../hooks/useTranslation';

function MyComponent() {
  const { t, changeLanguage, currentLanguage } = useTranslation();
  
  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <button onClick={() => changeLanguage('en')}>
        Switch to English
      </button>
    </div>
  );
}
```

### Sélecteur de langue

Le composant `LanguageSwitcher` est déjà intégré dans le menu utilisateur. Il permet de basculer entre le français et l'anglais.

## Ajouter de nouvelles traductions

1. Ajoutez la clé dans `locales/fr.json`
2. Ajoutez la traduction correspondante dans `locales/en.json`
3. Utilisez `t('votre.cle')` dans vos composants

## Exemple

```json
// fr.json
{
  "myModule": {
    "title": "Mon titre",
    "description": "Ma description"
  }
}

// en.json
{
  "myModule": {
    "title": "My title",
    "description": "My description"
  }
}
```

```tsx
// Dans votre composant
const { t } = useTranslation();
<h1>{t('myModule.title')}</h1>
```

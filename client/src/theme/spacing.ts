/**
 * Constantes d'espacement pour uniformiser la disposition dans toute l'application
 * Ces valeurs sont basées sur le système de spacing de Material-UI (8px = 1 unité)
 */

export const SPACING = {
  // Espacement de base (8px = 1 unité)
  XS: 1,      // 8px
  SM: 2,      // 16px
  MD: 3,      // 24px
  LG: 4,      // 32px
  XL: 5,      // 40px
  XXL: 6,     // 48px

  // Espacement spécifique aux pages
  PAGE_PADDING: 3,        // 24px - Padding principal des pages
  SECTION_SPACING: 3,     // 24px - Espacement entre sections
  CARD_PADDING: 3,        // 24px - Padding des cartes
  FORM_SPACING: 3,        // 24px - Espacement des formulaires
  
  // Espacement des composants
  COMPONENT_MARGIN: 3,    // 24px - Marge entre composants
  COMPONENT_PADDING: 3,   // 24px - Padding des composants
  
  // Espacement des listes
  LIST_ITEM_SPACING: 2,   // 16px - Espacement entre éléments de liste
  LIST_SECTION_SPACING: 3, // 24px - Espacement entre sections de liste
  
  // Espacement des formulaires
  FORM_FIELD_SPACING: 3,  // 24px - Espacement entre champs de formulaire
  FORM_SECTION_SPACING: 4, // 32px - Espacement entre sections de formulaire
  
  // Espacement des actions
  ACTION_SPACING: 2,      // 16px - Espacement entre boutons d'action
  ACTION_MARGIN: 3,       // 24px - Marge des boutons d'action
} as const;

/**
 * Styles d'espacement prédéfinis pour les composants
 */
export const SPACING_STYLES = {
  // Page principale
  page: {
    p: SPACING.PAGE_PADDING,
  },
  
  // Section de contenu
  section: {
    mb: SPACING.SECTION_SPACING,
  },
  
  // Carte
  card: {
    p: SPACING.CARD_PADDING,
  },
  
  // Formulaire
  form: {
    p: SPACING.FORM_SPACING,
  },
  
  // Section de formulaire
  formSection: {
    mb: SPACING.FORM_SECTION_SPACING,
  },
  
  // Champ de formulaire
  formField: {
    mb: SPACING.FORM_FIELD_SPACING,
  },
  
  // Actions
  actions: {
    mt: SPACING.ACTION_MARGIN,
    display: 'flex',
    gap: SPACING.ACTION_SPACING,
    justifyContent: 'flex-end',
  },
  
  // Actions avec bouton retour
  actionsWithBack: {
    mt: SPACING.ACTION_MARGIN,
    display: 'flex',
    gap: SPACING.ACTION_SPACING,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  // Liste
  list: {
    mt: SPACING.LIST_SECTION_SPACING,
  },
  
  // Élément de liste
  listItem: {
    mb: SPACING.LIST_ITEM_SPACING,
  },
  
  // Message d'alerte
  alert: {
    mb: SPACING.COMPONENT_MARGIN,
  },
  
  // Titre de section
  sectionTitle: {
    mb: SPACING.COMPONENT_MARGIN,
    color: 'primary.main',
  },
  
  // Conteneur de grille
  gridContainer: {
    mb: SPACING.SECTION_SPACING,
  },
  
  // Élément de grille
  gridItem: {
    mb: SPACING.FORM_FIELD_SPACING,
  },
} as const;

/**
 * Utilitaires pour créer des styles d'espacement cohérents
 */
export const createSpacing = {
  // Page avec padding uniforme
  page: (additionalStyles = {}) => ({
    ...SPACING_STYLES.page,
    ...additionalStyles,
  }),
  
  // Section avec marge inférieure
  section: (additionalStyles = {}) => ({
    ...SPACING_STYLES.section,
    ...additionalStyles,
  }),
  
  // Carte avec padding uniforme
  card: (additionalStyles = {}) => ({
    ...SPACING_STYLES.card,
    ...additionalStyles,
  }),
  
  // Formulaire avec espacement uniforme
  form: (additionalStyles = {}) => ({
    ...SPACING_STYLES.form,
    ...additionalStyles,
  }),
  
  // Actions avec espacement uniforme
  actions: (additionalStyles = {}) => ({
    ...SPACING_STYLES.actions,
    ...additionalStyles,
  }),
  
  // Actions avec bouton retour
  actionsWithBack: (additionalStyles = {}) => ({
    ...SPACING_STYLES.actionsWithBack,
    ...additionalStyles,
  }),
} as const;

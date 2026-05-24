/**
 * Re-export des primitives generiques pour preserver le path d'import historique.
 * La logique vit desormais dans {@code components/PageHeaderActionsContext.tsx}
 * pour etre partagee par toutes les pages multi-tabs du PMS (Documents,
 * Reports, Tarification, Billing, Monitoring, etc.).
 */
export {
  PageHeaderActionsProvider as SettingsHeaderProvider,
  usePageHeaderActions as useSettingsHeaderActions,
  usePageHeaderActionsSlot as useSettingsHeaderActionsSlot,
} from '../../components/PageHeaderActionsContext';

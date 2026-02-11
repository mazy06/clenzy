import {
  CleaningServices,
  Build,
  ElectricalServices,
  Plumbing,
  AcUnit,
  Kitchen,
  Yard,
  BugReport,
  Sanitizer,
  Restore,
  MoreHoriz
} from '@mui/icons-material';
import { SvgIconProps } from '@mui/material/SvgIcon';

/**
 * Types d'intervention partagés entre le frontend et le backend
 * Cette énumération doit être synchronisée avec le backend Java
 */
export enum InterventionType {
  // Nettoyage
  CLEANING = 'CLEANING',
  EXPRESS_CLEANING = 'EXPRESS_CLEANING',
  DEEP_CLEANING = 'DEEP_CLEANING',
  WINDOW_CLEANING = 'WINDOW_CLEANING',
  FLOOR_CLEANING = 'FLOOR_CLEANING',
  KITCHEN_CLEANING = 'KITCHEN_CLEANING',
  BATHROOM_CLEANING = 'BATHROOM_CLEANING',
  
  // Maintenance et réparation
  PREVENTIVE_MAINTENANCE = 'PREVENTIVE_MAINTENANCE',
  EMERGENCY_REPAIR = 'EMERGENCY_REPAIR',
  ELECTRICAL_REPAIR = 'ELECTRICAL_REPAIR',
  PLUMBING_REPAIR = 'PLUMBING_REPAIR',
  HVAC_REPAIR = 'HVAC_REPAIR',
  APPLIANCE_REPAIR = 'APPLIANCE_REPAIR',
  
  // Services spécialisés
  GARDENING = 'GARDENING',
  EXTERIOR_CLEANING = 'EXTERIOR_CLEANING',
  PEST_CONTROL = 'PEST_CONTROL',
  DISINFECTION = 'DISINFECTION',
  RESTORATION = 'RESTORATION',
  
  // Autre
  OTHER = 'OTHER'
}

/**
 * Interface pour les options d'affichage des types d'intervention
 */
export interface InterventionTypeOption {
  value: InterventionType;
  label: string;
  category: 'cleaning' | 'maintenance' | 'specialized' | 'other';
  color: string;
  icon: React.ComponentType<SvgIconProps>;
}

/**
 * Configuration complète des types d'intervention avec leurs métadonnées
 */
export const INTERVENTION_TYPE_OPTIONS: InterventionTypeOption[] = [
  // Nettoyage
  { value: InterventionType.CLEANING, label: 'Nettoyage', category: 'cleaning', color: 'success.main', icon: CleaningServices },
  { value: InterventionType.EXPRESS_CLEANING, label: 'Nettoyage Express', category: 'cleaning', color: 'success.main', icon: CleaningServices },
  { value: InterventionType.DEEP_CLEANING, label: 'Nettoyage en Profondeur', category: 'cleaning', color: 'success.main', icon: CleaningServices },
  { value: InterventionType.WINDOW_CLEANING, label: 'Nettoyage des Vitres', category: 'cleaning', color: 'success.main', icon: CleaningServices },
  { value: InterventionType.FLOOR_CLEANING, label: 'Nettoyage des Sols', category: 'cleaning', color: 'success.main', icon: CleaningServices },
  { value: InterventionType.KITCHEN_CLEANING, label: 'Nettoyage de la Cuisine', category: 'cleaning', color: 'success.main', icon: Kitchen },
  { value: InterventionType.BATHROOM_CLEANING, label: 'Nettoyage des Sanitaires', category: 'cleaning', color: 'success.main', icon: CleaningServices },
  
  // Maintenance et réparation
  { value: InterventionType.PREVENTIVE_MAINTENANCE, label: 'Maintenance Préventive', category: 'maintenance', color: 'warning.main', icon: Build },
  { value: InterventionType.EMERGENCY_REPAIR, label: 'Réparation d\'Urgence', category: 'maintenance', color: 'warning.main', icon: Build },
  { value: InterventionType.ELECTRICAL_REPAIR, label: 'Réparation Électrique', category: 'maintenance', color: 'warning.main', icon: ElectricalServices },
  { value: InterventionType.PLUMBING_REPAIR, label: 'Réparation Plomberie', category: 'maintenance', color: 'warning.main', icon: Plumbing },
  { value: InterventionType.HVAC_REPAIR, label: 'Réparation Climatisation', category: 'maintenance', color: 'warning.main', icon: AcUnit },
  { value: InterventionType.APPLIANCE_REPAIR, label: 'Réparation Électroménager', category: 'maintenance', color: 'warning.main', icon: Build },
  
  // Services spécialisés
  { value: InterventionType.GARDENING, label: 'Jardinage', category: 'specialized', color: 'purple', icon: Yard },
  { value: InterventionType.EXTERIOR_CLEANING, label: 'Nettoyage Extérieur', category: 'specialized', color: 'purple', icon: CleaningServices },
  { value: InterventionType.PEST_CONTROL, label: 'Désinsectisation', category: 'specialized', color: 'purple', icon: BugReport },
  { value: InterventionType.DISINFECTION, label: 'Désinfection', category: 'specialized', color: 'purple', icon: Sanitizer },
  { value: InterventionType.RESTORATION, label: 'Remise en État', category: 'specialized', color: 'purple', icon: Restore },
  
  // Autre
  { value: InterventionType.OTHER, label: 'Autre', category: 'other', color: 'error.main', icon: MoreHoriz }
];

/**
 * Fonctions utilitaires pour les types d'intervention
 */
export class InterventionTypeUtils {
  /**
   * Obtenir l'option d'un type d'intervention
   */
  static getOption(type: InterventionType): InterventionTypeOption | undefined {
    return INTERVENTION_TYPE_OPTIONS.find(option => option.value === type);
  }

  /**
   * Obtenir le label d'un type d'intervention
   */
  static getLabel(type: InterventionType): string {
    const option = this.getOption(type);
    return option?.label || type;
  }

  /**
   * Obtenir la catégorie d'un type d'intervention
   */
  static getCategory(type: InterventionType): string {
    const option = this.getOption(type);
    return option?.category || 'other';
  }

  /**
   * Obtenir la couleur d'un type d'intervention
   */
  static getColor(type: InterventionType): string {
    const option = this.getOption(type);
    return option?.color || 'primary.main';
  }

  /**
   * Filtrer par catégorie
   */
  static getByCategory(category: string): InterventionTypeOption[] {
    return INTERVENTION_TYPE_OPTIONS.filter(option => option.category === category);
  }

  /**
   * Obtenir tous les types de nettoyage
   */
  static getCleaningTypes(): InterventionTypeOption[] {
    return this.getByCategory('cleaning');
  }

  /**
   * Obtenir tous les types de maintenance
   */
  static getMaintenanceTypes(): InterventionTypeOption[] {
    return this.getByCategory('maintenance');
  }

  /**
   * Obtenir tous les types spécialisés
   */
  static getSpecializedTypes(): InterventionTypeOption[] {
    return this.getByCategory('specialized');
  }

  /**
   * Vérifier si un type appartient à une catégorie
   */
  static isCategory(type: InterventionType, category: string): boolean {
    return this.getCategory(type) === category;
  }

  /**
   * Vérifier si c'est un type de nettoyage
   */
  static isCleaning(type: InterventionType): boolean {
    return this.isCategory(type, 'cleaning');
  }

  /**
   * Vérifier si c'est un type de maintenance
   */
  static isMaintenance(type: InterventionType): boolean {
    return this.isCategory(type, 'maintenance');
  }

  /**
   * Vérifier si c'est un type spécialisé
   */
  static isSpecialized(type: InterventionType): boolean {
    return this.isCategory(type, 'specialized');
  }
}

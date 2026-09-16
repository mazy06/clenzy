package com.clenzy.marketplace.service;

import com.clenzy.model.InterventionType;
import com.clenzy.model.UserRole;

import java.util.List;
import java.util.Set;

/**
 * Traduction des metiers de l'exploitation vers les categories de la place de
 * marche.
 *
 * <h2>Pourquoi une traduction et pas une reutilisation</h2>
 * <p>{@code InterventionRoleFit} repond a une autre question : « ce role peut-il
 * PRENDRE cette intervention ? ». Ici on demande « dans quel rayon du catalogue
 * cette prestation se VEND-elle ? ». Les deux coincident souvent et divergent
 * parfois — la blanchisserie est un rayon a part entiere alors qu'elle releve du
 * nettoyage cote affectation. Fusionner les deux tables aurait force l'une des
 * deux reponses a mentir.</p>
 */
public final class ProviderCategoryMapper {

    private ProviderCategoryMapper() {}

    private static final Set<InterventionType> CLEANING = Set.of(
        InterventionType.CLEANING,
        InterventionType.EXPRESS_CLEANING,
        InterventionType.DEEP_CLEANING,
        InterventionType.WINDOW_CLEANING,
        InterventionType.FLOOR_CLEANING,
        InterventionType.KITCHEN_CLEANING,
        InterventionType.BATHROOM_CLEANING,
        InterventionType.DISINFECTION);

    private static final Set<InterventionType> MAINTENANCE = Set.of(
        InterventionType.PREVENTIVE_MAINTENANCE,
        InterventionType.EMERGENCY_REPAIR,
        InterventionType.ELECTRICAL_REPAIR,
        InterventionType.PLUMBING_REPAIR,
        InterventionType.HVAC_REPAIR,
        InterventionType.APPLIANCE_REPAIR,
        InterventionType.RESTORATION);

    private static final Set<InterventionType> EXTERIOR = Set.of(
        InterventionType.GARDENING,
        InterventionType.EXTERIOR_CLEANING,
        InterventionType.PEST_CONTROL);

    /** Metiers de terrain repris par l'import. Les autres roles ne vendent rien. */
    static final List<UserRole> PROVIDER_ROLES = List.of(
        UserRole.TECHNICIAN,
        UserRole.HOUSEKEEPER,
        UserRole.LAUNDRY,
        UserRole.EXTERIOR_TECH,
        UserRole.SUPERVISOR);

    /** Categorie d'un type d'intervention. {@code OTHER} pour tout ce qui ne se range pas. */
    static String forInterventionType(String rawType) {
        InterventionType type = InterventionType.fromString(rawType);
        if (type == null) return "OTHER";
        if (CLEANING.contains(type)) return "CLEANING";
        if (MAINTENANCE.contains(type)) return "MAINTENANCE";
        if (EXTERIOR.contains(type)) return "EXTERIOR";
        return "OTHER";
    }

    /**
     * Categorie par defaut d'un role, lorsque l'intervenant n'a declare aucune
     * prestation.
     *
     * <p>Sans elle, les comptes qui n'ont jamais rempli leurs tarifs — la
     * majorite — arriveraient au catalogue sans aucun metier, donc introuvables
     * par le filtre qui sert le plus.</p>
     */
    static String forRole(UserRole role) {
        return switch (role) {
            case HOUSEKEEPER -> "CLEANING";
            case TECHNICIAN -> "MAINTENANCE";
            case LAUNDRY -> "LAUNDRY";
            case EXTERIOR_TECH -> "EXTERIOR";
            case SUPERVISOR -> "CONCIERGE";
            default -> "OTHER";
        };
    }

    /**
     * Role plateforme d'un prestataire, deduit de son metier principal.
     *
     * <p>Inverse de {@link #forRole} — garde a cote d'elle pour que les deux
     * restent coherentes. Le repli est {@code TECHNICIAN} : c'est le role
     * d'intervention le plus general, et il n'ouvre rien de plus qu'une
     * intervention. Se tromper vers le haut ouvrirait des droits ; se tromper
     * vers lui ne coute qu'un ajustement.</p>
     */
    static UserRole roleForCategory(String categoryCode) {
        if (categoryCode == null) return UserRole.TECHNICIAN;
        return switch (categoryCode) {
            case "CLEANING" -> UserRole.HOUSEKEEPER;
            case "LAUNDRY", "LINEN" -> UserRole.LAUNDRY;
            case "EXTERIOR", "POOL" -> UserRole.EXTERIOR_TECH;
            case "CONCIERGE", "KEYS" -> UserRole.SUPERVISOR;
            default -> UserRole.TECHNICIAN;
        };
    }

    /** Libelle de la prestation par defaut creee pour un role. */
    static String defaultOfferLabel(UserRole role) {
        return switch (role) {
            case HOUSEKEEPER -> "Ménage entre deux séjours";
            case TECHNICIAN -> "Maintenance et petits travaux";
            case LAUNDRY -> "Blanchisserie du linge de maison";
            case EXTERIOR_TECH -> "Entretien des extérieurs";
            case SUPERVISOR -> "Supervision et coordination sur site";
            default -> "Prestation à préciser";
        };
    }

    /**
     * Prestation du CATALOGUE correspondant au metier d'un role.
     *
     * <p>Rattacher la reprise au referentiel plutot que de recreer un libelle
     * libre : c'est ce qui rend les fiches importees filtrables et leurs prix
     * comparables aux autres. Sans ce lien, les cinquante-quatre comptes repris
     * seraient invisibles du filtre par prestation.</p>
     */
    static String defaultServiceItemCode(UserRole role) {
        return switch (role) {
            case HOUSEKEEPER -> "cleaning-turnover";
            case TECHNICIAN -> "maintenance-handyman";
            case LAUNDRY -> "laundry-bed-linen";
            case EXTERIOR_TECH -> "exterior-garden";
            case SUPERVISOR -> "concierge-guest-support";
            default -> null;
        };
    }

    /** Inverse des correspondances certaines utilisées par l'import du catalogue. */
    static InterventionType interventionTypeForServiceItemCode(String serviceItemCode) {
        if (serviceItemCode == null || serviceItemCode.isBlank()) return InterventionType.OTHER;
        for (InterventionType type : InterventionType.values()) {
            if (serviceItemCode.equals(serviceItemCodeForInterventionType(type.name()))) return type;
        }
        return InterventionType.OTHER;
    }

    /**
     * Prestation du catalogue correspondant a un type d'intervention declare.
     *
     * <p>Volontairement PARTIELLE : seuls les types dont la correspondance est
     * certaine sont mappes. Un rattachement approximatif ferait apparaitre un
     * professionnel sous une prestation qu'il ne vend pas — pire qu'un libelle
     * libre, qui au moins ne ment pas.</p>
     */
    public static String serviceItemCodeForInterventionType(String rawType) {
        InterventionType type = InterventionType.fromString(rawType);
        if (type == null) return null;
        return switch (type) {
            case CLEANING -> "cleaning-turnover";
            case DEEP_CLEANING -> "cleaning-deep";
            case WINDOW_CLEANING -> "cleaning-windows";
            case DISINFECTION -> "cleaning-disinfection";
            case PLUMBING_REPAIR -> "maintenance-plumbing";
            case ELECTRICAL_REPAIR -> "maintenance-electrical";
            case HVAC_REPAIR -> "maintenance-hvac";
            case APPLIANCE_REPAIR -> "maintenance-appliance";
            case PREVENTIVE_MAINTENANCE -> "maintenance-preventive";
            case EMERGENCY_REPAIR -> "maintenance-emergency";
            case GARDENING -> "exterior-garden";
            case EXTERIOR_CLEANING -> "exterior-terrace";
            case PEST_CONTROL -> "pest-insects";
            case RESTORATION -> "renovation-painting";
            default -> null;
        };
    }
}

package com.clenzy.service.agent;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.UserRole;
import com.clenzy.util.JwtRoleExtractor;

import java.util.List;
import java.util.Set;

/**
 * Politique d'exposition des outils de l'assistant par rôle (least-privilege).
 *
 * <p><b>Pourquoi</b> : l'agent peut lire des données financières, des réservations,
 * des tarifs… Un rôle <b>opérationnel</b> (technicien, ménage…) ne doit pouvoir agir
 * ou s'informer que sur <b>ses propres interventions</b>, jamais sur les autres
 * données. On restreint donc l'ensemble d'outils exposé au LLM selon le rôle.</p>
 *
 * <p><b>Deux couches</b> :</p>
 * <ol>
 *   <li><b>Exposition</b> : {@link #filterForRole} ne présente au LLM que les outils
 *       autorisés (un rôle opérationnel ne voit pas {@code get_financial_summary}…).</li>
 *   <li><b>Enforcement</b> : {@link #isToolAllowed} est revérifié à l'exécution
 *       (defense-in-depth, au cas où le LLM invoque un outil non exposé).</li>
 * </ol>
 *
 * <p>Le <b>scoping par propriétaire</b> (un technicien ne voit que SES interventions)
 * est déjà assuré au niveau service ({@code InterventionService.listWithRoleBasedAccess}
 * via le JWT) — cette politique gère uniquement QUELS outils sont disponibles.</p>
 *
 * <p>Stateless : utilitaire statique pur (le rôle vient du JWT via
 * {@link JwtRoleExtractor}). JWT absent → rôle HOST par défaut → accès complet
 * (les endpoints exigent l'authentification en production ; le JWT est alors présent).</p>
 */
public final class RoleToolPolicy {

    private RoleToolPolicy() {}

    /**
     * Rôles opérationnels : assistant restreint à LEURS interventions. Aligné sur le
     * filtrage role-based de {@code InterventionService} et sur SUPERVISION_OPERATOR du
     * front. SUPERVISOR inclus (opérationnel élargi : interventions de son équipe).
     */
    private static final Set<UserRole> OPERATIONAL_ROLES = Set.of(
            UserRole.TECHNICIAN,
            UserRole.HOUSEKEEPER,
            UserRole.SUPERVISOR,
            UserRole.LAUNDRY,
            UserRole.EXTERIOR_TECH);

    /**
     * Outils autorisés pour un rôle opérationnel : interventions (déjà scopées par
     * assigné au niveau service) + météo + navigation. AUCUN outil
     * finance / réservation / tarif / autre logement (non scopés → fuite de données).
     */
    private static final Set<String> OPERATIONAL_TOOLS = Set.of(
            "get_interventions_by_status",
            "list_cleaning_tasks",
            "update_intervention_status",
            "get_weather_forecast",
            "suggest_navigation");

    /** True si le rôle courant est opérationnel (assistant restreint). */
    public static boolean isOperational(AgentContext context) {
        if (context == null) {
            return false;
        }
        UserRole role = JwtRoleExtractor.extractUserRole(context.jwt());
        return role != null && OPERATIONAL_ROLES.contains(role);
    }

    /** True si l'outil {@code toolName} est autorisé pour le rôle courant. */
    public static boolean isToolAllowed(String toolName, AgentContext context) {
        if (!isOperational(context)) {
            return true;  // rôles de gestion : accès complet
        }
        return OPERATIONAL_TOOLS.contains(toolName);
    }

    /** Sous-ensemble d'outils exposable au LLM selon le rôle courant. */
    public static List<ToolDescriptor> filterForRole(List<ToolDescriptor> all, AgentContext context) {
        if (all == null || !isOperational(context)) {
            return all;
        }
        return all.stream()
                .filter(d -> OPERATIONAL_TOOLS.contains(d.name()))
                .toList();
    }
}

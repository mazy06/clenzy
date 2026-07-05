package com.clenzy.service;

import com.clenzy.dto.SystemAutomationDto;
import com.clenzy.model.Organization;
import com.clenzy.repository.MessagingAutomationConfigRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Inventaire des automatisations qui vivent HORS du hub (code / autre mécanisme),
 * avec leur statut EFFECTIF pour l'organisation courante.
 *
 * <p>But : donner dans l'écran d'automatisation une vue exhaustive et honnête —
 * l'utilisateur voit aussi ce qui n'est PAS piloté par une règle. Le statut n'est
 * jamais codé en dur : il est dérivé de l'état réel (flags globaux, config de
 * l'org). Une automatisation transactionnelle (déclenchée par un événement métier :
 * livraison de code, lien de paiement) est marquée « Transactionnel » car son
 * chemin est toujours vivant, elle ne s'exécute que lorsque l'événement survient.</p>
 */
@Service
public class SystemAutomationService {

    private final OrganizationRepository organizationRepository;
    private final MessagingAutomationConfigRepository messagingConfigRepository;
    private final TenantContext tenantContext;
    private final boolean cartRecoveryGloballyEnabled;

    public SystemAutomationService(
            OrganizationRepository organizationRepository,
            MessagingAutomationConfigRepository messagingConfigRepository,
            TenantContext tenantContext,
            @Value("${clenzy.booking.cart-recovery.enabled:false}") boolean cartRecoveryGloballyEnabled) {
        this.organizationRepository = organizationRepository;
        this.messagingConfigRepository = messagingConfigRepository;
        this.tenantContext = tenantContext;
        this.cartRecoveryGloballyEnabled = cartRecoveryGloballyEnabled;
    }

    @Transactional(readOnly = true)
    public List<SystemAutomationDto> listForCurrentOrg() {
        Long orgId = tenantContext.getOrganizationId();

        // Relance panier abandonné : flag GLOBAL (@Value) ET flag org.
        boolean orgCartRecovery = organizationRepository.findById(orgId)
            .map(Organization::isAbandonedCartRecoveryEnabled)
            .orElse(false);
        boolean cartRecoveryEffective = cartRecoveryGloballyEnabled && orgCartRecovery;

        // Push tarifaire automatique : flag org (MessagingAutomationConfig).
        boolean pricingPushEffective = messagingConfigRepository.findByOrganizationId(orgId)
            .map(c -> c.isAutoPushPricingEnabled())
            .orElse(false);

        return List.of(
            new SystemAutomationDto(
                "abandoned_cart_recovery",
                "Relance de panier abandonné",
                "Email de relance aux voyageurs ayant commencé une réservation sans la finaliser.",
                "Panier abandonné (au bout d'un délai)",
                "Envoyer un email de relance",
                cartRecoveryEffective,
                cartRecoveryEffective ? "ACTIVE" : "INACTIVE",
                cartRecoveryEffective ? "Actif" : "Inactif",
                "Planificateur"
            ),
            new SystemAutomationDto(
                "auto_pricing_push",
                "Push tarifaire automatique",
                "Publie automatiquement les tarifs calculés vers les canaux connectés.",
                "Recalcul des tarifs",
                "Publier les prix sur les canaux",
                pricingPushEffective,
                pricingPushEffective ? "ACTIVE" : "INACTIVE",
                pricingPushEffective ? "Actif" : "Inactif",
                "Planificateur"
            ),
            new SystemAutomationDto(
                "access_code_delivery",
                "Livraison du code d'accès",
                "Envoie au voyageur son code d'accès (serrure connectée / échange de clés) au moment du check-in.",
                "Check-in avec un code d'accès disponible",
                "Envoyer le code d'accès",
                true,
                "TRANSACTIONAL",
                "Transactionnel",
                "Flux serrure"
            ),
            new SystemAutomationDto(
                "payment_link_delivery",
                "Lien de paiement",
                "Envoie au voyageur un lien de paiement lorsqu'un solde est dû.",
                "Solde à régler sur une réservation",
                "Envoyer un lien de paiement",
                true,
                "TRANSACTIONAL",
                "Transactionnel",
                "Flux paiement"
            ),
            new SystemAutomationDto(
                "access_code_rotation",
                "Rotation du code d'accès",
                "Fait tourner le code d'accès statique après le départ du voyageur (activable par logement).",
                "Après le départ (logements opt-in)",
                "Renouveler le code d'accès",
                true,
                "OPT_IN",
                "Opt-in par logement",
                "Planificateur"
            )
        );
    }
}

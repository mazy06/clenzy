package com.clenzy.integration.channex.event;

/**
 * Event Spring application emis quand les pricing settings tarifaires d'une
 * property changent cote Clenzy et qu'on veut declencher un push auto vers
 * Channex via {@code ChannexSyncService.pushPricingSettings}.
 *
 * <p>Origines typiques :</p>
 * <ul>
 *   <li>Modif d'un {@link com.clenzy.model.RatePlan}(WEEKEND)</li>
 *   <li>Modif d'un {@link com.clenzy.model.OccupancyPricing}</li>
 *   <li>Modif d'un {@link com.clenzy.model.LengthOfStayDiscount} (weekly/monthly)</li>
 *   <li>Modif du tarif de base / min-max nights cote Property</li>
 * </ul>
 *
 * <p><b>Strategie</b> : event in-process Spring (pas Kafka — pas besoin d'un
 * topic dedie pour ce flow point-to-point local). Le listener
 * {@code ChannexPricingSettingsAutoPushListener} est asynchrone (@Async) pour
 * ne pas bloquer le caller qui modifie la donnee.</p>
 *
 * <p><b>Tenant</b> : on transporte explicitement l'orgId car le listener tourne
 * hors TenantContext (thread @Async). Pas de fallback : si orgId null, skip.</p>
 *
 * @param clenzyPropertyId property concernee
 * @param organizationId   tenant
 * @param source           label informatif pour les logs (ex: "WEEKEND_RATE_PLAN_MODIFIED")
 */
public record ChannexPricingSettingsChangedEvent(
    Long clenzyPropertyId,
    Long organizationId,
    String source
) {}

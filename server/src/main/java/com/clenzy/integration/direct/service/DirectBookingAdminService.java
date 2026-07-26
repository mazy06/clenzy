package com.clenzy.integration.direct.service;

import com.clenzy.integration.direct.model.DirectBookingConfiguration;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.model.Property;
import com.clenzy.integration.direct.model.PromoCode;
import com.clenzy.integration.direct.repository.DirectBookingConfigRepository;
import com.clenzy.integration.direct.repository.PromoCodeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Administration du Direct Booking : configuration du widget + codes promo
 * — refactor T-ARCH-01 : plus aucun repository dans les controllers.
 *
 * <p>Toutes les operations sont scopees par l'{@code orgId} resolu du
 * {@link com.clenzy.tenant.TenantContext} par le controller. Les chargements
 * par ID filtrent explicitement sur l'organisation : un code promo d'une
 * autre organisation est introuvable (pas d'IDOR possible).</p>
 */
@Service
@Transactional(readOnly = true)
public class DirectBookingAdminService {

    private final DirectBookingConfigRepository configRepository;
    private final PromoCodeRepository promoCodeRepository;
    private final PropertyRepository propertyRepository;
    private final OrganizationAccessGuard organizationAccessGuard;

    public DirectBookingAdminService(DirectBookingConfigRepository configRepository,
                                     PromoCodeRepository promoCodeRepository,
                                     PropertyRepository propertyRepository,
                                     OrganizationAccessGuard organizationAccessGuard) {
        this.configRepository = configRepository;
        this.promoCodeRepository = promoCodeRepository;
        this.propertyRepository = propertyRepository;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * Refuse la creation d'une configuration sur un logement d'une autre organisation.
     *
     * <p>{@code findByPropertyIdAndOrganizationId} est bien borne, mais quand il ne trouve
     * rien le code construisait une configuration NEUVE sur le {@code propertyId} demande,
     * sans jamais verifier a qui ce logement appartient. La config d'un bien tiers etait
     * ainsi rattachee a l'organisation de l'appelant, exposant prix et disponibilites via
     * l'endpoint anonyme du widget (audit securite 2026-07-26, constat P1-17).
     */
    private void requirePropertyInOrganization(Long propertyId, Long orgId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Logement introuvable: " + propertyId));
        organizationAccessGuard.requireSameOrganization(
                property.getOrganizationId(), orgId, "Logement hors de votre organisation");
    }

    // ── Configuration du widget ──────────────────────────────────────────

    /** Cree ou met a jour la configuration du widget d'une propriete de l'org. */
    @Transactional
    public DirectBookingConfiguration updateWidgetConfig(Long propertyId, Long orgId,
                                                         DirectBookingConfiguration update) {
        requirePropertyInOrganization(propertyId, orgId);
        DirectBookingConfiguration existing = configRepository
                .findByPropertyIdAndOrganizationId(propertyId, orgId)
                .orElseGet(() -> new DirectBookingConfiguration(orgId, propertyId));

        existing.setEnabled(update.isEnabled());
        existing.setWidgetThemeColor(update.getWidgetThemeColor());
        existing.setWidgetLogo(update.getWidgetLogo());
        existing.setCustomCss(update.getCustomCss());
        existing.setTermsAndConditionsUrl(update.getTermsAndConditionsUrl());
        existing.setCancellationPolicyText(update.getCancellationPolicyText());
        existing.setConfirmationEmailTemplate(update.getConfirmationEmailTemplate());
        existing.setAutoConfirm(update.isAutoConfirm());
        existing.setRequirePayment(update.isRequirePayment());
        existing.setAllowedCurrencies(update.getAllowedCurrencies());

        return configRepository.save(existing);
    }

    // ── Codes promo ──────────────────────────────────────────────────────

    /** Liste les codes promo de l'organisation. */
    public List<PromoCode> listPromoCodes(Long orgId) {
        return promoCodeRepository.findAllByOrganizationId(orgId);
    }

    /** Cree un code promo rattache a l'organisation (compteur d'usages remis a zero). */
    @Transactional
    public PromoCode createPromoCode(Long orgId, PromoCode promoCode) {
        promoCode.setOrganizationId(orgId);
        promoCode.setCurrentUses(0);
        return promoCodeRepository.save(promoCode);
    }

    /** Met a jour un code promo de l'organisation. */
    @Transactional
    public PromoCode updatePromoCode(Long orgId, Long id, PromoCode update) {
        PromoCode existing = requireOrgPromoCode(orgId, id);

        existing.setCode(update.getCode());
        existing.setDiscountType(update.getDiscountType());
        existing.setDiscountValue(update.getDiscountValue());
        existing.setValidFrom(update.getValidFrom());
        existing.setValidUntil(update.getValidUntil());
        existing.setMinNights(update.getMinNights());
        existing.setMaxUses(update.getMaxUses());
        existing.setPropertyId(update.getPropertyId());
        existing.setActive(update.isActive());

        return promoCodeRepository.save(existing);
    }

    /** Desactive un code promo de l'organisation (soft delete). */
    @Transactional
    public void deactivatePromoCode(Long orgId, Long id) {
        PromoCode existing = requireOrgPromoCode(orgId, id);
        existing.setActive(false);
        promoCodeRepository.save(existing);
    }

    /** Chargement par ID avec validation d'organisation (hors org = introuvable). */
    private PromoCode requireOrgPromoCode(Long orgId, Long id) {
        return promoCodeRepository.findById(id)
                .filter(p -> orgId.equals(p.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Code promo introuvable: " + id));
    }
}

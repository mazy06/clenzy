package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Phase C1 — Applications Channex par API : jusqu'ici l'activation des apps
 * (PCI, Stripe Tokenization, Messages, Booking CRS, Payments) etait une etape
 * MANUELLE du dashboard Channex — oubliable, et bloquante pour les features
 * qui en dependent ({@code ChannexStripeTokenizationService} exige
 * {@code stripe_tokenization}, le CRS exige {@code booking_crs}...).
 *
 * <p>Codes d'apps documentes : {@code channex_messages}, {@code booking_crs},
 * {@code stripe_tokenization}, {@code channex_payments}. Certaines apps sont
 * payantes cote Channex ({@code price}/{@code vr_price} dans le catalogue).</p>
 */
@Service
public class ChannexApplicationsService {

    private static final Logger log = LoggerFactory.getLogger(ChannexApplicationsService.class);

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;

    public ChannexApplicationsService(ChannexClient channexClient,
                                      ChannexPropertyMappingRepository mappingRepository) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
    }

    /** Vue simplifiee d'une app (catalogue ou installee). */
    public record ApplicationView(String id, String code, String title,
                                  String price, String vrPrice,
                                  String installationId, String propertyId) {}

    /** Catalogue des applications disponibles sur le compte Channex. */
    public List<ApplicationView> listCatalog() {
        List<ApplicationView> catalog = new ArrayList<>();
        for (JsonNode node : channexClient.listApplications()) {
            JsonNode attributes = node.path("attributes");
            catalog.add(new ApplicationView(
                node.path("id").asText(null),
                attributes.path("code").asText(attributes.path("application_code").asText(null)),
                attributes.path("title").asText(null),
                attributes.path("price").asText(null),
                attributes.path("vr_price").asText(null),
                null, null));
        }
        return catalog;
    }

    /** Applications installees sur la property Channex mappee a cette propriete Clenzy. */
    public List<ApplicationView> listInstalled(Long clenzyPropertyId, Long orgId) {
        ChannexPropertyMapping mapping = requireMapping(clenzyPropertyId, orgId);
        List<ApplicationView> installed = new ArrayList<>();
        for (JsonNode node : channexClient.listInstalledApplications()) {
            JsonNode attributes = node.path("attributes");
            if (!mapping.getChannexPropertyId().equals(attributes.path("property_id").asText(null))) {
                continue; // installation d'une autre property du compte
            }
            installed.add(new ApplicationView(
                attributes.path("application_id").asText(null),
                attributes.path("application_code").asText(null),
                null, null, null,
                node.path("id").asText(attributes.path("id").asText(null)),
                attributes.path("property_id").asText(null)));
        }
        return installed;
    }

    /** Installe une app par code sur la property mappee. Retourne l'installation id. */
    public String install(Long clenzyPropertyId, Long orgId, String applicationCode) {
        ChannexPropertyMapping mapping = requireMapping(clenzyPropertyId, orgId);
        String installationId = channexClient.installApplication(
            mapping.getChannexPropertyId(), applicationCode);
        log.info("ChannexApplications: {} installee property={} (installation={})",
            applicationCode, clenzyPropertyId, installationId);
        return installationId;
    }

    /**
     * Desinstalle une app. Ownership : l'installation doit appartenir a la
     * property Channex mappee de cette propriete Clenzy (verifie via la liste
     * des installations — l'id seul ne porte pas l'org).
     */
    public void uninstall(Long clenzyPropertyId, Long orgId, String installationId) {
        boolean owned = listInstalled(clenzyPropertyId, orgId).stream()
            .anyMatch(app -> installationId.equals(app.installationId()));
        if (!owned) {
            throw new org.springframework.security.access.AccessDeniedException(
                "Installation " + installationId + " etrangere a la propriete " + clenzyPropertyId);
        }
        channexClient.uninstallApplication(installationId);
        log.info("ChannexApplications: installation {} desinstallee (property={})",
            installationId, clenzyPropertyId);
    }

    private ChannexPropertyMapping requireMapping(Long clenzyPropertyId, Long orgId) {
        return mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId));
    }
}

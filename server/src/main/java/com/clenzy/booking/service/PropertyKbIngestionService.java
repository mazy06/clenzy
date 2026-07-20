package com.clenzy.booking.service;

import com.clenzy.booking.dto.PublicPropertyDto;
import com.clenzy.service.agent.kb.IngestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Ingestion automatique des hébergements d'une org dans la knowledge base (2.13) — alimente le RAG
 * du concierge IA : chaque hébergement devient une section markdown {@code ## }, donc un chunk
 * vectoriel propre, individuellement recherchable (réutilise {@link IngestionService}, idempotent
 * par {@code sourcePath}). Source de données = le même contrat public que le widget/concierge
 * ({@link PublicBookingService#getProperties}) → aucune donnée sensible, pas d'accès entité direct.
 */
@Service
public class PropertyKbIngestionService {

    private static final Logger log = LoggerFactory.getLogger(PropertyKbIngestionService.class);

    /** sourcePath stable par org → l'ingestion remplace le doc précédent (pas d'accumulation). */
    static final String SOURCE_PREFIX = "auto/properties/";

    private final PublicBookingService bookingService;
    private final IngestionService ingestionService;

    public PropertyKbIngestionService(PublicBookingService bookingService, IngestionService ingestionService) {
        this.bookingService = bookingService;
        this.ingestionService = ingestionService;
    }

    /**
     * (Re)ingère les hébergements de l'org dans la KB. Retourne {@code true} si un doc a été ingéré,
     * {@code false} si l'org n'a aucun hébergement publié ou si la résolution échoue (best-effort).
     */
    public boolean ingestForOrg(Long orgId) {
        if (orgId == null) {
            return false;
        }
        final List<PublicPropertyDto> props;
        try {
            props = bookingService.getProperties(bookingService.resolveOrgById(orgId));
        } catch (RuntimeException e) {
            log.debug("KB auto-ingest : hébergements indisponibles org={} ({})", orgId, e.getMessage());
            return false;
        }
        if (props.isEmpty()) {
            return false;
        }
        // ingestMarkdownIfChanged : le cron quotidien ne re-embed pas un portefeuille
        // inchange (cout API + churn de chunks evites).
        return ingestionService.ingestMarkdownIfChanged(
                SOURCE_PREFIX + orgId, buildMarkdown(props), orgId, "fr");
    }

    /** Markdown : un {@code ## } par hébergement (= un chunk) avec ses caractéristiques publiques. */
    String buildMarkdown(List<PublicPropertyDto> props) {
        final StringBuilder sb = new StringBuilder("# Hébergements proposés\n\n");
        for (PublicPropertyDto p : props) {
            sb.append("## ").append(p.name() != null && !p.name().isBlank() ? p.name() : "Hébergement").append("\n\n");
            if (p.type() != null) sb.append("- Type : ").append(p.type()).append('\n');
            final String location = location(p);
            if (!location.isBlank()) sb.append("- Localisation : ").append(location).append('\n');
            final String capacity = capacity(p);
            if (!capacity.isBlank()) sb.append("- Capacité : ").append(capacity).append('\n');
            if (p.priceFrom() != null) {
                sb.append("- Tarif indicatif : dès ").append(p.priceFrom()).append(' ')
                  .append(p.currency() != null ? p.currency() : "EUR").append(" / nuit\n");
            }
            if (p.minimumNights() != null && p.minimumNights() > 1) {
                sb.append("- Séjour minimum : ").append(p.minimumNights()).append(" nuits\n");
            }
            if (p.amenities() != null && !p.amenities().isEmpty()) {
                sb.append("- Équipements : ").append(String.join(", ", p.amenities())).append('\n');
            }
            if (p.checkInTime() != null || p.checkOutTime() != null) {
                sb.append("- Arrivée : ").append(p.checkInTime() != null ? p.checkInTime() : "—")
                  .append(" / Départ : ").append(p.checkOutTime() != null ? p.checkOutTime() : "—").append('\n');
            }
            sb.append('\n');
        }
        return sb.toString();
    }

    private static String location(PublicPropertyDto p) {
        final StringBuilder s = new StringBuilder();
        if (p.city() != null) s.append(p.city());
        if (p.country() != null) {
            if (s.length() > 0) s.append(", ");
            s.append(p.country());
        }
        return s.toString();
    }

    private static String capacity(PublicPropertyDto p) {
        final StringBuilder s = new StringBuilder();
        if (p.bedroomCount() != null) s.append(p.bedroomCount()).append(" chambre(s)");
        if (p.bathroomCount() != null) {
            if (s.length() > 0) s.append(", ");
            s.append(p.bathroomCount()).append(" salle(s) de bain");
        }
        if (p.maxGuests() != null) {
            if (s.length() > 0) s.append(", ");
            s.append("jusqu'à ").append(p.maxGuests()).append(" voyageurs");
        }
        if (p.squareMeters() != null) {
            if (s.length() > 0) s.append(", ");
            s.append(p.squareMeters()).append(" m²");
        }
        return s.toString();
    }
}

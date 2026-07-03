package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.RateParityReport;
import com.clenzy.integration.channex.dto.RateParityReport.ChannelParity;
import com.clenzy.integration.channex.dto.RateParityReport.DisparitySample;
import com.clenzy.integration.channex.model.ChannexOtaChannel;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexOtaChannelRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PriceEngine;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Verification de parite tarifaire (S2) : compare le prix attendu resolu par le
 * {@link PriceEngine} (cascade 6 niveaux) avec le prix publie cote Channex pour
 * les canaux OTA d'une propriete, sur une fenetre glissante.
 *
 * <p><b>Lecture des tarifs canal</b> : Channex expose les tarifs par rate plan
 * via {@code GET /restrictions} ({@link ChannexClient#fetchRatesForRange}) — il
 * n'existe pas de lecture de prix PAR canal (les canaux consomment le rate plan
 * pousse). La comparaison se fait donc sur le rate plan par defaut du mapping et
 * le resultat est decline par canal OTA actif (chiffres partages, voir
 * {@link RateParityReport}).</p>

 * <p><b>Transactions</b> : ce service n'est PAS transactionnel — l'appel HTTP
 * Channex se fait hors de toute transaction DB (regle absolue n°2), les lectures
 * repository sont unitaires.</p>
 */
@Service
public class RateParityService {

    public static final int DEFAULT_DAYS = 30;
    public static final int MAX_DAYS = 90;

    /** Pseudo-canal quand le mapping n'a aucun canal OTA enregistre. */
    static final String FALLBACK_CHANNEL = "channex";

    private static final int MAX_SAMPLES = 5;
    private static final int PERCENT_SCALE = 2;

    private static final Logger log = LoggerFactory.getLogger(RateParityService.class);

    private final ChannexPropertyMappingRepository mappingRepository;
    private final ChannexOtaChannelRepository otaChannelRepository;
    private final ChannexClient channexClient;
    private final PriceEngine priceEngine;
    private final PropertyRepository propertyRepository;
    private final BigDecimal thresholdPercent;

    public RateParityService(ChannexPropertyMappingRepository mappingRepository,
                             ChannexOtaChannelRepository otaChannelRepository,
                             ChannexClient channexClient,
                             PriceEngine priceEngine,
                             PropertyRepository propertyRepository,
                             @Value("${clenzy.channex.rate-parity.threshold-percent:2}")
                             BigDecimal thresholdPercent) {
        this.mappingRepository = mappingRepository;
        this.otaChannelRepository = otaChannelRepository;
        this.channexClient = channexClient;
        this.priceEngine = priceEngine;
        this.propertyRepository = propertyRepository;
        this.thresholdPercent = thresholdPercent;
    }

    /**
     * Compare prix local attendu vs prix canal pour une propriete sur les
     * {@code days} prochains jours (defaut 30, max 90).
     *
     * @param propertyId propriete Baitly
     * @param orgId      organisation du demandeur — l'ownership est valide ici
     *                   (findById contourne le filtre Hibernate)
     * @param days       fenetre en jours, null → 30
     * @throws AccessDeniedException si la propriete n'appartient pas a l'org
     * @throws IllegalStateException si la propriete n'existe pas
     */
    public RateParityReport checkParity(Long propertyId, Long orgId, Integer days) {
        int window = clampDays(days);
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalStateException(
                        "Propriete " + propertyId + " introuvable"));
        if (!orgId.equals(property.getOrganizationId())) {
            throw new AccessDeniedException(
                    "Propriete " + propertyId + " hors de l'organisation " + orgId);
        }

        LocalDate from = LocalDate.now();
        LocalDate toInclusive = from.plusDays(window - 1L);
        String propertyName = property.getName() != null
                ? property.getName() : "Propriete #" + propertyId;

        Optional<ChannexPropertyMapping> mappingOpt =
                mappingRepository.findByClenzyPropertyId(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return emptyReport(propertyId, propertyName, from, toInclusive,
                    "Aucun mapping Channex pour cette propriete — pas de canal a comparer");
        }
        ChannexPropertyMapping mapping = mappingOpt.get();
        if (mapping.getSyncStatus() != ChannexSyncStatus.ACTIVE) {
            return emptyReport(propertyId, propertyName, from, toInclusive,
                    "Mapping Channex non actif (statut " + mapping.getSyncStatus() + ")");
        }
        if (mapping.getChannexDefaultRatePlanId() == null
                || mapping.getChannexDefaultRatePlanId().isBlank()) {
            return emptyReport(propertyId, propertyName, from, toInclusive,
                    "Mapping Channex sans rate plan par defaut");
        }

        // Prix locaux attendus (cascade PriceEngine), [from, from+window)
        Map<LocalDate, BigDecimal> localPrices = priceEngine.resolvePriceRange(
                propertyId, from, from.plusDays(window), orgId);

        // Prix publies cote Channex — appel HTTP HORS transaction
        Optional<List<JsonNode>> ratesOpt = channexClient.fetchRatesForRange(
                mapping.getChannexPropertyId(), mapping.getChannexDefaultRatePlanId(),
                from, toInclusive);
        if (ratesOpt.isEmpty()) {
            return emptyReport(propertyId, propertyName, from, toInclusive,
                    "Lecture des tarifs Channex indisponible pour cette propriete");
        }
        Map<LocalDate, BigDecimal> channelPrices = parseChannexRates(ratesOpt.get(), propertyId);
        if (channelPrices.isEmpty()) {
            return emptyReport(propertyId, propertyName, from, toInclusive,
                    "Aucun tarif publie cote Channex sur la fenetre comparee");
        }

        Comparison comparison = compare(localPrices, channelPrices);
        List<ChannelParity> channels = declineByChannel(mapping, comparison);

        return new RateParityReport(propertyId, propertyName, from, toInclusive,
                thresholdPercent, null, channels);
    }

    // ─── Comparaison ─────────────────────────────────────────────────────────

    private record Comparison(int daysCompared, List<DisparitySample> disparities,
                              BigDecimal maxDeviationPercent) {
    }

    /**
     * Ecart relatif au prix LOCAL (la reference attendue) :
     * {@code |local - canal| * 100 / local}, scale 2 HALF_UP. Les jours sans prix
     * local exploitable (null ou <= 0) ou sans prix canal ne sont pas comparables.
     */
    private Comparison compare(Map<LocalDate, BigDecimal> localPrices,
                               Map<LocalDate, BigDecimal> channelPrices) {
        int daysCompared = 0;
        BigDecimal maxDeviation = null;
        List<DisparitySample> disparities = new ArrayList<>();

        for (Map.Entry<LocalDate, BigDecimal> entry : channelPrices.entrySet()) {
            BigDecimal local = localPrices.get(entry.getKey());
            BigDecimal channel = entry.getValue();
            if (local == null || local.compareTo(BigDecimal.ZERO) <= 0 || channel == null) {
                continue;
            }
            daysCompared++;
            BigDecimal deviation = local.subtract(channel).abs()
                    .multiply(BigDecimal.valueOf(100))
                    .divide(local, PERCENT_SCALE, RoundingMode.HALF_UP);
            if (maxDeviation == null || deviation.compareTo(maxDeviation) > 0) {
                maxDeviation = deviation;
            }
            if (deviation.compareTo(thresholdPercent) > 0) {
                disparities.add(new DisparitySample(entry.getKey(), local, channel, deviation));
            }
        }
        return new Comparison(daysCompared, List.copyOf(disparities), maxDeviation);
    }

    /**
     * Decline le resultat par canal OTA actif du mapping — chiffres partages
     * (un seul rate plan lu, cf. javadoc de classe). Sans canal enregistre,
     * repli sur le pseudo-canal {@link #FALLBACK_CHANNEL}.
     */
    private List<ChannelParity> declineByChannel(ChannexPropertyMapping mapping,
                                                 Comparison comparison) {
        List<DisparitySample> samples = comparison.disparities().stream()
                .sorted(Comparator.comparing(DisparitySample::deviationPercent).reversed()
                        .thenComparing(DisparitySample::date))
                .limit(MAX_SAMPLES)
                .toList();

        List<String> channelNames = otaChannelRepository.findByMappingId(mapping.getId()).stream()
                .filter(ChannexOtaChannel::isEnabled)
                .map(ChannexOtaChannel::getOtaType)
                .toList();
        if (channelNames.isEmpty()) {
            channelNames = List.of(FALLBACK_CHANNEL);
        }

        return channelNames.stream()
                .map(name -> new ChannelParity(name, mapping.getChannexDefaultRatePlanId(),
                        comparison.daysCompared(), comparison.disparities().size(),
                        comparison.maxDeviationPercent(), samples))
                .toList();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Map<LocalDate, BigDecimal> parseChannexRates(List<JsonNode> entries, Long propertyId) {
        Map<LocalDate, BigDecimal> prices = new LinkedHashMap<>();
        for (JsonNode entry : entries) {
            JsonNode attrs = entry.path("attributes");
            String dateStr = attrs.path("date").asText(null);
            String rateStr = attrs.path("rate").asText(null);
            if (dateStr == null || rateStr == null || rateStr.isBlank()) {
                continue;
            }
            try {
                prices.put(LocalDate.parse(dateStr), new BigDecimal(rateStr));
            } catch (RuntimeException e) {
                log.warn("RateParity: entry Channex illisible property={} date={} rate={} : {}",
                        propertyId, dateStr, rateStr, e.getMessage());
            }
        }
        return prices;
    }

    private RateParityReport emptyReport(Long propertyId, String propertyName,
                                         LocalDate from, LocalDate to, String note) {
        return new RateParityReport(propertyId, propertyName, from, to,
                thresholdPercent, note, List.of());
    }

    private static int clampDays(Integer days) {
        if (days == null) return DEFAULT_DAYS;
        return Math.min(MAX_DAYS, Math.max(1, days));
    }
}

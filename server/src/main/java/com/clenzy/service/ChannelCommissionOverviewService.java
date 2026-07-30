package com.clenzy.service;

import com.clenzy.dto.ChannelCommissionOverviewDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.repository.ChannelCommissionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ReservationRepository.ChannelFeeAggregate;
import com.clenzy.service.agent.analytics.ChannelCommissionResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Construit la vue « Commissions canaux » de l'ecran de parametrage : pour
 * chaque canal, le taux de reference applique en repli et le taux reellement
 * facture sur la periode.
 *
 * <p>Service dedie plutot qu'une methode de plus sur {@code AccountingService} :
 * celui-ci porte deja neuf dependances et la logique de payout: cette lecture
 * n'a besoin que de trois collaborateurs et n'ecrit rien.</p>
 */
@Service
public class ChannelCommissionOverviewService {

    /**
     * Fenetre d'observation. Douze mois glissants : au-dela, les sejours Airbnb
     * relevent encore du <i>split fee</i> (part hote ~3 %) et melanger les deux
     * regimes produirait un taux moyen qui ne correspond a aucune realite.
     */
    private static final int OBSERVATION_MONTHS = 12;

    private static final Map<String, String> LABELS = Map.of(
        "airbnb", "Airbnb",
        "booking", "Booking.com",
        "vrbo", "Vrbo",
        "expedia", "Expedia",
        "direct", "Booking Engine");

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final ReservationRepository reservationRepository;
    private final ChannelCommissionRepository commissionRepository;
    private final ChannelCommissionResolver resolver;

    public ChannelCommissionOverviewService(ReservationRepository reservationRepository,
                                            ChannelCommissionRepository commissionRepository,
                                            ChannelCommissionResolver resolver) {
        this.reservationRepository = reservationRepository;
        this.commissionRepository = commissionRepository;
        this.resolver = resolver;
    }

    /** Une ligne par canal connu, meme sans aucun sejour sur la periode. */
    @Transactional(readOnly = true)
    public List<ChannelCommissionOverviewDto> getOverview(Long orgId) {
        LocalDate from = LocalDate.now().minusMonths(OBSERVATION_MONTHS);
        Map<String, Totals> byChannel = aggregateByNormalizedChannel(orgId, from);

        List<ChannelCommissionOverviewDto> rows = new ArrayList<>();
        for (String channel : resolver.knownChannels()) {
            BigDecimal reference = BigDecimal.valueOf(resolver.rateFor(channel))
                .multiply(HUNDRED)
                .setScale(2, RoundingMode.HALF_UP);
            rows.add(toRow(channel, reference, byChannel.get(channel), false));
        }
        rows.add(toRow("direct", bookingEngineRate(orgId), byChannel.get("direct"), true));

        rows.sort((a, b) -> Long.compare(b.stayCount(), a.stayCount()));
        return rows;
    }

    /**
     * Regroupe les agregats SQL (sources brutes) par canal normalise, avec la
     * meme regle que le calcul de commission.
     */
    private Map<String, Totals> aggregateByNormalizedChannel(Long orgId, LocalDate from) {
        Map<String, Totals> byChannel = new HashMap<>();
        for (ChannelFeeAggregate row : reservationRepository.aggregateOtaFeesBySource(orgId, from)) {
            String channel = resolver.normalize(row.getSource());
            byChannel.computeIfAbsent(channel, k -> new Totals()).add(row);
        }
        return byChannel;
    }

    private ChannelCommissionOverviewDto toRow(String channel, BigDecimal referenceRate,
                                               Totals totals, boolean editable) {
        long stayCount = totals != null ? totals.stayCount : 0L;
        long realFeeCount = totals != null ? totals.realFeeCount : 0L;
        return new ChannelCommissionOverviewDto(
            channel,
            LABELS.getOrDefault(channel, channel),
            referenceRate,
            totals != null ? totals.observedRate() : null,
            stayCount,
            realFeeCount,
            editable);
    }

    /** Taux du booking engine : parametrable par l'organisation, 0 si jamais configure. */
    private BigDecimal bookingEngineRate(Long orgId) {
        return commissionRepository.findByChannelAndOrgId(ChannelName.DIRECT, orgId)
            .map(c -> c.getCommissionRate() != null ? c.getCommissionRate() : BigDecimal.ZERO)
            .orElse(BigDecimal.ZERO)
            .setScale(2, RoundingMode.HALF_UP);
    }

    /** Cumul mutable le temps du regroupement — jamais expose. */
    private static final class Totals {
        private long stayCount;
        private long realFeeCount;
        private BigDecimal realFeeTotal = BigDecimal.ZERO;
        private BigDecimal realFeeGross = BigDecimal.ZERO;

        void add(ChannelFeeAggregate row) {
            stayCount += row.getStayCount();
            realFeeCount += row.getRealFeeCount();
            realFeeTotal = realFeeTotal.add(nullSafe(row.getRealFeeTotal()));
            realFeeGross = realFeeGross.add(nullSafe(row.getRealFeeGross()));
        }

        /** null tant qu'aucun sejour n'a remonte sa commission : pas de taux invente. */
        BigDecimal observedRate() {
            if (realFeeCount == 0 || realFeeGross.compareTo(BigDecimal.ZERO) <= 0) {
                return null;
            }
            return realFeeTotal.multiply(HUNDRED)
                .divide(realFeeGross, 2, RoundingMode.HALF_UP);
        }

        private static BigDecimal nullSafe(BigDecimal value) {
            return value != null ? value : BigDecimal.ZERO;
        }
    }
}

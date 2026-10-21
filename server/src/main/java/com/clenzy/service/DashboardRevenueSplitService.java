package com.clenzy.service;

import com.clenzy.dto.MonthlyRevenueSplitDto;
import com.clenzy.model.UserRole;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.repository.DashboardRevenueSplitRepository;
import com.clenzy.service.agent.analytics.ChannelCommissionResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/** Synthèse annuelle Baitly : trois lectures bornées, aucune boucle par nuit. */
@Service
@Transactional(readOnly = true)
public class DashboardRevenueSplitService {
    private final DashboardRevenueSplitRepository repository;
    private final ChannelCommissionResolver commissions;

    public DashboardRevenueSplitService(DashboardRevenueSplitRepository repository, ChannelCommissionResolver commissions) {
        this.repository = repository;
        this.commissions = commissions;
    }

    public List<MonthlyRevenueSplitDto> getYear(Long orgId, int year, UserRole role, String keycloakId) {
        if (year < 1900 || year > 9998) throw new IllegalArgumentException("Année invalide");
        if (role.isOwnerScoped() && (keycloakId == null || keycloakId.isBlank()))
            throw new org.springframework.security.access.AccessDeniedException("Identité propriétaire requise");
        final String ownerKc = role.isOwnerScoped() ? keycloakId : null;
        final LocalDate from = LocalDate.of(year, 1, 1);
        final LocalDate end = from.plusYears(1);
        final BigDecimal[] revenue = zeros(), fees = zeros(), costs = zeros(), payouts = zeros();
        String currency = null;
        for (var stay : repository.stays(orgId, ownerKc, from, end)) {
            if (currency == null && stay.getCurrency() != null) currency = stay.getCurrency();
            long nights = Math.max(1, ChronoUnit.DAYS.between(stay.getCheckIn(), stay.getCheckOut()));
            BigDecimal gross = nz(stay.getTotalPrice());
            // Même arrondi par nuit que le moteur de rapports, multiplié par
            // le nombre de nuits du mois plutôt qu'additionné nuit par nuit.
            BigDecimal nightlyRevenue = gross.divide(BigDecimal.valueOf(nights), 4, RoundingMode.HALF_UP);
            BigDecimal nightlyFee = commissions.commissionOf(stay.getSource(), stay.getOtaFeeAmount(), gross)
                .divide(BigDecimal.valueOf(nights), 4, RoundingMode.HALF_UP);
            LocalDate first = stay.getCheckIn().isBefore(from) ? from : stay.getCheckIn();
            LocalDate last = stay.getCheckOut().isBefore(end) ? stay.getCheckOut() : end;
            for (LocalDate day = first; day.isBefore(last); ) {
                LocalDate next = day.withDayOfMonth(1).plusMonths(1);
                if (next.isAfter(last)) next = last;
                BigDecimal count = BigDecimal.valueOf(ChronoUnit.DAYS.between(day, next));
                int index = day.getMonthValue() - 1;
                revenue[index] = revenue[index].add(nightlyRevenue.multiply(count));
                fees[index] = fees[index].add(nightlyFee.multiply(count));
                day = next;
            }
        }
        for (var row : repository.costs(orgId, ownerKc, from.atStartOfDay(), end.atStartOfDay()))
            costs[row.getMonth() - 1] = nz(row.getAmount());
        for (var row : repository.payouts(orgId, ownerKc, from, end,
                List.of(PayoutStatus.APPROVED, PayoutStatus.PROCESSING, PayoutStatus.PAID)))
            payouts[row.getMonth() - 1] = nz(row.getAmount());
        List<MonthlyRevenueSplitDto> result = new ArrayList<>(12);
        for (int m = 0; m < 12; m++) {
            BigDecimal amount = money(revenue[m]), fee = money(fees[m]);
            BigDecimal margin = money(revenue[m].subtract(fees[m]).subtract(costs[m]));
            result.add(new MonthlyRevenueSplitDto(from.plusMonths(m).toString().substring(0, 7),
                currency != null ? currency : "EUR", amount, fee,
                amount.subtract(fee).subtract(margin).max(BigDecimal.ZERO),
                money(payouts[m]), margin.subtract(money(payouts[m]))));
        }
        return result;
    }

    private static BigDecimal[] zeros() {
        BigDecimal[] values = new BigDecimal[12];
        java.util.Arrays.fill(values, BigDecimal.ZERO);
        return values;
    }
    private static BigDecimal nz(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private static BigDecimal money(BigDecimal value) { return value.setScale(2, RoundingMode.HALF_UP); }
}

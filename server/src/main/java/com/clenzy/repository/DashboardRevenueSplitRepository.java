package com.clenzy.repository;

import com.clenzy.model.Reservation;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import org.springframework.data.repository.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Lectures Baitly scalaires : aucune entité ni donnée personnelle à hydrater. */
public interface DashboardRevenueSplitRepository extends Repository<Reservation, Long> {
    interface Stay {
        LocalDate getCheckIn();
        LocalDate getCheckOut();
        BigDecimal getTotalPrice();
        BigDecimal getOtaFeeAmount();
        String getSource();
        String getCurrency();
    }
    interface MonthAmount {
        Integer getMonth();
        BigDecimal getAmount();
    }

    @Query("""
        select r.checkIn as checkIn, r.checkOut as checkOut, r.totalPrice as totalPrice,
               r.otaFeeAmount as otaFeeAmount, r.source as source, r.currency as currency
        from Reservation r join r.property p left join p.owner o
        where r.organizationId = :orgId and p.organizationId = :orgId
          and (:ownerKc is null or o.keycloakId = :ownerKc)
          and (r.status is null or lower(r.status) <> 'cancelled')
          and r.checkOut > :from and r.checkIn < :toExclusive
        order by r.id
        """)
    List<Stay> stays(@Param("orgId") Long orgId, @Param("ownerKc") String ownerKc,
                     @Param("from") LocalDate from, @Param("toExclusive") LocalDate toExclusive);

    @Query("""
        select month(i.scheduledDate) as month,
               sum(coalesce(i.actualCost, i.estimatedCost, 0)) as amount
        from Intervention i join i.property p left join p.owner o
        where i.organizationId = :orgId and p.organizationId = :orgId
          and (:ownerKc is null or o.keycloakId = :ownerKc)
          and i.scheduledDate >= :from and i.scheduledDate < :toExclusive
          and not exists (select r.id from Reservation r where r.intervention.id = i.id
              and r.hiddenFromPlanning = true and r.status = 'cancelled')
        group by month(i.scheduledDate)
        """)
    List<MonthAmount> costs(@Param("orgId") Long orgId, @Param("ownerKc") String ownerKc,
                            @Param("from") LocalDateTime from, @Param("toExclusive") LocalDateTime toExclusive);

    @Query("""
        select month(p.periodStart) as month, sum(p.netAmount) as amount
        from OwnerPayout p where p.organizationId = :orgId
          and (:ownerKc is null or exists (select u.id from User u
              where u.id = p.ownerId and u.keycloakId = :ownerKc))
          and p.periodStart >= :from and p.periodStart < :toExclusive
          and p.status in :statuses
        group by month(p.periodStart)
        """)
    List<MonthAmount> payouts(@Param("orgId") Long orgId, @Param("ownerKc") String ownerKc,
                              @Param("from") LocalDate from, @Param("toExclusive") LocalDate toExclusive,
                              @Param("statuses") List<PayoutStatus> statuses);
}

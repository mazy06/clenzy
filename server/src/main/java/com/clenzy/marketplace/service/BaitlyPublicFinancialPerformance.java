package com.clenzy.marketplace.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.math.*;
import java.time.*;
import java.util.*;

/** Opted-in portfolio ratios only. Recorded intervention costs are not all owner expenses. */
@Service
public class BaitlyPublicFinancialPerformance {
    private final JdbcTemplate db;
    private final Clock clock;
    public BaitlyPublicFinancialPerformance(JdbcTemplate db, Clock clock) { this.db=db; this.clock=clock; }

    public List<Map<String,Object>> compute(Long org, List<Long> ids, boolean concierge) {
        if(ids.isEmpty() || (concierge && ids.size()<5)) return List.of();
        var portfolio=db.queryForMap("SELECT count(*) AS homes,min(default_currency) AS currency,count(DISTINCT default_currency) AS currencies,min(created_at)::date AS oldest,max(created_at)::date AS newest FROM properties WHERE organization_id=? AND id IN ("+placeholders(ids)+") AND status='ACTIVE'", args(org,ids));
        if(((Number)portfolio.get("homes")).intValue()!=ids.size() || ((Number)portfolio.get("currencies")).intValue()!=1) return List.of();
        String currency=(String)portfolio.get("currency");
        if(currency==null || !currency.matches("[A-Z]{3}")) return List.of();
        int year=LocalDate.now(clock).getYear()-1;
        var previous=period(org,ids,year-1,currency);
        var current=period(org,ids,year,currency);
        // Same selected portfolio, fully present in both years, and no implicit currency conversion.
        var newest=(java.sql.Date)portfolio.get("newest");
        if(newest!=null && !newest.toLocalDate().isAfter(LocalDate.of(year-1,1,1))
            && current.get("revenuePerCalendarNight") instanceof BigDecimal now
            && previous.get("revenuePerCalendarNight") instanceof BigDecimal before && before.signum()>0)
            current.put("revenueGrowthPct",now.subtract(before).multiply(BigDecimal.valueOf(100)).divide(before,1,RoundingMode.HALF_UP));
        return List.of(previous,current);
    }

    private Map<String,Object> period(Long org,List<Long> ids,int year,String currency) {
        LocalDate start=LocalDate.of(year,1,1),end=start.plusYears(1);
        var data=db.queryForMap("""
            WITH portfolio AS (SELECT id,greatest(created_at::date,CAST(? AS date)) AS since FROM properties
                WHERE organization_id=? AND id IN (%s) AND status='ACTIVE' AND created_at::date<CAST(? AS date)),
            nights AS (SELECT r.property_id,d.night,r.room_revenue,r.currency,
                r.room_revenue/nullif(r.check_out-r.check_in,0) AS nightly
                FROM reservations r JOIN portfolio p ON p.id=r.property_id
                CROSS JOIN LATERAL generate_series(greatest(r.check_in,p.since)::timestamp,
                    (least(r.check_out,CAST(? AS date))-1)::timestamp,interval '1 day') d(night)
                WHERE r.organization_id=? AND lower(r.status) IN ('confirmed','checked_in','checked_out','completed')
                    AND r.check_out>r.check_in AND r.check_in<CAST(? AS date) AND r.check_out>CAST(? AS date))
            SELECT count(*) AS booked,count(DISTINCT (property_id,night)) AS unique_nights,
                count(*) FILTER(WHERE room_revenue IS NOT NULL AND room_revenue>=0 AND currency=?) AS covered,
                sum(nightly) AS revenue,
                (SELECT sum(CAST(? AS date)-since) FROM portfolio) AS calendar
            FROM nights
            """.formatted(placeholders(ids)), revenueArgs(org,ids,start,end,currency));
        long booked=((Number)data.get("booked")).longValue(),covered=((Number)data.get("covered")).longValue();
        var result=new LinkedHashMap<String,Object>(); result.put("year",year); result.put("currency",currency);
        result.put("properties",ids.size()); result.put("bookedNights",booked);
        result.put("financialCoveragePct",booked>0 ? ratio(BigDecimal.valueOf(covered*100),booked) : null);
        var revenue=(BigDecimal)data.get("revenue");
        long calendar=data.get("calendar") instanceof Number n ? n.longValue() : 0;
        result.put("calendarNights",calendar);
        if(calendar>0) result.put("occupancyPct",ratio(BigDecimal.valueOf(((Number)data.get("unique_nights")).longValue()*100),calendar));
        boolean complete=booked>0 && covered==booked && ((Number)data.get("unique_nights")).longValue()==booked && revenue!=null;
        if(!complete) return result;
        result.put("averageNightlyRate",ratio(revenue,booked));
        if(calendar>0) result.put("revenuePerCalendarNight",ratio(revenue,calendar));
        var costs=db.queryForMap("SELECT count(*) AS entries,count(*) FILTER(WHERE actual_cost IS NOT NULL AND actual_cost>=0 AND currency=?) AS covered,sum(actual_cost) AS costs FROM interventions WHERE organization_id=? AND property_id IN ("+placeholders(ids)+") AND upper(status)<>'CANCELLED' AND scheduled_date>=? AND scheduled_date<?", costArgs(currency,org,ids,start,end));
        long entries=((Number)costs.get("entries")).longValue(),known=((Number)costs.get("covered")).longValue();
        result.put("costCoveragePct",entries>0 ? ratio(BigDecimal.valueOf(known*100),entries) : null);
        if(entries>0 && entries==known && revenue.signum()>0 && costs.get("costs") instanceof BigDecimal expense && expense.signum()>0)
            result.put("recordedCostMarginPct",revenue.subtract(expense).multiply(BigDecimal.valueOf(100)).divide(revenue,1,RoundingMode.HALF_UP));
        return result;
    }
    static BigDecimal ratio(BigDecimal numerator,long denominator) { return numerator.divide(BigDecimal.valueOf(denominator),2,RoundingMode.HALF_UP); }
    private static String placeholders(List<Long> ids) { return String.join(",",Collections.nCopies(ids.size(),"?")); }
    private static Object[] args(Long org,List<Long> ids) { var a=new ArrayList<Object>();a.add(org);a.addAll(ids);return a.toArray(); }
    private static Object[] revenueArgs(Long org,List<Long> ids,LocalDate start,LocalDate end,String currency) {
        var a=new ArrayList<Object>();a.add(start);a.add(org);a.addAll(ids);a.add(end);a.add(end);a.add(org);a.add(end);a.add(start);a.add(currency);a.add(end);return a.toArray();
    }
    private static Object[] costArgs(String currency,Long org,List<Long> ids,LocalDate start,LocalDate end) {
        var a=new ArrayList<Object>();a.add(currency);a.add(org);a.addAll(ids);a.add(start);a.add(end);return a.toArray();
    }
}

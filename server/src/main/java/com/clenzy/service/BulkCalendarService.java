package com.clenzy.service;

import com.clenzy.dto.BulkCalendarRequest;
import com.clenzy.dto.BulkCalendarResult;
import com.clenzy.dto.BulkCalendarResult.ItemResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Édition groupée du calendrier sur plusieurs propriétés (CLZ-P0-10).
 *
 * <p><b>Volontairement NON {@code @Transactional}</b> : chaque item est traité par
 * {@link CalendarEngine} — un bean séparé {@code @Transactional} — donc <b>une transaction
 * par item</b> (pas d'auto-invocation, audit #6), avec son lock {@code pg_advisory} par
 * propriété, sa validation d'ownership et son event outbox. Tolérant aux échecs partiels :
 * un item en échec est journalisé et reporté dans le résultat, sans interrompre le lot.</p>
 */
@Service
public class BulkCalendarService {

    private static final Logger log = LoggerFactory.getLogger(BulkCalendarService.class);
    private static final String BULK_SOURCE = "BULK";

    private final CalendarEngine calendarEngine;

    public BulkCalendarService(CalendarEngine calendarEngine) {
        this.calendarEngine = calendarEngine;
    }

    public BulkCalendarResult apply(BulkCalendarRequest request, Long orgId, String actorId) {
        List<ItemResult> items = new ArrayList<>();
        int succeeded = 0;
        int failed = 0;
        for (Long propertyId : request.propertyIds()) {
            try {
                switch (request.operation()) {
                    case BLOCK -> calendarEngine.block(propertyId, request.from(), request.to(),
                            orgId, BULK_SOURCE, request.notes(), actorId);
                    case UNBLOCK -> calendarEngine.unblock(propertyId, request.from(), request.to(), orgId, actorId);
                    case PRICE -> calendarEngine.updatePrice(propertyId, request.from(), request.to(),
                            request.price(), orgId, actorId);
                }
                items.add(new ItemResult(propertyId, true, "OK"));
                succeeded++;
            } catch (Exception e) {
                // Echec partiel attendu et REPORTE (pas avale, audit #7) : on continue le lot.
                log.warn("Bulk calendrier {} echec pour propriete {}: {}",
                        request.operation(), propertyId, e.getMessage());
                items.add(new ItemResult(propertyId, false, e.getMessage()));
                failed++;
            }
        }
        return new BulkCalendarResult(items.size(), succeeded, failed, items);
    }
}

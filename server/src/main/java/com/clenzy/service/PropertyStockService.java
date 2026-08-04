package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PropertyStockItem;
import com.clenzy.repository.PropertyStockItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;

/**
 * Stock consommable d'un logement (M5, vague M-B). La consommation par ménage est
 * décrémentée à la complétion de l'intervention (UPDATE atomique, jamais sous zéro) ;
 * le réassort remet la quantité et trace la date.
 */
@Service
public class PropertyStockService {

    private static final Logger log = LoggerFactory.getLogger(PropertyStockService.class);

    private final PropertyStockItemRepository repository;
    private final Clock clock;

    public PropertyStockService(PropertyStockItemRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<PropertyStockItem> list(Long propertyId, Long orgId) {
        return repository.findByPropertyIdAndOrganizationIdOrderByNameAsc(propertyId, orgId);
    }

    @Transactional
    public PropertyStockItem save(Long orgId, Long propertyId, PropertyStockItem item) {
        if (item.getId() != null) {
            // Update : l'existant doit appartenir à l'org ET au logement annoncés.
            final PropertyStockItem existing = repository
                    .findByIdAndOrganizationId(item.getId(), orgId)
                    .orElseThrow(() -> new NotFoundException("Article introuvable : " + item.getId()));
            if (!existing.getPropertyId().equals(propertyId)) {
                throw new NotFoundException("Article introuvable pour ce logement");
            }
        }
        item.setOrganizationId(orgId);
        item.setPropertyId(propertyId);
        return repository.save(item);
    }

    @Transactional
    public void delete(Long id, Long propertyId, Long orgId) {
        final PropertyStockItem item = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Article introuvable : " + id));
        if (!item.getPropertyId().equals(propertyId)) {
            throw new NotFoundException("Article introuvable pour ce logement");
        }
        repository.delete(item);
    }

    /** Réassort : quantité += reorderQuantity (ou valeur explicite), date tracée. */
    @Transactional
    public PropertyStockItem restock(Long id, Long orgId, Integer quantityAdded) {
        final PropertyStockItem item = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Article introuvable : " + id));
        final int added = quantityAdded != null && quantityAdded > 0
                ? quantityAdded : item.getReorderQuantity();
        item.setQuantity(item.getQuantity() + Math.max(0, added));
        item.setLastRestockedAt(clock.instant());
        return repository.save(item);
    }

    /**
     * Consommation d'un séjour (appelée à la complétion du ménage) — transaction
     * indépendante et best-effort : un échec de stock ne bloque JAMAIS la complétion.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void consumeForStay(Long propertyId, Long orgId) {
        try {
            final int updated = repository.consumeForStay(propertyId, orgId);
            if (updated > 0) {
                log.debug("Stock : {} article(s) décrémenté(s) (property={})", updated, propertyId);
            }
        } catch (Exception e) {
            log.debug("Stock non décrémenté (property={}) : {}", propertyId, e.getMessage());
        }
    }
}

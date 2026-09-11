package com.clenzy.service;

import com.clenzy.dto.MarketPositioningDto;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStockItem;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.PropertyStockItemRepository;
import com.clenzy.service.marketdata.MarketPositioningService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Agregats de PARC pour le tableau de bord.
 *
 * <p>Deux indicateurs ne se lisaient que logement par logement : le stock sous
 * son seuil et le positionnement tarifaire. Les rassembler cote client aurait
 * demande un appel par bien — dix requetes pour une tuile, et davantage a
 * mesure que le parc grandit. Ici, une seule.</p>
 */
@Service
@Transactional(readOnly = true)
public class PortfolioPulseService {

    private static final Logger log = LoggerFactory.getLogger(PortfolioPulseService.class);

    /** Un article a recommander, avec le logement ou il manque. */
    public record ReorderItem(Long id, Long propertyId, String propertyName, String name,
                              String category, String unit, int quantity, int reorderThreshold,
                              int reorderQuantity, String supplierName, boolean orderable) {}

    /** Positionnement d'un bien, tel que la tuile de parc le montre. */
    public record PropertyPositioning(Long propertyId, String propertyName,
                                      MarketPositioningDto positioning) {}

    private final PropertyStockItemRepository stockRepository;
    private final PropertyRepository propertyRepository;
    private final MarketPositioningService positioningService;

    public PortfolioPulseService(PropertyStockItemRepository stockRepository,
                                 PropertyRepository propertyRepository,
                                 MarketPositioningService positioningService) {
        this.stockRepository = stockRepository;
        this.propertyRepository = propertyRepository;
        this.positioningService = positioningService;
    }

    /** Articles sous leur seuil, tout le parc, le plus critique d'abord. */
    public List<ReorderItem> stockToReorder(Long organizationId) {
        final List<PropertyStockItem> items = stockRepository.findBelowThreshold(organizationId);
        if (items.isEmpty()) return List.of();

        // Un seul chargement des noms de logement : la liste en porte souvent
        // plusieurs pour le meme bien.
        final Map<Long, String> names = propertyRepository
                .findAllById(items.stream().map(PropertyStockItem::getPropertyId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(Property::getId, Property::getName, (a, b) -> a));

        return items.stream()
                .map(item -> new ReorderItem(
                        item.getId(),
                        item.getPropertyId(),
                        names.get(item.getPropertyId()),
                        item.getName(),
                        item.getCategory() != null ? item.getCategory().name() : null,
                        item.getUnit(),
                        item.getQuantity(),
                        item.getReorderThreshold(),
                        item.getReorderQuantity(),
                        item.getSupplierName(),
                        // « Commander » n'a de sens qu'avec un fournisseur ET une
                        // quantite de reappro — meme regle que la carte HITL.
                        item.getSupplierEmail() != null && !item.getSupplierEmail().isBlank()
                                && item.getReorderQuantity() > 0))
                .toList();
    }

    /** Positionnement tarifaire de chaque bien face a son marche. */
    public List<PropertyPositioning> positioning(Long organizationId) {
        return propertyRepository.findByOrganizationId(organizationId).stream()
                .map(property -> {
                    try {
                        return new PropertyPositioning(property.getId(), property.getName(),
                                positioningService.position(property.getId(), organizationId));
                    } catch (Exception e) {
                        // Un bien sans donnee marche ne doit pas faire tomber la
                        // tuile entiere : il sort simplement de la liste.
                        log.debug("Positionnement indisponible pour le bien {} : {}",
                                property.getId(), e.getMessage());
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(ArrayList::new));
    }
}

package com.clenzy.service;

import com.clenzy.model.PropertyStockItem;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.PropertyStockItemRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Lecture transversale : une commande envoyée n'est jamais assimilée à une réception. */
@Service
@Transactional(readOnly = true)
public class ConsumablesOverviewService {
    public enum View { pending, ordered, stock }
    public record PropertyChoice(Long id, String name) {}
    public record Row(String id, Long stockItemId, Long propertyId, String propertyName,
                      String name, String catalogKey, String photoUrl, String unit,
                      Integer quantity, Integer threshold, String supplierName,
                      String createdAt, String orderedAt, String lastRestockedAt,
                      String description, boolean actionable) {}
    public record Overview(List<Row> rows, long totalElements, int page, int size,
                           Map<View, Long> counts) {}

    private final PropertyStockItemRepository stock;
    private final SupervisionSuggestionRepository suggestions;
    private final PropertyRepository properties;
    private final ObjectMapper mapper;
    private final Clock clock;

    public ConsumablesOverviewService(PropertyStockItemRepository stock, SupervisionSuggestionRepository suggestions,
                                      PropertyRepository properties, ObjectMapper mapper, Clock clock) {
        this.stock = stock;
        this.suggestions = suggestions;
        this.properties = properties;
        this.mapper = mapper;
        this.clock = clock;
    }

    public List<PropertyChoice> propertyChoices(Long orgId) {
        return properties.findStockPropertyChoices(orgId).stream()
                .map(p -> new PropertyChoice(p.getId(), p.getName())).toList();
    }

    public Overview list(Long orgId, View view, Long propertyId, String query, int page, int size) {
        List<PropertyChoice> choices = propertyChoices(orgId);
        Map<Long, String> names = choices.stream().collect(Collectors.toMap(PropertyChoice::id, PropertyChoice::name));
        if (propertyId != null && !names.containsKey(propertyId)) {
            throw new AccessDeniedException("Logement inaccessible pour cette organisation");
        }
        String search = "%" + query.trim().toLowerCase(Locale.ROOT)
                .replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        var now = clock.instant();
        Map<View, Long> counts = Map.of(
                View.pending, suggestions.countStockOverview(orgId, propertyId, "PENDING", now, search),
                View.ordered, suggestions.countStockOverview(orgId, propertyId, "APPLIED", now, search),
                View.stock, stock.countStockOverview(orgId, propertyId, search));
        long total = counts.get(view);
        // Une suppression ou un réassort peut vider la dernière page entre deux consultations.
        int actualPage = (int) Math.min(page, Math.max(0, (total - 1) / size));
        var pageable = PageRequest.of(actualPage, size);
        List<Row> rows;
        if (view == View.stock) {
            rows = stock.findStockOverview(orgId, propertyId, search, pageable).stream()
                    .map(item -> inventoryRow(item, names.get(item.getPropertyId()))).toList();
        } else {
            var entries = suggestions.findStockOverview(orgId, propertyId,
                    view == View.pending ? "PENDING" : "APPLIED", now, search, pageable).getContent();
            var ids = entries.stream().map(this::stockId).filter(Objects::nonNull).distinct().toList();
            Map<Long, PropertyStockItem> items = ids.isEmpty() ? Map.of() : stock.findByIdInAndOrganizationId(ids, orgId)
                    .stream().collect(Collectors.toMap(PropertyStockItem::getId, Function.identity()));
            rows = entries.stream().map(s -> {
                Long id = stockId(s);
                return suggestionRow(s, id == null ? null : items.get(id), names.get(s.getPropertyId()), view);
            }).toList();
        }
        return new Overview(rows, total, actualPage, size, counts);
    }

    private Row inventoryRow(PropertyStockItem item, String propertyName) {
        return new Row("stock-" + item.getId(), item.getId(), item.getPropertyId(), propertyName,
                item.getName(), item.getCatalogKey(), item.getPhotoUrl(), item.getUnit(), item.getQuantity(),
                item.getReorderThreshold(), item.getSupplierName(), date(item.getCreatedAt()), null,
                date(item.getLastRestockedAt()), null, false);
    }

    private Row suggestionRow(SupervisionSuggestion s, PropertyStockItem item, String propertyName, View view) {
        // Une référence altérée ne doit pas exposer l'article d'un autre logement.
        if (item != null && !Objects.equals(item.getPropertyId(), s.getPropertyId())) item = null;
        boolean pending = view == View.pending;
        JsonNode archive = params(s).path("stockOrder");
        Integer quantity = null;
        if (pending && item != null) quantity = item.getReorderQuantity();
        else if (archive.path("quantity").isIntegralNumber()) quantity = archive.path("quantity").asInt();
        String historicalName = s.getTitle().replaceFirst("(?i)^Stock bas\\s*:\\s*", "")
                .replaceFirst("\\s*\\(\\d+ restants?\\)$", "");
        return new Row("suggestion-" + s.getId(), item == null ? null : item.getId(), s.getPropertyId(), propertyName,
                pending && item != null ? item.getName() : archive.path("name").asText(historicalName),
                pending && item != null ? item.getCatalogKey() : archive.path("catalogKey").asText(null),
                pending && item != null ? item.getPhotoUrl() : null,
                pending && item != null ? item.getUnit() : archive.path("unit").asText(null),
                quantity, null,
                pending && item != null ? item.getSupplierName() : archive.path("supplierName").asText(null),
                date(s.getCreatedAt()), date(s.getAppliedAt()), null, s.getMotif(),
                pending && item != null && "LINEN_STOCK_ORDER".equals(s.getActionType()));
    }

    private Long stockId(SupervisionSuggestion suggestion) {
        JsonNode id = params(suggestion).path("stockItemId");
        return id.isIntegralNumber() && id.canConvertToLong() && id.asLong() > 0 ? id.asLong() : null;
    }

    private JsonNode params(SupervisionSuggestion suggestion) {
        try {
            JsonNode node = mapper.readTree(suggestion.getActionParams());
            return node == null ? mapper.createObjectNode() : node;
        } catch (Exception ignored) {
            // Les anciennes alertes informatives peuvent ne pas avoir de paramètres.
            return mapper.createObjectNode();
        }
    }

    private static String date(Object date) { return date == null ? null : date.toString(); }
}

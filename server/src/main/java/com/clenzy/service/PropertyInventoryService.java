package com.clenzy.service;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.dto.inventory.*;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Gestion de l'inventaire des proprietes et des devis blanchisserie.
 */
@Service
@Transactional
public class PropertyInventoryService {

    private static final Logger log = LoggerFactory.getLogger(PropertyInventoryService.class);

    private final PropertyInventoryItemRepository inventoryRepo;
    private final PropertyLaundryItemRepository laundryRepo;
    private final LaundryQuoteRepository quoteRepo;
    private final PricingConfigService pricingConfigService;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper;

    public PropertyInventoryService(PropertyInventoryItemRepository inventoryRepo,
                                     PropertyLaundryItemRepository laundryRepo,
                                     LaundryQuoteRepository quoteRepo,
                                     PricingConfigService pricingConfigService,
                                     TenantContext tenantContext,
                                     ObjectMapper objectMapper) {
        this.inventoryRepo = inventoryRepo;
        this.laundryRepo = laundryRepo;
        this.quoteRepo = quoteRepo;
        this.pricingConfigService = pricingConfigService;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
    }

    // ── Inventory Items ──────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PropertyInventoryItemDto> getInventoryItems(Long propertyId) {
        return inventoryRepo.findByPropertyIdOrderByCategoryAscNameAsc(propertyId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    public PropertyInventoryItemDto addInventoryItem(Long propertyId, PropertyInventoryItemDto dto) {
        final var item = new PropertyInventoryItem();
        item.setOrganizationId(tenantContext.getRequiredOrganizationId());
        item.setPropertyId(propertyId);
        item.setName(dto.name());
        item.setCategory(dto.category());
        item.setQuantity(dto.quantity() != null ? dto.quantity() : 1);
        item.setNotes(dto.notes());
        return toDto(inventoryRepo.save(item));
    }

    public PropertyInventoryItemDto updateInventoryItem(Long propertyId, Long itemId, PropertyInventoryItemDto dto) {
        final var item = inventoryRepo.findByPropertyIdAndId(propertyId, itemId)
                .orElseThrow(() -> new NotFoundException("Objet inventaire introuvable"));
        if (dto.name() != null) item.setName(dto.name());
        if (dto.category() != null) item.setCategory(dto.category());
        if (dto.quantity() != null) item.setQuantity(dto.quantity());
        if (dto.notes() != null) item.setNotes(dto.notes());
        return toDto(inventoryRepo.save(item));
    }

    public void deleteInventoryItem(Long propertyId, Long itemId) {
        final var item = inventoryRepo.findByPropertyIdAndId(propertyId, itemId)
                .orElseThrow(() -> new NotFoundException("Objet inventaire introuvable"));
        inventoryRepo.delete(item);
    }

    // ── Laundry Items ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PropertyLaundryItemDto> getLaundryItems(Long propertyId) {
        return laundryRepo.findByPropertyId(propertyId)
                .stream()
                .map(this::toLaundryDto)
                .toList();
    }

    public PropertyLaundryItemDto addLaundryItem(Long propertyId, PropertyLaundryItemDto dto) {
        final var item = new PropertyLaundryItem();
        item.setOrganizationId(tenantContext.getRequiredOrganizationId());
        item.setPropertyId(propertyId);
        item.setItemKey(dto.itemKey());
        item.setLabel(dto.label());
        item.setQuantityPerStay(dto.quantityPerStay() != null ? dto.quantityPerStay() : 1);
        return toLaundryDto(laundryRepo.save(item));
    }

    public PropertyLaundryItemDto updateLaundryItem(Long propertyId, Long itemId, PropertyLaundryItemDto dto) {
        final var item = laundryRepo.findByPropertyIdAndId(propertyId, itemId)
                .orElseThrow(() -> new NotFoundException("Article de linge introuvable"));
        if (dto.label() != null) item.setLabel(dto.label());
        if (dto.quantityPerStay() != null) item.setQuantityPerStay(dto.quantityPerStay());
        return toLaundryDto(laundryRepo.save(item));
    }

    public void deleteLaundryItem(Long propertyId, Long itemId) {
        final var item = laundryRepo.findByPropertyIdAndId(propertyId, itemId)
                .orElseThrow(() -> new NotFoundException("Article de linge introuvable"));
        laundryRepo.delete(item);
    }

    // ── Laundry Quotes ───────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<LaundryQuoteDto> getQuotes(Long propertyId) {
        return quoteRepo.findByPropertyIdOrderByGeneratedAtDesc(propertyId, PageRequest.of(0, 50))
                .stream()
                .map(this::toQuoteDto)
                .toList();
    }

    /**
     * Genere un devis blanchisserie a partir de l'inventaire linge de la propriete
     * et du catalogue prix blanchisserie de l'organisation.
     */
    public LaundryQuoteDto generateQuote(Long propertyId, GenerateLaundryQuoteRequest request) {
        final List<PropertyLaundryItem> laundryItems = laundryRepo.findByPropertyId(propertyId);
        if (laundryItems.isEmpty()) {
            throw new IllegalArgumentException("Aucun article de linge configure pour cette propriete. Ajoutez des articles avant de generer un devis.");
        }

        // Charger le catalogue blanchisserie
        final PricingConfigDto pricingConfig = pricingConfigService.getCurrentConfig();
        final List<PricingConfigDto.BlanchisserieItem> catalog = pricingConfig.getBlanchisserieConfig();
        final Map<String, PricingConfigDto.BlanchisserieItem> catalogByKey = catalog != null
                ? catalog.stream().collect(Collectors.toMap(PricingConfigDto.BlanchisserieItem::getKey, b -> b, (a, b) -> a))
                : Map.of();

        // Construire les lignes du devis
        final List<LaundryQuoteLineDto> lines = new ArrayList<>();
        BigDecimal totalHt = BigDecimal.ZERO;

        for (PropertyLaundryItem laundryItem : laundryItems) {
            final PricingConfigDto.BlanchisserieItem catalogItem = catalogByKey.get(laundryItem.getItemKey());
            final BigDecimal unitPrice = (catalogItem != null && catalogItem.isEnabled() && catalogItem.getPrice() != null)
                    ? BigDecimal.valueOf(catalogItem.getPrice())
                    : BigDecimal.ZERO;
            final BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(laundryItem.getQuantityPerStay()));
            totalHt = totalHt.add(lineTotal);

            lines.add(new LaundryQuoteLineDto(
                    laundryItem.getItemKey(),
                    laundryItem.getLabel(),
                    laundryItem.getQuantityPerStay(),
                    unitPrice,
                    lineTotal
            ));
        }

        // Persister le devis
        final var quote = new LaundryQuote();
        quote.setOrganizationId(tenantContext.getRequiredOrganizationId());
        quote.setPropertyId(propertyId);
        quote.setReservationId(request.reservationId());
        quote.setStatus(LaundryQuoteStatus.DRAFT);
        quote.setTotalHt(totalHt);
        quote.setCurrency(tenantContext.getDefaultCurrency());
        quote.setNotes(request.notes());

        try {
            quote.setLines(objectMapper.writeValueAsString(lines));
        } catch (JsonProcessingException e) {
            log.error("Erreur serialisation des lignes du devis", e);
            throw new RuntimeException("Erreur lors de la generation du devis");
        }

        return toQuoteDto(quoteRepo.save(quote));
    }

    public LaundryQuoteDto confirmQuote(Long propertyId, Long quoteId) {
        final var quote = quoteRepo.findByPropertyIdAndId(propertyId, quoteId)
                .orElseThrow(() -> new NotFoundException("Devis introuvable"));
        if (quote.getStatus() != LaundryQuoteStatus.DRAFT) {
            throw new IllegalStateException("Seul un devis au statut BROUILLON peut etre confirme");
        }
        quote.setStatus(LaundryQuoteStatus.CONFIRMED);
        quote.setConfirmedAt(LocalDateTime.now());
        return toQuoteDto(quoteRepo.save(quote));
    }

    // ── Blanchisserie catalog (read-only for non-admin roles) ────────────

    @Transactional(readOnly = true)
    public List<PricingConfigDto.BlanchisserieItem> getBlanchisserieCatalog() {
        final PricingConfigDto config = pricingConfigService.getCurrentConfig();
        final List<PricingConfigDto.BlanchisserieItem> items = config.getBlanchisserieConfig();
        if (items == null) return List.of();
        return items.stream().filter(PricingConfigDto.BlanchisserieItem::isEnabled).toList();
    }

    // ── Mappers ──────────────────────────────────────────────────────────

    private PropertyInventoryItemDto toDto(PropertyInventoryItem item) {
        return new PropertyInventoryItemDto(
                item.getId(), item.getPropertyId(),
                item.getName(), item.getCategory(),
                item.getQuantity(), item.getNotes()
        );
    }

    private PropertyLaundryItemDto toLaundryDto(PropertyLaundryItem item) {
        return new PropertyLaundryItemDto(
                item.getId(), item.getPropertyId(),
                item.getItemKey(), item.getLabel(),
                item.getQuantityPerStay()
        );
    }

    private LaundryQuoteDto toQuoteDto(LaundryQuote quote) {
        List<LaundryQuoteLineDto> lines;
        try {
            lines = objectMapper.readValue(quote.getLines(), new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            log.error("Erreur deserialization des lignes du devis #{}", quote.getId(), e);
            lines = List.of();
        }
        return new LaundryQuoteDto(
                quote.getId(), quote.getPropertyId(), quote.getReservationId(),
                quote.getStatus().name(), lines, quote.getTotalHt(),
                quote.getCurrency(),
                quote.getGeneratedAt() != null ? quote.getGeneratedAt().toString() : null,
                quote.getConfirmedAt() != null ? quote.getConfirmedAt().toString() : null,
                quote.getNotes()
        );
    }
}

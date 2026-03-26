package com.clenzy.booking.service;

import com.clenzy.booking.dto.BookingServiceCategoryDto;
import com.clenzy.booking.dto.BookingServiceItemDto;
import com.clenzy.booking.dto.SelectedServiceOptionDto;
import com.clenzy.booking.model.BookingServiceCategory;
import com.clenzy.booking.model.BookingServiceItem;
import com.clenzy.booking.model.BookingServicePricingMode;
import com.clenzy.booking.repository.BookingServiceCategoryRepository;
import com.clenzy.booking.repository.BookingServiceItemRepository;
import com.clenzy.model.Reservation;
import com.clenzy.model.ReservationServiceItem;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ReservationServiceItemRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Service metier pour les options/services custom du booking engine.
 * Gere le CRUD admin, la lecture publique, le calcul de prix et la liaison aux reservations.
 */
@Service
@Transactional(readOnly = true)
public class BookingServiceOptionsService {

    private static final Logger log = LoggerFactory.getLogger(BookingServiceOptionsService.class);

    private final BookingServiceCategoryRepository categoryRepository;
    private final BookingServiceItemRepository itemRepository;
    private final ReservationServiceItemRepository reservationServiceItemRepository;
    private final ReservationRepository reservationRepository;
    private final TenantContext tenantContext;

    public BookingServiceOptionsService(BookingServiceCategoryRepository categoryRepository,
                                         BookingServiceItemRepository itemRepository,
                                         ReservationServiceItemRepository reservationServiceItemRepository,
                                         ReservationRepository reservationRepository,
                                         TenantContext tenantContext) {
        this.categoryRepository = categoryRepository;
        this.itemRepository = itemRepository;
        this.reservationServiceItemRepository = reservationServiceItemRepository;
        this.reservationRepository = reservationRepository;
        this.tenantContext = tenantContext;
    }

    // ─── Admin CRUD : Categories ────────────────────────────────────────

    public List<BookingServiceCategoryDto> listCategories() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return categoryRepository.findAllByOrganizationIdOrderBySortOrderAsc(orgId).stream()
            .map(BookingServiceCategoryDto::from)
            .toList();
    }

    @Transactional
    public BookingServiceCategoryDto createCategory(BookingServiceCategoryDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        BookingServiceCategory category = new BookingServiceCategory();
        category.setOrganizationId(orgId);
        category.setName(dto.name());
        category.setDescription(dto.description());
        category.setSortOrder(dto.sortOrder() != null ? dto.sortOrder() : 0);
        category.setActive(dto.active());

        category = categoryRepository.save(category);
        log.info("Service option category created: id={}, name='{}', orgId={}", category.getId(), category.getName(), orgId);
        return BookingServiceCategoryDto.from(category);
    }

    @Transactional
    public BookingServiceCategoryDto updateCategory(Long categoryId, BookingServiceCategoryDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingServiceCategory category = categoryRepository.findByIdAndOrganizationId(categoryId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Categorie introuvable : " + categoryId));

        category.setName(dto.name());
        category.setDescription(dto.description());
        if (dto.sortOrder() != null) {
            category.setSortOrder(dto.sortOrder());
        }
        category.setActive(dto.active());

        category = categoryRepository.save(category);
        return BookingServiceCategoryDto.from(category);
    }

    @Transactional
    public void deleteCategory(Long categoryId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingServiceCategory category = categoryRepository.findByIdAndOrganizationId(categoryId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Categorie introuvable : " + categoryId));

        categoryRepository.delete(category);
        log.info("Service option category deleted: id={}, orgId={}", categoryId, orgId);
    }

    @Transactional
    public List<BookingServiceCategoryDto> reorderCategories(List<Long> orderedIds) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        List<BookingServiceCategory> categories = categoryRepository.findAllByOrganizationIdOrderBySortOrderAsc(orgId);

        Map<Long, BookingServiceCategory> byId = categories.stream()
            .collect(Collectors.toMap(BookingServiceCategory::getId, Function.identity()));

        for (int i = 0; i < orderedIds.size(); i++) {
            BookingServiceCategory cat = byId.get(orderedIds.get(i));
            if (cat != null) {
                cat.setSortOrder(i);
            }
        }
        categoryRepository.saveAll(categories);

        // Use already-updated in-memory entities instead of re-querying
        return categories.stream()
            .sorted(java.util.Comparator.comparingInt(BookingServiceCategory::getSortOrder))
            .map(BookingServiceCategoryDto::from)
            .toList();
    }

    // ─── Admin CRUD : Items ─────────────────────────────────────────────

    @Transactional
    public BookingServiceItemDto createItem(Long categoryId, BookingServiceItemDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingServiceCategory category = categoryRepository.findByIdAndOrganizationId(categoryId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Categorie introuvable : " + categoryId));

        BookingServiceItem item = new BookingServiceItem();
        item.setCategory(category);
        item.setOrganizationId(orgId);
        item.setName(dto.name());
        item.setDescription(dto.description());
        item.setPrice(dto.price() != null ? dto.price() : BigDecimal.ZERO);
        item.setPricingMode(dto.pricingMode() != null ? dto.pricingMode() : BookingServicePricingMode.PER_BOOKING);
        item.setInputType(dto.inputType() != null ? dto.inputType() : com.clenzy.booking.model.BookingServiceInputType.CHECKBOX);
        item.setMaxQuantity(dto.maxQuantity() != null ? dto.maxQuantity() : 10);
        item.setMandatory(dto.mandatory());
        item.setSortOrder(dto.sortOrder() != null ? dto.sortOrder() : 0);
        item.setActive(dto.active());

        item = itemRepository.save(item);
        log.info("Service option item created: id={}, name='{}', categoryId={}, orgId={}", item.getId(), item.getName(), categoryId, orgId);
        return BookingServiceItemDto.from(item);
    }

    @Transactional
    public BookingServiceItemDto updateItem(Long itemId, BookingServiceItemDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingServiceItem item = itemRepository.findByIdAndOrganizationId(itemId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Service item introuvable : " + itemId));

        item.setName(dto.name());
        item.setDescription(dto.description());
        if (dto.price() != null) {
            item.setPrice(dto.price());
        }
        if (dto.pricingMode() != null) {
            item.setPricingMode(dto.pricingMode());
        }
        if (dto.inputType() != null) {
            item.setInputType(dto.inputType());
        }
        if (dto.maxQuantity() != null) {
            item.setMaxQuantity(dto.maxQuantity());
        }
        item.setMandatory(dto.mandatory());
        if (dto.sortOrder() != null) {
            item.setSortOrder(dto.sortOrder());
        }
        item.setActive(dto.active());

        item = itemRepository.save(item);
        return BookingServiceItemDto.from(item);
    }

    @Transactional
    public void deleteItem(Long itemId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingServiceItem item = itemRepository.findByIdAndOrganizationId(itemId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Service item introuvable : " + itemId));

        itemRepository.delete(item);
        log.info("Service option item deleted: id={}, orgId={}", itemId, orgId);
    }

    // ─── Public API ─────────────────────────────────────────────────────

    /**
     * Liste les categories actives avec leurs items actifs pour l'API publique.
     * Pas de TenantContext — l'orgId est passe directement (resolu via slug/API Key).
     */
    public List<BookingServiceCategoryDto> listActiveCategories(Long orgId) {
        return categoryRepository.findAllByOrganizationIdAndActiveTrueOrderBySortOrderAsc(orgId).stream()
            .map(BookingServiceCategoryDto::fromActiveOnly)
            .filter(cat -> !cat.items().isEmpty())
            .toList();
    }

    // ─── Prix & liaison reservation ─────────────────────────────────────

    /**
     * Calcule le total des services optionnels selectionnes.
     * Le prix est TOUJOURS recalcule cote serveur (ne jamais faire confiance au client).
     *
     * @param selections options selectionnees par le voyageur
     * @param guests     nombre total de voyageurs (adults + children)
     * @param nights     nombre de nuits du sejour
     * @param orgId      ID de l'organisation
     * @return total des services optionnels
     */
    public BigDecimal computeServiceOptionsTotal(List<SelectedServiceOptionDto> selections,
                                                  int guests, int nights, Long orgId) {
        if (selections == null || selections.isEmpty()) {
            return BigDecimal.ZERO;
        }

        List<Long> itemIds = selections.stream()
            .map(SelectedServiceOptionDto::serviceItemId)
            .toList();
        Map<Long, BookingServiceItem> itemsById = itemRepository.findAllByIdInAndOrganizationId(itemIds, orgId).stream()
            .collect(Collectors.toMap(BookingServiceItem::getId, Function.identity()));

        BigDecimal total = BigDecimal.ZERO;
        for (SelectedServiceOptionDto sel : selections) {
            BookingServiceItem item = itemsById.get(sel.serviceItemId());
            if (item == null || !item.isActive()) {
                continue;
            }
            total = total.add(computeItemTotal(item, sel.quantity(), guests, nights));
        }
        return total;
    }

    /**
     * Cree les ReservationServiceItem (snapshots) et les rattache a la reservation.
     * Met a jour le serviceOptionsTotal de la reservation.
     */
    @Transactional
    public void createReservationServiceItems(Reservation reservation,
                                               List<SelectedServiceOptionDto> selections,
                                               int guests, int nights, Long orgId) {
        if (selections == null || selections.isEmpty()) {
            return;
        }

        List<Long> itemIds = selections.stream()
            .map(SelectedServiceOptionDto::serviceItemId)
            .toList();
        Map<Long, BookingServiceItem> itemsById = itemRepository.findAllByIdInAndOrganizationId(itemIds, orgId).stream()
            .collect(Collectors.toMap(BookingServiceItem::getId, Function.identity()));

        BigDecimal total = BigDecimal.ZERO;
        for (SelectedServiceOptionDto sel : selections) {
            BookingServiceItem item = itemsById.get(sel.serviceItemId());
            if (item == null || !item.isActive()) {
                continue;
            }

            BigDecimal itemTotal = computeItemTotal(item, sel.quantity(), guests, nights);

            ReservationServiceItem rsi = new ReservationServiceItem();
            rsi.setReservation(reservation);
            rsi.setServiceItemId(item.getId());
            rsi.setServiceItemName(item.getName());
            rsi.setQuantity(sel.quantity());
            rsi.setUnitPrice(item.getPrice());
            rsi.setPricingMode(item.getPricingMode());
            rsi.setTotalPrice(itemTotal);

            reservationServiceItemRepository.save(rsi);
            total = total.add(itemTotal);
        }

        reservation.setServiceOptionsTotal(total);
        reservationRepository.save(reservation);
    }

    // ─── Private ────────────────────────────────────────────────────────

    private BigDecimal computeItemTotal(BookingServiceItem item, int quantity, int guests, int nights) {
        // Enforce max_quantity server-side
        final int effectiveQty = item.getMaxQuantity() != null
            ? Math.min(quantity, item.getMaxQuantity())
            : quantity;
        BigDecimal price = item.getPrice();
        return switch (item.getPricingMode()) {
            case PER_BOOKING -> price.multiply(BigDecimal.valueOf(effectiveQty));
            case PER_PERSON -> price.multiply(BigDecimal.valueOf(effectiveQty)).multiply(BigDecimal.valueOf(guests));
            case PER_NIGHT -> price.multiply(BigDecimal.valueOf(effectiveQty)).multiply(BigDecimal.valueOf(nights));
        };
    }
}

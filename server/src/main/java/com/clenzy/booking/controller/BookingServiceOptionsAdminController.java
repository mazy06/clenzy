package com.clenzy.booking.controller;

import com.clenzy.booking.dto.BookingServiceCategoryDto;
import com.clenzy.booking.dto.BookingServiceItemDto;
import com.clenzy.booking.service.BookingServiceOptionsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Endpoints admin pour la gestion des options/services custom du booking engine.
 * Necessite un JWT avec role HOST, SUPER_ADMIN ou SUPER_MANAGER.
 */
@RestController
@RequestMapping("/api/booking-engine/service-options")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class BookingServiceOptionsAdminController {

    private final BookingServiceOptionsService serviceOptionsService;

    public BookingServiceOptionsAdminController(BookingServiceOptionsService serviceOptionsService) {
        this.serviceOptionsService = serviceOptionsService;
    }

    // ─── Categories ─────────────────────────────────────────────────────

    @GetMapping("/categories")
    public ResponseEntity<List<BookingServiceCategoryDto>> listCategories() {
        return ResponseEntity.ok(serviceOptionsService.listCategories());
    }

    @PostMapping("/categories")
    public ResponseEntity<BookingServiceCategoryDto> createCategory(@RequestBody BookingServiceCategoryDto dto) {
        return ResponseEntity.ok(serviceOptionsService.createCategory(dto));
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<BookingServiceCategoryDto> updateCategory(
            @PathVariable Long id,
            @RequestBody BookingServiceCategoryDto dto) {
        return ResponseEntity.ok(serviceOptionsService.updateCategory(id, dto));
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        serviceOptionsService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/categories/reorder")
    public ResponseEntity<List<BookingServiceCategoryDto>> reorderCategories(@RequestBody List<Long> orderedIds) {
        return ResponseEntity.ok(serviceOptionsService.reorderCategories(orderedIds));
    }

    // ─── Items ──────────────────────────────────────────────────────────

    @PostMapping("/categories/{catId}/items")
    public ResponseEntity<BookingServiceItemDto> createItem(
            @PathVariable Long catId,
            @RequestBody BookingServiceItemDto dto) {
        return ResponseEntity.ok(serviceOptionsService.createItem(catId, dto));
    }

    @PutMapping("/items/{id}")
    public ResponseEntity<BookingServiceItemDto> updateItem(
            @PathVariable Long id,
            @RequestBody BookingServiceItemDto dto) {
        return ResponseEntity.ok(serviceOptionsService.updateItem(id, dto));
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        serviceOptionsService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }

    // ─── Error handling ─────────────────────────────────────────────────

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
}

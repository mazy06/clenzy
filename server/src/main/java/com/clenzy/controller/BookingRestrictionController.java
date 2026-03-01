package com.clenzy.controller;

import com.clenzy.dto.BookingRestrictionDto;
import com.clenzy.dto.CreateBookingRestrictionRequest;
import com.clenzy.service.BookingRestrictionService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/booking-restrictions")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class BookingRestrictionController {

    private final BookingRestrictionService restrictionService;
    private final TenantContext tenantContext;

    public BookingRestrictionController(BookingRestrictionService restrictionService,
                                         TenantContext tenantContext) {
        this.restrictionService = restrictionService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<BookingRestrictionDto> list(@RequestParam Long propertyId) {
        Long orgId = tenantContext.getOrganizationId();
        return restrictionService.getByProperty(propertyId, orgId).stream()
            .map(BookingRestrictionDto::from).toList();
    }

    @GetMapping("/{id}")
    public BookingRestrictionDto getById(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        return BookingRestrictionDto.from(restrictionService.getById(id, orgId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BookingRestrictionDto create(@Valid @RequestBody CreateBookingRestrictionRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        return BookingRestrictionDto.from(restrictionService.create(request, orgId));
    }

    @PutMapping("/{id}")
    public BookingRestrictionDto update(@PathVariable Long id,
                                         @Valid @RequestBody CreateBookingRestrictionRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        return BookingRestrictionDto.from(restrictionService.update(id, orgId, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        restrictionService.delete(id, orgId);
    }
}

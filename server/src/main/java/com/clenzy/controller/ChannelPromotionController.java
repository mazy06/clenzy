package com.clenzy.controller;

import com.clenzy.dto.ChannelPromotionDto;
import com.clenzy.dto.CreateChannelPromotionRequest;
import com.clenzy.service.ChannelPromotionService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/channel-promotions")
public class ChannelPromotionController {

    private final ChannelPromotionService promotionService;
    private final TenantContext tenantContext;

    public ChannelPromotionController(ChannelPromotionService promotionService,
                                      TenantContext tenantContext) {
        this.promotionService = promotionService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<ChannelPromotionDto> list(@RequestParam(required = false) Long propertyId) {
        Long orgId = tenantContext.getOrganizationId();
        if (propertyId != null) {
            return promotionService.getByProperty(propertyId, orgId).stream()
                .map(ChannelPromotionDto::from).toList();
        }
        return promotionService.getAll(orgId).stream()
            .map(ChannelPromotionDto::from).toList();
    }

    @GetMapping("/{id}")
    public ChannelPromotionDto getById(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelPromotionDto.from(promotionService.getById(id, orgId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChannelPromotionDto create(@Valid @RequestBody CreateChannelPromotionRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelPromotionDto.from(promotionService.create(request, orgId));
    }

    @PutMapping("/{id}")
    public ChannelPromotionDto update(@PathVariable Long id,
                                      @Valid @RequestBody CreateChannelPromotionRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelPromotionDto.from(promotionService.update(id, orgId, request));
    }

    @PutMapping("/{id}/toggle")
    public ChannelPromotionDto toggle(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelPromotionDto.from(promotionService.togglePromotion(id, orgId));
    }

    @PostMapping("/sync/{propertyId}")
    @ResponseStatus(HttpStatus.OK)
    public void sync(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getOrganizationId();
        promotionService.syncWithChannel(propertyId, orgId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        promotionService.delete(id, orgId);
    }
}

package com.clenzy.controller;

import com.clenzy.dto.*;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.GuestReview;
import com.clenzy.service.ReviewService;
import com.clenzy.service.ReviewSyncService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {

    private final ReviewService reviewService;
    private final ReviewSyncService syncService;
    private final TenantContext tenantContext;

    public ReviewController(ReviewService reviewService,
                            ReviewSyncService syncService,
                            TenantContext tenantContext) {
        this.reviewService = reviewService;
        this.syncService = syncService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<Page<GuestReviewDto>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long propertyId,
            @RequestParam(required = false) ChannelName channel) {
        Long orgId = tenantContext.getOrganizationId();
        Page<GuestReviewDto> result;

        if (propertyId != null) {
            result = reviewService.getByProperty(propertyId, orgId, PageRequest.of(page, size))
                .map(GuestReviewDto::from);
        } else if (channel != null) {
            result = reviewService.getByChannel(channel, orgId, PageRequest.of(page, size))
                .map(GuestReviewDto::from);
        } else {
            result = reviewService.getAll(orgId, PageRequest.of(page, size))
                .map(GuestReviewDto::from);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<GuestReviewDto> getById(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        GuestReview review = reviewService.getById(id, orgId);
        return ResponseEntity.ok(GuestReviewDto.from(review));
    }

    @GetMapping("/stats/{propertyId}")
    public ResponseEntity<ReviewStatsDto> getStats(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getOrganizationId();
        return ResponseEntity.ok(reviewService.getStats(propertyId, orgId));
    }

    @PostMapping
    public ResponseEntity<GuestReviewDto> create(@Valid @RequestBody CreateReviewRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        GuestReview review = reviewService.addReview(request, orgId);
        return ResponseEntity.ok(GuestReviewDto.from(review));
    }

    @PutMapping("/{id}/respond")
    public ResponseEntity<GuestReviewDto> respond(@PathVariable Long id,
                                                   @Valid @RequestBody ReviewResponseRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        GuestReview review = reviewService.respondToReview(id, orgId, request.response());
        return ResponseEntity.ok(GuestReviewDto.from(review));
    }

    @PostMapping("/sync/{propertyId}")
    public ResponseEntity<Map<String, Object>> sync(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getOrganizationId();
        int synced = syncService.syncReviewsForProperty(propertyId, orgId);
        return ResponseEntity.ok(Map.of("synced", synced, "propertyId", propertyId));
    }
}

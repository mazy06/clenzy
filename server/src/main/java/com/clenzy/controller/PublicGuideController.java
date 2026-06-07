package com.clenzy.controller;

import com.clenzy.dto.ActivityDto;
import com.clenzy.dto.GuestChatRequest;
import com.clenzy.dto.GuestbookEntryDto;
import com.clenzy.dto.GuestbookEntryRequest;
import com.clenzy.dto.PublicUpsellDto;
import com.clenzy.dto.UpsellCheckoutDto;
import com.clenzy.dto.WelcomeGuideEventRequest;
import com.clenzy.dto.WelcomeGuidePublicDto;
import com.clenzy.model.WelcomeGuideEventType;
import com.clenzy.service.ActivityService;
import com.clenzy.service.GuestChatService;
import com.clenzy.service.UpsellService;
import com.clenzy.service.WelcomeGuideAnalyticsService;
import com.clenzy.service.WelcomeGuideEntryService;
import com.clenzy.service.WelcomeGuideService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/public/guide")
public class PublicGuideController {

    private final WelcomeGuideService guideService;
    private final WelcomeGuideEntryService entryService;
    private final ActivityService activityService;
    private final GuestChatService guestChatService;
    private final WelcomeGuideAnalyticsService analyticsService;
    private final UpsellService upsellService;

    public PublicGuideController(WelcomeGuideService guideService,
                                 WelcomeGuideEntryService entryService,
                                 ActivityService activityService,
                                 GuestChatService guestChatService,
                                 WelcomeGuideAnalyticsService analyticsService,
                                 UpsellService upsellService) {
        this.guideService = guideService;
        this.entryService = entryService;
        this.activityService = activityService;
        this.guestChatService = guestChatService;
        this.analyticsService = analyticsService;
        this.upsellService = upsellService;
    }

    @GetMapping("/{token}")
    public ResponseEntity<WelcomeGuidePublicDto> getGuide(@PathVariable UUID token) {
        return guideService.getPublicGuidePayload(token)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{token}/guestbook")
    public ResponseEntity<List<GuestbookEntryDto>> listGuestbook(@PathVariable UUID token) {
        return ResponseEntity.ok(entryService.listPublic(token));
    }

    @PostMapping("/{token}/guestbook")
    public ResponseEntity<GuestbookEntryDto> addGuestbookEntry(@PathVariable UUID token,
                                                               @Valid @RequestBody GuestbookEntryRequest request) {
        return entryService.addEntry(token, request)
            .map(dto -> {
                analyticsService.record(token, WelcomeGuideEventType.GUESTBOOK_SUBMIT.name(), null);
                return ResponseEntity.ok(dto);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    /** Capture d'un evenement guest (ouverture, clic activite, clic check-in). Best-effort. */
    @PostMapping("/{token}/event")
    public ResponseEntity<Void> recordEvent(@PathVariable UUID token,
                                            @Valid @RequestBody WelcomeGuideEventRequest request) {
        analyticsService.record(token, request.eventType(), request.detail());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{token}/activities")
    public ResponseEntity<List<ActivityDto>> listActivities(@PathVariable UUID token) {
        return ResponseEntity.ok(activityService.searchForGuide(token, 12));
    }

    @GetMapping("/{token}/upsells")
    public ResponseEntity<List<PublicUpsellDto>> listUpsells(@PathVariable UUID token) {
        return ResponseEntity.ok(upsellService.listForToken(token));
    }

    /** Crée le paiement d'un upsell (Stripe embedded) — renvoie le clientSecret. */
    @PostMapping("/{token}/upsells/{offerId}/checkout")
    public ResponseEntity<UpsellCheckoutDto> checkoutUpsell(@PathVariable UUID token, @PathVariable Long offerId) {
        try {
            return ResponseEntity.ok(upsellService.createCheckout(token, offerId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    /** Filet de secours post-paiement : re-vérifie la session Stripe + marque PAID. */
    @PostMapping("/{token}/upsells/orders/{orderId}/confirm")
    public ResponseEntity<Map<String, String>> confirmUpsell(@PathVariable UUID token, @PathVariable Long orderId) {
        return ResponseEntity.ok(Map.of("status", upsellService.confirmOrder(token, orderId)));
    }

    @PostMapping("/{token}/chat")
    public ResponseEntity<Map<String, String>> chat(@PathVariable UUID token,
                                                    @Valid @RequestBody GuestChatRequest request) {
        GuestChatService.GuestChatResult result = guestChatService.answer(token, request.message());
        if (result.status() == GuestChatService.Status.INVALID) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("reply", ""));
        }
        if (result.status() == GuestChatService.Status.OK) {
            analyticsService.record(token, WelcomeGuideEventType.CHAT_MESSAGE.name(), null);
        }
        HttpStatus code = result.status() == GuestChatService.Status.RATE_LIMITED
            ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.OK;
        return ResponseEntity.status(code).body(Map.of("reply", result.reply() != null ? result.reply() : ""));
    }
}

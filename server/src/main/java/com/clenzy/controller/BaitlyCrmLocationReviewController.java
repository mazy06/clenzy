package com.clenzy.controller;

import java.util.List;
import com.clenzy.service.BaitlyCrmLocationReview;
import com.clenzy.service.BaitlyCrmOsmMatching;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/prospect-location-review")
@PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
public class BaitlyCrmLocationReviewController {
    private final BaitlyCrmLocationReview review;
    public BaitlyCrmLocationReviewController(BaitlyCrmLocationReview review){this.review=review;}
    @GetMapping public BaitlyCrmLocationReview.Progress progress(@AuthenticationPrincipal Jwt jwt){return review.progress(jwt.getSubject());}
    @PostMapping public BaitlyCrmLocationReview.Progress enqueue(@AuthenticationPrincipal Jwt jwt,@RequestBody List<Long> ids){return review.enqueue(jwt.getSubject(),ids);}
    @PostMapping("/prepare-imported") public List<com.clenzy.marketplace.service.BaitlyProfessionalDirectory.ImportResult> prepareImported(@AuthenticationPrincipal Jwt jwt){return review.prepareImported(jwt.getSubject());}
    @PostMapping("/{id}/skip") public BaitlyCrmLocationReview.Progress skip(@AuthenticationPrincipal Jwt jwt,@PathVariable long id){return review.skip(jwt.getSubject(),id);}
    @PostMapping("/{id}/search") public BaitlyCrmOsmMatching.Results search(@AuthenticationPrincipal Jwt jwt,@PathVariable long id){return review.search(jwt.getSubject(),id);}
}

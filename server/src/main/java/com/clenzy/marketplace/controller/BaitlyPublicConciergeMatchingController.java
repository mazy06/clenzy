package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.BaitlyConciergeMatching;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/public/baitly-catalog/profiles/matches")
@PreAuthorize("permitAll()")
public class BaitlyPublicConciergeMatchingController {
    private final BaitlyConciergeMatching matching;
    public BaitlyPublicConciergeMatchingController(BaitlyConciergeMatching matching) {this.matching=matching;}
    @GetMapping
    public BaitlyConciergeMatching.Results search(@RequestParam(required=false) String city,@RequestParam(required=false) String country,
        @RequestParam(required=false) List<String> service,@RequestParam(required=false) BigDecimal maxFee,@RequestParam(defaultValue="0") int page) {
        return matching.search(city,country,service,maxFee,page);
    }
}

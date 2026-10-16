package com.clenzy.marketplace.controller;
import com.clenzy.marketplace.service.BaitlyConciergePerformance;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** Route couverte par /api/public/** dans SecurityConfigProd ; lecture uniquement. */
@RestController
@RequestMapping("/api/public/concierge-performance")
@PreAuthorize("permitAll()")
public class BaitlyPublicConciergePerformanceController {
    private final BaitlyConciergePerformance performance;
    public BaitlyPublicConciergePerformanceController(BaitlyConciergePerformance performance) { this.performance=performance; }
    @GetMapping public List<BaitlyConciergePerformance.Performance> list() { return performance.publicList(); }
}

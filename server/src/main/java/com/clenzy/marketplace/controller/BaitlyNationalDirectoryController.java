package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.BaitlyNationalDirectorySync;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/** Public source coverage for authenticated users; no private organization data. */
@RestController
@RequestMapping("/api/professional-directory/synchronization")
@PreAuthorize("isAuthenticated()")
public class BaitlyNationalDirectoryController {
    private final BaitlyNationalDirectorySync sync;
    public BaitlyNationalDirectoryController(BaitlyNationalDirectorySync sync){this.sync=sync;}
    @GetMapping public Map<String,Object> status(){return sync.status();}
}

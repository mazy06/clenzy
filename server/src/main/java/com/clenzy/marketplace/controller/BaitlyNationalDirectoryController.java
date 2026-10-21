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
    private com.clenzy.marketplace.service.BaitlyDirectoryCountrySync countries;
    @org.springframework.beans.factory.annotation.Autowired
    public void countries(com.clenzy.marketplace.service.BaitlyDirectoryCountrySync countries){this.countries=countries;}
    public BaitlyNationalDirectoryController(BaitlyNationalDirectorySync sync){this.sync=sync;}
    public Map<String,Object> status(){return sync.status();}
    @GetMapping public Map<String,Object> status(@RequestParam(defaultValue="FR") String country){country=com.clenzy.marketplace.service.BaitlyDirectoryCountry.country(country);return country.equals("FR")?sync.status():countries.status(country);}
}

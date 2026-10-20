package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.BaitlyProfessionalDirectory;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/** Global professional references, never tenant CRM contacts. */
@RestController
@RequestMapping("/api/professional-directory")
@PreAuthorize("isAuthenticated()")
public class BaitlyProfessionalDirectoryController {
    private final BaitlyProfessionalDirectory directory;
    public BaitlyProfessionalDirectoryController(BaitlyProfessionalDirectory directory){this.directory=directory;}
    @GetMapping public BaitlyProfessionalDirectory.Page list(@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="") String service,@RequestParam(defaultValue="") String contacts){return directory.list(query,page,service,contacts);}
    @GetMapping("/map/clusters") public BaitlyProfessionalDirectory.MapCoverage clusters(@RequestParam(defaultValue="") String city,@RequestParam(defaultValue="") String service,@RequestParam(defaultValue="") String query,
        @RequestParam(defaultValue="-180") double west,@RequestParam(defaultValue="-90") double south,@RequestParam(defaultValue="180") double east,@RequestParam(defaultValue="90") double north,@RequestParam(defaultValue="") String contacts){
        return directory.clusters(city,service,query,west,south,east,north,contacts);
    }
    @GetMapping("/map") public BaitlyProfessionalDirectory.MapPage map(@RequestParam(defaultValue="") String city,@RequestParam(defaultValue="") String service,@RequestParam(defaultValue="") String query,
        @RequestParam(defaultValue="-180") double west,@RequestParam(defaultValue="-90") double south,@RequestParam(defaultValue="180") double east,@RequestParam(defaultValue="90") double north,@RequestParam(defaultValue="0") long after,@RequestParam(defaultValue="") String contacts){
        return directory.map(city,service,query,west,south,east,north,after,contacts);
    }
    @GetMapping("/map/ranked") public BaitlyProfessionalDirectory.MapPage rankedMap(@RequestParam(defaultValue="") String city,@RequestParam(defaultValue="") String service,@RequestParam(defaultValue="") String query,
        @RequestParam double west,@RequestParam double south,@RequestParam double east,@RequestParam double north,@RequestParam(defaultValue="0") long after,@RequestParam(defaultValue="") String contacts,@RequestParam(defaultValue="PROXIMITY") String sort){
        return directory.rankedMap(city,service,query,west,south,east,north,after,contacts,sort);
    }
    @PostMapping("/sirene/search") @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public BaitlyProfessionalDirectory.Preview search(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyProfessionalDirectory.Search input){return directory.search(jwt.getSubject(),input);}
    @GetMapping("/cities") @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public com.fasterxml.jackson.databind.JsonNode cities(@RequestParam String name){return directory.cities(name);}
    @PostMapping("/sirene/confirm-batch") @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public java.util.List<BaitlyProfessionalDirectory.ImportResult> confirmBusinesses(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyProfessionalDirectory.BulkChoices input){return directory.confirmBusinesses(jwt.getSubject(),input);}
    @PostMapping("/sirene/confirm") @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public Map<String,Object> confirmBusiness(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyProfessionalDirectory.Choice choice){return directory.confirmBusiness(jwt.getSubject(),choice);}
    @PostMapping("/{id}/osm/search") @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public BaitlyProfessionalDirectory.Matches match(@AuthenticationPrincipal Jwt jwt,@PathVariable long id){return directory.match(jwt.getSubject(),id);}
    @PostMapping("/{id}/osm/confirm") @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public Map<String,Object> confirmPlace(@AuthenticationPrincipal Jwt jwt,@PathVariable long id,@Valid @RequestBody BaitlyProfessionalDirectory.Choice choice){return directory.confirmPlace(jwt.getSubject(),id,choice);}
    @DeleteMapping("/{id}") @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public void suppress(@PathVariable long id){directory.suppress(id);}
    @ExceptionHandler(IllegalArgumentException.class) @ResponseStatus(org.springframework.http.HttpStatus.BAD_REQUEST)
    public Map<String,String> invalid(IllegalArgumentException e){return Map.of("message",e.getMessage());}
}

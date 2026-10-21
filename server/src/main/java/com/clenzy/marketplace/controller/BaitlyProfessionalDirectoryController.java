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
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(BaitlyProfessionalDirectoryController.class);
    private final BaitlyProfessionalDirectory directory;
    public BaitlyProfessionalDirectoryController(BaitlyProfessionalDirectory directory){this.directory=directory;}
    @GetMapping public BaitlyProfessionalDirectory.Page list(@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="") String service,@RequestParam(defaultValue="") String contacts,@RequestParam(defaultValue="FR") String country){return directory.list(query,page,service,contacts,country);}
    @GetMapping("/map/clusters") public BaitlyProfessionalDirectory.MapCoverage clusters(@RequestParam(defaultValue="") String city,@RequestParam(defaultValue="") String service,@RequestParam(defaultValue="") String query,
        @RequestParam(defaultValue="-180") double west,@RequestParam(defaultValue="-90") double south,@RequestParam(defaultValue="180") double east,@RequestParam(defaultValue="90") double north,@RequestParam(defaultValue="") String contacts,@RequestParam(defaultValue="FR") String country){
        return directory.clusters(city,service,query,west,south,east,north,contacts,country);
    }
    @GetMapping("/map") public BaitlyProfessionalDirectory.MapPage map(@RequestParam(defaultValue="") String city,@RequestParam(defaultValue="") String service,@RequestParam(defaultValue="") String query,
        @RequestParam(defaultValue="-180") double west,@RequestParam(defaultValue="-90") double south,@RequestParam(defaultValue="180") double east,@RequestParam(defaultValue="90") double north,@RequestParam(defaultValue="0") long after,@RequestParam(defaultValue="") String contacts,@RequestParam(defaultValue="FR") String country){
        return directory.map(city,service,query,west,south,east,north,after,contacts,country);
    }
    public BaitlyProfessionalDirectory.MapPage rankedMap(@RequestParam(defaultValue="") String city,@RequestParam(defaultValue="") String service,@RequestParam(defaultValue="") String query,
        @RequestParam double west,@RequestParam double south,@RequestParam double east,@RequestParam double north,@RequestParam(defaultValue="0") long after,@RequestParam(defaultValue="") String contacts,@RequestParam(defaultValue="PROXIMITY") String sort){
        return directory.rankedMap(city,service,query,west,south,east,north,after,contacts,sort);
    }

    @GetMapping("/map/ranked") public BaitlyProfessionalDirectory.MapPage rankedMapWithCenter(@RequestParam(defaultValue="") String city,@RequestParam(defaultValue="") String service,@RequestParam(defaultValue="") String query,
        @RequestParam double west,@RequestParam double south,@RequestParam double east,@RequestParam double north,@RequestParam(defaultValue="0") long after,@RequestParam(defaultValue="") String contacts,@RequestParam(defaultValue="PROXIMITY") String sort,
        @RequestParam(required=false) Double centerLongitude,@RequestParam(required=false) Double centerLatitude,@RequestParam(defaultValue="FR") String country){
        return directory.rankedMap(city,service,query,west,south,east,north,after,contacts,sort,centerLongitude,centerLatitude,country);
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
    @ExceptionHandler(org.springframework.dao.QueryTimeoutException.class)
    public org.springframework.http.ResponseEntity<Map<String,Object>> queryTimeout(){
        log.warn("Baitly professional directory query exceeded its time limit");
        return org.springframework.http.ResponseEntity.status(org.springframework.http.HttpStatus.GATEWAY_TIMEOUT)
            .header("Retry-After","2").body(Map.of("code","DIRECTORY_QUERY_TIMEOUT","status",504,
                "message","La recherche prend trop de temps. Rapprochez la carte ou affinez les filtres, puis réessayez."));
    }
    public BaitlyProfessionalDirectory.Page list(String query,int page,String service,String contacts){return list(query,page,service,contacts,"FR");}

    public BaitlyProfessionalDirectory.MapCoverage clusters(String city,String service,String query,
        double west,double south,double east,double north,String contacts){return clusters(city,service,query,west,south,east,north,contacts,"FR");}

    public BaitlyProfessionalDirectory.MapPage map(String city,String service,String query,
        double west,double south,double east,double north,long after,String contacts){return map(city,service,query,west,south,east,north,after,contacts,"FR");}

    public BaitlyProfessionalDirectory.MapPage rankedMapWithCenter(String city,String service,String query,
        double west,double south,double east,double north,long after,String contacts,String sort,
        Double centerLongitude,Double centerLatitude){return rankedMapWithCenter(city,service,query,west,south,east,north,after,contacts,sort,centerLongitude,centerLatitude,"FR");}

}

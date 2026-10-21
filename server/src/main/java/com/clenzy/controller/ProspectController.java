package com.clenzy.controller;
import com.clenzy.dto.ProspectDto;
import com.clenzy.model.Prospect.ProspectCategory;
import com.clenzy.service.*;
import org.springframework.data.domain.Page;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

@RestController
@RequestMapping("/api/prospects")
@PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view')")
public class ProspectController {
    private final ProspectService contacts;
    private final BaitlyCrmAccess access;
    private final BaitlyCrmCsvImport importer;
    private final BaitlyCrmContactAuthorizations authorizations;
    public ProspectController(ProspectService contacts,BaitlyCrmAccess access,BaitlyCrmCsvImport importer,
                              BaitlyCrmContactAuthorizations authorizations) {
        this.contacts=contacts;this.access=access;this.importer=importer;this.authorizations=authorizations;
    }
    @GetMapping("/access")
    public Map<String,Object> access(@AuthenticationPrincipal Jwt jwt) { return access.capabilities(jwt.getSubject()); }
    @GetMapping
    public List<ProspectDto> all(@AuthenticationPrincipal Jwt jwt) { access.require(jwt.getSubject());return contacts.getAll(); }
    @GetMapping("/page")
    public Page<ProspectDto> page(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="") String search,
        @RequestParam(required=false) String type,@RequestParam(required=false) String status,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size) {
        access.require(jwt.getSubject());return contacts.page(search,type,status,page,size);
    }
    @GetMapping("/category/{category}")
    public List<ProspectDto> category(@PathVariable String category,@AuthenticationPrincipal Jwt jwt) {
        access.require(jwt.getSubject());return contacts.getByCategory(ProspectCategory.valueOf(category.toUpperCase(Locale.ROOT)));
    }
    @GetMapping("/{id}")
    public ProspectDto detail(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt) {
        access.require(jwt.getSubject());return contacts.detail(id);
    }
    @GetMapping("/{id}/duplicates")
    public List<ProspectDto> duplicates(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt) {
        access.require(jwt.getSubject());return contacts.duplicates(id);
    }
    @PostMapping @Transactional
    @PreAuthorize("hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
    public ResponseEntity<ProspectDto> create(@RequestBody ProspectDto dto,@AuthenticationPrincipal Jwt jwt) {
        access.lock(jwt.getSubject());return ResponseEntity.status(HttpStatus.CREATED).body(contacts.create(dto));
    }
    @PutMapping("/{id}") @Transactional
    @PreAuthorize("hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
    public ProspectDto update(@PathVariable Long id,@RequestBody ProspectDto dto,@AuthenticationPrincipal Jwt jwt) {
        access.lock(jwt.getSubject());return contacts.update(id,dto);
    }
    @DeleteMapping("/{id}") @Transactional
    @PreAuthorize("hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
    public ResponseEntity<Void> archive(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt) {
        access.lock(jwt.getSubject());contacts.delete(id);return ResponseEntity.noContent().build();
    }
    public record DeleteSelection(@NotEmpty @Size(max=10000) List<@NotNull @Positive Long> ids) {}
    @PostMapping("/bulk-delete") @Transactional
    @PreAuthorize("hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
    public ResponseEntity<Void> archiveSelection(@Valid @RequestBody DeleteSelection selection,@AuthenticationPrincipal Jwt jwt) {
        access.lock(jwt.getSubject());contacts.deleteMany(selection.ids());return ResponseEntity.noContent().build();
    }
    @PostMapping(value="/import",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @Transactional
    @PreAuthorize("hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
    public BaitlyCrmCsvImport.Report importCsv(@RequestParam MultipartFile file,@RequestParam String category,
        @RequestParam(required=false) String provenance,@AuthenticationPrincipal Jwt jwt) {
        long org=access.lock(jwt.getSubject());
        return importer.run(file,ProspectCategory.valueOf(category.toUpperCase(Locale.ROOT)),org,provenance);
    }
    @GetMapping("/{id}/contact-authorizations")
    public List<BaitlyCrmContactAuthorizations.Entry> history(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt) {
        access.require(jwt.getSubject());return authorizations.history(id);
    }
    @PostMapping("/{id}/contact-authorizations") @Transactional
    @PreAuthorize("hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:authorize')")
    public BaitlyCrmContactAuthorizations.Entry authorize(@PathVariable Long id,
        @RequestBody BaitlyCrmContactAuthorizations.Command command,@AuthenticationPrincipal Jwt jwt) {
        access.lock(jwt.getSubject());return authorizations.record(id,command,jwt.getSubject());
    }
}

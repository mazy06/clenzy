package com.clenzy.service;
import com.clenzy.dto.ProspectDto;
import com.clenzy.model.Prospect;
import com.clenzy.model.Prospect.ProspectCategory;
import com.clenzy.repository.ProspectRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import java.util.*;
import static com.clenzy.service.BaitlyCrmIdentity.*;

@Service
@Transactional
public class ProspectService {
    private final ProspectRepository repository;
    private final TenantContext tenant;
    public ProspectService(ProspectRepository repository,TenantContext tenant) {
        this.repository=repository; this.tenant=tenant;
    }
    @Transactional(readOnly=true)
    public List<ProspectDto> getAll() {
        return repository.findByOrganizationId(tenant.getRequiredOrganizationId()).stream()
            .filter(p -> !p.isArchived()).map(ProspectDto::fromEntity).toList();
    }
    @Transactional(readOnly=true)
    public List<ProspectDto> getByCategory(ProspectCategory category) {
        return repository.findByOrganizationIdAndCategory(tenant.getRequiredOrganizationId(),category).stream()
            .filter(p -> !p.isArchived()).map(ProspectDto::fromEntity).toList();
    }
    @Transactional(readOnly=true)
    public Page<ProspectDto> page(String search,String type,String status,int page,int size) {
        long org=tenant.getRequiredOrganizationId();
        String query=text(search,200);
        Specification<Prospect> scope=(r,q,b) -> b.and(b.equal(r.get("organizationId"),org),b.isFalse(r.get("archived")));
        if(type!=null && !type.isBlank()) {
            BaitlyCrmContactValidation.choice(type,Set.of("OWNER","PROVIDER"));
            scope=scope.and((r,q,b)->b.equal(r.get("contactType"),type));
        }
        if(status!=null && !status.isBlank()) {
            Prospect.ProspectStatus.valueOf(status);
            scope=scope.and((r,q,b)->b.equal(r.get("status"),Prospect.ProspectStatus.valueOf(status)));
        }
        if(query!=null) {
            String pattern="%"+query.toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
            scope=scope.and((r,q,b)->b.or(b.like(b.lower(r.get("name")),pattern,'\\'),
                b.like(b.lower(r.get("city")),pattern,'\\'),b.like(b.lower(r.get("email")),pattern,'\\')));
        }
        return repository.findAll(scope,PageRequest.of(Math.max(0,page),Math.min(100,Math.max(1,size)),Sort.by(Sort.Direction.DESC,"id")))
            .map(ProspectDto::fromEntity);
    }
    public ProspectDto create(ProspectDto dto) {
        Prospect p=new Prospect(); p.setOrganizationId(tenant.getRequiredOrganizationId());
        if("OWNERS".equals(dto.category()) && dto.contactType()==null) p.setContactType("OWNER");
        BaitlyCrmContactValidation.apply(p,dto);
        BaitlyCrmContactValidation.source(p,dto,"MANUAL");
        assertUnique(p);
        return ProspectDto.fromEntity(repository.saveAndFlush(p));
    }
    public ProspectDto update(Long id,ProspectDto dto) {
        Prospect p=require(id);
        if(p.isArchived()) throw new ResponseStatusException(HttpStatus.CONFLICT,"Contact archivé");
        String oldEmail=p.getNormalizedEmail(),oldPhone=p.getNormalizedPhone();
        String oldName=p.getName(),oldCity=p.getCity();
        ProspectCategory oldCategory=p.getCategory();
        // Provenance is historical and cannot be replaced by a partial contact edit.
        BaitlyCrmContactValidation.apply(p,dto);
        if("LEGACY".equals(p.getSourceType()) && dto.sourceType()!=null && !"LEGACY".equals(dto.sourceType()))
            BaitlyCrmContactValidation.source(p,dto,"MANUAL");
        boolean noCoordinates=p.getNormalizedEmail()==null && p.getNormalizedPhone()==null;
        if(!Objects.equals(oldEmail,p.getNormalizedEmail()) || !Objects.equals(oldPhone,p.getNormalizedPhone())
            || (noCoordinates && (!Objects.equals(oldName,p.getName()) || !Objects.equals(oldCity,p.getCity()) || oldCategory!=p.getCategory())))
            assertUnique(p);
        return ProspectDto.fromEntity(repository.saveAndFlush(p));
    }
    /** Archiving preserves refusals and prevents their loss on re-import. */
    public void delete(Long id) { Prospect p=require(id); p.setArchived(true); repository.saveAndFlush(p); }
    /** Baitly CRM : valider toute la sélection avant de retirer une seule fiche. */
    public void deleteMany(Collection<Long> ids) {
        if(ids==null||ids.isEmpty()||ids.size()>10000||ids.stream().anyMatch(id->id==null||id<=0))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Sélection invalide (1 à 10 000 contacts)");
        var unique=new LinkedHashSet<>(ids);
        var selected=repository.findByOrganizationIdAndIdIn(tenant.getRequiredOrganizationId(),unique);
        if(!selected.stream().map(Prospect::getId).collect(java.util.stream.Collectors.toSet()).equals(unique))
            throw new AccessDeniedException("Sélection de contacts inaccessible");
        selected.forEach(contact->contact.setArchived(true));
        repository.saveAllAndFlush(selected);
    }
    @Transactional(readOnly=true)
    public ProspectDto detail(Long id) { return ProspectDto.fromEntity(require(id)); }
    @Transactional(readOnly=true)
    public List<ProspectDto> duplicates(Long id) {
        return matches(require(id)).stream().filter(p -> !p.isArchived() && !p.getId().equals(id))
            .limit(100).map(ProspectDto::fromEntity).toList();
    }
    Prospect require(Long id) {
        return repository.findByIdAndOrganizationId(id,tenant.getRequiredOrganizationId())
            .orElseThrow(() -> new AccessDeniedException("Contact inaccessible"));
    }
    List<Prospect> matches(Prospect p) {
        if(p.getNormalizedEmail()!=null || p.getNormalizedPhone()!=null) {
            var found=new LinkedHashMap<Long,Prospect>();
            repository.findIdentityMatches(p.getOrganizationId(),p.getNormalizedEmail(),p.getNormalizedPhone())
                .forEach(contact -> found.put(contact.getId(),contact));
            var hashes=java.util.stream.Stream.of(p.getNormalizedEmail(),p.getNormalizedPhone())
                .filter(Objects::nonNull).map(BaitlyCrmIdentity::hash).toList();
            repository.findHistoricIdentityMatches(p.getOrganizationId(),hashes)
                .forEach(contact -> found.put(contact.getId(),contact));
            return List.copyOf(found.values());
        }
        // An exact identity without coordinates is flagged, never merged automatically.
        return repository.findWithoutCoordinates(p.getOrganizationId(),p.getName(),Objects.toString(p.getCity(),""),p.getCategory());
    }
    private void assertUnique(Prospect p) {
        if(matches(p).stream().anyMatch(other -> !Objects.equals(other.getId(),p.getId())))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Un contact de cette organisation utilise déjà cette identité (archives comprises)");
    }
}

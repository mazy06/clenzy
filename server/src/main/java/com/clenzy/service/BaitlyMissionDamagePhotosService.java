package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.storage.ObjectStorageTransactions;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.*;
@Service
public class BaitlyMissionDamagePhotosService {
    private final InterventionRepository missions;private final IssueRepository issues;private final IssuePhotoRepository photos;
    private final InterventionAccessPolicy access;private final UserRepository users;private final PhotoStorageService storage;private final TransactionTemplate tx;
    public BaitlyMissionDamagePhotosService(InterventionRepository missions,IssueRepository issues,IssuePhotoRepository photos,InterventionAccessPolicy access,UserRepository users,PhotoStorageService storage,org.springframework.transaction.PlatformTransactionManager manager){
        this.missions=missions;this.issues=issues;this.photos=photos;this.access=access;this.users=users;this.storage=storage;this.tx=new TransactionTemplate(manager);
    }
    private Intervention check(Long id,Long issueId,Jwt jwt,boolean edit){
        var m=missions.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        if(edit) access.requireAssignee(m,jwt);else access.assertCanAccess(m,jwt);
        var issue=issues.findById(issueId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        if(!Objects.equals(issue.getSourceInterventionId(),id)||!Objects.equals(issue.getOrganizationId(),m.getOrganizationId()))throw new org.springframework.security.access.AccessDeniedException("Signalement inaccessible.");
        return m;
    }
    public void upload(Long id,Long issueId,List<MultipartFile> files,Jwt jwt){
        if(files.isEmpty()||files.size()>10||files.stream().anyMatch(f->f.isEmpty()||f.getSize()>8_000_000||!Set.of("image/jpeg","image/png","image/webp").contains(f.getContentType()==null?"":f.getContentType())))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Photos invalides (10 maximum, 8 Mo chacune).");
        tx.execute(s->{check(id,issueId,jwt,true);return null;});
        var keys=new ArrayList<String>();
        try { for(var f:files) keys.add(storage.store(f.getBytes(),f.getContentType(),f.getOriginalFilename())); }
        catch(Exception failure){ObjectStorageTransactions.discard(keys,storage::delete);throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Échec du stockage des photos.",failure);}
        var unused=new ArrayList<String>();
        ObjectStorageTransactions.persistOrDiscard(keys,storage::delete,()->tx.execute(s->{
            var m=check(id,issueId,jwt,true);missions.findForReview(id,m.getOrganizationId()).orElseThrow();
            var existing=photos.findByIssueIdOrderByCreatedAtAsc(issueId);
            var names=new HashSet<String>();existing.forEach(p->names.add(p.getOriginalFilename()));
            long newCount=files.stream().map(MultipartFile::getOriginalFilename).distinct().filter(n->!names.contains(n)).count();
            if(existing.size()+newCount>10)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"10 photos maximum.");
            var actor=users.findByKeycloakId(jwt.getSubject()).orElseThrow();
            for(int n=0;n<files.size();n++){var f=files.get(n);var key=keys.get(n);if(!names.add(f.getOriginalFilename())){if(existing.stream().noneMatch(p->Objects.equals(p.getStorageKey(),key)))unused.add(key);continue;}var p=new IssuePhoto();p.setIssueId(issueId);p.setOrganizationId(m.getOrganizationId());p.setStorageKey(key);p.setContentType(f.getContentType());p.setFileSize(f.getSize());p.setOriginalFilename(f.getOriginalFilename());p.setUploadedById(actor.getId());photos.save(p);}
            return true;
        }));
        ObjectStorageTransactions.discard(unused,storage::delete);
    }
    public List<String> list(Long id,Long issueId,Jwt jwt){
        var records=tx.execute(s->{check(id,issueId,jwt,false);return photos.findByIssueIdOrderByCreatedAtAsc(issueId).stream().map(p->new Photo(p.getStorageKey(),p.getData(),p.getContentType())).toList();});
        return records.stream().map(p->{byte[] bytes=p.key()==null?p.data():storage.retrieve(p.key());return bytes==null?null:"data:"+p.type()+";base64,"+Base64.getEncoder().encodeToString(bytes);}).filter(Objects::nonNull).toList();
    }
    private record Photo(String key,byte[] data,String type){}
}

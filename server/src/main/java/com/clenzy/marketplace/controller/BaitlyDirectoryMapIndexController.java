package com.clenzy.marketplace.controller;
import com.clenzy.marketplace.service.BaitlyDirectoryMapIndex;
import com.clenzy.marketplace.service.BaitlyProfessionalDirectory;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/** Public reference read model, authenticated independently of organization CRM access. */
@RestController
@RequestMapping("/api/professional-directory/map-index")
@PreAuthorize("isAuthenticated()")
public class BaitlyDirectoryMapIndexController {
    private final BaitlyDirectoryMapIndex index;
    private final BaitlyProfessionalDirectory directory;
    public BaitlyDirectoryMapIndexController(BaitlyDirectoryMapIndex index,BaitlyProfessionalDirectory directory){this.index=index;this.directory=directory;}
    public ResponseEntity<byte[]> tile(int z,int x,int y,long revision,String service,String contacts){return tile(z,x,y,revision,service,contacts,"FR");}
    @GetMapping public BaitlyDirectoryMapIndex.State state(){return index.state();}
    @GetMapping("/references/{id}") public Map<String,Object> reference(@PathVariable long id){return directory.mapReference(id);}
    @GetMapping(value="/tiles/{z}/{x}/{y}.mvt",produces="application/vnd.mapbox-vector-tile")
    public ResponseEntity<byte[]> tile(@PathVariable int z,@PathVariable int x,@PathVariable int y,
        @RequestParam long revision,@RequestParam(defaultValue="") String service,@RequestParam(defaultValue="") String contacts,@RequestParam(defaultValue="FR") String country){
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/vnd.mapbox-vector-tile")).body(index.tile(z,x,y,service,contacts,revision,country));
    }
    @ExceptionHandler(IllegalArgumentException.class) @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String,String> invalid(IllegalArgumentException e){return Map.of("message",e.getMessage());}
}

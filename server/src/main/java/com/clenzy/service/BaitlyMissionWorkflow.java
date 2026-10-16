package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/** Server-owned workflow, based on the actual property and recorded evidence. */
@Service
public class BaitlyMissionWorkflow {
    private final PropertyStockItemRepository stocks;
    private final InterventionPhotoRepository photos;
    private final ObjectMapper json;
    private final PropertyInventoryItemRepository inventory;
    public BaitlyMissionWorkflow(PropertyStockItemRepository stocks,InterventionPhotoRepository photos,ObjectMapper json,PropertyInventoryItemRepository inventory){this.stocks=stocks;this.photos=photos;this.json=json;this.inventory=inventory;}
    public List<String> steps(Intervention mission,String mode) {
        if("REMOTE".equals(mode))return List.of("delivery","review");
        String type=Objects.toString(mission.getType(),"").toUpperCase(Locale.ROOT);
        // Every on-site mission ends with the client's signature, or the declared absence of a client.
        if(!type.contains("CLEANING"))return type.contains("MAINTENANCE")||type.contains("TECHNICAL")
            ?List.of("inspection","diagnostic","work","test","after_photos","signature"):List.of("inspection","work","after_photos","signature");
        var result=new ArrayList<>(List.of("inspection","surfaces"));
        var property=mission.getProperty();
        if(property!=null && property.getBathroomCount()!=null && property.getBathroomCount()>0)result.add("sanitary");
        if(property!=null && property.getBedroomCount()!=null && property.getBedroomCount()>0)result.add("linen");
        if(property!=null&&!inventory.findBaitlyMissionInventory(property.getId(),property.getOrganizationId()).isEmpty())result.add("inventory");
        boolean restock=completed(mission.getCompletedSteps()).contains("restock") || property!=null && stocks.findByPropertyIdAndOrganizationIdOrderByNameAsc(property.getId(),property.getOrganizationId()).stream()
            .anyMatch(item->item.getReorderThreshold()>0 && item.getQuantity()<=item.getReorderThreshold());
        if(restock)result.add("restock");
        result.add("after_photos");result.add("signature");return List.copyOf(result);
    }
    public Set<String> completed(String raw) {
        if(raw==null||raw.isBlank())return Set.of();
        try { var values=json.readValue(raw,new TypeReference<List<String>>(){});
            if(values==null||values.size()>500||values.stream().anyMatch(v->v==null||!v.matches("[a-zA-Z_0-9]{1,80}")))throw new IllegalArgumentException();
            return new HashSet<>(values);
        }catch(Exception invalid){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Étapes invalides.");}
    }
    public List<String> validatedRoomIds(Intervention mission,List<BaitlyMobileWorkService.Room> rooms) {
        if(mission.getValidatedRooms()==null)return List.of();
        try {return json.readValue(mission.getValidatedRooms(),new TypeReference<List<Integer>>(){}).stream()
            .filter(i->i!=null&&i>=0&&i<rooms.size()).distinct().map(i->rooms.get(i).id()).toList();}
        catch(Exception invalid){return List.of();}
    }
    public void synchronizeRooms(Intervention mission,String raw,List<BaitlyMobileWorkService.Room> rooms) {
        if(!Objects.toString(mission.getType(),"").toUpperCase(Locale.ROOT).contains("CLEANING"))return;
        var checked=completed(raw);
        var indexes=java.util.stream.IntStream.range(0,rooms.size()).filter(i->checked.contains("surfaces_"+rooms.get(i).id())).boxed().toList();
        try {mission.setValidatedRooms(json.writeValueAsString(indexes));}catch(Exception impossible){throw new IllegalStateException(impossible);}
        int count=indexes.size()+(checked.contains("inspection")?1:0)+(checked.contains("after_photos")?1:0);
        mission.setProgressPercentage((int)Math.round(100.0*count/(rooms.size()+2)));
    }
    public void validate(Intervention mission,String mode,String raw,boolean submitting,List<BaitlyMobileWorkService.Room> rooms) {
        var completed=completed(raw);var required=steps(mission,mode);
        if(submitting && !completed.containsAll(required))bad("Toutes les étapes requises doivent être validées.");
        if(completed.contains("diagnostic") && (mission.getTechnicianNotes()==null || mission.getTechnicianNotes().isBlank()))bad("Le constat du diagnostic est requis.");
        if(completed.contains("signature"))requireSignature(mission);
        if("REMOTE".equals(mode)||!Objects.toString(mission.getType(),"").toUpperCase(Locale.ROOT).contains("CLEANING"))return;
        var evidence=photos.findAllByInterventionId(mission.getId(),mission.getOrganizationId());
        if(completed.contains("inspection") && (rooms.isEmpty() || rooms.stream().anyMatch(room->evidence.stream().noneMatch(photo->photo.getPhase()==InterventionPhoto.PhotoPhase.BEFORE
            && photo.getOriginalFilename()!=null && photo.getOriginalFilename().startsWith("baitly-"+mission.getId()+"-step-inspection_"+room.id()+"-")))))bad("Une photo avant par pièce est requise.");
        if(completed.contains("surfaces") && rooms.stream().anyMatch(room->!completed.contains("surfaces_"+room.id())))bad("Chaque pièce doit être validée.");
        if(completed.contains("inventory") && mission.getProperty()!=null && inventory.findBaitlyMissionInventory(mission.getProperty().getId(),mission.getProperty().getOrganizationId()).stream().anyMatch(item->!completed.contains("inventory_"+item.getId())))bad("Chaque article d’inventaire doit être contrôlé.");
        if(completed.contains("after_photos") && evidence.stream().noneMatch(photo->photo.getPhase()==InterventionPhoto.PhotoPhase.AFTER))bad("Une photo après est requise.");
    }
    /** A signed acknowledgement needs its stored image; a declared absence needs nothing more. */
    private void requireSignature(Intervention mission) {
        String status=mission.getBaitlySignatureStatus();
        if(status==null)bad("La signature du client ou son absence doit être enregistrée.");
        if("SIGNED".equals(status) && photos.findAllByInterventionId(mission.getId(),mission.getOrganizationId()).stream()
            .noneMatch(photo->photo.getOriginalFilename()!=null && photo.getOriginalFilename().startsWith("baitly-"+mission.getId()+"-step-signature-")))
            bad("L’image de la signature est introuvable.");
    }
    private static void bad(String message){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
}

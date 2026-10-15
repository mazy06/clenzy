package com.clenzy.service;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.repository.InterventionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class InterventionProgressService {

    private static final Logger log = LoggerFactory.getLogger(InterventionProgressService.class);

    private final InterventionRepository interventionRepository;
    private final InterventionMapper interventionMapper;
    private final InterventionAccessPolicy accessPolicy;
    private final InterventionLifecycleService lifecycleService;
    private final ObjectMapper objectMapper;
    private final com.clenzy.repository.InterventionPhotoRepository inspectionPhotos;

    public InterventionProgressService(InterventionRepository interventionRepository,
                                       InterventionMapper interventionMapper,
                                       InterventionAccessPolicy accessPolicy,
                                       InterventionLifecycleService lifecycleService,
                                       ObjectMapper objectMapper, com.clenzy.repository.InterventionPhotoRepository inspectionPhotos) {
        this.interventionRepository = interventionRepository;
        this.interventionMapper = interventionMapper;
        this.accessPolicy = accessPolicy;
        this.lifecycleService = lifecycleService;
        this.objectMapper = objectMapper;
        this.inspectionPhotos = inspectionPhotos;
    }

    /**
     * Mettre a jour la progression d'une intervention.
     * Accessible aux TECHNICIAN, HOUSEKEEPER et SUPERVISOR pour leurs interventions assignees.
     *
     * La completion est UNIQUEMENT declenchee par l'appel explicite a completeIntervention()
     * (bouton "Terminer" dans le recap). Pas d'auto-completion sur progress=100%
     * pour eviter les race conditions lors des re-hydratations React.
     */
    public InterventionResponse updateProgress(Long id, Integer progressPercentage, Jwt jwt) {
        if (progressPercentage < 0 || progressPercentage > 100) {
            throw new IllegalArgumentException("La progression doit etre entre 0 et 100");
        }

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);
        if(intervention.getBaitlyPausedAt()!=null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Intervention en pause.");

        intervention.setProgressPercentage(progressPercentage);
        intervention = interventionRepository.save(intervention);
        log.debug("Progress updated: id={}, progress={}%", intervention.getId(), progressPercentage);

        return interventionMapper.convertToResponse(intervention);
    }

    public InterventionResponse updateNotes(Long id, String notes, Jwt jwt) {
        if (notes != null && notes.length() > 10_000) {
            throw new IllegalArgumentException("Notes trop longues (max 10 000 caracteres)");
        }

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);
        if(intervention.getBaitlyPausedAt()!=null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Intervention en pause.");

        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent etre commentees");
        }

        intervention.setNotes(notes);
        intervention = interventionRepository.save(intervention);

        log.debug("Notes updated for intervention: {}", intervention.getId());

        return interventionMapper.convertToResponse(intervention);
    }

    public InterventionResponse updateValidatedRooms(Long id, String validatedRooms, Jwt jwt) {
        if (validatedRooms != null && validatedRooms.length() > 10_000) {
            throw new IllegalArgumentException("Donnees validatedRooms trop longues (max 10 000 caracteres)");
        }

        // Validate JSON format before opening DB transaction work
        try {
            objectMapper.readTree(validatedRooms);
        } catch (Exception e) {
            throw new IllegalArgumentException("Format JSON invalide pour validatedRooms");
        }

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);
        if(intervention.getBaitlyPausedAt()!=null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Intervention en pause.");

        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent avoir leurs pieces validees");
        }

        intervention.setValidatedRooms(validatedRooms);
        intervention = interventionRepository.save(intervention);

        log.debug("Validated rooms updated for intervention: {}", intervention.getId());

        return interventionMapper.convertToResponse(intervention);
    }

    public InterventionResponse updateCompletedSteps(Long id, String completedSteps, Jwt jwt) {
        if (completedSteps != null && completedSteps.length() > 10_000) {
            throw new IllegalArgumentException("Donnees completedSteps trop longues (max 10 000 caracteres)");
        }

        // Validate JSON format before opening DB transaction work
        try {
            objectMapper.readTree(completedSteps);
        } catch (Exception e) {
            throw new IllegalArgumentException("Format JSON invalide pour completedSteps");
        }

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);
        if(intervention.getBaitlyPausedAt()!=null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Intervention en pause.");

        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent avoir leurs etapes completees mises a jour");
        }

        if(intervention.getType()!=null && intervention.getType().toUpperCase(java.util.Locale.ROOT).contains("CLEANING")
            && completedSteps!=null && completedSteps.contains("\"inspection\"")) {
            var property=intervention.getProperty();
            if(property==null) throw new IllegalArgumentException("Les pièces du logement doivent être renseignées.");
            var requiredRooms=new java.util.ArrayList<String>();
            for(int n=1;n<=(property.getBedroomCount()==null?0:property.getBedroomCount());n++) requiredRooms.add("bedroom_"+n);
            for(int n=1;n<=(property.getBathroomCount()==null?0:property.getBathroomCount());n++) requiredRooms.add("bathroom_"+n);
            requiredRooms.add("living_1"); requiredRooms.add("kitchen_1");
            var photos=inspectionPhotos.findByInterventionIdAndPhaseOrderByCreatedAtAsc(id,com.clenzy.model.InterventionPhoto.PhotoPhase.BEFORE,intervention.getOrganizationId());
            if(!requiredRooms.stream().allMatch(room -> photos.stream().anyMatch(photo -> photo.getOriginalFilename()!=null
                && photo.getOriginalFilename().startsWith("baitly-"+id+"-step-inspection_"+room+"-"))))
                throw new IllegalArgumentException("Une photo avant par pièce est requise pour valider l’inspection.");
        }
        intervention.setCompletedSteps(completedSteps);
        intervention = interventionRepository.save(intervention);

        log.debug("Completed steps updated for intervention: {}", intervention.getId());

        return interventionMapper.convertToResponse(intervention);
    }
}

package com.clenzy.service;

import com.clenzy.dto.InterventionDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@Transactional
public class InterventionService {
    private final InterventionRepository interventionRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;

    public InterventionService(InterventionRepository interventionRepository,
                               ServiceRequestRepository serviceRequestRepository,
                               PropertyRepository propertyRepository,
                               UserRepository userRepository) {
        this.interventionRepository = interventionRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
    }

    public InterventionDto create(InterventionDto dto) {
        Intervention entity = new Intervention();
        apply(dto, entity);
        entity = interventionRepository.save(entity);
        return toDto(entity);
    }

    public InterventionDto update(Long id, InterventionDto dto) {
        Intervention entity = interventionRepository.findById(id).orElseThrow(() -> new NotFoundException("Intervention not found"));
        apply(dto, entity);
        entity = interventionRepository.save(entity);
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public InterventionDto getById(Long id) {
        return toDto(interventionRepository.findById(id).orElseThrow(() -> new NotFoundException("Intervention not found")));
    }

    @Transactional(readOnly = true)
    public List<InterventionDto> list() {
        return interventionRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<InterventionDto> list(Pageable pageable) {
        return interventionRepository.findAll(pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public Page<InterventionDto> search(Pageable pageable, Long propertyId, Long technicianId, com.clenzy.model.InterventionStatus status, com.clenzy.model.InterventionType type) {
        return interventionRepository.findAll((root, query, cb) -> cb.and(
                propertyId != null ? cb.equal(root.get("property").get("id"), propertyId) : cb.conjunction(),
                technicianId != null ? cb.equal(root.get("assignedTechnician").get("id"), technicianId) : cb.conjunction(),
                status != null ? cb.equal(root.get("status"), status) : cb.conjunction(),
                type != null ? cb.equal(root.get("type"), type) : cb.conjunction()
        ), pageable).map(this::toDto);
    }

    public void delete(Long id) {
        if (!interventionRepository.existsById(id)) throw new NotFoundException("Intervention not found");
        interventionRepository.deleteById(id);
    }

    private void apply(InterventionDto dto, Intervention e) {
        e.setStartTime(dto.startTime);
        e.setEndTime(dto.endTime);
        e.setEstimatedDurationHours(dto.estimatedDurationHours);
        e.setActualDurationHours(dto.actualDurationHours);
        if (dto.status != null) e.setStatus(dto.status);
        if (dto.type != null) e.setType(dto.type);
        e.setNotes(dto.notes);
        e.setTechnicianNotes(dto.technicianNotes);
        e.setCustomerFeedback(dto.customerFeedback);
        e.setCustomerRating(dto.customerRating);
        e.setEstimatedCost(dto.estimatedCost);
        e.setActualCost(dto.actualCost);
        e.setMaterialsUsed(dto.materialsUsed);
        e.setBeforePhotosUrls(dto.beforePhotosUrls);
        e.setAfterPhotosUrls(dto.afterPhotosUrls);
        e.setUrgent(dto.urgent);
        e.setRequiresFollowUp(dto.requiresFollowUp);
        e.setFollowUpNotes(dto.followUpNotes);
        if (dto.serviceRequestId != null) {
            ServiceRequest sr = serviceRequestRepository.findById(dto.serviceRequestId).orElseThrow(() -> new NotFoundException("Service request not found"));
            e.setServiceRequest(sr);
        }
        if (dto.propertyId != null) {
            Property property = propertyRepository.findById(dto.propertyId).orElseThrow(() -> new NotFoundException("Property not found"));
            e.setProperty(property);
        }
        if (dto.assignedTechnicianId != null) {
            User tech = userRepository.findById(dto.assignedTechnicianId).orElseThrow(() -> new NotFoundException("Technician not found"));
            e.setAssignedTechnician(tech);
        }
        // team optional, repository not present; leaving unset unless added later
    }

    private InterventionDto toDto(Intervention e) {
        InterventionDto dto = new InterventionDto();
        dto.id = e.getId();
        dto.startTime = e.getStartTime();
        dto.endTime = e.getEndTime();
        dto.estimatedDurationHours = e.getEstimatedDurationHours();
        dto.actualDurationHours = e.getActualDurationHours();
        dto.status = e.getStatus();
        dto.type = e.getType();
        dto.notes = e.getNotes();
        dto.technicianNotes = e.getTechnicianNotes();
        dto.customerFeedback = e.getCustomerFeedback();
        dto.customerRating = e.getCustomerRating();
        dto.estimatedCost = e.getEstimatedCost();
        dto.actualCost = e.getActualCost();
        dto.materialsUsed = e.getMaterialsUsed();
        dto.beforePhotosUrls = e.getBeforePhotosUrls();
        dto.afterPhotosUrls = e.getAfterPhotosUrls();
        dto.urgent = e.isUrgent();
        dto.requiresFollowUp = e.isRequiresFollowUp();
        dto.followUpNotes = e.getFollowUpNotes();
        dto.serviceRequestId = e.getServiceRequest() != null ? e.getServiceRequest().getId() : null;
        dto.propertyId = e.getProperty() != null ? e.getProperty().getId() : null;
        dto.assignedTechnicianId = e.getAssignedTechnician() != null ? e.getAssignedTechnician().getId() : null;
        dto.teamId = e.getTeam() != null ? e.getTeam().getId() : null;
        dto.createdAt = e.getCreatedAt();
        dto.updatedAt = e.getUpdatedAt();
        return dto;
    }
}



package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.User;
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
public class ServiceRequestService {
    private final ServiceRequestRepository serviceRequestRepository;
    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;

    public ServiceRequestService(ServiceRequestRepository serviceRequestRepository, UserRepository userRepository, PropertyRepository propertyRepository) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
    }

    public ServiceRequestDto create(ServiceRequestDto dto) {
        ServiceRequest entity = new ServiceRequest();
        apply(dto, entity);
        entity = serviceRequestRepository.save(entity);
        return toDto(entity);
    }

    public ServiceRequestDto update(Long id, ServiceRequestDto dto) {
        ServiceRequest entity = serviceRequestRepository.findById(id).orElseThrow(() -> new NotFoundException("Service request not found"));
        apply(dto, entity);
        entity = serviceRequestRepository.save(entity);
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public ServiceRequestDto getById(Long id) {
        return toDto(serviceRequestRepository.findById(id).orElseThrow(() -> new NotFoundException("Service request not found")));
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestDto> list() {
        return serviceRequestRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> list(Pageable pageable) {
        return serviceRequestRepository.findAll(pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public Page<ServiceRequestDto> search(Pageable pageable, Long userId, Long propertyId, com.clenzy.model.RequestStatus status, com.clenzy.model.ServiceType serviceType) {
        return serviceRequestRepository.findAll((root, query, cb) -> cb.and(
                userId != null ? cb.equal(root.get("user").get("id"), userId) : cb.conjunction(),
                propertyId != null ? cb.equal(root.get("property").get("id"), propertyId) : cb.conjunction(),
                status != null ? cb.equal(root.get("status"), status) : cb.conjunction(),
                serviceType != null ? cb.equal(root.get("serviceType"), serviceType) : cb.conjunction()
        ), pageable).map(this::toDto);
    }

    public void delete(Long id) {
        if (!serviceRequestRepository.existsById(id)) throw new NotFoundException("Service request not found");
        serviceRequestRepository.deleteById(id);
    }

    private void apply(ServiceRequestDto dto, ServiceRequest e) {
        if (dto.title != null) e.setTitle(dto.title);
        e.setDescription(dto.description);
        if (dto.serviceType != null) e.setServiceType(dto.serviceType);
        if (dto.priority != null) e.setPriority(dto.priority);
        if (dto.status != null) e.setStatus(dto.status);
        e.setDesiredDate(dto.desiredDate);
        e.setPreferredTimeSlot(dto.preferredTimeSlot);
        e.setEstimatedDurationHours(dto.estimatedDurationHours);
        e.setEstimatedCost(dto.estimatedCost);
        e.setActualCost(dto.actualCost);
        e.setSpecialInstructions(dto.specialInstructions);
        e.setAccessNotes(dto.accessNotes);
        e.setGuestCheckoutTime(dto.guestCheckoutTime);
        e.setGuestCheckinTime(dto.guestCheckinTime);
        e.setUrgent(dto.urgent);
        e.setRequiresApproval(dto.requiresApproval);
        e.setApprovedBy(dto.approvedBy);
        e.setApprovedAt(dto.approvedAt);
        if (dto.userId != null) {
            User user = userRepository.findById(dto.userId).orElseThrow(() -> new NotFoundException("User not found"));
            e.setUser(user);
        }
        if (dto.propertyId != null) {
            Property property = propertyRepository.findById(dto.propertyId).orElseThrow(() -> new NotFoundException("Property not found"));
            e.setProperty(property);
        }
    }

    private ServiceRequestDto toDto(ServiceRequest e) {
        ServiceRequestDto dto = new ServiceRequestDto();
        dto.id = e.getId();
        dto.title = e.getTitle();
        dto.description = e.getDescription();
        dto.serviceType = e.getServiceType();
        dto.priority = e.getPriority();
        dto.status = e.getStatus();
        dto.desiredDate = e.getDesiredDate();
        dto.preferredTimeSlot = e.getPreferredTimeSlot();
        dto.estimatedDurationHours = e.getEstimatedDurationHours();
        dto.estimatedCost = e.getEstimatedCost();
        dto.actualCost = e.getActualCost();
        dto.specialInstructions = e.getSpecialInstructions();
        dto.accessNotes = e.getAccessNotes();
        dto.guestCheckoutTime = e.getGuestCheckoutTime();
        dto.guestCheckinTime = e.getGuestCheckinTime();
        dto.urgent = e.isUrgent();
        dto.requiresApproval = e.isRequiresApproval();
        dto.approvedBy = e.getApprovedBy();
        dto.approvedAt = e.getApprovedAt();
        dto.userId = e.getUser() != null ? e.getUser().getId() : null;
        dto.propertyId = e.getProperty() != null ? e.getProperty().getId() : null;
        dto.createdAt = e.getCreatedAt();
        dto.updatedAt = e.getUpdatedAt();
        return dto;
    }
}



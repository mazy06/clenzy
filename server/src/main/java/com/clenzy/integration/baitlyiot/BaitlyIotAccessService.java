package com.clenzy.integration.baitlyiot;

import com.clenzy.model.NoiseDevice;
import com.clenzy.model.Property;
import com.clenzy.repository.NoiseDeviceRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BaitlyIotAccessService {
    private final PropertyRepository properties;
    private final NoiseDeviceRepository devices;
    private final OrganizationAccessGuard organizations;

    public BaitlyIotAccessService(PropertyRepository properties, NoiseDeviceRepository devices,
                                 OrganizationAccessGuard organizations) {
        this.properties = properties;
        this.devices = devices;
        this.organizations = organizations;
    }

    @Transactional(readOnly = true)
    public Property property(long id, String requester) {
        Property property = properties.findByIdWithOwnerNoOrgFilter(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        organizations.requireSameOrganization(property.getOrganizationId(), "Logement hors de votre organisation");
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean administrator = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN")
                        || authority.getAuthority().equals("ROLE_SUPER_ADMIN"));
        if (!administrator && (property.getOwner() == null || !requester.equals(property.getOwner().getKeycloakId()))) {
            throw new AccessDeniedException("Ce logement ne vous appartient pas");
        }
        return property;
    }

    @Transactional(readOnly = true)
    public NoiseDevice device(long id, String requester) {
        NoiseDevice device = devices.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        organizations.requireSameOrganization(device.getOrganizationId(), "Capteur hors de votre organisation");
        if (device.getDeviceType() != NoiseDevice.DeviceType.BAITLY) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        property(device.getPropertyId(), requester);
        return device;
    }
}

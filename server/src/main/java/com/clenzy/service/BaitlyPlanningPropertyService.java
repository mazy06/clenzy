package com.clenzy.service;

import com.clenzy.dto.BaitlyPlanningPropertyRow;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class BaitlyPlanningPropertyService {
    private final PropertyRepository properties;
    private final PropertyPhotoRepository photos;
    private final TenantContext tenant;
    public BaitlyPlanningPropertyService(PropertyRepository properties, PropertyPhotoRepository photos, TenantContext tenant) {
        this.properties = properties;
        this.photos = photos;
        this.tenant = tenant;
    }

    public Page<BaitlyPlanningPropertyRow> page(String ownerKeycloakId, int page, int size) {
        Long orgId = tenant.getRequiredOrganizationId();
        var rows = properties.findBaitlyPlanningProperties(orgId, ownerKeycloakId, PageRequest.of(page, size));
        List<Long> ids = rows.stream().map(PropertyRepository.BaitlyPlanningProperty::getId).toList();
        Map<Long, List<String>> urls = new HashMap<>();
        if (!ids.isEmpty()) {
            for (var photo : photos.findBaitlyPlanningPhotos(ids, orgId)) {
                String url = photo.getExternalUrl();
                if (url == null || url.isBlank()) {
                    url = "/api/properties/" + photo.getPropertyId() + "/photos/" + photo.getId() + "/data";
                }
                urls.computeIfAbsent(photo.getPropertyId(), ignored -> new ArrayList<>()).add(url);
            }
        }
        return rows.map(p -> new BaitlyPlanningPropertyRow(p.getId(), p.getName(), p.getAddress(), p.getCity(),
                ((p.getOwnerFirstName() == null ? "" : p.getOwnerFirstName()) + " "
                    + (p.getOwnerLastName() == null ? "" : p.getOwnerLastName())).trim(),
                p.getMaxGuests(), p.getType(), p.getNightlyPrice(), p.getMinimumNights(),
                p.getDefaultCheckInTime(), p.getDefaultCheckOutTime(), p.getCleaningFrequency(), p.getCleaningBasePrice(),
                p.getCurrency(), p.getLatitude(), p.getLongitude(), urls.getOrDefault(p.getId(), List.of())));
    }
}

package com.clenzy.marketplace.sectors;

import com.clenzy.service.IndividualCoverageService;
import org.springframework.stereotype.Service;

import java.util.List;

/** Le secteur que l'intervenant a déclaré, dessiné pour qu'il vérifie sa zone. */
@Service
public class MySectorMapService {

    private final IndividualCoverageService coverage;
    private final SectorShapes shapes;

    public MySectorMapService(IndividualCoverageService coverage, SectorShapes shapes) {
        this.coverage = coverage;
        this.shapes = shapes;
    }

    public SectorMapDto mine(String subject) {
        var declared = coverage.getMine(subject).stream()
                .map(z -> new SectorShapes.DeclaredZone(z.country(), z.department(), z.arrondissement(), z.city()))
                .toList();
        return shapes.map(List.of(shapes.provider(null, null, declared)), List.of());
    }
}

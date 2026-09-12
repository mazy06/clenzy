package com.clenzy.repository;

import com.clenzy.model.SmartLockAccessCodeEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Journal d'audit des codes d'acces de serrures (isolation via organizationFilter). */
@Repository
public interface SmartLockAccessCodeEventRepository extends JpaRepository<SmartLockAccessCodeEvent, Long> {

    List<SmartLockAccessCodeEvent> findByPropertyIdOrderByCreatedAtDesc(Long propertyId);

    List<SmartLockAccessCodeEvent> findByCodeIdOrderByCreatedAtDesc(Long codeId);

    /**
     * Journal d'une serrure, du plus recent au plus ancien. Inclut les echecs de
     * generation, qui n'ont pas de code rattache — c'est precisement pour eux
     * que la lecture se fait par serrure et non par code.
     */
    List<SmartLockAccessCodeEvent> findByDeviceIdOrderByCreatedAtDesc(Long deviceId);
}

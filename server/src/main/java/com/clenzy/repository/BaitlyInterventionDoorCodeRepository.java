package com.clenzy.repository;
import com.clenzy.model.BaitlyInterventionDoorCode;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
public interface BaitlyInterventionDoorCodeRepository extends JpaRepository<BaitlyInterventionDoorCode,Long>{
    @Query(value="SELECT * FROM baitly_intervention_door_codes WHERE intervention_id=:mission AND device_id=:device AND organization_id=:org AND property_id=:property",nativeQuery=true)
    Optional<BaitlyInterventionDoorCode> findBound(@Param("mission")Long mission,@Param("device")Long device,@Param("org")Long org,@Param("property")Long property);
}

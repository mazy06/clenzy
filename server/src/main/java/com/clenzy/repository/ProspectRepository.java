package com.clenzy.repository;

import com.clenzy.model.Prospect;
import com.clenzy.model.Prospect.ProspectCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProspectRepository extends JpaRepository<Prospect, Long>, JpaSpecificationExecutor<Prospect> {

    List<Prospect> findByOrganizationId(Long organizationId);

    List<Prospect> findByOrganizationIdAndCategory(Long organizationId, ProspectCategory category);

    java.util.Optional<Prospect> findByIdAndOrganizationId(Long id,Long organizationId);
    List<Prospect> findByOrganizationIdAndIdIn(Long organizationId,java.util.Collection<Long> ids);
    @org.springframework.data.jpa.repository.Query("""
        select p from Prospect p where p.organizationId=:org and
        ((:email is not null and p.normalizedEmail=:email) or
         (:phone is not null and p.normalizedPhone=:phone)) order by p.id
        """)
    List<Prospect> findIdentityMatches(@org.springframework.data.repository.query.Param("org") Long org,
        @org.springframework.data.repository.query.Param("email") String email,
        @org.springframework.data.repository.query.Param("phone") String phone);
    @org.springframework.data.jpa.repository.Query("""
        select distinct p from Prospect p, BaitlyCrmContactAuthorization a
        where p.organizationId=:org and a.organizationId=:org and a.prospectId=p.id
          and a.destinationHash in :hashes
        """)
    List<Prospect> findHistoricIdentityMatches(@org.springframework.data.repository.query.Param("org") Long org,
        @org.springframework.data.repository.query.Param("hashes") java.util.Collection<String> hashes);
    @org.springframework.data.jpa.repository.Query("""
        select p from Prospect p where p.organizationId=:org and p.normalizedEmail is null and p.normalizedPhone is null
        and lower(p.name)=lower(:name) and lower(coalesce(p.city,''))=lower(:city) and p.category=:category
        """)
    List<Prospect> findWithoutCoordinates(@org.springframework.data.repository.query.Param("org") Long org,
        @org.springframework.data.repository.query.Param("name") String name,
        @org.springframework.data.repository.query.Param("city") String city,
        @org.springframework.data.repository.query.Param("category") ProspectCategory category);

    long countByOrganizationId(Long organizationId);
}

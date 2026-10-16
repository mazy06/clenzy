package com.clenzy.model;
import jakarta.persistence.*;
import com.clenzy.config.EncryptedFieldConverter;
import java.time.LocalDateTime;
@Entity @Table(name="baitly_intervention_door_codes")
@org.hibernate.annotations.Filter(name="organizationFilter",condition="organization_id = :orgId")
public class BaitlyInterventionDoorCode {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="intervention_id",nullable=false) private Long interventionId;
    @Column(name="property_id",nullable=false) private Long propertyId;
    @Column(name="device_id",nullable=false) private Long deviceId;
    @Convert(converter=EncryptedFieldConverter.class) @Column(name="code",columnDefinition="TEXT") private String code;
    @Column(name="external_code_id") private String externalCodeId;
    @Column(name="valid_from",nullable=false) private LocalDateTime validFrom;
    @Column(name="valid_until",nullable=false) private LocalDateTime validUntil;
    @Column(name="status",nullable=false,length=20) private String status;
    @Column(name="created_by",nullable=false) private String createdBy;
    @Column(name="created_at",nullable=false) private LocalDateTime createdAt;
    public BaitlyInterventionDoorCode(){}
    public BaitlyInterventionDoorCode(Long org,Long mission,Long property,Long device,LocalDateTime from,LocalDateTime until,String actor,LocalDateTime created){organizationId=org;interventionId=mission;propertyId=property;deviceId=device;validFrom=from;validUntil=until;createdBy=actor;createdAt=created;status="PENDING";}
    public Long getId(){return id;} public Long getDeviceId(){return deviceId;} public String getCode(){return code;} public String getStatus(){return status;}
    public LocalDateTime getValidFrom(){return validFrom;}public LocalDateTime getValidUntil(){return validUntil;}
    public void activate(String pin,String external){code=pin;externalCodeId=external;status="ACTIVE";}
    public void fail(){code=null;status="FAILED";}
}

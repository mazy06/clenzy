package com.clenzy.integration.channelmanager.repository;

import com.clenzy.integration.channelmanager.model.ChannelManagerConnection;
import com.clenzy.integration.channelmanager.model.ChannelManagerProviderType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ChannelManagerConnectionRepository extends JpaRepository<ChannelManagerConnection, Long> {

    Optional<ChannelManagerConnection> findByOrganizationIdAndProviderType(Long organizationId,
                                                                            ChannelManagerProviderType providerType);
}

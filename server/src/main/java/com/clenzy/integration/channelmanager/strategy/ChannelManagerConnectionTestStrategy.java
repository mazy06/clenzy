package com.clenzy.integration.channelmanager.strategy;

import com.clenzy.integration.channelmanager.model.ChannelManagerProviderType;

/** Contrat de test de connexion pour un Channel Manager. */
public interface ChannelManagerConnectionTestStrategy {

    ChannelManagerProviderType providerType();

    boolean testConnection(String serverUrl, String accountIdentifier, String apiKey);
}

package com.clenzy.dto;

import java.util.List;

public class ManagerAssociationsDto {
    private List<ClientAssociationDto> clients;
    private List<PropertyAssociationDto> properties;
    private List<TeamAssociationDto> teams;
    private List<UserAssociationDto> users;
    private Long totalCount;

    // Constructors
    public ManagerAssociationsDto() {}

    public ManagerAssociationsDto(List<ClientAssociationDto> clients, 
                                 List<PropertyAssociationDto> properties,
                                 List<TeamAssociationDto> teams, 
                                 List<UserAssociationDto> users) {
        this.clients = clients;
        this.properties = properties;
        this.teams = teams;
        this.users = users;
        this.totalCount = (long) (clients.size() + properties.size() + teams.size() + users.size());
    }

    // Getters and Setters
    public List<ClientAssociationDto> getClients() {
        return clients;
    }

    public void setClients(List<ClientAssociationDto> clients) {
        this.clients = clients;
    }

    public List<PropertyAssociationDto> getProperties() {
        return properties;
    }

    public void setProperties(List<PropertyAssociationDto> properties) {
        this.properties = properties;
    }

    public List<TeamAssociationDto> getTeams() {
        return teams;
    }

    public void setTeams(List<TeamAssociationDto> teams) {
        this.teams = teams;
    }

    public List<UserAssociationDto> getUsers() {
        return users;
    }

    public void setUsers(List<UserAssociationDto> users) {
        this.users = users;
    }

    public Long getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(Long totalCount) {
        this.totalCount = totalCount;
    }
}

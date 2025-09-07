package com.clenzy.dto;

import java.util.List;

public class TeamUserAssignmentRequest {
    private Long managerId;
    private List<Long> teamIds;
    private List<Long> userIds;

    // Constructeurs
    public TeamUserAssignmentRequest() {}

    public TeamUserAssignmentRequest(Long managerId, List<Long> teamIds, List<Long> userIds) {
        this.managerId = managerId;
        this.teamIds = teamIds;
        this.userIds = userIds;
    }

    // Getters et Setters
    public Long getManagerId() {
        return managerId;
    }

    public void setManagerId(Long managerId) {
        this.managerId = managerId;
    }

    public List<Long> getTeamIds() {
        return teamIds;
    }

    public void setTeamIds(List<Long> teamIds) {
        this.teamIds = teamIds;
    }

    public List<Long> getUserIds() {
        return userIds;
    }

    public void setUserIds(List<Long> userIds) {
        this.userIds = userIds;
    }
}

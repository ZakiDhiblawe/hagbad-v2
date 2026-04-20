package com.hagbad.springbootbackend.joinrequest;

import java.time.OffsetDateTime;

public record JoinRequestResponse(
    Integer id,
    Integer groupId,
    Integer userId,
    String fullName,
    String profileImage,
    JoinRequestStatus status,
    OffsetDateTime requestedAt,
    Integer handledBy
) {

    public static JoinRequestResponse from(
        JoinRequestEntity entity,
        String fullName,
        String profileImage
    ) {
        return new JoinRequestResponse(
            entity.getId(),
            entity.getGroupId(),
            entity.getUserId(),
            fullName,
            profileImage,
            entity.getStatus(),
            entity.getRequestedAt(),
            entity.getHandledBy()
        );
    }
}

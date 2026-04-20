package com.hagbad.springbootbackend.invite;

import java.time.OffsetDateTime;

public record InviteResponse(
    Integer id,
    Integer groupId,
    String code,
    Integer createdBy,
    OffsetDateTime expiresAt,
    boolean used,
    OffsetDateTime createdAt
) {

    public static InviteResponse from(InviteEntity entity) {
        return new InviteResponse(
            entity.getId(),
            entity.getGroupId(),
            entity.getCode(),
            entity.getCreatedBy(),
            entity.getExpiresAt(),
            entity.isUsed(),
            entity.getCreatedAt()
        );
    }
}

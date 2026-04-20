package com.hagbad.springbootbackend.group;

import java.time.OffsetDateTime;

public record GroupResponse(
    Integer id,
    String name,
    String description,
    boolean visible,
    String groupImage,
    String coverImage,
    String privacy,
    Integer createdBy,
    String status,
    OffsetDateTime createdAt
) {

    public static GroupResponse from(GroupEntity group) {
        return new GroupResponse(
            group.getId(),
            group.getName(),
            group.getDescription(),
            group.isVisible(),
            group.getGroupImage(),
            group.getCoverImage(),
            group.getPrivacy().value(),
            group.getCreatedBy(),
            group.getStatus().name(),
            group.getCreatedAt()
        );
    }
}

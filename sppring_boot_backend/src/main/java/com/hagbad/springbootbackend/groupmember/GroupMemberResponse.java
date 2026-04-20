package com.hagbad.springbootbackend.groupmember;

import java.time.OffsetDateTime;

public record GroupMemberResponse(
    Integer id,
    Integer groupId,
    Integer userId,
    String role,
    OffsetDateTime joinedAt,
    String fullName,
    String profileImage
) {

    public static GroupMemberResponse from(GroupMemberEntity member) {
        return new GroupMemberResponse(
            member.getId(),
            member.getGroupId(),
            member.getUserId(),
            member.getRole().name(),
            member.getJoinedAt(),
            member.getFullName(),
            member.getProfileImage()
        );
    }
}

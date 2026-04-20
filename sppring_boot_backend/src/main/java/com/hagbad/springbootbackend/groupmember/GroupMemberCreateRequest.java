package com.hagbad.springbootbackend.groupmember;

public record GroupMemberCreateRequest(
    Integer groupId,
    Integer userId,
    String role
) {
}

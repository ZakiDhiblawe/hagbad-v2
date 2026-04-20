package com.hagbad.springbootbackend.cyclemember;

public record CycleMemberCreateRequest(
    Integer cycleId,
    Integer userId,
    Integer payoutOrder
) {
}

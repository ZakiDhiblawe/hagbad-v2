package com.hagbad.springbootbackend.cyclemember;

public record CycleMemberFillRequest(
    Integer cycleId,
    String orderMode
) {
}

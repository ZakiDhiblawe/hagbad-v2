package com.hagbad.springbootbackend.cyclemember;

public record CycleMemberUpdateRequest(
    Integer payoutOrder,
    Boolean received
) {
}

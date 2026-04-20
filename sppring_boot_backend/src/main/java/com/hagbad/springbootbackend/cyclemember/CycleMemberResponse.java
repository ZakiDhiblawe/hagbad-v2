package com.hagbad.springbootbackend.cyclemember;

import java.time.OffsetDateTime;

public record CycleMemberResponse(
    Integer id,
    Integer cycleId,
    Integer userId,
    Integer payoutOrder,
    boolean received,
    OffsetDateTime createdAt
) {

    public static CycleMemberResponse from(CycleMemberEntity entity) {
        return new CycleMemberResponse(
            entity.getId(),
            entity.getCycleId(),
            entity.getUserId(),
            entity.getPayoutOrder(),
            entity.isReceived(),
            entity.getCreatedAt()
        );
    }
}

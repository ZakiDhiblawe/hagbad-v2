package com.hagbad.springbootbackend.invite;

import com.hagbad.springbootbackend.groupmember.GroupMemberResponse;
import com.hagbad.springbootbackend.security.CurrentUser;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/invites")
public class InviteController {

    private final InviteService inviteService;

    public InviteController(InviteService inviteService) {
        this.inviteService = inviteService;
    }

    @PostMapping("/")
    @ResponseStatus(HttpStatus.CREATED)
    public InviteResponse create(
        @RequestBody InviteCreateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return inviteService.create(request, currentUser);
    }

    @GetMapping("/{groupId}")
    public List<InviteResponse> list(
        @PathVariable Integer groupId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return inviteService.list(groupId, currentUser);
    }

    @PostMapping("/redeem")
    public GroupMemberResponse redeem(
        @RequestBody InviteRedeemRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return inviteService.redeem(request, currentUser);
    }

    @DeleteMapping("/{inviteId}")
    public ResponseEntity<Void> delete(
        @PathVariable Integer inviteId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        inviteService.delete(inviteId, currentUser);
        return ResponseEntity.noContent().build();
    }
}

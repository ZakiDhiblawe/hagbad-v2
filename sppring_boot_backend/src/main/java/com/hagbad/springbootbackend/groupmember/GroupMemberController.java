package com.hagbad.springbootbackend.groupmember;

import com.hagbad.springbootbackend.security.CurrentUser;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/group-members")
@Validated
public class GroupMemberController {

    private final GroupMemberService groupMemberService;

    public GroupMemberController(GroupMemberService groupMemberService) {
        this.groupMemberService = groupMemberService;
    }

    @PostMapping("/")
    public ResponseEntity<GroupMemberResponse> addMember(
        @RequestBody GroupMemberCreateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return ResponseEntity.status(201).body(groupMemberService.addMember(request, currentUser));
    }

    @GetMapping("/")
    public List<GroupMemberResponse> listMembers(
        @RequestParam("group_id") Integer groupId,
        @RequestParam(value = "role", required = false) String role,
        @RequestParam(value = "page", defaultValue = "1") int page,
        @RequestParam(value = "size", defaultValue = "20") int size,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return groupMemberService.listMembers(groupId, role, page, size, currentUser);
    }

    @PutMapping("/{memberId}")
    public GroupMemberResponse updateMember(
        @PathVariable Integer memberId,
        @RequestBody GroupMemberUpdateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return groupMemberService.updateMember(memberId, request, currentUser);
    }

    @DeleteMapping("/{memberId}")
    public ResponseEntity<Void> removeMember(
        @PathVariable Integer memberId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        groupMemberService.removeMember(memberId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/leave")
    public ResponseEntity<Void> leaveGroup(
        @RequestParam("group_id") Integer groupId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        groupMemberService.leaveGroup(groupId, currentUser);
        return ResponseEntity.noContent().build();
    }
}

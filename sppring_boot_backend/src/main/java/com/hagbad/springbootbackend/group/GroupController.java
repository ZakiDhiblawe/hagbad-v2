package com.hagbad.springbootbackend.group;

import com.hagbad.springbootbackend.groupmember.GroupMemberResponse;
import com.hagbad.springbootbackend.security.CurrentUser;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/groups")
@Validated
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @PostMapping(value = "/", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public GroupResponse createGroup(
        @RequestParam("name") String name,
        @RequestParam(value = "description", required = false) String description,
        @RequestParam(value = "privacy", required = false) String privacy,
        @RequestParam(value = "visible", defaultValue = "true") boolean visible,
        @RequestPart(value = "group_image", required = false) MultipartFile groupImage,
        @RequestPart(value = "cover_image", required = false) MultipartFile coverImage,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return groupService.createGroup(currentUser, name, description, privacy, visible, groupImage, coverImage);
    }

    @GetMapping("/")
    public List<GroupResponse> listGroups(
        @RequestParam(value = "mine", defaultValue = "false") boolean mine,
        @RequestParam(value = "explore", defaultValue = "false") boolean explore,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "role", required = false) String role,
        @RequestParam(value = "managed", defaultValue = "false") boolean managed,
        @RequestParam(value = "page", defaultValue = "1") int page,
        @RequestParam(value = "size", defaultValue = "20") int size,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return groupService.listGroups(currentUser, mine, explore, search, role, managed, page, size);
    }

    @GetMapping("/{groupId}")
    public GroupResponse getGroup(
        @PathVariable Integer groupId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return groupService.getGroup(groupId, currentUser);
    }

    @PutMapping(value = "/{groupId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public GroupResponse updateGroup(
        @PathVariable Integer groupId,
        @RequestParam(value = "name", required = false) String name,
        @RequestParam(value = "description", required = false) String description,
        @RequestParam(value = "privacy", required = false) String privacy,
        @RequestParam(value = "visible", required = false) Boolean visible,
        @RequestParam(value = "status", required = false) String status,
        @RequestPart(value = "group_image", required = false) MultipartFile groupImage,
        @RequestPart(value = "cover_image", required = false) MultipartFile coverImage,
        @RequestParam(value = "remove_group_image", defaultValue = "false") boolean removeGroupImage,
        @RequestParam(value = "remove_cover_image", defaultValue = "false") boolean removeCoverImage,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return groupService.updateGroup(
            groupId,
            currentUser,
            name,
            description,
            privacy,
            visible,
            status,
            groupImage,
            coverImage,
            removeGroupImage,
            removeCoverImage
        );
    }

    @PostMapping("/{groupId}/join")
    @ResponseStatus(HttpStatus.CREATED)
    public GroupMemberResponse joinGroup(
        @PathVariable Integer groupId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return groupService.joinGroup(groupId, currentUser);
    }

    @PostMapping("/{groupId}/close")
    public GroupResponse closeGroup(
        @PathVariable Integer groupId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return groupService.closeGroup(groupId, currentUser);
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> deleteGroup(
        @PathVariable Integer groupId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        groupService.deleteGroup(groupId, currentUser);
        return ResponseEntity.noContent().build();
    }
}

package com.hagbad.springbootbackend.joinrequest;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/join-requests")
public class JoinRequestController {

    private final JoinRequestService joinRequestService;

    public JoinRequestController(JoinRequestService joinRequestService) {
        this.joinRequestService = joinRequestService;
    }

    @PostMapping("/")
    @ResponseStatus(HttpStatus.CREATED)
    public JoinRequestResponse create(
        @RequestBody JoinRequestCreateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return joinRequestService.create(request, currentUser);
    }

    @GetMapping("/mine")
    public List<JoinRequestResponse> mine(@AuthenticationPrincipal CurrentUser currentUser) {
        return joinRequestService.listMine(currentUser);
    }

    @GetMapping("/group/{groupId}")
    public List<JoinRequestResponse> listGroup(
        @PathVariable Integer groupId,
        @RequestParam(value = "status", required = false) JoinRequestStatus status,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return joinRequestService.listGroup(groupId, status, currentUser);
    }

    @GetMapping("/managed")
    public List<JoinRequestResponse> listManaged(
        @RequestParam(value = "status", required = false) JoinRequestStatus status,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return joinRequestService.listManaged(status, currentUser);
    }

    @GetMapping("/{requestId}")
    public JoinRequestResponse get(
        @PathVariable Integer requestId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return joinRequestService.get(requestId, currentUser);
    }

    @PostMapping("/{requestId}/decision")
    public JoinRequestResponse decide(
        @PathVariable Integer requestId,
        @RequestBody JoinRequestDecisionRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return joinRequestService.decide(requestId, request, currentUser);
    }

    @DeleteMapping("/{requestId}")
    public ResponseEntity<Void> cancel(
        @PathVariable Integer requestId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        joinRequestService.cancel(requestId, currentUser);
        return ResponseEntity.noContent().build();
    }
}

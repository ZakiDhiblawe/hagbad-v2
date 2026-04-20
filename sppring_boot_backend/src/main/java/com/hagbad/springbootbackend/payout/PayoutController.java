package com.hagbad.springbootbackend.payout;

import com.hagbad.springbootbackend.security.CurrentUser;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/payouts")
public class PayoutController {

    private final PayoutService payoutService;

    public PayoutController(PayoutService payoutService) {
        this.payoutService = payoutService;
    }

    @PostMapping("/")
    @ResponseStatus(HttpStatus.CREATED)
    public PayoutResponse create(
        @RequestBody PayoutCreateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return payoutService.create(request, currentUser);
    }

    @GetMapping("/{payoutId}")
    public PayoutResponse get(
        @PathVariable Integer payoutId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return payoutService.get(payoutId, currentUser);
    }

    @GetMapping("/")
    public List<PayoutResponse> list(
        @RequestParam("cycle_id") Integer cycleId,
        @RequestParam(value = "cycle_member_id", required = false) Integer cycleMemberId,
        @RequestParam(value = "status", required = false) PayoutStatus status,
        @RequestParam(value = "page", defaultValue = "1") int page,
        @RequestParam(value = "size", defaultValue = "20") int size,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return payoutService.list(cycleId, cycleMemberId, status, page, size, currentUser);
    }

    @GetMapping("/summary/cycle/{cycleId}")
    public PayoutSummaryResponse summary(
        @PathVariable Integer cycleId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return payoutService.summary(cycleId, currentUser);
    }

    @PutMapping("/{payoutId}")
    public PayoutResponse update(
        @PathVariable Integer payoutId,
        @RequestBody PayoutUpdateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return payoutService.update(payoutId, request, currentUser);
    }

    @PutMapping("/{payoutId}/approve")
    public PayoutResponse approve(
        @PathVariable Integer payoutId,
        @RequestBody(required = false) PayoutDecisionRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        PayoutDecisionRequest payload = request == null ? new PayoutDecisionRequest(null) : request;
        return payoutService.approve(payoutId, payload, currentUser);
    }

    @PutMapping("/{payoutId}/reject")
    public PayoutResponse reject(
        @PathVariable Integer payoutId,
        @RequestBody(required = false) PayoutDecisionRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        PayoutDecisionRequest payload = request == null ? new PayoutDecisionRequest(null) : request;
        return payoutService.reject(payoutId, payload, currentUser);
    }

    @PutMapping("/{payoutId}/pay")
    public PayoutResponse pay(
        @PathVariable Integer payoutId,
        @RequestBody(required = false) PayoutDecisionRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        PayoutDecisionRequest payload = request == null ? new PayoutDecisionRequest(null) : request;
        return payoutService.pay(payoutId, payload, currentUser);
    }

    @DeleteMapping("/{payoutId}")
    public ResponseEntity<Void> delete(
        @PathVariable Integer payoutId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        payoutService.delete(payoutId, currentUser);
        return ResponseEntity.noContent().build();
    }
}

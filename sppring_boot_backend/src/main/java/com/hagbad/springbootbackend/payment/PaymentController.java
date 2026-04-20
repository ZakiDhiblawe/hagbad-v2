package com.hagbad.springbootbackend.payment;

import com.hagbad.springbootbackend.security.CurrentUser;
import java.time.LocalDate;
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
@RequestMapping("/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentResponse create(
        @RequestBody PaymentCreateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return paymentService.create(request, currentUser);
    }

    @GetMapping("/{paymentId}")
    public PaymentResponse get(
        @PathVariable Integer paymentId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return paymentService.get(paymentId, currentUser);
    }

    @GetMapping("/")
    public List<PaymentResponse> list(
        @RequestParam("cycle_id") Integer cycleId,
        @RequestParam(value = "cycle_member_id", required = false) Integer cycleMemberId,
        @RequestParam(value = "status", required = false) PaymentStatus status,
        @RequestParam(value = "due_from", required = false) LocalDate dueFrom,
        @RequestParam(value = "due_to", required = false) LocalDate dueTo,
        @RequestParam(value = "page", defaultValue = "1") int page,
        @RequestParam(value = "size", defaultValue = "20") int size,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return paymentService.list(cycleId, cycleMemberId, status, dueFrom, dueTo, page, size, currentUser);
    }

    @GetMapping("/summary/cycle/{cycleId}")
    public PaymentSummaryResponse summary(
        @PathVariable Integer cycleId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return paymentService.summary(cycleId, currentUser);
    }

    @PutMapping("/{paymentId}")
    public PaymentResponse update(
        @PathVariable Integer paymentId,
        @RequestBody PaymentUpdateRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        return paymentService.update(paymentId, request, currentUser);
    }

    @PutMapping("/{paymentId}/submit")
    public PaymentResponse submit(
        @PathVariable Integer paymentId,
        @RequestBody(required = false) PaymentSubmissionRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        PaymentSubmissionRequest payload = request == null ? new PaymentSubmissionRequest(null, null) : request;
        return paymentService.submit(paymentId, payload, currentUser);
    }

    @PutMapping("/{paymentId}/approve")
    public PaymentResponse approve(
        @PathVariable Integer paymentId,
        @RequestBody(required = false) PaymentDecisionRequest request,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        PaymentDecisionRequest payload = request == null ? new PaymentDecisionRequest(null) : request;
        return paymentService.approve(paymentId, payload, currentUser);
    }

    @DeleteMapping("/{paymentId}")
    public ResponseEntity<Void> delete(
        @PathVariable Integer paymentId,
        @AuthenticationPrincipal CurrentUser currentUser
    ) {
        paymentService.delete(paymentId, currentUser);
        return ResponseEntity.noContent().build();
    }
}

# Security Specification — kicchive Digital Library

## 1. Data Invariants

1. **Role Integrity**: No user may self-assign `role: "admin"` on `/users/{userId}` creation or update, nor create documents in `/admins/{adminId}` unless already a verified administrator.
2. **PII Isolation**: User emails and loan borrower emails in `/users` and `/loans` are never readable by unrelated members (`get` and `list` enforce `userId == request.auth.uid` or verified admin).
3. **Catalog & Stock Atomicity**: Every `/loans/{loanId}` creation by a member must reference an existing `/books/{bookId}` and atomically decrement `books/{bookId}.availableCopies` by 1 in the same write batch (`getAfter()`). Every return transition (`borrowed` -> `returned`) must atomically increment `availableCopies` by 1.
4. **Terminal State Locking**: A `/loans/{loanId}` document with `status == 'returned'` cannot be reverted or modified by non-admin members.
5. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must match `request.time`. `createdAt` and `borrowedAt` are immutable once written.
6. **Path & Payload Hardening**: Document IDs must match `^[a-zA-Z0-9_\-]+$` (1–128 chars), and all strings enforce explicit upper bounds.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Self-Admin Privilege Escalation**: Member creates `/users/{uid}` with `role: "admin"`. Expected: `PERMISSION_DENIED`.
2. **Shadow Field Injection on User**: Member creates `/users/{uid}` with extra field `isSuperAdmin: true`. Expected: `PERMISSION_DENIED`.
3. **Unverified Email Spoofing**: Request with `email: "fathiahasnaa@gmail.com"` and `email_verified: false` tries to create a book in `/books`. Expected: `PERMISSION_DENIED`.
4. **PII Cross-Read**: Member A attempts `get` on `/users/{memberB_uid}`. Expected: `PERMISSION_DENIED`.
5. **Unauthorized Catalog Creation**: Non-admin member attempts `create` on `/books/book_99`. Expected: `PERMISSION_DENIED`.
6. **Stock Manipulation Without Loan**: Member updates `/books/{bookId}` setting `availableCopies: 999` or changing `title`. Expected: `PERMISSION_DENIED`.
7. **Orphan Loan Without Stock Decrement**: Member creates `/loans/{loanId}` without atomically decrementing `/books/{bookId}.availableCopies` in the same batch. Expected: `PERMISSION_DENIED`.
8. **Identity Spoofing on Loan**: Member A creates `/loans/{loanId}` with `userId: memberB_uid`. Expected: `PERMISSION_DENIED`.
9. **Terminal State Reversal**: Member updates `/loans/{loanId}` where `existing.status == 'returned'` back to `'borrowed'`. Expected: `PERMISSION_DENIED`.
10. **Path ID Poisoning**: Client writes to `/books/invalid!@#id` or 500-char ID. Expected: `PERMISSION_DENIED`.
11. **Fake Timestamp Backdating**: Member creates `/loans/{loanId}` with `borrowedAt` set to a client-forged past timestamp instead of `request.time`. Expected: `PERMISSION_DENIED`.
12. **Cross-User Notification Injection**: Non-admin Member A creates `/notifications/{id}` targeting `userId: memberB_uid`. Expected: `PERMISSION_DENIED`.

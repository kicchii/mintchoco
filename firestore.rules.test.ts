/**
 * Security Rules Verification Suite (Dirty Dozen Adversarial Matrix)
 * Run with Firebase Emulator Suite when testing locally.
 */
import assert from 'node:assert/strict';

export const dirtyDozenPayloads = [
  {
    name: '1. Self-Admin Privilege Escalation',
    collection: 'users',
    operation: 'create',
    auth: { uid: 'member_1', email: 'member@example.com', email_verified: true },
    payload: {
      uid: 'member_1',
      displayName: 'Member One',
      email: 'member@example.com',
      role: 'admin',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Shadow Field Injection on User',
    collection: 'users',
    operation: 'create',
    auth: { uid: 'member_1', email: 'member@example.com', email_verified: true },
    payload: {
      uid: 'member_1',
      displayName: 'Member One',
      email: 'member@example.com',
      role: 'member',
      isSuperAdmin: true,
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Unverified Email Spoofing',
    collection: 'books',
    operation: 'create',
    auth: { uid: 'attacker', email: 'fathiahasnaa@gmail.com', email_verified: false },
    payload: { id: 'book_spoof', title: 'Spoofed Book' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. PII Cross-Read',
    collection: 'users',
    operation: 'get',
    targetId: 'member_2',
    auth: { uid: 'member_1', email: 'member@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Unauthorized Catalog Creation',
    collection: 'books',
    operation: 'create',
    auth: { uid: 'member_1', email: 'member@example.com', email_verified: true },
    payload: { id: 'book_99', title: 'Rogue Entry' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Stock Manipulation Without Loan',
    collection: 'books',
    operation: 'update',
    targetId: 'book_1',
    auth: { uid: 'member_1', email: 'member@example.com', email_verified: true },
    payload: { availableCopies: 999, title: 'Hijacked' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Orphan Loan Without Stock Decrement',
    collection: 'loans',
    operation: 'create',
    auth: { uid: 'member_1', email: 'member@example.com', email_verified: true },
    payload: { bookId: 'book_1', userId: 'member_1', status: 'borrowed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Identity Spoofing on Loan',
    collection: 'loans',
    operation: 'create',
    auth: { uid: 'member_1', email: 'member@example.com', email_verified: true },
    payload: { bookId: 'book_1', userId: 'member_2', status: 'borrowed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Terminal State Reversal',
    collection: 'loans',
    operation: 'update',
    targetId: 'loan_returned_1',
    auth: { uid: 'member_1', email: 'member@example.com', email_verified: true },
    payload: { status: 'borrowed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Path ID Poisoning',
    collection: 'books',
    operation: 'create',
    targetId: 'invalid!@#id',
    auth: { uid: 'admin_1', email: 'fathiahasnaa@gmail.com', email_verified: true },
    payload: { id: 'invalid!@#id' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Fake Timestamp Backdating',
    collection: 'loans',
    operation: 'create',
    auth: { uid: 'member_1', email: 'member@example.com', email_verified: true },
    payload: { bookId: 'book_1', userId: 'member_1', borrowedAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Cross-User Notification Injection',
    collection: 'notifications',
    operation: 'create',
    auth: { uid: 'member_1', email: 'member@example.com', email_verified: true },
    payload: { userId: 'member_2', loanId: 'loan_1', type: 'overdue' },
    expected: 'PERMISSION_DENIED',
  },
];

assert.equal(dirtyDozenPayloads.length, 12);

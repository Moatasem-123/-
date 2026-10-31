# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Global Default Deny**: Any path not explicitly matched in `firestore.rules` is unconditionally denied (`allow read, write: if false;`).
2. **Verified Authentication**: Every read and write operation requires a signed-in user with `request.auth.token.email_verified == true`.
3. **Strict Path ID Guard**: Every single-document path variable (`userId`, `adminId`, `docId`, `logId`, `configId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` chars.
4. **Zero Self-Assigned Admin Privileges**: Non-admin users creating a `/users/{userId}` document can only set `role == 'employee'`, and cannot escalate `role` to `'manager'` unless `isAdmin()` is true.
5. **Document Clearance Isolation**: Documents in `/documents/{docId}` with `classification == 'top_secret'` can only be read by admins (`isAdmin()`). Standard employees can only read documents where `classification == 'internal'`. Only admins can create, update, or delete `/documents/{docId}`.
6. **Immutable Audit Trail**: `/activity_logs/{logId}` entries can only be created with `employeeId == request.auth.uid` and `createdAt == request.time`. They can never be deleted, and only `passwordVerified` can transition from `false` to `true` by the owner.
7. **Strict Temporal Integrity**: All `createdAt` and `updatedAt` fields must equal `request.time`.

## 2. The "Dirty Dozen" Payloads

1. **Unverified Email Spoof**: Signed-in user with `email: "almoatasemmohammed123@gmail.com"` but `email_verified: false` attempting to create an official document.
2. **Self-Privilege Escalation on Profile Create**: Regular employee creating `/users/emp1` with `role: "manager"`.
3. **Shadow Field Injection on Profile Update**: User updating `/users/emp1` with an extra undeclared field `isSuperAdmin: true`.
4. **Top-Secret Document Read by Employee**: Regular employee attempting `get` or `list` on `/documents/secretDoc1` where `classification == "top_secret"`.
5. **Unauthorized Document Upload by Employee**: Regular employee attempting `create` on `/documents/doc1`.
6. **Identity Spoofing in Activity Log**: User `emp1` creating `/activity_logs/log1` with `employeeId: "emp2"`.
7. **Timestamp Forgery on Log Creation**: User `emp1` creating `/activity_logs/log1` with a past or future `createdAt` timestamp instead of `request.time`.
8. **Audit Log Deletion Attempt**: Admin or employee attempting `delete` on `/activity_logs/log1`.
9. **Audit Log Query Tampering**: Employee `emp1` attempting `update` on `/activity_logs/log1` to alter `queryText` after searching.
10. **Denial-of-Wallet 1MB String Poisoning**: User attempting to write a 30,000-character string into `queryText` (max 1000) or `displayName` (max 100).
11. **Path ID Poisoning**: User attempting to create a document with an invalid ID containing spaces or special characters.
12. **Unauthorized Security Config Mutation**: Regular employee attempting `update` on `/security_config/global` to change `employeeUnifiedPassword`.

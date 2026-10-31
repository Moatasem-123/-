/**
 * Firestore Security Rules Verification Suite (Dirty Dozen Payloads)
 */

export interface DirtyPayloadTest {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyPayloadTest[] = [
  {
    id: 1,
    name: 'Unverified Email Spoof on Admin Document Create',
    collection: '/documents/doc_1',
    operation: 'create',
    auth: { uid: 'spoof_uid', email: 'almoatasemmohammed123@gmail.com', email_verified: false },
    payload: { title: 'Spoofed Regulation' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Self-Privilege Escalation on Profile Create',
    collection: '/users/emp_1',
    operation: 'create',
    auth: { uid: 'emp_1', email: 'emp1@gov.org', email_verified: true },
    payload: {
      uid: 'emp_1',
      displayName: 'أحمد العتيبي',
      employeeCode: 'EMP-101',
      department: 'الموارد البشرية',
      role: 'manager',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Profile Update',
    collection: '/users/emp_1',
    operation: 'update',
    auth: { uid: 'emp_1', email: 'emp1@gov.org', email_verified: true },
    payload: {
      displayName: 'أحمد العتيبي',
      isSuperAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Top-Secret Document Read by Standard Employee',
    collection: '/documents/secret_doc_1',
    operation: 'get',
    auth: { uid: 'emp_1', email: 'emp1@gov.org', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unauthorized Document Upload by Employee',
    collection: '/documents/new_doc_1',
    operation: 'create',
    auth: { uid: 'emp_1', email: 'emp1@gov.org', email_verified: true },
    payload: { title: 'Fake Policy' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Identity Spoofing in Activity Log',
    collection: '/activity_logs/log_1',
    operation: 'create',
    auth: { uid: 'emp_1', email: 'emp1@gov.org', email_verified: true },
    payload: { employeeId: 'emp_2', queryText: 'كم رصيد الإجازات؟' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Timestamp Forgery on Log Creation',
    collection: '/activity_logs/log_1',
    operation: 'create',
    auth: { uid: 'emp_1', email: 'emp1@gov.org', email_verified: true },
    payload: { employeeId: 'emp_1', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Audit Log Deletion Attempt',
    collection: '/activity_logs/log_1',
    operation: 'delete',
    auth: { uid: 'admin_1', email: 'almoatasemmohammed123@gmail.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Audit Log Query Text Tampering',
    collection: '/activity_logs/log_1',
    operation: 'update',
    auth: { uid: 'emp_1', email: 'emp1@gov.org', email_verified: true },
    payload: { queryText: 'سؤال معدل' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Denial-of-Wallet Oversized String Poisoning',
    collection: '/activity_logs/log_1',
    operation: 'create',
    auth: { uid: 'emp_1', email: 'emp1@gov.org', email_verified: true },
    payload: { queryText: 'أ'.repeat(5000) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Path ID Poisoning',
    collection: '/users/invalid id$!',
    operation: 'create',
    auth: { uid: 'invalid id$!', email: 'emp1@gov.org', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Security Config Mutation by Employee',
    collection: '/security_config/global',
    operation: 'update',
    auth: { uid: 'emp_1', email: 'emp1@gov.org', email_verified: true },
    payload: { employeeUnifiedPassword: '1234' },
    expectedResult: 'PERMISSION_DENIED',
  },
];

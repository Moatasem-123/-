export type UserRole = 'employee' | 'manager';

export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  employeeCode: string;
  department: string;
  role: UserRole;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
  lastLoginAt?: string;
  updatedAt?: string;
}

export interface AccessRequest {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  department: string;
  requestedRole: UserRole;
  requestType: 'register' | 'login';
  status: 'pending' | 'approved' | 'rejected';
  requestedDate: string;
  requestedTime: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface OfficialDocument {
  id: string;
  title: string;
  referenceNumber: string;
  category: string;
  classification: 'internal' | 'top_secret';
  content: string;
  keywords: string;
  authorId: string;
  authorName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ActivityLog {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  userRole: UserRole;
  queryText: string;
  searchDate: string;
  searchTime: string;
  accuracyScore: number;
  matchedDocTitle: string;
  allocatedSeconds: number;
  passwordVerified: boolean;
  createdAt?: unknown;
}

export interface SecurityConfig {
  employeeUnifiedPassword: string;
  previousEmployeePassword?: string;
  passwordVersion?: number;
  passwordChangedAt?: string;
  passwordChangedBy?: string;
  managerAccessCode: string;
  wordsPerSecond: number;
  minTimerSeconds: number;
  maxTimerSeconds: number;
  strictWatermark: boolean;
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SemanticSearchResult {
  queryText: string;
  answer: string;
  matchedDocTitle: string;
  matchedReferenceNumber: string;
  matchedCategory: string;
  classificationLevel: 'internal' | 'top_secret';
  accuracyScore: number;
  semanticIntent: string;
  restrictedNotice: boolean;
  allocatedSeconds: number;
  wordCount: number;
  charCount: number;
  logId: string;
  searchDate: string;
  searchTime: string;
}

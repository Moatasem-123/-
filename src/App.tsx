import React, { useCallback, useEffect, useState } from 'react';
import {
  Shield,
  Search,
  Lock,
  KeyRound,
  Clock,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  LogOut,
  UserCheck,
  UserPlus,
  LogIn,
  Upload,
  Eye,
  EyeOff,
  MailWarning,
  Users,
  ShieldAlert,
  XCircle,
  Globe,
  RefreshCw,
} from 'lucide-react';
import {
  AccessRequest,
  ActivityLog,
  OfficialDocument,
  SecurityConfig,
  SemanticSearchResult,
  UserProfile,
  UserRole,
} from './types';
import { ProtectedAnswerVault } from './components/ProtectedAnswerVault';
import { AdminDocumentsPanel } from './components/AdminDocumentsPanel';
import { ActivityLogsPanel } from './components/ActivityLogsPanel';
import { SecuritySettingsPanel } from './components/SecuritySettingsPanel';
import { AdminEmployeesPanel } from './components/AdminEmployeesPanel';
import { AccessRequestsPanel } from './components/AccessRequestsPanel';
import { PasswordUpdateNoticeModal } from './components/PasswordUpdateNoticeModal';
import { useLanguage } from './i18n';

type ActiveTab =
  | 'assistant'
  | 'regulations'
  | 'admin_docs'
  | 'admin_employees'
  | 'access_requests'
  | 'activity_logs'
  | 'security_settings';

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  employeeUnifiedPassword: 'EMP-2026',
  previousEmployeePassword: '',
  passwordVersion: 1,
  managerAccessCode: 'MGR-9900#SEC',
  wordsPerSecond: 3,
  minTimerSeconds: 15,
  maxTimerSeconds: 90,
  strictWatermark: true,
  updatedBy: 'system',
};

const SESSION_STORAGE_KEY = 'sanad_active_user_v2';
const ACK_PASS_VERSION_KEY = 'sanad_ack_pass_version_';

export default function App() {
  const { lang, setLang, isRtl, t } = useLanguage();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as UserProfile) : null;
    } catch {
      return null;
    }
  });

  // Direct Registration / Login state
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee');
  const [threePartName, setThreePartName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');
  const [showAuthPass, setShowAuthPass] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Pending Manager Approval state (when someone tries to register/login)
  const [pendingAccessRequest, setPendingAccessRequest] =
    useState<AccessRequest | null>(null);

  // Main Workspace state
  const [activeTab, setActiveTab] = useState<ActiveTab>('assistant');
  const [documents, setDocuments] = useState<OfficialDocument[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(
    DEFAULT_SECURITY_CONFIG
  );

  // Encrypted Password Update Notification state (for employees)
  const [acknowledgedPassVersion, setAcknowledgedPassVersion] =
    useState<number>(1);
  const [isPasswordNoticeModalOpen, setIsPasswordNoticeModalOpen] =
    useState(false);

  // Search & AI state
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Password Gate Modal (before revealing answer)
  const [pendingResult, setPendingResult] =
    useState<SemanticSearchResult | null>(null);
  const [enteredAnswerPassword, setEnteredAnswerPassword] = useState('');
  const [passwordGateError, setPasswordGateError] = useState<string | null>(
    null
  );
  const [showGatePass, setShowGatePass] = useState(false);

  // Unlocked Answer Vault (with smart countdown + anti-copy)
  const [unlockedResult, setUnlockedResult] =
    useState<SemanticSearchResult | null>(null);
  const [evictionBanner, setEvictionBanner] = useState<string | null>(null);
  const [isSeedingDocs, setIsSeedingDocs] = useState(false);
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);

  const quickSampleQuestions = [
    {
      label: t(
        'سؤال بالعامية: كم يوم إجازة لو تعبت؟',
        'Question: How many sick or emergency leave days am I entitled to?'
      ),
      query: t(
        'لو تعبت وصار عندي ظرف صحي، كم يوم إجازة مرضية أو اضطرارية يحق لي؟',
        'If I get sick or have an emergency, how many sick or emergency leave days am I entitled to according to the regulations?'
      ),
      clearance: 'internal',
    },
    {
      label: t(
        'سؤال بالعامية: وش شروط الترقية والعلاوة؟',
        'Question: What are the promotion & annual increment rules?'
      ),
      query: t(
        'وش شروط الترقية للمرتبة اللي بعدها وكيف تنحسب نقاط المفاضلة؟',
        'What are the requirements for promotion to the next grade and how are evaluation points calculated?'
      ),
      clearance: 'internal',
    },
    {
      label: t(
        'سؤال بالفصحى: مقدار بدل الانتداب الداخلي والخارجي',
        'Question: Domestic and international business travel allowances'
      ),
      query: t(
        'ما هي مخصصات بدل الانتداب اليومي الداخلي والخارجي وضوابط السلف المالية؟',
        'What are the daily domestic and international travel allowance rates and financial advance rules?'
      ),
      clearance: 'internal',
    },
    {
      label: t(
        'سؤال سري (للمديرين): سقف الترسية المباشرة وميزانية الطوارئ',
        'Top Secret (Managers): Direct award ceiling & strategic reserve budget'
      ),
      query: t(
        'كم يبلغ السقف المالي للترسية المباشرة في العقود السيادية وميزانية صندوق الاحتياطي الاستراتيجي؟',
        'What is the financial ceiling for direct contract awards and the strategic emergency reserve budget?'
      ),
      clearance: 'top_secret',
    },
  ];

  const handleLogout = useCallback((customError?: string) => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUserProfile(null);
    setPendingResult(null);
    setUnlockedResult(null);
    setSearchInput('');
    setPasswordInput('');
    setAuthError(customError || null);
  }, []);

  // Load acknowledged password version for current user
  useEffect(() => {
    if (!userProfile) return;
    const savedVer = localStorage.getItem(
      `${ACK_PASS_VERSION_KEY}${userProfile.uid}`
    );
    if (savedVer) {
      setAcknowledgedPassVersion(Number(savedVer) || 1);
    } else {
      setAcknowledgedPassVersion(1);
    }
  }, [userProfile]);

  // Fetch system state (documents, activity logs, users, access requests, security config)
  const fetchSystemState = useCallback(
    async (uid: string, role: UserRole) => {
      try {
        const res = await fetch(
          `/api/state?uid=${encodeURIComponent(uid)}&role=${role}`
        );
        if (res.status === 401) {
          const errData = await res.json().catch(() => ({}));
          if (errData.accountRemoved) {
            handleLogout(
              t(
                'تم إنهاء صلاحية حسابك أو إزالته من قِبل إدارة المؤسسة.',
                'Your account access has been terminated or removed by organization management.'
              )
            );
            return;
          }
        }
        if (!res.ok) return;

        const data = await res.json();

        // Sync user role if promoted by a Manager
        if (data.user && data.user.role) {
          setUserProfile((prev) => {
            if (!prev) return null;
            if (prev.role !== data.user.role) {
              const updated = { ...prev, ...data.user };
              localStorage.setItem(
                SESSION_STORAGE_KEY,
                JSON.stringify(updated)
              );
              return updated;
            }
            return prev;
          });
        }

        if (Array.isArray(data.documents)) setDocuments(data.documents);
        if (Array.isArray(data.activityLogs))
          setActivityLogs(data.activityLogs);
        if (Array.isArray(data.users)) setRegisteredUsers(data.users);
        if (Array.isArray(data.accessRequests))
          setAccessRequests(data.accessRequests);
        if (data.securityConfig) setSecurityConfig(data.securityConfig);
      } catch (err) {
        console.error('Failed to load state:', err);
      }
    },
    [handleLogout, t]
  );

  // Manual Refresh button handler (syncs state or checks pending approval)
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshingPage(true);
    try {
      if (userProfile) {
        await fetchSystemState(userProfile.uid, userProfile.role);
      } else if (
        pendingAccessRequest &&
        pendingAccessRequest.status === 'pending'
      ) {
        const res = await fetch(
          `/api/auth/request-status/${pendingAccessRequest.id}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'approved' && data.user) {
            setPendingAccessRequest(null);
            const approvedUser = data.user as UserProfile;
            localStorage.setItem(
              SESSION_STORAGE_KEY,
              JSON.stringify(approvedUser)
            );
            setUserProfile(approvedUser);
            setActiveTab('assistant');
            await fetchSystemState(approvedUser.uid, approvedUser.role);
          } else if (data.status === 'rejected') {
            setPendingAccessRequest((prev) =>
              prev ? { ...prev, status: 'rejected' } : null
            );
          }
        }
      } else {
        window.location.reload();
      }
    } finally {
      setTimeout(() => setIsRefreshingPage(false), 400);
    }
  }, [userProfile, pendingAccessRequest, fetchSystemState]);

  // Poll system state when logged in (every 3 seconds so Manager sees live login attempts immediately)
  useEffect(() => {
    if (!userProfile) return;
    fetchSystemState(userProfile.uid, userProfile.role);

    const interval = window.setInterval(() => {
      fetchSystemState(userProfile.uid, userProfile.role);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [userProfile, fetchSystemState]);

  // Poll pending access request status when waiting for Manager approval
  useEffect(() => {
    if (!pendingAccessRequest || pendingAccessRequest.status !== 'pending')
      return;

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/auth/request-status/${pendingAccessRequest.id}`
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'approved' && data.user) {
          window.clearInterval(interval);
          setPendingAccessRequest(null);
          const approvedUser = data.user as UserProfile;
          localStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify(approvedUser)
          );
          setUserProfile(approvedUser);
          setActiveTab('assistant');
          await fetchSystemState(approvedUser.uid, approvedUser.role);
        } else if (data.status === 'rejected') {
          window.clearInterval(interval);
          setPendingAccessRequest((prev) =>
            prev ? { ...prev, status: 'rejected' } : null
          );
        }
      } catch (err) {
        console.error('Polling access request error:', err);
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [pendingAccessRequest, fetchSystemState]);

  // Handle Registration or Login
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (authMode === 'register') {
      const nameWords = threePartName.trim().split(/\s+/).filter(Boolean);
      if (nameWords.length < 3) {
        setAuthError(
          t(
            'يرجى كتابة الاسم الثلاثي كاملاً (مثال: أحمد محمد العتيبي).',
            'Please enter your full three-part name (e.g., Ahmed Mohammed Al-Otaibi).'
          )
        );
        return;
      }
    }

    setIsSubmittingAuth(true);
    try {
      const endpoint =
        authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: threePartName.trim(),
          email: emailInput.trim(),
          password: passwordInput,
          role: selectedRole,
          selectedRole,
          department:
            departmentInput.trim() ||
            (selectedRole === 'manager'
              ? t('الإدارة العليا والتحكم', 'Executive Management & Control')
              : t('الإدارة العامة للعمليات', 'General Operations Department')),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ||
            t(
              'تعذر إتمام عملية التسجيل أو الدخول.',
              'Could not complete registration or login.'
            )
        );
      }

      // If this registration or login requires Manager approval
      if (data.pendingApproval && data.accessRequest) {
        setPendingAccessRequest(data.accessRequest as AccessRequest);
        return;
      }

      const loggedUser = data.user as UserProfile;
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(loggedUser));
      setUserProfile(loggedUser);
      setActiveTab('assistant');
      await fetchSystemState(loggedUser.uid, loggedUser.role);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : t('حدث خطأ أثناء التسجيل.', 'An error occurred during authentication.')
      );
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Manager Decision on Pending Access Request (Approve or Reject)
  const handleDecideAccessRequest = async (
    requestId: string,
    decision: 'approved' | 'rejected'
  ) => {
    if (!userProfile || userProfile.role !== 'manager') return;
    const res = await fetch(`/api/access-requests/${requestId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterRole: userProfile.role,
        managerName: userProfile.displayName,
        decision,
      }),
    });
    const data = await res.json();
    if (Array.isArray(data.accessRequests))
      setAccessRequests(data.accessRequests);
    if (Array.isArray(data.users)) setRegisteredUsers(data.users);
  };

  // Execute Semantic Search -> Record Log -> Trigger Password Gate Modal
  const handleExecuteSearch = async (
    e?: React.FormEvent,
    customQuery?: string
  ) => {
    if (e) e.preventDefault();
    if (!userProfile) return;

    const finalQuery = (customQuery ?? searchInput).trim().slice(0, 1000);
    if (!finalQuery) return;

    setIsSearching(true);
    setSearchError(null);
    setEvictionBanner(null);

    try {
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: finalQuery,
          user: userProfile,
          lang,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ||
            t(
              'تعذر الاتصال بمحرك البحث الدلالي.',
              'Could not connect to the semantic search engine.'
            )
        );
      }

      if (Array.isArray(data.activityLogs)) {
        setActivityLogs(data.activityLogs);
      }

      setPendingResult({
        queryText: finalQuery,
        answer: String(data.answer || '').trim(),
        matchedDocTitle: String(
          data.matchedDocTitle ||
            t('اللائحة الرسمية المعتمدة', 'Approved Official Regulation')
        ),
        matchedReferenceNumber: String(
          data.matchedReferenceNumber || 'GOV-2026'
        ),
        matchedCategory: String(data.matchedCategory || t('عام', 'General')),
        classificationLevel:
          data.classificationLevel === 'top_secret' ? 'top_secret' : 'internal',
        accuracyScore: Number(data.accuracyScore || 94.2),
        semanticIntent: String(
          data.semanticIntent ||
            t(
              'مطابقة دلالية مع اللوائح الرسمية',
              'Semantic match with official regulations'
            )
        ),
        restrictedNotice: Boolean(data.restrictedNotice),
        allocatedSeconds: Number(data.allocatedSeconds || 20),
        wordCount: Number(data.wordCount || 30),
        charCount: Number(data.charCount || 150),
        logId: String(data.logId || ''),
        searchDate: String(data.searchDate || ''),
        searchTime: String(data.searchTime || ''),
      });
      setEnteredAnswerPassword('');
      setPasswordGateError(null);
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : t(
              'حدث خطأ أثناء البحث الدلالي.',
              'An error occurred during semantic search.'
            )
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Verify Unified Password to unlock the answer
  const handleVerifyAnswerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingResult || !userProfile) return;

    const cleanInput = enteredAnswerPassword.trim();
    const expectedPassword =
      userProfile.role === 'manager'
        ? securityConfig.managerAccessCode
        : securityConfig.employeeUnifiedPassword;

    const isValid =
      cleanInput === expectedPassword ||
      cleanInput === securityConfig.employeeUnifiedPassword;

    if (!isValid) {
      setPasswordGateError(
        t(
          'كلمة المرور الموحدة غير صحيحة. لا يمكن عرض الإجابة إلا بعد إدخال كلمة المرور المعتمدة بشكل صحيح.',
          'Incorrect unified password. The answer cannot be displayed without entering the valid authorized password.'
        )
      );
      return;
    }

    const resultToReveal = pendingResult;
    setPendingResult(null);
    setEnteredAnswerPassword('');
    setPasswordGateError(null);
    setUnlockedResult(resultToReveal);

    fetch(`/api/activity-logs/${resultToReveal.logId}/verify`, {
      method: 'PATCH',
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.activityLogs)) {
          setActivityLogs(data.activityLogs);
        }
      })
      .catch((err) => {
        console.error('Could not update passwordVerified flag:', err);
      });
  };

  // Handle Vault Expiration or Manual Close
  const handleVaultClose = useCallback(
    (reason: 'expired' | 'manual_close') => {
      setUnlockedResult(null);
      if (reason === 'expired') {
        setEvictionBanner(
          t(
            'انتهت المهلة المحددة للقراءة التلقائية وتم إغلاق صفحة الإجابة وطرد الجلسة منها لمنع تصوير الشاشة أو تسريب المعلومات.',
            'Allocated reading time expired. The answer vault was automatically closed and purged to prevent screen capture or data leakage.'
          )
        );
      }
    },
    [t]
  );

  // Admin Document Handlers (Managers Only)
  const handleCreateDocument = async (
    docData: Omit<
      OfficialDocument,
      'id' | 'authorId' | 'authorName' | 'createdAt' | 'updatedAt'
    >
  ) => {
    if (!userProfile || userProfile.role !== 'manager') return;
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: userProfile.role,
        authorId: userProfile.uid,
        authorName: userProfile.displayName,
        document: docData,
      }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || t('تعذر حفظ الوثيقة', 'Could not save document'));
    if (Array.isArray(data.documents)) setDocuments(data.documents);
  };

  const handleUpdateDocument = async (
    docId: string,
    docData: Omit<
      OfficialDocument,
      'id' | 'authorId' | 'authorName' | 'createdAt' | 'updatedAt'
    >
  ) => {
    if (!userProfile || userProfile.role !== 'manager') return;
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: userProfile.role,
        authorName: userProfile.displayName,
        document: docData,
      }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        data.error || t('تعذر تحديث الوثيقة', 'Could not update document')
      );
    if (Array.isArray(data.documents)) setDocuments(data.documents);
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!userProfile || userProfile.role !== 'manager') return;
    const res = await fetch(
      `/api/documents/${docId}?role=${userProfile.role}`,
      {
        method: 'DELETE',
      }
    );
    const data = await res.json();
    if (Array.isArray(data.documents)) setDocuments(data.documents);
  };

  const handleSeedDefaultDocuments = async () => {
    if (!userProfile || userProfile.role !== 'manager') return;
    setIsSeedingDocs(true);
    try {
      const res = await fetch('/api/documents/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: userProfile.role,
          authorId: userProfile.uid,
          authorName: userProfile.displayName,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.documents)) setDocuments(data.documents);
    } finally {
      setIsSeedingDocs(false);
    }
  };

  const handleSaveSecurityConfig = async (
    updated: Omit<SecurityConfig, 'updatedBy' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!userProfile || userProfile.role !== 'manager') return;
    const res = await fetch('/api/security-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: userProfile.role,
        updatedBy: userProfile.displayName,
        config: updated,
      }),
    });
    const data = await res.json();
    if (data.securityConfig) setSecurityConfig(data.securityConfig);
  };

  // Manager Employee Management Handlers
  const handleChangeUserRole = async (
    targetUid: string,
    newRole: 'employee' | 'manager'
  ) => {
    if (!userProfile || userProfile.role !== 'manager') return;
    const res = await fetch(`/api/users/${targetUid}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterRole: userProfile.role,
        newRole,
      }),
    });
    const data = await res.json();
    if (Array.isArray(data.users)) setRegisteredUsers(data.users);
  };

  const handleRemoveUser = async (targetUid: string) => {
    if (!userProfile || userProfile.role !== 'manager') return;
    const res = await fetch(
      `/api/users/${targetUid}?role=${userProfile.role}`,
      {
        method: 'DELETE',
      }
    );
    const data = await res.json();
    if (Array.isArray(data.users)) setRegisteredUsers(data.users);
  };

  const currentPassVersion = securityConfig.passwordVersion || 1;
  const hasPasswordUpdateNotification =
    Boolean(securityConfig.previousEmployeePassword) &&
    currentPassVersion > 1 &&
    acknowledgedPassVersion < currentPassVersion;

  const handleAcknowledgePasswordUpdate = useCallback(
    (versionAck: number) => {
      setIsPasswordNoticeModalOpen(false);
      setAcknowledgedPassVersion(versionAck);
      if (userProfile) {
        localStorage.setItem(
          `${ACK_PASS_VERSION_KEY}${userProfile.uid}`,
          String(versionAck)
        );
      }
    },
    [userProfile]
  );

  const pendingAccessList = accessRequests.filter(
    (r) => r.status === 'pending'
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 border-b border-slate-200 bg-white px-6 py-4">
        {/* Zone 1: Single text element Brand wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            if (userProfile) setActiveTab('assistant');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          {t('دليلك الذكي', 'Your Smart Guide')}
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        {userProfile ? (
          <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('assistant')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'assistant'
                  ? 'font-bold text-emerald-700 underline underline-offset-8'
                  : 'hover:text-slate-900'
              }`}
            >
              {t('المساعد الذكي', 'AI Assistant')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('regulations')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'regulations'
                  ? 'font-bold text-emerald-700 underline underline-offset-8'
                  : 'hover:text-slate-900'
              }`}
            >
              {t('اللوائح المتاحة', 'Regulations')} ({documents.length})
            </button>
            {userProfile.role === 'manager' && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('admin_docs')}
                  className={`transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'admin_docs'
                      ? 'font-bold text-emerald-700 underline underline-offset-8'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {t('رفع وإدارة المستندات', 'Manage Documents')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('admin_employees')}
                  className={`transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'admin_employees'
                      ? 'font-bold text-emerald-700 underline underline-offset-8'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {t('الموظفون', 'Employees')} ({registeredUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('access_requests')}
                  className={`transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'access_requests'
                      ? 'font-bold text-emerald-700 underline underline-offset-8'
                      : pendingAccessList.length > 0
                        ? 'font-bold text-amber-700 hover:text-amber-900'
                        : 'hover:text-slate-900'
                  }`}
                >
                  {t('طلبات الدخول', 'Login Requests')} (
                  {pendingAccessList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('activity_logs')}
                  className={`transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'activity_logs'
                      ? 'font-bold text-emerald-700 underline underline-offset-8'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {t('سجل نشاطات الموظفين', 'Activity Logs')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('security_settings')}
                  className={`transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'security_settings'
                      ? 'font-bold text-emerald-700 underline underline-offset-8'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {t('إعدادات الحماية', 'Security Settings')}
                </button>
              </>
            )}
          </nav>
        ) : (
          <div />
        )}

        {/* Zone 3: Refresh Button + Language Switcher + Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Refresh / Sync Data Button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshingPage}
            title={t('تحديث البيانات والصفحة', 'Refresh Page & Data')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-emerald-600 ${
                isRefreshingPage ? 'animate-spin' : ''
              }`}
            />
            <span>
              {isRefreshingPage
                ? t('جاري التحديث...', 'Refreshing...')
                : t('تحديث', 'Refresh')}
            </span>
          </button>

          {/* Arabic / English Language Switcher Box */}
          <div className="flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLang('ar')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors whitespace-nowrap shrink-0 ${
                lang === 'ar'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>العربية</span>
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`rounded-md px-2.5 py-1.5 transition-colors whitespace-nowrap shrink-0 ${
                lang === 'en'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
          </div>

          {userProfile ? (
            <button
              type="button"
              onClick={() => handleLogout()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
              <span>{t('تسجيل الخروج', 'Logout')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPendingAccessRequest(null);
                setAuthMode((m) => (m === 'register' ? 'login' : 'register'));
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              {authMode === 'register'
                ? t('لديك حساب؟ تسجيل الدخول', 'Have an account? Sign In')
                : t('إنشاء حساب جديد', 'Create New Account')}
            </button>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {!userProfile ? (
          pendingAccessRequest ? (
            /* WAITING SCREEN FOR MANAGER APPROVAL ON LOGIN / REGISTRATION */
            <div className="mx-auto max-w-xl py-8">
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
                {pendingAccessRequest.status === 'pending' ? (
                  <>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-600">
                      <Clock className="h-7 w-7 animate-pulse" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {t(
                        'طلب تسجيل الدخول بانتظار موافقة المدير الحالي',
                        'Login Request Awaiting Current Manager Approval'
                      )}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {t(
                        'حفاظاً على أمان المؤسسة ومنع دخول أي شخص غريب، تم إرسال بيانات محاولة دخولك إلى حساب المدير الحالي للمراجعة والموافقة.',
                        'To protect organizational security and prevent unauthorized access, your login request has been sent to the current Manager for review and approval.'
                      )}
                    </p>

                    <div
                      className={`mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 ${
                        isRtl ? 'text-right' : 'text-left'
                      }`}
                    >
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500">
                          {t('الاسم الثلاثي:', 'Full Name:')}
                        </span>
                        <span className="font-bold text-slate-900">
                          {pendingAccessRequest.displayName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500">
                          {t('البريد الإلكتروني:', 'Email:')}
                        </span>
                        <span className="font-mono">
                          {pendingAccessRequest.email}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500">
                          {t('الصفة المطلوبة:', 'Requested Role:')}
                        </span>
                        <span className="font-bold text-emerald-700">
                          {pendingAccessRequest.requestedRole === 'manager'
                            ? t('حساب مدير', 'Manager Account')
                            : t('حساب موظف', 'Employee Account')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500">
                          {t('الحالة الحالية:', 'Current Status:')}
                        </span>
                        <span className="font-bold text-amber-700">
                          {t(
                            'بانتظار ضغط المدير على «موافقة»...',
                            'Waiting for Manager to click "Approve"...'
                          )}
                        </span>
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-slate-500">
                      {t(
                        'سيتم فتح الحساب تلقائياً فور موافقة المدير دون الحاجة لتحديث الصفحة.',
                        'Your account will open automatically as soon as the Manager approves, without refreshing the page.'
                      )}
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-5">
                      <button
                        type="button"
                        onClick={handleManualRefresh}
                        disabled={isRefreshingPage}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${
                            isRefreshingPage ? 'animate-spin' : ''
                          }`}
                        />
                        <span>
                          {t(
                            'تحديث حالة الطلب الآن',
                            'Refresh Request Status Now'
                          )}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPendingAccessRequest(null);
                          setAuthMode('login');
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t(
                          'العودة لتسجيل الدخول بحساب المدير الحالي للموافقة',
                          'Return to Sign In as Current Manager to Approve'
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600">
                      <XCircle className="h-7 w-7" />
                    </div>
                    <h2 className="text-xl font-bold text-red-700">
                      {t(
                        'تم رفض طلب تسجيل الدخول من قِبل مدير النظام',
                        'Login Request Rejected by System Manager'
                      )}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      {t(
                        'قام المدير الحالي برفض طلب دخول هذا الحساب لعدم التحقق من الهوية.',
                        'The current Manager rejected this login request due to unverified identity.'
                      )}
                    </p>
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => setPendingAccessRequest(null)}
                        className="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                      >
                        {t('العودة لصفحة الدخول', 'Back to Login')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* DIRECT REGISTRATION / LOGIN CARD ON LOAD */
            <div className="mx-auto max-w-xl py-4">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
                {/* Mode Switch Tabs */}
                <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError(null);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-md py-2.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      authMode === 'register'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserPlus className="h-4 w-4 text-emerald-600" />
                    <span>
                      {t('تسجيل حساب جديد', 'Register New Account')}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError(null);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-md py-2.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      authMode === 'login'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LogIn className="h-4 w-4 text-emerald-600" />
                    <span>
                      {t('تسجيل الدخول لحساب حالي', 'Sign In to Existing Account')}
                    </span>
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-5">
                  {/* STEP 1: Ask whether Employee or Manager */}
                  <div>
                    <label className="mb-2 block text-xs font-bold text-slate-800">
                      {t(
                        '1. اختر الصفة الوظيفية ونوع الحساب:',
                        '1. Select Job Role & Account Type:'
                      )}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedRole('employee')}
                        className={`rounded-xl border p-4 transition-colors ${
                          isRtl ? 'text-right' : 'text-left'
                        } ${
                          selectedRole === 'employee'
                            ? 'border-emerald-600 bg-emerald-50/70 text-slate-900'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-sm font-bold text-slate-900">
                          {t('حساب موظف', 'Employee Account')}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {t(
                            'البحث والاستعلام في اللوائح الرسمية (يتطلب موافقة المدير)',
                            'Search & query official regulations (requires Manager approval)'
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedRole('manager')}
                        className={`rounded-xl border p-4 transition-colors ${
                          isRtl ? 'text-right' : 'text-left'
                        } ${
                          selectedRole === 'manager'
                            ? 'border-emerald-600 bg-emerald-50/70 text-slate-900'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-sm font-bold text-slate-900">
                          {t('حساب مدير', 'Manager Account')}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {t(
                            'صلاحية رفع المستندات، قبول أو رفض الدخول، والوثائق السرية',
                            'Upload documents, approve/reject logins & access top-secret files'
                          )}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* STEP 2: Three-part Name (in Register mode) */}
                  {authMode === 'register' && (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-800">
                          {t(
                            '2. الاسم الثلاثي الكامل:',
                            '2. Full Three-Part Name:'
                          )}
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={threePartName}
                          onChange={(e) => setThreePartName(e.target.value)}
                          placeholder={t(
                            'اكتب اسمك الثلاثي (مثال: أحمد محمد العتيبي)',
                            'Enter your full 3-part name (e.g., Ahmed Mohammed Al-Otaibi)'
                          )}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          {t(
                            'القسم / الإدارة (اختياري):',
                            'Department / Division (Optional):'
                          )}
                        </label>
                        <input
                          type="text"
                          maxLength={80}
                          value={departmentInput}
                          onChange={(e) => setDepartmentInput(e.target.value)}
                          placeholder={
                            selectedRole === 'manager'
                              ? t(
                                  'مثال: الإدارة العليا والتحكم',
                                  'e.g., Executive Management & Control'
                                )
                              : t(
                                  'مثال: إدارة الموارد البشرية',
                                  'e.g., Human Resources Department'
                                )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    </>
                  )}

                  {/* STEP 3: Email & Password */}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-800">
                      {t('البريد الإلكتروني (الإيميل):', 'Email Address:')}
                    </label>
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="name@organization.gov"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-800">
                      {t('كلمة المرور (الباسوورد):', 'Password:')}
                    </label>
                    <div className="relative">
                      <input
                        type={showAuthPass ? 'text' : 'password'}
                        required
                        minLength={4}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder={t(
                          'أدخل كلمة المرور...',
                          'Enter your password...'
                        )}
                        className={`w-full rounded-lg border border-slate-300 bg-white py-2.5 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none ${
                          isRtl ? 'pr-3.5 pl-10' : 'pl-3.5 pr-10'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAuthPass((v) => !v)}
                        className={`absolute top-2.5 text-slate-400 hover:text-slate-700 ${
                          isRtl ? 'left-3' : 'right-3'
                        }`}
                      >
                        {showAuthPass ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmittingAuth}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Lock className="h-4 w-4" />
                    <span>
                      {isSubmittingAuth
                        ? t('جاري التحقق...', 'Verifying...')
                        : authMode === 'register'
                          ? t(
                              `طلب تسجيل ودخول كـ ${selectedRole === 'manager' ? 'مدير' : 'موظف'}`,
                              `Register & Request Access as ${selectedRole === 'manager' ? 'Manager' : 'Employee'}`
                            )
                          : t(
                              'تسجيل الدخول إلى الحساب',
                              'Sign In to Account'
                            )}
                    </span>
                  </button>
                </form>
              </div>
            </div>
          )
        ) : (
          /* AUTHENTICATED WORKSPACE */
          <div className="space-y-6">
            {/* LIVE ACCESS REQUEST ALERT BANNER FOR CURRENT MANAGER */}
            {userProfile.role === 'manager' && pendingAccessList.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-xs">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                    <span>
                      {t(
                        `تنبيه أمني للمدير: يوجد (${pendingAccessList.length}) شخص يحاول تسجيل الدخول الآن وبانتظار قرارك`,
                        `Manager Security Alert: (${pendingAccessList.length}) user(s) attempting to sign in right now awaiting your decision`
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('access_requests')}
                    className="text-xs font-bold text-amber-800 underline hover:text-amber-950"
                  >
                    {t('فتح صفحة طلبات الدخول', 'Open Login Requests Tab')}
                  </button>
                </div>

                <div className="divide-y divide-amber-200/70 rounded-lg border border-amber-200 bg-white">
                  {pendingAccessList.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-3.5"
                    >
                      <div className="text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {req.displayName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-bold ${
                              req.requestedRole === 'manager'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {req.requestedRole === 'manager'
                              ? t(
                                  'يحاول الدخول كـ مدير',
                                  'Attempting access as Manager'
                                )
                              : t(
                                  'يحاول الدخول كـ موظف',
                                  'Attempting access as Employee'
                                )}
                          </span>
                        </div>
                        <div className="mt-0.5 text-slate-500">
                          <span className="font-mono">{req.email}</span> ·{' '}
                          {req.department} · {req.requestedTime}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleDecideAccessRequest(req.id, 'approved')
                          }
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>
                            {t('موافقة على الدخول', 'Approve Access')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDecideAccessRequest(req.id, 'rejected')
                          }
                          className="flex items-center gap-1 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 whitespace-nowrap shrink-0"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>{t('رفض وحظر', 'Reject & Block')}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Encrypted Password Update Message Banner (When Manager changes Employee Unified Password) */}
            {Boolean(securityConfig.previousEmployeePassword) &&
              currentPassVersion > 1 && (
                <div
                  className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border px-6 py-4 ${
                    hasPasswordUpdateNotification
                      ? 'border-amber-300 bg-amber-50 text-amber-950'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-300 bg-white text-amber-700">
                      <MailWarning className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">
                        {t(
                          'رسالة أمنية مشفرة من الإدارة: تم تحديث كلمة المرور الموحدة للموظفين',
                          'Encrypted Security Notice: Employee Unified Password Updated'
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {t(
                          'لا يمكن فتح الرسالة والاطلاع على كلمة المرور الجديدة إلا بإدخال كلمة المرور القديمة (مع عد تنازلي للإغلاق التلقائي).',
                          'You can only unlock this message and view the new password by entering the old unified password (with auto-close countdown).'
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPasswordNoticeModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-700 whitespace-nowrap shrink-0"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>
                      {t(
                        'فتح الرسالة المشفرة بالكلمة القديمة',
                        'Unlock Message with Old Password'
                      )}
                    </span>
                  </button>
                </div>
              )}

            {/* Identity & Role Header Strip (NO PASSWORD OR CODE SHOWN) */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-bold text-slate-900">
                  {userProfile.displayName}
                </span>
                <span aria-hidden="true">·</span>
                <span>{userProfile.department}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    userProfile.role === 'manager'
                      ? 'font-bold text-amber-700'
                      : 'font-bold text-emerald-700'
                  }
                >
                  {userProfile.role === 'manager'
                    ? t(
                        'حساب مدير النظام (صلاحية رفع المستندات + الموافقة على الدخول + الوثائق السرية)',
                        'System Manager Account (Document Upload + Login Approvals + Top Secret Access)'
                      )
                    : t(
                        'حساب موظف (صلاحية البحث والاستعلام مع التحقق بكلمة المرور الموحدة)',
                        'Employee Account (Semantic Search & Query with Unified Password Gate)'
                      )}
                </span>
              </div>

              {userProfile.role === 'manager' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin_employees')}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      {t('الموظفون', 'Employees')} ({registeredUsers.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('access_requests')}
                    className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      pendingAccessList.length > 0
                        ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ShieldAlert
                      className={`h-3.5 w-3.5 ${
                        pendingAccessList.length > 0
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    />
                    <span>
                      {t('طلبات الدخول', 'Login Requests')} (
                      {pendingAccessList.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin_docs')}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>
                      {t('رفع وإدارة المستندات', 'Upload & Manage Docs')}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile / Tablet Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4 lg:hidden">
              <button
                type="button"
                onClick={() => setActiveTab('assistant')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                  activeTab === 'assistant'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {t('المساعد الذكي', 'AI Assistant')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('regulations')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                  activeTab === 'regulations'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {t('اللوائح', 'Regulations')} ({documents.length})
              </button>
              {userProfile.role === 'manager' && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin_docs')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                      activeTab === 'admin_docs'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {t('إدارة المستندات', 'Documents')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin_employees')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                      activeTab === 'admin_employees'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {t('الموظفون', 'Employees')} ({registeredUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('access_requests')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                      activeTab === 'access_requests'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {t('طلبات الدخول', 'Login Requests')} (
                    {pendingAccessList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('activity_logs')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                      activeTab === 'activity_logs'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {t('سجل النشاطات', 'Activity Logs')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('security_settings')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                      activeTab === 'security_settings'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {t('إعدادات الحماية', 'Security')}
                  </button>
                </>
              )}
            </div>

            {/* Eviction Alert Banner after Countdown Timer Expiry */}
            {evictionBanner && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-xs text-amber-900">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold text-amber-950">
                      {t(
                        'إغلاق أمني تلقائي لصفحة الإجابة',
                        'Automatic Security Closure of Answer Vault'
                      )}
                    </p>
                    <p className="mt-0.5 text-amber-800">{evictionBanner}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEvictionBanner(null)}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0"
                >
                  {t('إغلاق التنبيه', 'Dismiss')}
                </button>
              </div>
            )}

            {/* TAB 1: SEMANTIC AI ASSISTANT */}
            {activeTab === 'assistant' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 md:p-8">
                  <div className="max-w-3xl">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                      <Sparkles className="h-4 w-4" />
                      <span>
                        {t(
                          'دليلك الذكي — محرك البحث الدلالي يدعم الفصحى والعامية والإنجليزية بناءً على المستندات الرسمية',
                          'Your Smart Guide — Semantic Search Engine supporting Arabic & English over Official Documents'
                        )}
                      </span>
                    </div>
                    <h1
                      className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl"
                      style={{ textWrap: 'balance' }}
                    >
                      {t(
                        'اطرح سؤالك أو استفسارك الوظيفي',
                        'Ask Your Official or Administrative Question'
                      )}
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-600">
                      {t(
                        'بعد طرح السؤال، سيطلب النظام إدخال كلمة المرور الموحدة السرية قبل عرض الإجابة داخل صفحة مؤمنة غير قابلة للنسخ مع عد تنازلي ذكي.',
                        'After submitting your question, the system requires the confidential unified password before displaying the answer inside a non-copyable vault with a smart countdown timer.'
                      )}
                    </p>
                  </div>

                  {/* Semantic Search Input Form */}
                  <form onSubmit={handleExecuteSearch} className="mt-6">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative flex-1">
                        <Search
                          className={`pointer-events-none absolute top-4 h-5 w-5 text-slate-400 ${
                            isRtl ? 'right-4' : 'left-4'
                          }`}
                        />
                        <input
                          type="text"
                          required
                          maxLength={1000}
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          placeholder={t(
                            'اكتب سؤالك بالفصحى أو العامية (مثال: كم يوم إجازة لو تعبت؟ أو وش شروط الترقية؟)...',
                            'Type your question in Arabic or English (e.g., How many sick leave days am I allowed? What are the promotion rules?)...'
                          )}
                          className={`w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none ${
                            isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'
                          }`}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSearching || !searchInput.trim()}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {isSearching ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>
                              {t(
                                'جاري التحليل الدلالي...',
                                'Analyzing Semantically...'
                              )}
                            </span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4" />
                            <span>
                              {t(
                                'بحث واستخراج الإجابة',
                                'Search & Extract Answer'
                              )}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {searchError && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                      <span>{searchError}</span>
                    </div>
                  )}

                  {/* Quick Sample Questions */}
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <div className="mb-3 text-xs font-semibold text-slate-600">
                      {t(
                        'أسئلة جاهزة للتجربة السريعة (بالعامية والفصحى):',
                        'Quick Sample Questions to Try:'
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                      {quickSampleQuestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSearchInput(item.query);
                            handleExecuteSearch(undefined, item.query);
                          }}
                          disabled={isSearching}
                          className={`flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-emerald-500 hover:bg-white ${
                            isRtl ? 'text-right' : 'text-left'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-800">
                              {item.label}
                            </div>
                            <div className="mt-1 line-clamp-1 text-[11px] text-slate-500">
                              «{item.query}»
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                              item.clearance === 'top_secret'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {item.clearance === 'top_secret'
                              ? t('سري للمديرين', 'Managers Only')
                              : t('متاح للموظفين', 'Employees')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Security Policy Cards (NO PASSWORDS DISPLAYED ON SCREEN) */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                      <KeyRound className="h-4 w-4" />
                      <span>
                        {t(
                          'حماية الجلسة ضد المتطفلين',
                          'Session Protection Against Intruders'
                        )}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-slate-600">
                      {t(
                        'كلمة المرور الموحدة مخفية تماماً ولا تظهر في الشاشة الرئيسية، لمنع أي شخص غريب من قراءة الإجابات حتى لو كان الجهاز مفتوحاً.',
                        'The unified password is completely hidden from the main screen to prevent any unauthorized person from viewing answers on an unattended device.'
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                      <Shield className="h-4 w-4" />
                      <span>
                        {t(
                          'موافقة المدير على تسجيل الدخول',
                          'Manager Approval for Login Attempts'
                        )}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-slate-600">
                      {t(
                        'يرصد المدير الحالي أي محاولة تسجيل دخول جديدة (سواء كمدير أو موظف) ويملك صلاحية الموافقة عليها أو رفضها وحظرها فوراً.',
                        'The active Manager monitors any new login attempt (whether as Manager or Employee) and can approve or reject & block it immediately.'
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Clock className="h-4 w-4 text-emerald-600" />
                      <span>
                        {t(
                          'العد التنازلي الذكي ومنع النسخ',
                          'Smart Countdown & Anti-Copy Vault'
                        )}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-slate-600">
                      {t(
                        `تُحسب مدة العرض تلقائياً حسب طول النص وبحد أدنى ${securityConfig.minTimerSeconds} ثانية، ثم تُغلق الإجابة تلقائياً.`,
                        `Display duration is calculated automatically based on text length (minimum ${securityConfig.minTimerSeconds}s) and auto-closes when time expires.`
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: OFFICIAL REGULATIONS VIEWER */}
            {activeTab === 'regulations' && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h2 className="text-xl font-bold text-slate-900">
                    {t(
                      'فهرس اللوائح والمستندات الرسمية المعتمدة',
                      'Index of Approved Official Regulations & Documents'
                    )}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {t(
                      `الوثائق المتاحة حسب مستوى صلاحيات حسابك الحالي (${
                        userProfile.role === 'manager'
                          ? 'مدير: يشمل الوثائق الداخلية والسرية للغاية'
                          : 'موظف: الوثائق الداخلية فقط'
                      }).`,
                      `Documents available under your current account clearance (${
                        userProfile.role === 'manager'
                          ? 'Manager: Includes Internal & Top Secret Documents'
                          : 'Employee: Internal Documents Only'
                      }).`
                    )}
                  </p>
                </div>

                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                  {documents.map((docItem) => (
                    <div key={docItem.id} className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold tabular-nums text-slate-800">
                            {docItem.referenceNumber}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{docItem.category}</span>
                        </div>
                        <span
                          className={
                            docItem.classification === 'top_secret'
                              ? 'font-bold text-amber-700'
                              : 'font-semibold text-emerald-700'
                          }
                        >
                          {docItem.classification === 'top_secret'
                            ? t(
                                'سري للغاية — خاص بالمديرين',
                                'Top Secret — Managers Only'
                              )
                            : t(
                                'داخلي — متاح للموظفين',
                                'Internal — Available to Employees'
                              )}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-base font-bold text-slate-900">
                        {docItem.title}
                      </h3>
                      <p className="mt-2 text-xs text-slate-600">
                        {t('الكلمات الدلالية المشمولة:', 'Included Keywords:')}{' '}
                        {docItem.keywords}
                      </p>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('assistant');
                            const q = t(
                              `ما هي أبرز بنود وضوابط ${docItem.title}؟`,
                              `What are the key rules and provisions of ${docItem.title}?`
                            );
                            setSearchInput(q);
                            handleExecuteSearch(undefined, q);
                          }}
                          className="rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                        >
                          {t(
                            'الاستعلام عن هذه الوثيقة عبر المساعد الذكي',
                            'Query This Document via AI Assistant'
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: ADMIN DOCUMENTS CONTROL PANEL (MANAGERS ONLY) */}
            {activeTab === 'admin_docs' && userProfile.role === 'manager' && (
              <AdminDocumentsPanel
                documents={documents}
                onCreateDocument={handleCreateDocument}
                onUpdateDocument={handleUpdateDocument}
                onDeleteDocument={handleDeleteDocument}
                onSeedDefaultDocuments={handleSeedDefaultDocuments}
                isSeeding={isSeedingDocs}
              />
            )}

            {/* TAB 4: REGISTERED EMPLOYEES DIRECTORY (MANAGERS ONLY - SEPARATE TAB) */}
            {activeTab === 'admin_employees' &&
              userProfile.role === 'manager' && (
                <AdminEmployeesPanel
                  users={registeredUsers}
                  currentManagerUid={userProfile.uid}
                  onChangeUserRole={handleChangeUserRole}
                  onRemoveUser={handleRemoveUser}
                  onRefresh={handleManualRefresh}
                />
              )}

            {/* TAB 5: LOGIN / ACCESS REQUESTS APPROVALS (MANAGERS ONLY - SEPARATE TAB) */}
            {activeTab === 'access_requests' &&
              userProfile.role === 'manager' && (
                <AccessRequestsPanel
                  accessRequests={accessRequests}
                  onDecideAccessRequest={handleDecideAccessRequest}
                  onRefresh={handleManualRefresh}
                />
              )}

            {/* TAB 6: EMPLOYEE ACTIVITY LOGS (MANAGERS ONLY) */}
            {activeTab === 'activity_logs' && userProfile.role === 'manager' && (
              <ActivityLogsPanel logs={activityLogs} />
            )}

            {/* TAB 7: SECURITY & COUNTDOWN SETTINGS (MANAGERS ONLY) */}
            {activeTab === 'security_settings' &&
              userProfile.role === 'manager' && (
                <SecuritySettingsPanel
                  securityConfig={securityConfig}
                  onSaveConfig={handleSaveSecurityConfig}
                />
              )}
          </div>
        )}
      </main>

      {/* MANDATORY PASSWORD GATE MODAL BEFORE REVEALING ANSWER (NO PASSWORD HINTS SHOWN) */}
      {pendingResult && userProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t(
                    'طبقة التحقق الأمني قبل عرض الإجابة',
                    'Security Verification Layer Before Revealing Answer'
                  )}
                </h3>
                <p className="text-xs text-slate-500">
                  {t(
                    `تم تجهيز الإجابة وحساب مدة القراءة (${pendingResult.allocatedSeconds} ثانية)`,
                    `Answer prepared & reading time calculated (${pendingResult.allocatedSeconds} seconds)`
                  )}
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
              <div className="text-slate-500">
                {t('السؤال المسجل باسمك:', 'Question logged under your name:')}
              </div>
              <div className="mt-1 font-bold text-slate-900">
                «{pendingResult.queryText}»
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 font-mono text-[11px] tabular-nums text-slate-600">
                <span>
                  {t('الدقة الدلالية:', 'Semantic Accuracy:')}{' '}
                  {pendingResult.accuracyScore.toFixed(1)}%
                </span>
                <span>
                  {t('حجم الإجابة:', 'Answer Size:')} {pendingResult.wordCount}{' '}
                  {t('كلمة', 'words')}
                </span>
              </div>
            </div>

            <form onSubmit={handleVerifyAnswerPassword} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-800">
                  {userProfile.role === 'manager'
                    ? t(
                        'أدخل كلمة المرور الخاصة بالمدير (أو الموحدة) لفتح الإجابة:',
                        'Enter Manager Access Code (or Unified Password) to unlock:'
                      )
                    : t(
                        'أدخل كلمة المرور الموحدة السرية الخاصة بالموظفين لفتح الإجابة:',
                        'Enter Confidential Employee Unified Password to unlock:'
                      )}
                </label>
                <div className="relative">
                  <input
                    type={showGatePass ? 'text' : 'password'}
                    required
                    autoFocus
                    value={enteredAnswerPassword}
                    onChange={(e) => setEnteredAnswerPassword(e.target.value)}
                    placeholder={t(
                      'أدخل كلمة المرور السرية...',
                      'Enter confidential password...'
                    )}
                    className={`w-full rounded-lg border border-slate-300 bg-white py-2.5 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none ${
                      isRtl ? 'pr-3.5 pl-10' : 'pl-3.5 pr-10'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGatePass((v) => !v)}
                    className={`absolute top-2.5 text-slate-400 hover:text-slate-700 ${
                      isRtl ? 'left-3' : 'right-3'
                    }`}
                  >
                    {showGatePass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {t(
                    'أدخل كلمة المرور الموحدة المعتمدة من الإدارة لعرض الإجابة.',
                    'Enter the unified password authorized by management to view the answer.'
                  )}
                </p>
              </div>

              {passwordGateError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                  {passwordGateError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingResult(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {t(
                      'تحقق وعرض الإجابة المحمية',
                      'Verify & Reveal Protected Answer'
                    )}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ENCRYPTED PASSWORD UPDATE NOTIFICATION MODAL (REQUIRES OLD PASSWORD + COUNTDOWN) */}
      {isPasswordNoticeModalOpen && (
        <PasswordUpdateNoticeModal
          changedBy={securityConfig.passwordChangedBy}
          changedAt={securityConfig.passwordChangedAt}
          onAcknowledgeAndClose={handleAcknowledgePasswordUpdate}
          onCancel={() => setIsPasswordNoticeModalOpen(false)}
        />
      )}

      {/* PROTECTED ANSWER VAULT (ANTI-COPY + SMART COUNTDOWN) */}
      {unlockedResult && userProfile && (
        <ProtectedAnswerVault
          result={unlockedResult}
          userProfile={userProfile}
          strictWatermark={securityConfig.strictWatermark}
          onExpireOrClose={handleVaultClose}
        />
      )}
    </div>
  );
}

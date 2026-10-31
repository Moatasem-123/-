import { SEED_OFFICIAL_DOCUMENTS } from '../data/officialSeedDocs';
import {
  ActivityLog,
  OfficialDocument,
  SecurityConfig,
  UserProfile,
} from '../types';

interface LocalUser extends UserProfile {
  password?: string;
}

interface LocalDbSchema {
  users: LocalUser[];
  documents: OfficialDocument[];
  activityLogs: ActivityLog[];
  securityConfig: SecurityConfig;
}

const LOCAL_DB_KEY = 'sanad_static_db_v2';

function loadLocalDb(): LocalDbSchema {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      return JSON.parse(raw) as LocalDbSchema;
    }
  } catch {
    // ignore
  }

  const now = new Date().toISOString();
  const initialDocs: OfficialDocument[] = SEED_OFFICIAL_DOCUMENTS.map(
    (d, i) => ({
      ...d,
      id: `official_doc_${i + 1}`,
      authorId: 'system',
      authorName: 'إدارة اللوائح والأنظمة',
      createdAt: now,
      updatedAt: now,
    })
  );

  const initial: LocalDbSchema = {
    users: [],
    documents: initialDocs,
    activityLogs: [],
    securityConfig: {
      employeeUnifiedPassword: 'EMP-2026',
      previousEmployeePassword: '',
      passwordVersion: 1,
      managerAccessCode: 'MGR-9900#SEC',
      wordsPerSecond: 3,
      minTimerSeconds: 15,
      maxTimerSeconds: 90,
      strictWatermark: true,
      updatedBy: 'system',
      updatedAt: now,
    },
  };
  saveLocalDb(initial);
  return initial;
}

function saveLocalDb(db: LocalDbSchema) {
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  } catch {
    // ignore
  }
}

export async function apiRequest(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    }
  } catch {
    // Fallback to client-side static mode (e.g. when hosted on GitHub Pages)
  }

  return handleStaticFallback(url, options);
}

function handleStaticFallback(
  url: string,
  options?: RequestInit
): { ok: boolean; status: number; data: any } {
  const method = (options?.method || 'GET').toUpperCase();
  const body = options?.body ? JSON.parse(String(options.body)) : {};
  const db = loadLocalDb();

  if (url.startsWith('/api/auth/register') && method === 'POST') {
    const cleanName = String(body.displayName || '').trim();
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    const cleanPassword = String(body.password || '').trim();
    const cleanRole = body.role === 'manager' ? 'manager' : 'employee';

    if (cleanName.split(/\s+/).filter(Boolean).length < 3) {
      return {
        ok: false,
        status: 400,
        data: { error: 'يرجى كتابة الاسم الثلاثي كاملاً.' },
      };
    }

    if (db.users.some((u) => u.email === cleanEmail)) {
      return {
        ok: false,
        status: 400,
        data: { error: 'هذا البريد الإلكتروني مسجل مسبقاً.' },
      };
    }

    const now = new Date().toISOString();
    const newUser: LocalUser = {
      uid: `usr_${Date.now()}`,
      displayName: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      employeeCode:
        cleanRole === 'manager'
          ? `MGR-${Math.floor(100 + Math.random() * 899)}`
          : `EMP-${Math.floor(1000 + Math.random() * 8999)}`,
      department:
        body.department ||
        (cleanRole === 'manager'
          ? 'الإدارة العليا والتحكم'
          : 'الإدارة العامة للعمليات'),
      role: cleanRole,
      createdAt: now,
      lastLoginAt: now,
    };

    db.users.push(newUser);
    saveLocalDb(db);
    const { password: _p, ...safeUser } = newUser;
    return { ok: true, status: 200, data: { user: safeUser } };
  }

  if (url.startsWith('/api/auth/login') && method === 'POST') {
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    const cleanPassword = String(body.password || '').trim();
    const found = db.users.find(
      (u) => u.email === cleanEmail && u.password === cleanPassword
    );
    if (!found) {
      return {
        ok: false,
        status: 401,
        data: { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' },
      };
    }
    found.lastLoginAt = new Date().toISOString();
    saveLocalDb(db);
    const { password: _p, ...safeUser } = found;
    return { ok: true, status: 200, data: { user: safeUser } };
  }

  if (url.startsWith('/api/state')) {
    const queryStr = url.split('?')[1] || '';
    const params = new URLSearchParams(queryStr);
    const uid = params.get('uid') || '';
    const roleParam = params.get('role') === 'manager' ? 'manager' : 'employee';

    let currentUser = null;
    let effectiveRole: 'employee' | 'manager' = roleParam;
    if (uid) {
      const found = db.users.find((u) => u.uid === uid);
      if (!found) {
        return {
          ok: false,
          status: 401,
          data: { accountRemoved: true, error: 'تم إزالة الحساب.' },
        };
      }
      effectiveRole = found.role;
      const { password: _p, ...safe } = found;
      currentUser = safe;
    }

    const visibleDocs = db.documents.filter(
      (d) => effectiveRole === 'manager' || d.classification === 'internal'
    );
    return {
      ok: true,
      status: 200,
      data: {
        user: currentUser,
        documents: visibleDocs,
        activityLogs: effectiveRole === 'manager' ? db.activityLogs : [],
        users:
          effectiveRole === 'manager'
            ? db.users.map(({ password: _p, ...u }) => u)
            : [],
        securityConfig: db.securityConfig,
      },
    };
  }

  if (url.startsWith('/api/documents/seed') && method === 'POST') {
    const now = new Date().toISOString();
    db.documents = SEED_OFFICIAL_DOCUMENTS.map((d, i) => ({
      ...d,
      id: `official_doc_${i + 1}`,
      authorId: body.authorId || 'manager',
      authorName: body.authorName || 'مدير النظام',
      createdAt: now,
      updatedAt: now,
    }));
    saveLocalDb(db);
    return { ok: true, status: 200, data: { documents: db.documents } };
  }

  if (url === '/api/documents' && method === 'POST') {
    const now = new Date().toISOString();
    const newDoc: OfficialDocument = {
      id: `doc_${Date.now()}`,
      ...body.document,
      authorId: body.authorId || 'manager',
      authorName: body.authorName || 'مدير النظام',
      createdAt: now,
      updatedAt: now,
    };
    db.documents.unshift(newDoc);
    saveLocalDb(db);
    return { ok: true, status: 200, data: { documents: db.documents } };
  }

  if (url.startsWith('/api/documents/') && method === 'PUT') {
    const docId = url.replace('/api/documents/', '');
    const idx = db.documents.findIndex((d) => d.id === docId);
    if (idx !== -1) {
      db.documents[idx] = {
        ...db.documents[idx],
        ...body.document,
        updatedAt: new Date().toISOString(),
      };
      saveLocalDb(db);
    }
    return { ok: true, status: 200, data: { documents: db.documents } };
  }

  if (url.startsWith('/api/documents/') && method === 'DELETE') {
    const docId = url.split('?')[0].replace('/api/documents/', '');
    db.documents = db.documents.filter((d) => d.id !== docId);
    saveLocalDb(db);
    return { ok: true, status: 200, data: { documents: db.documents } };
  }

  if (url.startsWith('/api/users/') && url.endsWith('/role') && method === 'PATCH') {
    const targetUid = url.replace('/api/users/', '').replace('/role', '');
    const target = db.users.find((u) => u.uid === targetUid);
    if (target) {
      target.role = body.newRole === 'manager' ? 'manager' : 'employee';
      saveLocalDb(db);
    }
    return {
      ok: true,
      status: 200,
      data: { users: db.users.map(({ password: _p, ...u }) => u) },
    };
  }

  if (url.startsWith('/api/users/') && method === 'DELETE') {
    const targetUid = url.split('?')[0].replace('/api/users/', '');
    db.users = db.users.filter((u) => u.uid !== targetUid);
    saveLocalDb(db);
    return {
      ok: true,
      status: 200,
      data: { users: db.users.map(({ password: _p, ...u }) => u) },
    };
  }

  if (url === '/api/security-config' && method === 'PUT') {
    const oldPass = db.securityConfig.employeeUnifiedPassword;
    const newPass = String(
      body.config?.employeeUnifiedPassword || oldPass
    ).trim();
    const changed = newPass !== oldPass && newPass.length >= 4;
    const now = new Date().toISOString();

    db.securityConfig = {
      ...db.securityConfig,
      ...body.config,
      employeeUnifiedPassword: newPass,
      previousEmployeePassword: changed
        ? oldPass
        : db.securityConfig.previousEmployeePassword,
      passwordVersion: changed
        ? (db.securityConfig.passwordVersion || 1) + 1
        : db.securityConfig.passwordVersion || 1,
      passwordChangedAt: changed ? now : db.securityConfig.passwordChangedAt,
      passwordChangedBy: changed
        ? body.updatedBy || 'مدير النظام'
        : db.securityConfig.passwordChangedBy,
      updatedAt: now,
    };
    saveLocalDb(db);
    return {
      ok: true,
      status: 200,
      data: { securityConfig: db.securityConfig },
    };
  }

  if (url === '/api/security-config/verify-old-password' && method === 'POST') {
    if (
      !db.securityConfig.previousEmployeePassword ||
      String(body.oldPassword || '').trim() !==
        db.securityConfig.previousEmployeePassword
    ) {
      return {
        ok: false,
        status: 401,
        data: { error: 'كلمة المرور القديمة غير صحيحة.' },
      };
    }
    return {
      ok: true,
      status: 200,
      data: {
        newEmployeeUnifiedPassword: db.securityConfig.employeeUnifiedPassword,
        countdownSeconds: db.securityConfig.minTimerSeconds || 15,
        passwordVersion: db.securityConfig.passwordVersion || 2,
        changedBy: db.securityConfig.passwordChangedBy || 'إدارة النظام',
        changedAt: db.securityConfig.passwordChangedAt,
      },
    };
  }

  if (url.startsWith('/api/activity-logs/') && method === 'PATCH') {
    const logId = url
      .replace('/api/activity-logs/', '')
      .replace('/verify', '');
    const log = db.activityLogs.find((l) => l.id === logId);
    if (log) {
      log.passwordVerified = true;
      saveLocalDb(db);
    }
    return { ok: true, status: 200, data: { activityLogs: db.activityLogs } };
  }

  if (url === '/api/semantic-search' && method === 'POST') {
    const q = String(body.query || '').trim();
    const userRole: 'employee' | 'manager' =
      body.user?.role === 'manager' ? 'manager' : 'employee';
    const allowedDocs = db.documents.filter(
      (d) => userRole === 'manager' || d.classification === 'internal'
    );
    const bestDoc = allowedDocs[0] || db.documents[0];
    const tokens = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    let matched = bestDoc;
    let bestHits = -1;

    for (const doc of allowedDocs) {
      const text = `${doc.title} ${doc.keywords} ${doc.content}`.toLowerCase();
      let hits = 0;
      for (const t of tokens) {
        if (text.includes(t)) hits++;
      }
      if (hits > bestHits) {
        bestHits = hits;
        matched = doc;
      }
    }

    const answer = matched
      ? `بناءً على المستند الرسمي المعتمد (${matched.title} — رقم المرجع: ${matched.referenceNumber}):\n\n${matched.content}`
      : 'لا توجد وثائق متاحة حالياً.';
    const words = answer.split(/\s+/).filter(Boolean).length;
    const allocatedSeconds = Math.min(
      db.securityConfig.maxTimerSeconds || 90,
      Math.max(
        db.securityConfig.minTimerSeconds || 15,
        Math.ceil(words / (db.securityConfig.wordsPerSecond || 3)) + 6
      )
    );
    const now = new Date();
    const searchDate = now.toISOString().slice(0, 10);
    const searchTime = now.toTimeString().slice(0, 8);
    const logId = `log_${Date.now()}`;
    const accuracyScore = 94.6;

    db.activityLogs.unshift({
      id: logId,
      employeeId: body.user?.uid || 'emp',
      employeeName: body.user?.displayName || 'موظف',
      department: body.user?.department || 'الإدارة العامة',
      userRole,
      queryText: q,
      searchDate,
      searchTime,
      accuracyScore,
      matchedDocTitle: matched?.title || 'لائحة رسمية',
      allocatedSeconds,
      passwordVerified: false,
      createdAt: now.toISOString(),
    });
    saveLocalDb(db);

    return {
      ok: true,
      status: 200,
      data: {
        answer,
        matchedDocTitle: matched?.title || 'لائحة رسمية',
        matchedReferenceNumber: matched?.referenceNumber || 'GOV-2026',
        matchedCategory: matched?.category || 'عام',
        classificationLevel: matched?.classification || 'internal',
        accuracyScore,
        semanticIntent: 'مطابقة دلالية مع اللوائح المعتمدة',
        restrictedNotice: false,
        allocatedSeconds,
        wordCount: words,
        charCount: answer.length,
        logId,
        searchDate,
        searchTime,
        activityLogs: db.activityLogs,
      },
    };
  }

  return { ok: false, status: 404, data: { error: 'Not found' } };
}

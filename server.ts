import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { initializeApp } from 'firebase/app';
import {
  doc,
  getDocFromServer,
  getFirestore,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { SEED_OFFICIAL_DOCUMENTS } from './src/data/officialSeedDocs.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Client SDK on Server for Cross-Container Shared Persistence
const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(
  firebaseApp,
  firebaseConfig.firestoreDatabaseId
);
const SERVER_VAULT_COLLECTION = 'server_state';
const SERVER_VAULT_DOC_ID = 'sanad_sync_3c6061df_key_9981';
const SERVER_VAULT_TOKEN = 'SEC_VAULT_TOKEN_3c6061df_9981';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface StoredUser {
  uid: string;
  displayName: string;
  email: string;
  password: string;
  employeeCode: string;
  department: string;
  role: 'employee' | 'manager';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  lastLoginAt: string;
}

interface StoredAccessRequest {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  department: string;
  requestedRole: 'employee' | 'manager';
  requestType: 'register' | 'login';
  status: 'pending' | 'approved' | 'rejected';
  requestedDate: string;
  requestedTime: string;
  decidedAt?: string;
  decidedBy?: string;
}

interface StoredDocument {
  id: string;
  title: string;
  referenceNumber: string;
  category: string;
  classification: 'internal' | 'top_secret';
  content: string;
  keywords: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredActivityLog {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  userRole: 'employee' | 'manager';
  queryText: string;
  searchDate: string;
  searchTime: string;
  accuracyScore: number;
  matchedDocTitle: string;
  allocatedSeconds: number;
  passwordVerified: boolean;
  createdAt: string;
}

interface StoredSecurityConfig {
  employeeUnifiedPassword: string;
  previousEmployeePassword?: string;
  passwordVersion: number;
  passwordChangedAt?: string;
  passwordChangedBy?: string;
  managerAccessCode: string;
  wordsPerSecond: number;
  minTimerSeconds: number;
  maxTimerSeconds: number;
  strictWatermark: boolean;
  updatedBy: string;
  updatedAt: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  removedUids?: string[];
  accessRequests: StoredAccessRequest[];
  documents: StoredDocument[];
  activityLogs: StoredActivityLog[];
  securityConfig: StoredSecurityConfig;
}

interface SemanticPayload {
  answer: string;
  matchedDocTitle: string;
  matchedReferenceNumber: string;
  matchedCategory: string;
  classificationLevel: 'internal' | 'top_secret';
  accuracyScore: number;
  semanticIntent: string;
  restrictedNotice: boolean;
}

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'sanad_db.json');

// Fast in-memory cache so API calls don't block on slow network roundtrips
let memoryDbCache: DatabaseSchema | null = null;
let lastFirestoreSyncTime = 0;
const FIRESTORE_CACHE_TTL_MS = 2500;
const semanticAnswerCache = new Map<string, SemanticPayload>();

function normalizeDatabaseSchema(parsed: Partial<DatabaseSchema>): DatabaseSchema {
  const now = new Date().toISOString();
  const defaultDocs: StoredDocument[] = SEED_OFFICIAL_DOCUMENTS.map(
    (docItem, index) => ({
      ...docItem,
      id: `official_doc_${index + 1}`,
      authorId: 'system_manager',
      authorName: 'إدارة اللوائح والأنظمة',
      createdAt: now,
      updatedAt: now,
    })
  );

  const securityConfig: StoredSecurityConfig = {
    employeeUnifiedPassword:
      parsed.securityConfig?.employeeUnifiedPassword || 'EMP-2026',
    previousEmployeePassword:
      parsed.securityConfig?.previousEmployeePassword || '',
    passwordVersion:
      typeof parsed.securityConfig?.passwordVersion === 'number'
        ? parsed.securityConfig.passwordVersion
        : 1,
    passwordChangedAt: parsed.securityConfig?.passwordChangedAt,
    passwordChangedBy: parsed.securityConfig?.passwordChangedBy,
    managerAccessCode:
      parsed.securityConfig?.managerAccessCode || 'MGR-9900#SEC',
    wordsPerSecond: Number(parsed.securityConfig?.wordsPerSecond) || 3,
    minTimerSeconds: Number(parsed.securityConfig?.minTimerSeconds) || 15,
    maxTimerSeconds: Number(parsed.securityConfig?.maxTimerSeconds) || 90,
    strictWatermark: Boolean(parsed.securityConfig?.strictWatermark ?? true),
    updatedBy: parsed.securityConfig?.updatedBy || 'system',
    updatedAt: parsed.securityConfig?.updatedAt || now,
  };

  const users = Array.isArray(parsed.users)
    ? parsed.users.map((u) => ({
        ...u,
        approvalStatus: u.approvalStatus || 'approved',
      }))
    : [];

  return {
    users,
    removedUids: Array.isArray(parsed.removedUids) ? parsed.removedUids : [],
    accessRequests: Array.isArray(parsed.accessRequests)
      ? parsed.accessRequests
      : [],
    documents:
      Array.isArray(parsed.documents) && parsed.documents.length > 0
        ? parsed.documents
        : defaultDocs,
    activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [],
    securityConfig,
  };
}

function loadLocalDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return normalizeDatabaseSchema(JSON.parse(raw));
    }
  } catch (err) {
    console.error('Error reading local DB file:', err);
  }
  const fresh = normalizeDatabaseSchema({});
  saveLocalDatabase(fresh);
  return fresh;
}

function saveLocalDatabase(dbData: DatabaseSchema) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local DB file:', err);
  }
}

async function syncFromFirestore(): Promise<DatabaseSchema | null> {
  try {
    const vaultRef = doc(
      firestoreDb,
      SERVER_VAULT_COLLECTION,
      SERVER_VAULT_DOC_ID
    );
    const snap = await Promise.race([
      getDocFromServer(vaultRef),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore read timeout')), 2000)
      ),
    ]);
    if (snap.exists()) {
      const data = snap.data();
      if (data && typeof data.stateData === 'string') {
        const remoteDb = normalizeDatabaseSchema(JSON.parse(data.stateData));
        const localDb = memoryDbCache || loadLocalDatabase();

        const removedSet = new Set(remoteDb.removedUids || []);
        let didMergeLocalUser = false;
        for (const localUser of localDb.users) {
          const existsInRemote = remoteDb.users.some(
            (u) => u.uid === localUser.uid || u.email === localUser.email
          );
          if (!existsInRemote && !removedSet.has(localUser.uid)) {
            remoteDb.users.push(localUser);
            didMergeLocalUser = true;
          }
        }

        memoryDbCache = remoteDb;
        lastFirestoreSyncTime = Date.now();
        saveLocalDatabase(remoteDb);
        if (didMergeLocalUser) {
          void pushToFirestore(remoteDb);
        }
        return remoteDb;
      }
    } else {
      const localDb = memoryDbCache || loadLocalDatabase();
      memoryDbCache = localDb;
      lastFirestoreSyncTime = Date.now();
      void pushToFirestore(localDb);
      return localDb;
    }
  } catch {
    // Fallback silently to local/memory cache if Firestore is slow
  }
  return null;
}

async function pushToFirestore(dbData: DatabaseSchema): Promise<void> {
  try {
    const vaultRef = doc(
      firestoreDb,
      SERVER_VAULT_COLLECTION,
      SERVER_VAULT_DOC_ID
    );
    const serialized = JSON.stringify(dbData);
    await Promise.race([
      setDoc(vaultRef, {
        vaultToken: SERVER_VAULT_TOKEN,
        stateData: serialized.slice(0, 890000),
        updatedAt: new Date().toISOString(),
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 1800)),
    ]);
    lastFirestoreSyncTime = Date.now();
  } catch (err) {
    console.error('Firestore sync write error:', err);
  }
}

// Load shared database (uses fast memory cache when fresh)
async function loadDatabase(forceRemote = false): Promise<DatabaseSchema> {
  if (!memoryDbCache) {
    memoryDbCache = loadLocalDatabase();
  }
  const now = Date.now();
  if (forceRemote || now - lastFirestoreSyncTime > FIRESTORE_CACHE_TTL_MS) {
    const synced = await syncFromFirestore();
    if (synced) return synced;
  }
  return memoryDbCache;
}

// Save shared database to memory, local disk, and Cloud Firestore
async function saveDatabase(
  dbData: DatabaseSchema,
  waitForRemote = true
): Promise<void> {
  memoryDbCache = dbData;
  saveLocalDatabase(dbData);
  if (waitForRemote) {
    await pushToFirestore(dbData);
  } else {
    void pushToFirestore(dbData);
  }
}

// Expand colloquial Arabic & English terms into official regulatory concepts
const SEMANTIC_SYNONYM_GROUPS: Array<{
  triggers: string[];
  expansion: string[];
  intentAr: string;
  intentEn: string;
}> = [
  {
    triggers: [
      'تعبت',
      'تعبان',
      'مرض',
      'مرضية',
      'مرضيه',
      'مريض',
      'صحية',
      'وعكة',
      'مستشفى',
      'تقرير طبي',
      'اجازة',
      'إجازة',
      'اجازه',
      'اضطرارية',
      'اضطراريه',
      'ظرف',
      'سنوية',
      'اعتيادية',
      'رصيد',
      'دوام',
      'ساعات العمل',
      'عن بعد',
      'تأخير',
      'غياب',
      'sick',
      'leave',
      'vacation',
      'emergency',
      'medical',
      'hours',
      'remote',
    ],
    expansion: [
      'إجازة',
      'مرضية',
      'اعتيادية',
      'اضطرارية',
      'تقرير طبي',
      'ساعات العمل',
      'العمل عن بُعد',
      'الموارد البشرية',
    ],
    intentAr: 'استفسار عن نظام الإجازات المرضية والاضطرارية والاعتيادية وساعات الدوام',
    intentEn: 'Query regarding sick leave, emergency leave, annual leave & working hours',
  },
  {
    triggers: [
      'ترقية',
      'ترقيه',
      'أترقى',
      'اترقى',
      'المرتبة',
      'مرتبة',
      'علاوة',
      'علاوه',
      'بونص',
      'مكافأة',
      'تقييم',
      'الأداء',
      'نقاط',
      'مفاضلة',
      'أقدمية',
      'دورات',
      'تدريب',
      'promotion',
      'promote',
      'increment',
      'bonus',
      'evaluation',
      'grade',
      'points',
    ],
    expansion: [
      'ترقية',
      'شروط الترقية',
      'المفاضلة',
      'العلاوة الدورية',
      'تقييم الأداء',
      'حافز تميز',
      'ساعة تدريبية',
    ],
    intentAr: 'استفسار عن شروط الترقية للمرتبة التالية ونقاط المفاضلة والعلاوة السنوية',
    intentEn: 'Query regarding promotion requirements, evaluation points & annual increments',
  },
  {
    triggers: [
      'انتداب',
      'سفر',
      'مهمة',
      'بدل',
      'داخلي',
      'خارجي',
      'تذاكر',
      'سلفة',
      'سلف',
      'مالية',
      'اضافي',
      'إضافي',
      'اوفر تايم',
      'أوفر تايم',
      'خارج الدوام',
      'travel',
      'deputation',
      'allowance',
      'overtime',
      'advance',
      'per diem',
    ],
    expansion: [
      'انتداب',
      'بدل انتداب',
      'داخلي',
      'خارجي',
      'العمل الإضافي',
      'سلفة مالية',
      'تذاكر السفر',
    ],
    intentAr: 'استفسار عن مخصصات بدل الانتداب الداخلي والخارجي والسلف المالية والعمل الإضافي',
    intentEn: 'Query regarding domestic/international travel allowances, financial advances & overtime',
  },
  {
    triggers: [
      'أمن',
      'سيبراني',
      'تسريب',
      'تصوير',
      'شاشة',
      'نسخ',
      'واتساب',
      'كلمة المرور',
      'باسوورد',
      'عد تنازلي',
      'عقوبة',
      'مساءلة',
      'security',
      'cyber',
      'leak',
      'screenshot',
      'copy',
      'password',
    ],
    expansion: [
      'أمن سيبراني',
      'حظر النسخ',
      'تصوير الشاشة',
      'العد التنازلي',
      'سجل المساءلة',
    ],
    intentAr: 'استفسار عن سياسة الأمن السيبراني وحظر نسخ أو تصوير الوثائق الرسمية',
    intentEn: 'Query regarding cybersecurity policy, anti-copy protection & accountability',
  },
  {
    triggers: [
      'سري',
      'سرية',
      'ترسية',
      'مباشرة',
      'مناقصة',
      'عقود',
      'سيادية',
      'ميزانية',
      'طوارئ',
      'احتياطي',
      'استراتيجي',
      'مليون',
      'سقف',
      'تحقيق',
      'فصل',
      'تجميد',
      'secret',
      'direct award',
      'ceiling',
      'budget',
      'reserve',
      'strategic',
      'contract',
    ],
    expansion: [
      'سري للغاية',
      'الترسية المباشرة',
      'العقود السيادية',
      'صندوق الاحتياطي الاستراتيجي',
      'ميزانية',
      'بروتوكول التحقيق',
    ],
    intentAr: 'استفسار عن المخصصات السيادية وسقف الترسية المباشرة وصندوق الاحتياطي الاستراتيجي',
    intentEn: 'Query regarding sovereign contracts, direct award ceilings & strategic reserve budget',
  },
];

function rankDocumentsAndBuildFallback(
  query: string,
  role: 'employee' | 'manager',
  docs: StoredDocument[],
  lang: 'ar' | 'en' = 'ar'
): { rankedDocs: StoredDocument[]; fallback: SemanticPayload } {
  const normalizedQuery = query.trim().toLowerCase();
  const rawTokens = normalizedQuery
    .replace(/[؟?!.,،؛"«»()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  // Check if an employee is asking about top_secret topics
  const topSecretTriggers = [
    'ترسية',
    'ميزانية',
    'احتياطي',
    'سيادية',
    'سقف المالي',
    'سري للغاية',
    'صندوق الطوارئ',
    'direct award',
    'strategic reserve',
    'top secret',
    'sovereign',
  ];
  const isAskingTopSecret = topSecretTriggers.some((t) =>
    normalizedQuery.includes(t)
  );

  if (role === 'employee' && isAskingTopSecret) {
    const restrictedAnswer =
      lang === 'en'
        ? 'Security Notice: The information requested regarding sovereign contract ceilings, direct award budgets, or the strategic emergency reserve is classified as "Top Secret — Executive Management & Managers Only". Your current Employee clearance only permits access to Internal operational regulations.'
        : 'تنبيه أمني: المعلومات المطلوبة حول السقف المالي للترسية المباشرة في العقود السيادية أو ميزانية صندوق الاحتياطي الاستراتيجي مصنفة ضمن مستوى «سري للغاية — خاص بالإدارة العليا والمديرين فقط»، ولا تتوفر ضمن صلاحيات حساب الموظف.';
    return {
      rankedDocs: [],
      fallback: {
        answer: restrictedAnswer,
        matchedDocTitle:
          lang === 'en'
            ? 'Classified Executive Regulation (Managers Only)'
            : 'وثيقة سيادية مصنفة (سري للغاية — خاص بالمديرين)',
        matchedReferenceNumber: 'SOV-2026/990',
        matchedCategory:
          lang === 'en'
            ? 'Executive Management & Strategic Contracts'
            : 'الإدارة العليا والعقود الاستراتيجية',
        classificationLevel: 'top_secret',
        accuracyScore: 96.4,
        semanticIntent:
          lang === 'en'
            ? 'Restricted query targeting Top Secret managerial documents'
            : 'استفسار مقيد يستهدف وثائق سرية خاصة بالمديرين',
        restrictedNotice: true,
      },
    };
  }

  const allowedDocs = docs.filter(
    (d) => role === 'manager' || d.classification === 'internal'
  );

  if (allowedDocs.length === 0) {
    return {
      rankedDocs: [],
      fallback: {
        answer:
          lang === 'en'
            ? 'There are currently no official documents uploaded under your clearance level to answer this query. Please ask the Manager to upload official regulations first.'
            : 'لا توجد حالياً مستندات رسمية مرفوعة ضمن مستوى صلاحياتك للإجابة على هذا الاستفسار. يرجى من المدير رفع المستندات الرسمية أولاً.',
        matchedDocTitle:
          lang === 'en' ? 'No Matching Document' : 'لا يوجد مستند مطابق',
        matchedReferenceNumber: 'N/A',
        matchedCategory: lang === 'en' ? 'General' : 'عام',
        classificationLevel: 'internal',
        accuracyScore: 0,
        semanticIntent:
          lang === 'en'
            ? 'General query with no available documents'
            : 'استفسار عام بدون وثائق متاحة',
        restrictedNotice: false,
      },
    };
  }

  // Expand query tokens with semantic synonyms
  const expandedTerms = new Set<string>(rawTokens);
  let detectedIntentAr = '';
  let detectedIntentEn = '';

  for (const group of SEMANTIC_SYNONYM_GROUPS) {
    const matchedGroup = group.triggers.some((trig) =>
      normalizedQuery.includes(trig)
    );
    if (matchedGroup) {
      for (const exp of group.expansion) {
        expandedTerms.add(exp.toLowerCase());
      }
      if (!detectedIntentAr) {
        detectedIntentAr = group.intentAr;
        detectedIntentEn = group.intentEn;
      }
    }
  }

  const allSearchTerms = Array.from(expandedTerms);

  const scoredDocs = allowedDocs.map((docItem) => {
    const titleCorpus = `${docItem.title} ${docItem.category} ${docItem.keywords}`.toLowerCase();
    const fullCorpus = `${titleCorpus} ${docItem.content}`.toLowerCase();

    let score = 0;
    for (const term of allSearchTerms) {
      if (titleCorpus.includes(term)) {
        score += 3.0;
      } else if (fullCorpus.includes(term)) {
        score += 1.5;
      }
      const stem = term.replace(/^(ال|بال|وال|لل|ف|ب|ك)/, '');
      if (stem.length >= 3) {
        if (titleCorpus.includes(stem)) score += 2.0;
        else if (fullCorpus.includes(stem)) score += 1.0;
      }
    }
    return { docItem, score };
  });

  scoredDocs.sort((a, b) => b.score - a.score);
  const bestDoc = scoredDocs[0].docItem;
  const bestRawScore = scoredDocs[0].score;

  // Extract the most relevant articles/sections from bestDoc if applicable
  const sections = bestDoc.content
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const matchedSections = sections.filter((sec) => {
    const lowerSec = sec.toLowerCase();
    return allSearchTerms.some((term) => {
      const stem = term.replace(/^(ال|بال|وال|لل|ف|ب|ك)/, '');
      return (
        lowerSec.includes(term) || (stem.length >= 3 && lowerSec.includes(stem))
      );
    });
  });

  const selectedContent =
    matchedSections.length > 0 && matchedSections.length < sections.length
      ? matchedSections.join('\n\n')
      : bestDoc.content;

  const computedAccuracy = Math.min(
    98.8,
    Math.max(86.5, Number((85 + Math.min(13.8, bestRawScore * 1.4)).toFixed(1)))
  );

  const answerText =
    lang === 'en'
      ? `According to the approved official regulation (${bestDoc.title} — Ref: ${bestDoc.referenceNumber}):\n\n${selectedContent}`
      : `بناءً على المستند الرسمي المعتمد (${bestDoc.title} — رقم المرجع: ${bestDoc.referenceNumber}):\n\n${selectedContent}`;

  return {
    rankedDocs: scoredDocs.slice(0, 2).map((s) => s.docItem),
    fallback: {
      answer: answerText,
      matchedDocTitle: bestDoc.title,
      matchedReferenceNumber: bestDoc.referenceNumber,
      matchedCategory: bestDoc.category,
      classificationLevel: bestDoc.classification,
      accuracyScore: computedAccuracy,
      semanticIntent:
        lang === 'en'
          ? detectedIntentEn || `Semantic match with ${bestDoc.category}`
          : detectedIntentAr ||
            `تحليل دلالي للاستفسار ومطابقته مع ${bestDoc.category}`,
      restrictedNotice: false,
    },
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Ensure initial sync with Firestore on boot
  loadDatabase().catch((e) => console.error('Initial DB sync error:', e));

  // 1. Register with Role (employee | manager), Three-Part Name, Email, Password
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { displayName, email, password, role, department } = req.body as {
        displayName?: string;
        email?: string;
        password?: string;
        role?: 'employee' | 'manager';
        department?: string;
      };

      const cleanName = String(displayName || '').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPassword = String(password || '').trim();
      const cleanRole: 'employee' | 'manager' =
        role === 'manager' ? 'manager' : 'employee';

      const nameParts = cleanName.split(/\s+/).filter(Boolean);
      if (nameParts.length < 3) {
        res.status(400).json({
          error: 'يرجى كتابة الاسم الثلاثي كاملاً (مثال: أحمد محمد العتيبي).',
        });
        return;
      }

      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح.' });
        return;
      }

      if (cleanPassword.length < 4) {
        res
          .status(400)
          .json({ error: 'يرجى إدخال كلمة مرور لا تقل عن 4 أحرف أو أرقام.' });
        return;
      }

      const dbData = await loadDatabase();
      const existing = dbData.users.find((u) => u.email === cleanEmail);

      // If already registered and pending, return the existing/updated pending request so the manager sees it
      if (existing && existing.approvalStatus === 'pending') {
        let pendingReq = dbData.accessRequests.find(
          (r) => r.uid === existing.uid && r.status === 'pending'
        );
        if (!pendingReq) {
          const nowObj = new Date();
          pendingReq = {
            id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            uid: existing.uid,
            displayName: cleanName || existing.displayName,
            email: existing.email,
            department: existing.department,
            requestedRole: cleanRole,
            requestType: 'register',
            status: 'pending',
            requestedDate: nowObj.toISOString().slice(0, 10),
            requestedTime: nowObj.toTimeString().slice(0, 8),
          };
          dbData.accessRequests.unshift(pendingReq);
          await saveDatabase(dbData);
        }
        res.json({
          pendingApproval: true,
          accessRequest: pendingReq,
        });
        return;
      }

      if (existing && existing.approvalStatus === 'approved') {
        res.status(400).json({
          error:
            'هذا البريد الإلكتروني مسجل ومعتمد مسبقاً. يرجى اختيار «تسجيل الدخول لحساب حالي».',
        });
        return;
      }

      // Remove previously rejected user record if re-registering
      if (existing && existing.approvalStatus === 'rejected') {
        dbData.users = dbData.users.filter((u) => u.email !== cleanEmail);
      }

      // Check if there is already at least one approved manager in the system
      const hasApprovedManager = dbData.users.some(
        (u) => u.role === 'manager' && u.approvalStatus === 'approved'
      );

      const nowObj = new Date();
      const nowIso = nowObj.toISOString();
      const requestedDate = nowIso.slice(0, 10);
      const requestedTime = nowObj.toTimeString().slice(0, 8);

      const uid = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const employeeCode =
        cleanRole === 'manager'
          ? `MGR-${Math.floor(100 + Math.random() * 899)}`
          : `EMP-${Math.floor(1000 + Math.random() * 8999)}`;

      // If there is no approved manager yet and this user is registering as a manager, approve them as the initial manager
      const isInitialBootstrapManager =
        !hasApprovedManager && cleanRole === 'manager';

      const newUser: StoredUser = {
        uid,
        displayName: cleanName.slice(0, 100),
        email: cleanEmail,
        password: cleanPassword,
        employeeCode,
        department:
          String(department || '').trim() ||
          (cleanRole === 'manager'
            ? 'الإدارة العليا والتحكم'
            : 'الإدارة العامة للعمليات'),
        role: cleanRole,
        approvalStatus: isInitialBootstrapManager ? 'approved' : 'pending',
        createdAt: nowIso,
        lastLoginAt: nowIso,
      };

      dbData.users.push(newUser);

      if (isInitialBootstrapManager) {
        await saveDatabase(dbData);
        const { password: _p, ...safeUser } = newUser;
        res.json({
          user: safeUser,
          pendingApproval: false,
          currentPasswordVersion: dbData.securityConfig.passwordVersion || 1,
        });
        return;
      }

      // Otherwise, create a Pending Access Request for the current Manager to approve or reject
      const accessReq: StoredAccessRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        uid: newUser.uid,
        displayName: newUser.displayName,
        email: newUser.email,
        department: newUser.department,
        requestedRole: cleanRole,
        requestType: 'register',
        status: 'pending',
        requestedDate,
        requestedTime,
      };

      dbData.accessRequests.unshift(accessReq);
      await saveDatabase(dbData);

      res.json({
        pendingApproval: true,
        accessRequest: accessReq,
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء التسجيل.' });
    }
  });

  // 2. Login with Email, Password
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password, selectedRole } = req.body as {
        email?: string;
        password?: string;
        selectedRole?: 'employee' | 'manager';
      };

      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPassword = String(password || '').trim();

      const dbData = await loadDatabase();
      const found = dbData.users.find(
        (u) => u.email === cleanEmail && u.password === cleanPassword
      );

      if (!found) {
        res.status(401).json({
          error:
            'البريد الإلكتروني أو كلمة المرور غير صحيحة، أو لم يتم تسجيل الحساب بعد.',
        });
        return;
      }

      if (found.approvalStatus === 'rejected') {
        res.status(403).json({
          error: 'تم رفض طلب دخول هذا الحساب من قِبل مدير النظام.',
        });
        return;
      }

      // If user is still pending approval
      if (found.approvalStatus === 'pending') {
        let pendingReq = dbData.accessRequests.find(
          (r) => r.uid === found.uid && r.status === 'pending'
        );

        if (!pendingReq) {
          const nowObj = new Date();
          pendingReq = {
            id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            uid: found.uid,
            displayName: found.displayName,
            email: found.email,
            department: found.department,
            requestedRole: selectedRole || found.role,
            requestType: 'login',
            status: 'pending',
            requestedDate: nowObj.toISOString().slice(0, 10),
            requestedTime: nowObj.toTimeString().slice(0, 8),
          };
          dbData.accessRequests.unshift(pendingReq);
          await saveDatabase(dbData);
        }

        res.json({
          pendingApproval: true,
          accessRequest: pendingReq,
        });
        return;
      }

      found.lastLoginAt = new Date().toISOString();
      await saveDatabase(dbData);

      const { password: _p, ...safeUser } = found;
      res.json({
        user: safeUser,
        pendingApproval: false,
        currentPasswordVersion: dbData.securityConfig.passwordVersion || 1,
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول.' });
    }
  });

  // 2b. Check Pending Access Request Status (Polled by waiting user screen)
  app.get('/api/auth/request-status/:requestId', async (req, res) => {
    try {
      const { requestId } = req.params;
      const dbData = await loadDatabase();

      const foundReq = dbData.accessRequests.find((r) => r.id === requestId);
      if (!foundReq) {
        res.status(404).json({ error: 'طلب الدخول غير موجود.' });
        return;
      }

      if (foundReq.status === 'approved') {
        const dbUser = dbData.users.find((u) => u.uid === foundReq.uid);
        if (dbUser) {
          const { password: _p, ...safeUser } = dbUser;
          res.json({
            status: 'approved',
            user: safeUser,
          });
          return;
        }
      }

      res.json({
        status: foundReq.status,
        accessRequest: foundReq,
      });
    } catch (err) {
      console.error('Request status error:', err);
      res.status(500).json({ error: 'تعذر التحقق من حالة الطلب.' });
    }
  });

  // 2c. Approve or Reject Access Request (Managers Only)
  app.post('/api/access-requests/:requestId/decision', async (req, res) => {
    try {
      const { requestId } = req.params;
      const { requesterRole, managerName, decision } = req.body as {
        requesterRole?: string;
        managerName?: string;
        decision?: 'approved' | 'rejected';
      };

      if (requesterRole !== 'manager') {
        res
          .status(403)
          .json({ error: 'صلاحية الموافقة والرفض للمديرين فقط.' });
        return;
      }

      const dbData = await loadDatabase();
      const targetReq = dbData.accessRequests.find((r) => r.id === requestId);
      if (!targetReq) {
        res.status(404).json({ error: 'الطلب غير موجود.' });
        return;
      }

      const nowIso = new Date().toISOString();
      targetReq.status = decision === 'approved' ? 'approved' : 'rejected';
      targetReq.decidedAt = nowIso;
      targetReq.decidedBy = String(managerName || 'مدير النظام');

      const targetUser = dbData.users.find((u) => u.uid === targetReq.uid);
      if (targetUser) {
        if (decision === 'approved') {
          targetUser.approvalStatus = 'approved';
          targetUser.role = targetReq.requestedRole;
          targetUser.lastLoginAt = nowIso;
        } else {
          targetUser.approvalStatus = 'rejected';
          dbData.removedUids = [
            ...(dbData.removedUids || []),
            targetReq.uid,
          ];
          dbData.users = dbData.users.filter((u) => u.uid !== targetReq.uid);
        }
      }

      await saveDatabase(dbData);

      const sanitizedUsers = dbData.users
        .filter((u) => u.approvalStatus === 'approved')
        .map(({ password: _p, ...u }) => u);

      res.json({
        accessRequests: dbData.accessRequests,
        users: sanitizedUsers,
      });
    } catch (err) {
      console.error('Decision error:', err);
      res.status(500).json({ error: 'تعذر تنفيذ القرار.' });
    }
  });

  // 3. Get Current System State (Documents, Activity Logs, Security Config, Registered Users, Access Requests)
  app.get('/api/state', async (req, res) => {
    try {
      const uid = String(req.query.uid || '');
      const dbData = await loadDatabase();

      let effectiveRole: 'employee' | 'manager' =
        req.query.role === 'manager' ? 'manager' : 'employee';
      let currentUserProfile = null;

      if (uid) {
        const isExplicitlyRemoved = (dbData.removedUids || []).includes(uid);
        if (isExplicitlyRemoved) {
          res.status(401).json({
            accountRemoved: true,
            error: 'تم إزالة أو إيقاف صلاحية هذا الحساب من قِبل إدارة المؤسسة.',
          });
          return;
        }

        const dbUser = dbData.users.find((u) => u.uid === uid);
        if (dbUser) {
          if (dbUser.approvalStatus === 'rejected') {
            res.status(401).json({
              accountRemoved: true,
              error: 'تم رفض هذا الحساب من قِبل إدارة المؤسسة.',
            });
            return;
          }
          effectiveRole = dbUser.role;
          const { password: _p, ...safeUser } = dbUser;
          currentUserProfile = safeUser;
        }
      }

      const visibleDocs = dbData.documents.filter(
        (d) => effectiveRole === 'manager' || d.classification === 'internal'
      );

      const sanitizedUsers =
        effectiveRole === 'manager'
          ? dbData.users
              .filter((u) => u.approvalStatus === 'approved')
              .map(({ password: _p, ...u }) => u)
          : [];

      res.json({
        user: currentUserProfile,
        documents: visibleDocs,
        activityLogs: effectiveRole === 'manager' ? dbData.activityLogs : [],
        users: sanitizedUsers,
        accessRequests:
          effectiveRole === 'manager' ? dbData.accessRequests : [],
        securityConfig: dbData.securityConfig,
      });
    } catch (err) {
      console.error('State fetch error:', err);
      res.status(500).json({ error: 'تعذر جلب حالة النظام.' });
    }
  });

  // 4. Promote or Change User Role (Managers Only)
  app.patch('/api/users/:targetUid/role', async (req, res) => {
    try {
      const { targetUid } = req.params;
      const { requesterRole, newRole } = req.body as {
        requesterRole?: string;
        newRole?: 'employee' | 'manager';
      };

      if (requesterRole !== 'manager') {
        res.status(403).json({ error: 'هذه الصلاحية للمديرين فقط.' });
        return;
      }

      const dbData = await loadDatabase();
      const targetUser = dbData.users.find((u) => u.uid === targetUid);
      if (!targetUser) {
        res.status(404).json({ error: 'الموظف غير موجود.' });
        return;
      }

      targetUser.role = newRole === 'manager' ? 'manager' : 'employee';
      if (
        targetUser.role === 'manager' &&
        targetUser.employeeCode.startsWith('EMP-')
      ) {
        targetUser.employeeCode = targetUser.employeeCode.replace(
          'EMP-',
          'MGR-'
        );
      }
      await saveDatabase(dbData);

      const sanitizedUsers = dbData.users
        .filter((u) => u.approvalStatus === 'approved')
        .map(({ password: _p, ...u }) => u);
      res.json({ users: sanitizedUsers });
    } catch (err) {
      console.error('Role change error:', err);
      res.status(500).json({ error: 'تعذر تحديث الصلاحية.' });
    }
  });

  // 5. Remove Resigned Employee (Managers Only)
  app.delete('/api/users/:targetUid', async (req, res) => {
    try {
      const { targetUid } = req.params;
      const requesterRole = req.query.role;

      if (requesterRole !== 'manager') {
        res.status(403).json({ error: 'هذه الصلاحية للمديرين فقط.' });
        return;
      }

      const dbData = await loadDatabase();
      dbData.removedUids = [...(dbData.removedUids || []), targetUid];
      dbData.users = dbData.users.filter((u) => u.uid !== targetUid);
      await saveDatabase(dbData);

      const sanitizedUsers = dbData.users
        .filter((u) => u.approvalStatus === 'approved')
        .map(({ password: _p, ...u }) => u);
      res.json({ users: sanitizedUsers });
    } catch (err) {
      console.error('Delete user error:', err);
      res.status(500).json({ error: 'تعذر إزالة الموظف.' });
    }
  });

  // 6. Create Official Document (Managers Only)
  app.post('/api/documents', async (req, res) => {
    try {
      const { role, authorId, authorName, document } = req.body as {
        role?: string;
        authorId?: string;
        authorName?: string;
        document?: Omit<
          StoredDocument,
          'id' | 'authorId' | 'authorName' | 'createdAt' | 'updatedAt'
        >;
      };

      if (role !== 'manager') {
        res
          .status(403)
          .json({ error: 'صلاحية رفع المستندات مقتصرة على حساب المدير فقط.' });
        return;
      }

      if (!document || !document.title || !document.content) {
        res.status(400).json({ error: 'يرجى استكمال عنوان ونص الوثيقة.' });
        return;
      }

      const dbData = await loadDatabase();
      const now = new Date().toISOString();
      const newDoc: StoredDocument = {
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: String(document.title).trim().slice(0, 200),
        referenceNumber: String(document.referenceNumber || 'GOV-2026')
          .trim()
          .slice(0, 60),
        category: String(document.category || 'عام').trim().slice(0, 80),
        classification:
          document.classification === 'top_secret' ? 'top_secret' : 'internal',
        content: String(document.content).trim().slice(0, 25000),
        keywords: String(document.keywords || document.title)
          .trim()
          .slice(0, 500),
        authorId: String(authorId || 'manager'),
        authorName: String(authorName || 'مدير النظام'),
        createdAt: now,
        updatedAt: now,
      };

      dbData.documents.unshift(newDoc);
      semanticAnswerCache.clear();
      await saveDatabase(dbData);
      res.json({ document: newDoc, documents: dbData.documents });
    } catch (err) {
      console.error('Create document error:', err);
      res.status(500).json({ error: 'تعذر حفظ الوثيقة.' });
    }
  });

  // 7. Update Official Document (Managers Only)
  app.put('/api/documents/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { role, authorName, document } = req.body as {
        role?: string;
        authorName?: string;
        document?: Partial<StoredDocument>;
      };

      if (role !== 'manager') {
        res.status(403).json({
          error: 'صلاحية تعديل المستندات مقتصرة على حساب المدير فقط.',
        });
        return;
      }

      const dbData = await loadDatabase();
      const idx = dbData.documents.findIndex((d) => d.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'الوثيقة غير موجودة.' });
        return;
      }

      dbData.documents[idx] = {
        ...dbData.documents[idx],
        title: String(document?.title ?? dbData.documents[idx].title)
          .trim()
          .slice(0, 200),
        referenceNumber: String(
          document?.referenceNumber ?? dbData.documents[idx].referenceNumber
        )
          .trim()
          .slice(0, 60),
        category: String(document?.category ?? dbData.documents[idx].category)
          .trim()
          .slice(0, 80),
        classification:
          document?.classification === 'top_secret' ? 'top_secret' : 'internal',
        content: String(document?.content ?? dbData.documents[idx].content)
          .trim()
          .slice(0, 25000),
        keywords: String(document?.keywords ?? dbData.documents[idx].keywords)
          .trim()
          .slice(0, 500),
        authorName: String(authorName || dbData.documents[idx].authorName),
        updatedAt: new Date().toISOString(),
      };

      semanticAnswerCache.clear();
      await saveDatabase(dbData);
      res.json({
        document: dbData.documents[idx],
        documents: dbData.documents,
      });
    } catch (err) {
      console.error('Update document error:', err);
      res.status(500).json({ error: 'تعذر تحديث الوثيقة.' });
    }
  });

  // 8. Delete Official Document (Managers Only)
  app.delete('/api/documents/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const role = req.query.role;

      if (role !== 'manager') {
        res
          .status(403)
          .json({ error: 'صلاحية حذف المستندات مقتصرة على حساب المدير فقط.' });
        return;
      }

      const dbData = await loadDatabase();
      dbData.documents = dbData.documents.filter((d) => d.id !== id);
      semanticAnswerCache.clear();
      await saveDatabase(dbData);
      res.json({ documents: dbData.documents });
    } catch (err) {
      console.error('Delete document error:', err);
      res.status(500).json({ error: 'تعذر حذف الوثيقة.' });
    }
  });

  // 9. Seed Default Official Documents (Managers Only)
  app.post('/api/documents/seed', async (req, res) => {
    try {
      const { role, authorId, authorName } = req.body as {
        role?: string;
        authorId?: string;
        authorName?: string;
      };

      if (role !== 'manager') {
        res.status(403).json({ error: 'للمديرين فقط.' });
        return;
      }

      const dbData = await loadDatabase();
      const now = new Date().toISOString();
      dbData.documents = SEED_OFFICIAL_DOCUMENTS.map((docItem, index) => ({
        ...docItem,
        id: `official_doc_${index + 1}`,
        authorId: String(authorId || 'manager'),
        authorName: String(authorName || 'مدير النظام'),
        createdAt: now,
        updatedAt: now,
      }));
      semanticAnswerCache.clear();
      await saveDatabase(dbData);
      res.json({ documents: dbData.documents });
    } catch (err) {
      console.error('Seed documents error:', err);
      res.status(500).json({ error: 'تعذر استعادة الوثائق.' });
    }
  });

  // 10. Update Security Config & Trigger Encrypted Employee Notification if Unified Password Changed
  app.put('/api/security-config', async (req, res) => {
    try {
      const { role, updatedBy, config } = req.body as {
        role?: string;
        updatedBy?: string;
        config?: Partial<StoredSecurityConfig>;
      };

      if (role !== 'manager') {
        res.status(403).json({ error: 'للمديرين فقط.' });
        return;
      }

      const dbData = await loadDatabase();
      const oldUnifiedPassword = dbData.securityConfig.employeeUnifiedPassword;
      const newUnifiedPassword = String(
        config?.employeeUnifiedPassword || oldUnifiedPassword
      ).trim();

      const didEmployeePasswordChange =
        newUnifiedPassword !== oldUnifiedPassword &&
        newUnifiedPassword.length >= 4;

      const now = new Date().toISOString();

      dbData.securityConfig = {
        ...dbData.securityConfig,
        employeeUnifiedPassword: newUnifiedPassword,
        previousEmployeePassword: didEmployeePasswordChange
          ? oldUnifiedPassword
          : dbData.securityConfig.previousEmployeePassword || '',
        passwordVersion: didEmployeePasswordChange
          ? (dbData.securityConfig.passwordVersion || 1) + 1
          : dbData.securityConfig.passwordVersion || 1,
        passwordChangedAt: didEmployeePasswordChange
          ? now
          : dbData.securityConfig.passwordChangedAt,
        passwordChangedBy: didEmployeePasswordChange
          ? String(updatedBy || 'إدارة النظام')
          : dbData.securityConfig.passwordChangedBy,
        managerAccessCode: String(
          config?.managerAccessCode || dbData.securityConfig.managerAccessCode
        ).trim(),
        wordsPerSecond: Number(config?.wordsPerSecond) || 3,
        minTimerSeconds: Number(config?.minTimerSeconds) || 15,
        maxTimerSeconds: Number(config?.maxTimerSeconds) || 90,
        strictWatermark: Boolean(config?.strictWatermark ?? true),
        updatedBy: String(updatedBy || 'manager'),
        updatedAt: now,
      };

      await saveDatabase(dbData);
      res.json({
        securityConfig: dbData.securityConfig,
        didEmployeePasswordChange,
      });
    } catch (err) {
      console.error('Security config update error:', err);
      res.status(500).json({ error: 'تعذر تحديث إعدادات الأمان.' });
    }
  });

  // 11. Verify Old Employee Unified Password to Unlock the New Unified Password Notification
  app.post('/api/security-config/verify-old-password', async (req, res) => {
    try {
      const { oldPassword } = req.body as { oldPassword?: string };
      const cleanOld = String(oldPassword || '').trim();
      const dbData = await loadDatabase();

      const expectedOld = dbData.securityConfig.previousEmployeePassword;
      if (!expectedOld || cleanOld !== expectedOld) {
        res.status(401).json({
          error:
            'كلمة المرور القديمة غير صحيحة. يجب إدخال كلمة المرور الموحدة السابقة لفتح الرسالة المشفرة.',
        });
        return;
      }

      res.json({
        newEmployeeUnifiedPassword:
          dbData.securityConfig.employeeUnifiedPassword,
        countdownSeconds: Math.max(
          12,
          Math.min(25, dbData.securityConfig.minTimerSeconds || 15)
        ),
        passwordVersion: dbData.securityConfig.passwordVersion,
        changedBy: dbData.securityConfig.passwordChangedBy || 'إدارة النظام',
        changedAt: dbData.securityConfig.passwordChangedAt,
      });
    } catch (err) {
      console.error('Verify old password error:', err);
      res.status(500).json({ error: 'تعذر التحقق من كلمة المرور.' });
    }
  });

  // 12. Verify Password on Activity Log
  app.patch('/api/activity-logs/:id/verify', async (req, res) => {
    try {
      const { id } = req.params;
      const dbData = await loadDatabase(false);
      const log = dbData.activityLogs.find((l) => l.id === id);
      if (log) {
        log.passwordVerified = true;
        await saveDatabase(dbData, false);
      }
      res.json({ activityLogs: dbData.activityLogs });
    } catch (err) {
      console.error('Verify log error:', err);
      res.status(500).json({ error: 'تعذر تحديث سجل النشاط.' });
    }
  });

  // 13. Fast Semantic Search + Immediate Activity Log Recording
  app.post('/api/semantic-search', async (req, res) => {
    try {
      const { query, user, lang } = req.body as {
        query?: string;
        lang?: 'ar' | 'en';
        user?: {
          uid: string;
          displayName: string;
          department: string;
          role: 'employee' | 'manager';
        };
      };

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ error: 'يرجى إدخال نص السؤال أو الاستفسار.' });
        return;
      }

      const dbData = await loadDatabase(false);
      const userRole: 'employee' | 'manager' =
        user?.role === 'manager' ? 'manager' : 'employee';
      const safeLang: 'ar' | 'en' = lang === 'en' ? 'en' : 'ar';
      const cleanQuery = query.trim();
      const cacheKey = `${userRole}:${safeLang}:${cleanQuery.toLowerCase()}`;

      // Pre-rank top 2 documents & build instant semantic fallback
      const { rankedDocs, fallback } = rankDocumentsAndBuildFallback(
        cleanQuery,
        userRole,
        dbData.documents,
        safeLang
      );

      let resultPayload: SemanticPayload = fallback;

      // Check in-memory answer cache first for instant response
      const cachedAnswer = semanticAnswerCache.get(cacheKey);
      if (cachedAnswer) {
        resultPayload = cachedAnswer;
      } else if (rankedDocs.length > 0 && !fallback.restrictedNotice) {
        const docsContext = rankedDocs
          .map(
            (docItem, idx) =>
              `[وثيقة ${idx + 1}] العنوان: ${docItem.title} | المرجع: ${docItem.referenceNumber} | التصنيف: ${docItem.category}
النص:
${docItem.content}`
          )
          .join('\n\n---\n\n');

        const systemInstruction = `أنت "دليلك الذكي (Your Smart Guide)". أجب باختصار ودقة عالية من الوثائق الرسمية المرفقة فقط مع ذكر اسم الوثيقة ورقم المرجع والمادة. ${
          safeLang === 'en'
            ? 'Respond in clear English.'
            : 'أجب باللغة العربية الفصحى الواضحة.'
        }`;

        const prompt = `صلاحية السائل: ${userRole === 'manager' ? 'مدير' : 'موظف'}
سؤال المستخدم: "${cleanQuery}"

الوثائق الرسمية المرشحة:
${docsContext}`;

        try {
          const geminiPromise = ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  answer: { type: Type.STRING },
                  matchedDocTitle: { type: Type.STRING },
                  matchedReferenceNumber: { type: Type.STRING },
                  matchedCategory: { type: Type.STRING },
                  classificationLevel: { type: Type.STRING },
                  accuracyScore: { type: Type.NUMBER },
                  semanticIntent: { type: Type.STRING },
                  restrictedNotice: { type: Type.BOOLEAN },
                },
                required: [
                  'answer',
                  'matchedDocTitle',
                  'matchedReferenceNumber',
                  'matchedCategory',
                  'classificationLevel',
                  'accuracyScore',
                  'semanticIntent',
                  'restrictedNotice',
                ],
              },
            },
          });

          // Race Gemini against a 2500ms timeout so the user never waits long
          const response = await Promise.race([
            geminiPromise,
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 2500)
            ),
          ]);

          if (response) {
            const rawText = (response.text ?? '').trim();
            if (rawText) {
              const parsed = JSON.parse(rawText);
              const safeAccuracy = Math.min(
                99.8,
                Math.max(
                  75,
                  Number(Number(parsed.accuracyScore || 94.2).toFixed(1))
                )
              );
              resultPayload = {
                answer: String(parsed.answer || fallback.answer).trim(),
                matchedDocTitle: String(
                  parsed.matchedDocTitle || fallback.matchedDocTitle
                ).slice(0, 200),
                matchedReferenceNumber: String(
                  parsed.matchedReferenceNumber ||
                    fallback.matchedReferenceNumber
                ).slice(0, 60),
                matchedCategory: String(
                  parsed.matchedCategory || fallback.matchedCategory
                ).slice(0, 80),
                classificationLevel:
                  parsed.classificationLevel === 'top_secret'
                    ? 'top_secret'
                    : 'internal',
                accuracyScore: safeAccuracy,
                semanticIntent: String(
                  parsed.semanticIntent || fallback.semanticIntent
                ),
                restrictedNotice: Boolean(parsed.restrictedNotice),
              };
            }
          }
          semanticAnswerCache.set(cacheKey, resultPayload);
        } catch (geminiErr) {
          console.error('Gemini fast fallback used:', geminiErr);
          semanticAnswerCache.set(cacheKey, resultPayload);
        }
      }

      // Compute smart countdown timer duration based on answer length
      const words = resultPayload.answer
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
      const chars = resultPayload.answer.trim().length;
      const wps = Math.max(1, dbData.securityConfig.wordsPerSecond || 3);
      const computedSecs = Math.ceil(words / wps) + 6;
      const allocatedSeconds = Math.min(
        dbData.securityConfig.maxTimerSeconds || 90,
        Math.max(dbData.securityConfig.minTimerSeconds || 15, computedSecs)
      );

      // Record Activity Log immediately on the server (non-blocking remote sync)
      const now = new Date();
      const searchDate = now.toISOString().slice(0, 10);
      const searchTime = now.toTimeString().slice(0, 8);
      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const newLog: StoredActivityLog = {
        id: logId,
        employeeId: String(user?.uid || 'emp_guest'),
        employeeName: String(user?.displayName || 'موظف مسجل'),
        department: String(user?.department || 'الإدارة العامة'),
        userRole,
        queryText: cleanQuery.slice(0, 1000),
        searchDate,
        searchTime,
        accuracyScore: resultPayload.accuracyScore,
        matchedDocTitle: resultPayload.matchedDocTitle,
        allocatedSeconds,
        passwordVerified: false,
        createdAt: now.toISOString(),
      };

      dbData.activityLogs.unshift(newLog);
      await saveDatabase(dbData, false);

      res.json({
        ...resultPayload,
        allocatedSeconds,
        wordCount: words,
        charCount: chars,
        logId,
        searchDate,
        searchTime,
        activityLogs: dbData.activityLogs,
      });
    } catch (error) {
      console.error('Semantic search API error:', error);
      res.status(500).json({ error: 'حدث خطأ أثناء معالجة الاستفسار.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

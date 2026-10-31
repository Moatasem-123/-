import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { AccessRequest } from '../types';
import { useLanguage } from '../i18n';

interface AccessRequestsPanelProps {
  accessRequests: AccessRequest[];
  onDecideAccessRequest: (
    requestId: string,
    decision: 'approved' | 'rejected'
  ) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

export const AccessRequestsPanel: React.FC<AccessRequestsPanelProps> = ({
  accessRequests,
  onDecideAccessRequest,
  onRefresh,
}) => {
  const { t, isRtl } = useLanguage();
  const [busyReqId, setBusyReqId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected'
  >('all');

  const pendingRequests = accessRequests.filter((r) => r.status === 'pending');
  const approvedCount = accessRequests.filter(
    (r) => r.status === 'approved'
  ).length;
  const rejectedCount = accessRequests.filter(
    (r) => r.status === 'rejected'
  ).length;

  const historyRequests = accessRequests.filter((r) => {
    if (statusFilter === 'all') return r.status !== 'pending';
    if (statusFilter === 'pending') return false;
    return r.status === statusFilter;
  });

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {t(
              'طلبات تسجيل الدخول والموافقة الأمنية',
              'Login Requests & Security Approvals'
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t(
              'مراقبة لحظية لأي شخص يحاول تسجيل الدخول أو إنشاء حساب (سواء كمدير أو موظف) للموافقة على دخوله أو رفضه وحظره فوراً.',
              'Real-time monitoring of anyone attempting to log in or register (as Manager or Employee) to approve or reject & block them immediately.'
            )}
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`h-4 w-4 text-emerald-600 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>
              {isRefreshing
                ? t('جاري التحديث...', 'Refreshing...')
                : t('تحديث طلبات الدخول', 'Refresh Login Requests')}
            </span>
          </button>
        )}
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {t(
              'طلبات معلقة بانتظار قرارك الآن',
              'Pending Requests Awaiting Decision'
            )}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-600">
            {pendingRequests.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {t('طلبات تمت الموافقة عليها', 'Approved Login Requests')}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700">
            {approvedCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {t('محاولات مرفوضة ومحظورة', 'Rejected & Blocked Attempts')}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-red-600">
            {rejectedCount}
          </div>
        </div>
      </div>

      {/* SECTION 1: LIVE PENDING LOGIN / REGISTRATION REQUESTS */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <ShieldAlert
              className={`h-5 w-5 ${
                pendingRequests.length > 0
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            />
            <h3 className="text-base font-bold text-slate-900">
              {t(
                `الطلبات المعلقة حالياً (${pendingRequests.length})`,
                `Currently Pending Requests (${pendingRequests.length})`
              )}
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {t(
              'لا يتمكن صاحب الطلب من الدخول إلا بعد ضغطك على «موافقة على الدخول»',
              'The user cannot enter the platform until you click "Approve Access"'
            )}
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
            <UserCheck className="mx-auto mb-2.5 h-8 w-8 text-emerald-600" />
            <p className="text-sm font-semibold text-slate-800">
              {t(
                'لا توجد حالياً أي محاولات تسجيل دخول معلقة',
                'No pending login attempts at the moment'
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t(
                'سيظهر هنا فوراً أي شخص يحاول تسجيل الدخول أو إنشاء حساب جديد في «دليلك الذكي».',
                'Anyone attempting to sign in or register in "Your Smart Guide" will appear here immediately.'
              )}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-lg border border-amber-200 bg-amber-50/40">
            {pendingRequests.map((req) => {
              const isBusy = busyReqId === req.id;
              return (
                <div
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {req.displayName}
                      </span>
                      <span aria-hidden="true" className="text-slate-400">
                        ·
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          req.requestedRole === 'manager'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {req.requestedRole === 'manager'
                          ? t(
                              'يحاول الدخول بصفة: مدير',
                              'Attempting access as: Manager'
                            )
                          : t(
                              'يحاول الدخول بصفة: موظف',
                              'Attempting access as: Employee'
                            )}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-mono">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {req.email}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{req.department}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1 font-mono tabular-nums text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {req.requestedDate} — {req.requestedTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={async () => {
                        setBusyReqId(req.id);
                        try {
                          await onDecideAccessRequest(req.id, 'approved');
                        } finally {
                          setBusyReqId(null);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{t('موافقة على الدخول', 'Approve Access')}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={async () => {
                        setBusyReqId(req.id);
                        try {
                          await onDecideAccessRequest(req.id, 'rejected');
                        } finally {
                          setBusyReqId(null);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>
                        {t('رفض وحظر (شخص غريب)', 'Reject & Block (Stranger)')}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: HISTORY OF PREVIOUS DECISIONS */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">
            {t(
              'سجل قرارات طلبات الدخول السابقة',
              'History of Previous Login Request Decisions'
            )}
          </h3>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('الكل', 'All')} ({approvedCount + rejectedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('approved')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'approved'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('المقبولة', 'Approved')} ({approvedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('rejected')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'rejected'
                  ? 'bg-white text-red-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('المرفوضة', 'Rejected')} ({rejectedCount})
            </button>
          </div>
        </div>

        {historyRequests.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
            {t(
              'لا توجد قرارات سابقة مسجلة في هذا التصنيف.',
              'No previous decisions recorded in this filter.'
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table
              className={`w-full border-collapse text-xs ${
                isRtl ? 'text-right' : 'text-left'
              }`}
            >
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 font-semibold">
                    {t('الاسم الثلاثي', 'Full Name')}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t('البريد الإلكتروني والإدارة', 'Email & Department')}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t('الصفة المطلوبة', 'Requested Role')}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t('توقيت الطلب', 'Request Time')}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t('قرار المدير', 'Manager Decision')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {historyRequests.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {item.displayName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-slate-800">
                        {item.email}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.department}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={
                          item.requestedRole === 'manager'
                            ? 'font-bold text-amber-700'
                            : 'font-semibold text-emerald-700'
                        }
                      >
                        {item.requestedRole === 'manager'
                          ? t('حساب مدير', 'Manager')
                          : t('حساب موظف', 'Employee')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {item.requestedDate} · {item.requestedTime}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.status === 'approved' ? (
                        <span className="font-bold text-emerald-700">
                          {t('تمت الموافقة على الدخول', 'Approved')}
                        </span>
                      ) : (
                        <span className="font-bold text-red-700">
                          {t('تم الرفض والحظر', 'Rejected & Blocked')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

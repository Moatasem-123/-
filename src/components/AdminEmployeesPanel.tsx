import React, { useState } from 'react';
import {
  Users,
  Search,
  ShieldCheck,
  UserMinus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { UserProfile } from '../types';
import { useLanguage } from '../i18n';

interface AdminEmployeesPanelProps {
  users: UserProfile[];
  currentManagerUid: string;
  onChangeUserRole: (
    targetUid: string,
    newRole: 'employee' | 'manager'
  ) => Promise<void>;
  onRemoveUser: (targetUid: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

export const AdminEmployeesPanel: React.FC<AdminEmployeesPanelProps> = ({
  users,
  currentManagerUid,
  onChangeUserRole,
  onRemoveUser,
  onRefresh,
}) => {
  const { t, isRtl } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'employee' | 'manager'>(
    'all'
  );
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesText =
      !searchQuery.trim() ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesText;
  });

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return `${iso.slice(0, 10)} · ${iso.slice(11, 19)}`;
  };

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {t(
              'قائمة الموظفين والحسابات المقيدة في المؤسسة',
              'Registered Employees & Accounts Directory'
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t(
              'إدارة الموظفين المسجلين والمعتمدين في الموقع، مع إمكانية ترقية الموظف لمنصب مدير أو إزالته في حال الاستقالة.',
              'Manage approved employees registered in the platform, promote employees to Manager, or remove resigned personnel.'
            )}
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`h-4 w-4 text-emerald-600 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>
              {isRefreshing
                ? t('جاري التحديث...', 'Refreshing...')
                : t('تحديث القائمة', 'Refresh List')}
            </span>
          </button>
        )}
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {t(
              'إجمالي الحسابات المقيدة في المؤسسة',
              'Total Registered Accounts'
            )}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {users.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {t('حسابات الموظفين', 'Employee Accounts')}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700">
            {users.filter((u) => u.role === 'employee').length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {t('حسابات المديرين', 'Manager Accounts')}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-700">
            {users.filter((u) => u.role === 'manager').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              roleFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('جميع المقيدين', 'All Registered')} ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('employee')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              roleFilter === 'employee'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('الموظفون', 'Employees')} (
            {users.filter((u) => u.role === 'employee').length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('manager')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              roleFilter === 'manager'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('المديرون', 'Managers')} (
            {users.filter((u) => u.role === 'manager').length})
          </button>
        </div>

        <div className="relative w-full max-w-sm">
          <Search
            className={`pointer-events-none absolute top-2.5 h-4 w-4 text-slate-400 ${
              isRtl ? 'right-3' : 'left-3'
            }`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(
              'بحث بالاسم الثلاثي، البريد الإلكتروني، أو القسم...',
              'Search by full name, email, or department...'
            )}
            className={`w-full rounded-lg border border-slate-200 bg-white py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none ${
              isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>
      </div>

      {/* Employees Table */}
      {filteredUsers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm font-semibold text-slate-800">
            {t('لا توجد حسابات مطابقة للبحث', 'No matching accounts found')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t(
              'تظهر هنا كافة حسابات الموظفين والمديرين المقيدين في المنصة.',
              'All registered employee and manager accounts appear here.'
            )}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table
            className={`w-full border-collapse text-xs ${
              isRtl ? 'text-right' : 'text-left'
            }`}
          >
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-4 py-3.5 font-semibold">
                  {t('الاسم الثلاثي الكامل', 'Three-Part Full Name')}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {t('البريد الإلكتروني والإدارة', 'Email & Department')}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {t('المنصب والصلاحية', 'Role & Clearance')}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {t('آخر تسجيل دخول', 'Last Login')}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {t(
                    'إجراءات الإدارة (الترقية / إنهاء الخدمة)',
                    'Management Actions (Promote / Remove)'
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((userItem) => {
                const isSelf = userItem.uid === currentManagerUid;
                const isBusy = busyUid === userItem.uid;

                return (
                  <tr
                    key={userItem.uid}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <div className="font-bold text-slate-900">
                        {userItem.displayName}
                        {isSelf && (
                          <span className="mx-2 text-[11px] font-normal text-emerald-700">
                            {t('(حسابك الحالي)', '(Your Current Account)')}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-1.5 font-mono text-slate-800">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <span>{userItem.email || '—'}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {userItem.department}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                      {userItem.role === 'manager' ? (
                        <div className="flex items-center gap-1.5 font-bold text-amber-700">
                          <ShieldCheck className="h-4 w-4 text-amber-600" />
                          <span>
                            {t('مدير (صلاحيات كاملة)', 'Manager (Full Control)')}
                          </span>
                        </div>
                      ) : (
                        <span className="font-semibold text-emerald-700">
                          {t('موظف معتمد', 'Approved Employee')}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 align-middle font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                          {formatDate(userItem.lastLoginAt || userItem.createdAt)}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                      {isSelf ? (
                        <span className="text-[11px] text-slate-400">
                          {t('مدير الجلسة الحالية', 'Active Session Manager')}
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Promote to Manager / Demote to Employee */}
                          {userItem.role === 'employee' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={async () => {
                                setBusyUid(userItem.uid);
                                try {
                                  await onChangeUserRole(
                                    userItem.uid,
                                    'manager'
                                  );
                                } finally {
                                  setBusyUid(null);
                                }
                              }}
                              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap shrink-0"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                              <span>
                                {t('ترقية لمنصب مدير', 'Promote to Manager')}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={async () => {
                                setBusyUid(userItem.uid);
                                try {
                                  await onChangeUserRole(
                                    userItem.uid,
                                    'employee'
                                  );
                                } finally {
                                  setBusyUid(null);
                                }
                              }}
                              className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                            >
                              <ArrowDownRight className="h-3.5 w-3.5 text-slate-500" />
                              <span>
                                {t('تحويل لمنصب موظف', 'Change to Employee')}
                              </span>
                            </button>
                          )}

                          {/* Remove Employee if Resigned */}
                          {confirmRemoveUid === userItem.uid ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyUid(userItem.uid);
                                  try {
                                    await onRemoveUser(userItem.uid);
                                    setConfirmRemoveUid(null);
                                  } finally {
                                    setBusyUid(null);
                                  }
                                }}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                              >
                                {t('تأكيد الإزالة النهائية', 'Confirm Removal')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveUid(null)}
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                              >
                                {t('إلغاء', 'Cancel')}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmRemoveUid(userItem.uid)}
                              className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 whitespace-nowrap shrink-0"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              <span>
                                {t('إزالة (استقالة)', 'Remove (Resigned)')}
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

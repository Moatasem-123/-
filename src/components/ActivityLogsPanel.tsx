import React, { useState } from 'react';
import {
  Search,
  Download,
  ShieldCheck,
  Clock,
  FileSearch,
  UserCheck,
} from 'lucide-react';
import { ActivityLog } from '../types';
import { useLanguage } from '../i18n';

interface ActivityLogsPanelProps {
  logs: ActivityLog[];
}

export const ActivityLogsPanel: React.FC<ActivityLogsPanelProps> = ({
  logs,
}) => {
  const { t, isRtl } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'employee' | 'manager'>(
    'all'
  );

  const filteredLogs = logs.filter((log) => {
    const matchesRole = roleFilter === 'all' || log.userRole === roleFilter;
    const matchesText =
      !searchQuery.trim() ||
      log.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.queryText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.searchDate.includes(searchQuery);
    return matchesRole && matchesText;
  });

  const handleExportCsv = () => {
    const headers = [
      t('اسم الموظف الثلاثي', 'Employee Full Name'),
      t('الإدارة', 'Department'),
      t('الصلاحية', 'Role'),
      t('نص السؤال أو الكلمة المبحوث عنها', 'Search Query Text'),
      t('التاريخ', 'Date'),
      t('الساعة بالثانية', 'Exact Time'),
      t('نسبة الدقة بالتحديد (%)', 'Semantic Accuracy (%)'),
      t('الوثيقة المطابقة', 'Matched Document'),
      t('مدة العد التنازلي (ثانية)', 'Allocated Countdown (s)'),
      t('تأكيد كلمة المرور الموحدة', 'Unified Password Verified'),
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.employeeName.replace(/"/g, '""')}"`,
      `"${l.department.replace(/"/g, '""')}"`,
      l.userRole === 'manager' ? t('مدير', 'Manager') : t('موظف', 'Employee'),
      `"${l.queryText.replace(/"/g, '""')}"`,
      l.searchDate,
      l.searchTime,
      `${l.accuracyScore.toFixed(1)}%`,
      `"${l.matchedDocTitle.replace(/"/g, '""')}"`,
      l.allocatedSeconds,
      l.passwordVerified
        ? t('تم التحقق والعرض', 'Verified & Viewed')
        : t('قيد الانتظار / لم يكتمل', 'Pending / Unverified'),
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {t(
              'سجل نشاطات الموظفين والمساءلة (Activity Logs)',
              'Employee Activity & Accountability Logs'
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t(
              'سجل تفصيلي ودقيق يوثق كل عملية بحث بـ (اسم الموظف الثلاثي، نص السؤال، التاريخ، الساعة بالثانية، ونسبة الدقة بالتحديد).',
              'Detailed audit log recording every search with (employee full name, exact query, date, time down to the second, and exact semantic accuracy %).'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredLogs.length === 0}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4 text-emerald-600" />
          <span>
            {t('تصدير تقرير المساءلة (CSV)', 'Export Audit Report (CSV)')}
          </span>
        </button>
      </div>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {t('إجمالي عمليات البحث المسجلة', 'Total Logged Searches')}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {logs.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {t(
              'عمليات استعلام الموظفين المؤكدة بكلمة المرور',
              'Password-Verified Queries'
            )}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700">
            {logs.filter((l) => l.passwordVerified).length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {t('متوسط دقة المطابقة الدلالية', 'Average Semantic Accuracy')}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {logs.length > 0
              ? `${(
                  logs.reduce((acc, item) => acc + item.accuracyScore, 0) /
                  logs.length
                ).toFixed(1)}%`
              : '0.0%'}
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
            {t('الكل', 'All')} ({logs.length})
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
            {t('استعلامات الموظفين', 'Employee Queries')} (
            {logs.filter((l) => l.userRole === 'employee').length})
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
            {t('استعلامات المديرين', 'Manager Queries')} (
            {logs.filter((l) => l.userRole === 'manager').length})
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
              'تصفية باسم الموظف، نص السؤال، أو التاريخ...',
              'Filter by employee name, query text, or date...'
            )}
            className={`w-full rounded-lg border border-slate-200 bg-white py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none ${
              isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>
      </div>

      {/* High-Density Accountability Table */}
      {filteredLogs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <FileSearch className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm font-semibold text-slate-800">
            {t(
              'لا توجد سجلات بحث مطابقة حالياً',
              'No matching search logs found'
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t(
              'بمجرد قيام أي موظف بطرح سؤال في المساعد الذكي، سيظهر السجل التفصيلي هنا فوراً.',
              'As soon as any employee submits a question in the AI Assistant, the detailed record will appear here immediately.'
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
                  {t(
                    'اسم الموظف الثلاثي والإدارة',
                    'Employee Full Name & Dept'
                  )}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {t(
                    'نص السؤال أو الكلمة التي بحث عنها',
                    'Exact Question / Search Query'
                  )}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {t('التاريخ', 'Date')}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {t('الساعة (بالثانية)', 'Time (Exact Second)')}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {t('الدقة بالتحديد', 'Exact Accuracy')}
                </th>
                <th className="px-4 py-3.5 font-semibold">
                  {t('حالة عرض الإجابة', 'Answer Reveal Status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3.5 align-top">
                    <div className="font-bold text-slate-900">
                      {log.employeeName}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {log.department} ·{' '}
                      {log.userRole === 'manager'
                        ? t('حساب مدير', 'Manager')
                        : t('حساب موظف', 'Employee')}
                    </div>
                  </td>

                  <td className="max-w-md px-4 py-3.5 align-top">
                    <div className="font-semibold text-slate-900">
                      «{log.queryText}»
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {t('المرجع المطابق:', 'Matched Ref:')}{' '}
                      {log.matchedDocTitle}
                    </div>
                  </td>

                  <td className="px-4 py-3.5 align-top font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {log.searchDate}
                  </td>

                  <td className="px-4 py-3.5 align-top font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{log.searchTime}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 align-top font-mono tabular-nums whitespace-nowrap">
                    <span className="font-bold text-emerald-700">
                      {log.accuracyScore.toFixed(1)}%
                    </span>
                  </td>

                  <td className="px-4 py-3.5 align-top whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      {log.passwordVerified ? (
                        <>
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          <span>
                            {t(
                              `تم التحقق (${log.allocatedSeconds} ثانية قراءة)`,
                              `Verified (${log.allocatedSeconds}s reading)`
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 text-amber-600" />
                          <span className="text-amber-700">
                            {t(
                              'بانتظار كلمة المرور الموحدة',
                              'Awaiting Unified Password'
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

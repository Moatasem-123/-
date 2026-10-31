import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Clock,
  Lock,
  EyeOff,
  FileCheck2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { SemanticSearchResult, UserProfile } from '../types';
import { useLanguage } from '../i18n';

interface ProtectedAnswerVaultProps {
  result: SemanticSearchResult;
  userProfile: UserProfile;
  strictWatermark: boolean;
  onExpireOrClose: (reason: 'expired' | 'manual_close') => void;
}

export const ProtectedAnswerVault: React.FC<ProtectedAnswerVaultProps> = ({
  result,
  userProfile,
  strictWatermark,
  onExpireOrClose,
}) => {
  const { t } = useLanguage();
  const [secondsLeft, setSecondsLeft] = useState<number>(result.allocatedSeconds);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);
  const [isWindowBlurred, setIsWindowBlurred] = useState<boolean>(false);

  // Countdown timer logic: automatically closes and purges answer when reaching 0
  useEffect(() => {
    setSecondsLeft(result.allocatedSeconds);
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          onExpireOrClose('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [result.allocatedSeconds, onExpireOrClose]);

  // Anti-copy, anti-print, anti-screenshot keyboard & focus guards
  useEffect(() => {
    const triggerAlert = (msg: string) => {
      setSecurityWarning(msg);
      window.setTimeout(() => {
        setSecurityWarning((curr) => (curr === msg ? null : curr));
      }, 3000);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        e.key === 'PrintScreen' ||
        ((e.ctrlKey || e.metaKey) &&
          ['c', 'x', 'a', 'p', 's', 'u'].includes(key)) ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 's'].includes(key)) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerAlert(
          t(
            'تحذير أمني: تم حظر محاولة النسخ أو الطباعة أو الالتقاط. جميع الأنشطة مسجلة باسمك.',
            'Security Alert: Copy, print, or capture attempt blocked. All activities are logged under your name.'
          )
        );
      }
    };

    const handleCopyOrCut = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerAlert(
        t(
          'منع التسريب: النسخ غير مسموح به نهائياً في هذا النظام.',
          'Anti-Leakage: Copying is strictly disabled in this system.'
        )
      );
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerAlert(
        t(
          'القائمة المختصرة معطلة لحماية المحتوى الرسمي.',
          'Context menu is disabled to protect official content.'
        )
      );
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowBlurred(true);
      } else {
        setIsWindowBlurred(false);
      }
    };

    const handleWindowBlur = () => setIsWindowBlurred(true);
    const handleWindowFocus = () => setIsWindowBlurred(false);

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('copy', handleCopyOrCut, true);
    window.addEventListener('cut', handleCopyOrCut, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('copy', handleCopyOrCut, true);
      window.removeEventListener('cut', handleCopyOrCut, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [t]);

  const progressPercentage = Math.max(
    0,
    Math.min(100, (secondsLeft / result.allocatedSeconds) * 100)
  );

  const isUrgent = secondsLeft <= 8;

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div
      className="no-copy-shield fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Top Countdown Progress Bar */}
        <div className="h-2 w-full bg-slate-100">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              isUrgent ? 'bg-red-600' : 'bg-emerald-600'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Vault Security Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                result.classificationLevel === 'top_secret'
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-700'
              }`}
            >
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  {t(
                    'جلسة قراءة مؤقتة ومؤمنة ضد النسخ',
                    'Temporary Anti-Copy Protected Reading Session'
                  )}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {result.classificationLevel === 'top_secret'
                    ? t(
                        'تصنيف: سري للغاية (صلاحية مدير)',
                        'Classification: Top Secret (Manager Clearance)'
                      )
                    : t(
                        'تصنيف: وثيقة داخلية رسمية',
                        'Classification: Official Internal Document'
                      )}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {result.matchedDocTitle}
              </h2>
            </div>
          </div>

          {/* Live Smart Countdown Box */}
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-3 rounded-lg border px-4 py-2 ${
                isUrgent
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              <Clock
                className={`h-4 w-4 ${
                  isUrgent ? 'text-red-600' : 'text-emerald-600'
                }`}
              />
              <div>
                <div className="text-[11px] text-slate-500">
                  {t('الإغلاق التلقائي بعد', 'Auto-closes in')}
                </div>
                <div className="font-mono text-lg font-bold tabular-nums">
                  {formatTimer(secondsLeft)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onExpireOrClose('manual_close')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              <XCircle className="h-4 w-4 text-slate-500" />
              <span>{t('إنهاء القراءة وإغلاق', 'Finish & Close')}</span>
            </button>
          </div>
        </div>

        {/* Security Violation Banner (if user attempts Ctrl+C / right-click) */}
        {securityWarning && (
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-2.5 text-xs font-semibold text-red-700">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
            <span>{securityWarning}</span>
          </div>
        )}

        {/* Metadata Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {t('المرجع:', 'Ref:')} {result.matchedReferenceNumber}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('القسم:', 'Category:')} {result.matchedCategory}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-semibold tabular-nums text-emerald-700">
              {t('دقة المطابقة الدلالية:', 'Semantic Accuracy:')}{' '}
              {result.accuracyScore.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono tabular-nums text-slate-600">
            <span>
              {t('حجم النص:', 'Length:')} {result.wordCount}{' '}
              {t('كلمة', 'words')}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('المهلة المحسوبة:', 'Allocated Time:')}{' '}
              {result.allocatedSeconds} {t('ثانية', 'sec')}
            </span>
          </div>
        </div>

        {/* Protected Answer Body */}
        <div className="relative flex-1 overflow-y-auto px-6 py-6">
          {/* Forensic Dynamic Watermark Overlay */}
          {strictWatermark && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 flex flex-wrap items-center justify-around gap-12 overflow-hidden p-6 opacity-[0.06] select-none"
            >
              {Array.from({ length: 9 }).map((_, idx) => (
                <div
                  key={idx}
                  className="-rotate-12 font-mono text-xs font-bold tracking-wider text-slate-900 whitespace-nowrap"
                >
                  {userProfile.displayName} · {result.searchDate}{' '}
                  {result.searchTime}
                </div>
              ))}
            </div>
          )}

          {/* Blur Shield if window loses focus */}
          {isWindowBlurred && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 p-6 text-center backdrop-blur-md">
              <EyeOff className="mb-3 h-10 w-10 text-amber-600" />
              <p className="text-sm font-bold text-slate-900">
                {t(
                  'تم إخفاء النص مؤقتاً لخروج المؤشر من نافذة النظام',
                  'Content temporarily hidden because window lost focus'
                )}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {t(
                  'انقر داخل النافذة لاستئناف القراءة قبل انتهاء العد التنازلي.',
                  'Click inside the window to resume reading before the countdown ends.'
                )}
              </p>
            </div>
          )}

          {/* Question Summary */}
          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>
                {t('الاستفسار المسجل باسم:', 'Query logged by:')}{' '}
                {userProfile.displayName}
              </span>
              <span className="font-mono tabular-nums">
                {result.searchDate} — {result.searchTime}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900">
              «{result.queryText}»
            </p>
            <p className="mt-1.5 text-xs text-slate-600">
              {t('التحليل الدلالي:', 'Semantic Intent:')}{' '}
              {result.semanticIntent}
            </p>
          </div>

          {/* Restricted Notice if employee asked about top_secret topic */}
          {result.restrictedNotice && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-bold">
                  {t(
                    'تنبيه صلاحيات الوصول السيادية',
                    'Sovereign Access Clearance Notice'
                  )}
                </p>
                <p className="mt-1 leading-relaxed text-amber-800">
                  {t(
                    'يتضمن هذا الاستفسار جوانب مصنفة ضمن مستوى «سري للغاية» المخصص لحسابات المديرين فقط. تم عرض الجزء المتاح ضمن صلاحيات الموظفين.',
                    'This query involves topics classified as "Top Secret" restricted to Manager accounts. Showing the portion permitted under Employee clearance.'
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Non-Copyable Answer Content */}
          <div className="relative z-0 rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <FileCheck2 className="h-4 w-4" />
              <span>
                {t(
                  'الإجابة الرسمية المستندة إلى الوثائق المعتمدة (للقراءة فقط — غير قابلة للنسخ)',
                  'Official Answer Based on Approved Documents (Read-Only — Non-Copyable)'
                )}
              </span>
            </div>
            <div className="whitespace-pre-line text-base leading-8 text-slate-800 select-none">
              {result.answer}
            </div>
          </div>
        </div>

        {/* Footer Security Policy Notice */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-500">
          <span>
            {t(
              'حماية منع التسريب نشطة: النسخ، التحديد، الطباعة، والنقر الأيمن معطلة بالكامل على الكمبيوتر والهاتف.',
              'Anti-Leakage Shield Active: Copy, selection, printing, and right-click are disabled across desktop & mobile.'
            )}
          </span>
          <span className="font-mono tabular-nums text-slate-400">
            LOG-ID: {result.logId.slice(0, 10)}
          </span>
        </div>
      </div>
    </div>
  );
};

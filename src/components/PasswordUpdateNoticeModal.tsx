import React, { useEffect, useState } from 'react';
import {
  Lock,
  KeyRound,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Eye,
  EyeOff,
  XCircle,
} from 'lucide-react';
import { useLanguage } from '../i18n';

interface PasswordUpdateNoticeModalProps {
  changedBy?: string;
  changedAt?: string;
  onAcknowledgeAndClose: (versionAck: number) => void;
  onCancel: () => void;
}

export const PasswordUpdateNoticeModal: React.FC<
  PasswordUpdateNoticeModalProps
> = ({ changedBy, changedAt, onAcknowledgeAndClose, onCancel }) => {
  const { t, isRtl } = useLanguage();
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Unlocked state with countdown timer
  const [revealedNewPassword, setRevealedNewPassword] = useState<string | null>(
    null
  );
  const [totalSeconds, setTotalSeconds] = useState<number>(15);
  const [secondsLeft, setSecondsLeft] = useState<number>(15);
  const [unlockedVersion, setUnlockedVersion] = useState<number>(1);
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);

  // Countdown timer once the new password is revealed
  useEffect(() => {
    if (!revealedNewPassword) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          onAcknowledgeAndClose(unlockedVersion);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [revealedNewPassword, unlockedVersion, onAcknowledgeAndClose]);

  // Anti-copy protection when password is revealed
  useEffect(() => {
    if (!revealedNewPassword) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        e.key === 'PrintScreen' ||
        ((e.ctrlKey || e.metaKey) &&
          ['c', 'x', 'a', 'p', 's', 'u'].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        setSecurityAlert(
          t(
            'منع التسريب: لا يُسمح بنسخ كلمة المرور الجديدة، يرجى قراءتها وحفظها قبل انتهاء العد التنازلي.',
            'Anti-Leakage: Copying the new password is not allowed. Please read and memorize it before the countdown ends.'
          )
        );
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setSecurityAlert(
        t(
          'النسخ معطل أمنياً لحماية كلمة المرور الموحدة.',
          'Copying is disabled to protect the unified password.'
        )
      );
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('copy', handleCopy, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('copy', handleCopy, true);
    };
  }, [revealedNewPassword, t]);

  const handleVerifyOldPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsVerifying(true);

    try {
      const res = await fetch('/api/security-config/verify-old-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: oldPasswordInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            t(
              'كلمة المرور القديمة غير صحيحة، يرجى المحاولة مرة أخرى.',
              'Incorrect old unified password. Please try again.'
            )
        );
      }

      const secs = Number(data.countdownSeconds || 15);
      setTotalSeconds(secs);
      setSecondsLeft(secs);
      setUnlockedVersion(Number(data.passwordVersion || 2));
      setRevealedNewPassword(String(data.newEmployeeUnifiedPassword || ''));
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : t('تعذر التحقق من كلمة المرور.', 'Failed to verify password.')
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const progressPercentage = Math.max(
    0,
    Math.min(100, (secondsLeft / totalSeconds) * 100)
  );

  return (
    <div
      className="no-copy-shield fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Progress bar when revealed */}
        {revealedNewPassword && (
          <div className="h-2 w-full bg-slate-100">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                secondsLeft <= 5 ? 'bg-red-600' : 'bg-emerald-600'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}

        <div className="p-6">
          {!revealedNewPassword ? (
            /* STEP 1: Ask for Old Unified Password */
            <>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {t(
                      'رسالة مشفرة: تحديث كلمة المرور الموحدة للموظفين',
                      'Encrypted Notice: Employee Unified Password Updated'
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('تم التحديث بواسطة:', 'Updated by:')}{' '}
                    {changedBy || t('إدارة النظام', 'System Admin')}
                    {changedAt ? ` · ${changedAt.slice(0, 10)}` : ''}
                  </p>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs leading-6 text-slate-700">
                {t(
                  'قامت الإدارة بتغيير كلمة المرور الموحدة الخاصة بالموظفين. لفتح هذه الرسالة والاطلاع على كلمة المرور الجديدة، يجب عليك أولاً إدخال ',
                  'Management has updated the unified employee password. To unlock this message and view the new password, you must first enter the '
                )}
                <span className="font-bold text-slate-900">
                  {t(
                    'كلمة المرور الموحدة القديمة',
                    'previous unified password'
                  )}
                </span>
                .
              </div>

              <form onSubmit={handleVerifyOldPassword} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-800">
                    {t(
                      'أدخل كلمة المرور الموحدة القديمة لفتح الرسالة:',
                      'Enter Old Unified Password to Unlock:'
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showOldPass ? 'text' : 'password'}
                      required
                      autoFocus
                      value={oldPasswordInput}
                      onChange={(e) => setOldPasswordInput(e.target.value)}
                      placeholder={t(
                        'اكتب كلمة المرور القديمة هنا...',
                        'Type the old password here...'
                      )}
                      className={`w-full rounded-lg border border-slate-300 bg-white py-2.5 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none ${
                        isRtl ? 'pr-3.5 pl-10' : 'pl-3.5 pr-10'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPass((v) => !v)}
                      className={`absolute top-2.5 text-slate-400 hover:text-slate-700 ${
                        isRtl ? 'left-3' : 'right-3'
                      }`}
                    >
                      {showOldPass ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                    {errorMsg}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    {t('لاحقاً', 'Later')}
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>
                      {isVerifying
                        ? t('جاري التحقق...', 'Verifying...')
                        : t(
                            'فتح الرسالة وعرض كلمة المرور الجديدة',
                            'Unlock & View New Password'
                          )}
                    </span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* STEP 2: Reveal New Unified Password with Countdown Timer & Anti-Copy */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-bold">
                    {t(
                      'تم التحقق — كلمة المرور الموحدة الجديدة',
                      'Verified — New Unified Password'
                    )}
                  </span>
                </div>

                <div
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 font-mono text-sm font-bold tabular-nums ${
                    secondsLeft <= 5
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-slate-50 text-slate-900'
                  }`}
                >
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span>00:{String(secondsLeft).padStart(2, '0')}</span>
                </div>
              </div>

              {securityAlert && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{securityAlert}</span>
                </div>
              )}

              <p className="text-xs text-slate-600">
                {t(
                  'احفظ كلمة المرور الموحدة الجديدة التالية لاستخدامها عند طلب الإجابات. ستُغلق هذه الرسالة تلقائياً عند انتهاء العد التنازلي (النسخ معطل):',
                  'Memorize the new unified password below to unlock answers. This message will automatically close when the countdown expires (copying disabled):'
                )}
              </p>

              <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-5 text-center select-none">
                <div className="text-[11px] font-medium text-emerald-800">
                  {t(
                    'كلمة المرور الموحدة الجديدة للموظفين',
                    'New Employee Unified Password'
                  )}
                </div>
                <div className="mt-2 font-mono text-2xl font-bold tracking-widest text-slate-900 select-none">
                  {revealedNewPassword}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => onAcknowledgeAndClose(unlockedVersion)}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <XCircle className="h-4 w-4" />
                  <span>
                    {t(
                      'تم حفظ الكلمة وإغلاق الرسالة',
                      'I Memorized It — Close Message'
                    )}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

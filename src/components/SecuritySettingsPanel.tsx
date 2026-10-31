import React, { useState } from 'react';
import {
  KeyRound,
  Timer,
  Shield,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SecurityConfig } from '../types';
import { useLanguage } from '../i18n';

interface SecuritySettingsPanelProps {
  securityConfig: SecurityConfig;
  onSaveConfig: (
    updated: Omit<SecurityConfig, 'updatedBy' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
}

export const SecuritySettingsPanel: React.FC<SecuritySettingsPanelProps> = ({
  securityConfig,
  onSaveConfig,
}) => {
  const { t, isRtl } = useLanguage();
  const [employeeUnifiedPassword, setEmployeeUnifiedPassword] = useState(
    securityConfig.employeeUnifiedPassword
  );
  const [managerAccessCode, setManagerAccessCode] = useState(
    securityConfig.managerAccessCode
  );
  const [wordsPerSecond, setWordsPerSecond] = useState(
    securityConfig.wordsPerSecond
  );
  const [minTimerSeconds, setMinTimerSeconds] = useState(
    securityConfig.minTimerSeconds
  );
  const [maxTimerSeconds, setMaxTimerSeconds] = useState(
    securityConfig.maxTimerSeconds
  );
  const [strictWatermark, setStrictWatermark] = useState(
    securityConfig.strictWatermark
  );

  const [showEmpPass, setShowEmpPass] = useState(false);
  const [showMgrPass, setShowMgrPass] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await onSaveConfig({
        employeeUnifiedPassword: employeeUnifiedPassword.trim().slice(0, 64),
        managerAccessCode: managerAccessCode.trim().slice(0, 64),
        wordsPerSecond: Math.min(10, Math.max(1, Number(wordsPerSecond) || 3)),
        minTimerSeconds: Math.min(60, Math.max(5, Number(minTimerSeconds) || 12)),
        maxTimerSeconds: Math.min(
          300,
          Math.max(15, Number(maxTimerSeconds) || 90)
        ),
        strictWatermark,
      });
      setSaveMessage(
        t(
          'تم تحديث السياسات الأمنية وكلمات المرور بنجاح.',
          'Security policies and passwords updated successfully.'
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const simulateTimer = (wordCount: number) => {
    const raw = Math.ceil(wordCount / Math.max(1, wordsPerSecond)) + 6;
    return Math.min(maxTimerSeconds, Math.max(minTimerSeconds, raw));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl font-bold text-slate-900">
          {t(
            'إعدادات الحماية وكلمات المرور والعد التنازلي الذكي',
            'Security Settings, Passwords & Smart Countdown Timer'
          )}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t(
            'التحكم المركزي في كلمة المرور الموحدة للموظفين، كلمة مرور المديرين، ومعادلة حساب وقت قراءة الإجابات.',
            'Central control over the unified employee password, manager access code, and dynamic answer countdown formula.'
          )}
        </p>
      </div>

      {saveMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{saveMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Passwords Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">
              {t(
                'طبقة الأمان وكلمات المرور المعتمدة',
                'Security Layer & Authorized Passwords'
              )}
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t(
                  'كلمة المرور الموحدة للموظفين (تُطلب بعد طرح السؤال وقبل عرض الإجابة)',
                  'Employee Unified Password (Required after asking a question before revealing the answer)'
                )}
              </label>
              <div className="relative">
                <input
                  type={showEmpPass ? 'text' : 'password'}
                  required
                  minLength={4}
                  maxLength={64}
                  value={employeeUnifiedPassword}
                  onChange={(e) => setEmployeeUnifiedPassword(e.target.value)}
                  className={`w-full rounded-lg border border-slate-300 bg-white py-2.5 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none ${
                    isRtl ? 'pr-3.5 pl-10' : 'pl-3.5 pr-10'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowEmpPass((v) => !v)}
                  className={`absolute top-2.5 text-slate-400 hover:text-slate-700 ${
                    isRtl ? 'left-3' : 'right-3'
                  }`}
                >
                  {showEmpPass ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {t(
                  'عند تغيير هذه الكلمة، يصل للموظفين إشعار مشفر لا يُفتح إلا بإدخال الكلمة القديمة مع عد تنازلي.',
                  'When changed, employees receive an encrypted notice that requires the old password to unlock with a countdown timer.'
                )}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t(
                  'كلمة المرور الأمنية الخاصة بالمديرين',
                  'Manager Security Access Password'
                )}
              </label>
              <div className="relative">
                <input
                  type={showMgrPass ? 'text' : 'password'}
                  required
                  minLength={4}
                  maxLength={64}
                  value={managerAccessCode}
                  onChange={(e) => setManagerAccessCode(e.target.value)}
                  className={`w-full rounded-lg border border-slate-300 bg-white py-2.5 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none ${
                    isRtl ? 'pr-3.5 pl-10' : 'pl-3.5 pr-10'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowMgrPass((v) => !v)}
                  className={`absolute top-2.5 text-slate-400 hover:text-slate-700 ${
                    isRtl ? 'left-3' : 'right-3'
                  }`}
                >
                  {showMgrPass ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Countdown Calibration Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <Timer className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">
              {t(
                'معايرة العد التنازلي الذكي (حسب طول وحجم النص)',
                'Smart Countdown Calibration (Based on Answer Length)'
              )}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t('سرعة القراءة (كلمة/ثانية)', 'Reading Speed (words/sec)')}
              </label>
              <input
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={wordsPerSecond}
                onChange={(e) => setWordsPerSecond(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t('الحد الأدنى (ثانية)', 'Minimum Time (sec)')}
              </label>
              <input
                type="number"
                min={5}
                max={60}
                value={minTimerSeconds}
                onChange={(e) => setMinTimerSeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t('الحد الأقصى (ثانية)', 'Maximum Time (sec)')}
              </label>
              <input
                type="number"
                min={15}
                max={300}
                value={maxTimerSeconds}
                onChange={(e) => setMaxTimerSeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Live Formula Preview */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <div className="mb-2 font-semibold text-slate-700">
              {t(
                'معاينة تلقائية لمدة بقاء الإجابة قبل الطرد التلقائي:',
                'Live Preview of Answer Display Duration Before Auto-Close:'
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-slate-600">
              <div>
                {t('نص قصير (25 كلمة):', 'Short (25 words):')}{' '}
                <span className="font-bold text-emerald-700">
                  {simulateTimer(25)} {t('ثانية', 'sec')}
                </span>
              </div>
              <div>
                {t('نص متوسط (75 كلمة):', 'Medium (75 words):')}{' '}
                <span className="font-bold text-emerald-700">
                  {simulateTimer(75)} {t('ثانية', 'sec')}
                </span>
              </div>
              <div>
                {t('نص طويل (180 كلمة):', 'Long (180 words):')}{' '}
                <span className="font-bold text-emerald-700">
                  {simulateTimer(180)} {t('ثانية', 'sec')}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-slate-700">
                {t(
                  'تفعيل العلامة المائية الجنائية باسم الموظف والتوقيت داخل الإجابة',
                  'Enable forensic watermark with employee name & timestamp inside answers'
                )}
              </span>
            </div>
            <input
              type="checkbox"
              checked={strictWatermark}
              onChange={(e) => setStrictWatermark(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-600"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {isSaving
            ? t('جاري الحفظ...', 'Saving...')
            : t(
                'حفظ واعتماد إعدادات الأمان',
                'Save & Apply Security Settings'
              )}
        </button>
      </div>
    </form>
  );
};

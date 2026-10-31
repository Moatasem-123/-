import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Search,
  Database,
  X,
} from 'lucide-react';
import { OfficialDocument } from '../types';
import { useLanguage } from '../i18n';

interface AdminDocumentsPanelProps {
  documents: OfficialDocument[];
  onCreateDocument: (
    docData: Omit<
      OfficialDocument,
      'id' | 'authorId' | 'authorName' | 'createdAt' | 'updatedAt'
    >
  ) => Promise<void>;
  onUpdateDocument: (
    docId: string,
    docData: Omit<
      OfficialDocument,
      'id' | 'authorId' | 'authorName' | 'createdAt' | 'updatedAt'
    >
  ) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  onSeedDefaultDocuments: () => Promise<void>;
  isSeeding: boolean;
}

export const AdminDocumentsPanel: React.FC<AdminDocumentsPanelProps> = ({
  documents,
  onCreateDocument,
  onUpdateDocument,
  onDeleteDocument,
  onSeedDefaultDocuments,
  isSeeding,
}) => {
  const { t, isRtl } = useLanguage();
  const [filterClassification, setFilterClassification] = useState<
    'all' | 'internal' | 'top_secret'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [category, setCategory] = useState('الموارد البشرية وشؤون الموظفين');
  const [classification, setClassification] = useState<
    'internal' | 'top_secret'
  >('internal');
  const [keywords, setKeywords] = useState('');
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setEditingDocId(null);
    setTitle('');
    setReferenceNumber(`GOV-2026/${Math.floor(100 + Math.random() * 899)}`);
    setCategory(
      t('الموارد البشرية وشؤون الموظفين', 'Human Resources & Personnel')
    );
    setClassification('internal');
    setKeywords('');
    setContent('');
    setFormError(null);
  };

  const handleOpenNew = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (docItem: OfficialDocument) => {
    setEditingDocId(docItem.id);
    setTitle(docItem.title);
    setReferenceNumber(docItem.referenceNumber);
    setCategory(docItem.category);
    setClassification(docItem.classification);
    setKeywords(docItem.keywords);
    setContent(docItem.content);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '').slice(0, 24000);
      setContent(text);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, '').slice(0, 180));
      }
      if (!referenceNumber.trim()) {
        setReferenceNumber(`DOC-2026/${Math.floor(100 + Math.random() * 899)}`);
      }
      if (!keywords.trim()) {
        setKeywords(
          t(
            'لائحة رسمية، تعميم، نظام، استفسار، ضوابط',
            'official regulation, circular, policy, guidelines'
          )
        );
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanTitle = title.trim().slice(0, 200);
    const cleanRef = referenceNumber.trim().slice(0, 60);
    const cleanCat = category.trim().slice(0, 80);
    const cleanKeywords = (keywords.trim() || cleanTitle).slice(0, 500);
    const cleanContent = content.trim().slice(0, 25000);

    if (!cleanTitle || !cleanRef || !cleanCat || !cleanContent) {
      setFormError(
        t(
          'يرجى تعبئة كافة الحقول الأساسية ونص الوثيقة الرسمية.',
          'Please fill in all required fields and the official document text.'
        )
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingDocId) {
        await onUpdateDocument(editingDocId, {
          title: cleanTitle,
          referenceNumber: cleanRef,
          category: cleanCat,
          classification,
          keywords: cleanKeywords,
          content: cleanContent,
        });
      } else {
        await onCreateDocument({
          title: cleanTitle,
          referenceNumber: cleanRef,
          category: cleanCat,
          classification,
          keywords: cleanKeywords,
          content: cleanContent,
        });
      }
      setIsFormOpen(false);
      resetForm();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : t('حدث خطأ أثناء حفظ الوثيقة.', 'Error saving document.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDocs = documents.filter((d) => {
    const matchesClass =
      filterClassification === 'all' ||
      d.classification === filterClassification;
    const matchesSearch =
      !searchTerm.trim() ||
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.keywords.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClass && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {t(
              'لوحة تحكم المدير — إدارة ورفع المستندات الرسمية',
              'Manager Control Panel — Official Document Management'
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t(
              'حساب المدير هو الوحيد الذي يمتلك صلاحية رفع، تحديث، أو حذف الملفات والوثائق الرسمية التي يعتمد عليها الذكاء الاصطناعي.',
              'Only Manager accounts have clearance to upload, update, or delete official documents and regulations used by the AI.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSeedDefaultDocuments}
            disabled={isSeeding}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Database className="h-4 w-4 text-emerald-600" />
            <span>
              {isSeeding
                ? t('جاري تجهيز اللوائح...', 'Restoring Regulations...')
                : t(
                    'استعادة اللوائح الحكومية النموذجية',
                    'Restore Sample Official Regulations'
                  )}
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenNew}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>
              {t('رفع مستند رسمي جديد', 'Upload New Official Document')}
            </span>
          </button>
        </div>
      </div>

      {/* Upload / Edit Form Drawer */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {editingDocId
                  ? t(
                      'تحديث بيانات ونص الوثيقة الرسمية',
                      'Update Official Document Metadata & Text'
                    )
                  : t(
                      'رفع وإدراج وثيقة رسمية جديدة في قاعدة المعرفة',
                      'Upload & Index New Official Document into Knowledge Base'
                    )}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {t(
                  'يمكنك رفع ملف نصي (.txt, .md, .csv) مباشرة من جهازك أو كتابة ولصق مواد اللائحة.',
                  'You can upload a text file (.txt, .md, .csv) from your device or paste the regulation articles.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {formError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {formError}
            </div>
          )}

          {/* Direct File Upload Dropzone */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <Upload className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {t(
                    'رفع ملف مستند مباشر من جهازك',
                    'Upload Document File from Your Device'
                  )}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t(
                    'يدعم الملفات النصية واللوائح (.txt, .md, .json, .csv) حتى 25,000 حرف',
                    'Supports text & regulation files (.txt, .md, .json, .csv) up to 25,000 characters'
                  )}
                </p>
              </div>
            </div>
            <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0">
              <span>{t('اختيار ملف من الجهاز', 'Choose File')}</span>
              <input
                type="file"
                accept=".txt,.md,.csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t(
                  'عنوان الوثيقة أو اللائحة الرسمية',
                  'Official Document or Regulation Title'
                )}
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t(
                  'مثال: اللائحة التنفيذية للإجازات والبدلات',
                  'e.g., Executive Regulation for Leaves & Allowances'
                )}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t('رقم المرجع / التعميم الرسمي', 'Official Reference Number')}
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={t('مثال: HR-2026/104', 'e.g., HR-2026/104')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t('الإدارة / التصنيف الموضوعي', 'Department / Category')}
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={t(
                  'مثال: الموارد البشرية وشؤون الموظفين',
                  'e.g., Human Resources & Personnel'
                )}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t(
                  'مستوى السرية وصلاحيات الوصول',
                  'Classification & Access Clearance'
                )}
              </label>
              <select
                value={classification}
                onChange={(e) =>
                  setClassification(
                    e.target.value === 'top_secret' ? 'top_secret' : 'internal'
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="internal">
                  {t(
                    'وثيقة داخلية عامة — متاحة للموظفين والمديرين',
                    'Internal Document — Accessible to Employees & Managers'
                  )}
                </option>
                <option value="top_secret">
                  {t(
                    'سري للغاية — خاصة بالمديرين فقط (محجوبة عن الموظفين)',
                    'Top Secret — Managers Only (Restricted from Employees)'
                  )}
                </option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {t(
                'الكلمات المفتاحية والمرادفات بالعامية والفصحى (لدعم البحث الدلالي)',
                'Semantic Keywords & Colloquial/Formal Synonyms'
              )}
            </label>
            <input
              type="text"
              maxLength={500}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={t(
                'مثال: إجازة، تعبان، مرضية، رصيد، غياب، استئذان، دوام مرن...',
                'e.g., sick leave, vacation, promotion, allowance, flexible hours...'
              )}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>
                {t(
                  'النص الكامل للوثيقة والمواد النظامية',
                  'Full Document Text & Regulatory Articles'
                )}
              </span>
              <span className="font-mono tabular-nums text-slate-500">
                {content.length} / 25000 {t('حرف', 'chars')}
              </span>
            </div>
            <textarea
              required
              rows={8}
              maxLength={25000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t(
                'اكتب أو الصق المواد والبنود الرسمية التي سيعتمد عليها المساعد الذكي في الإجابة...',
                'Write or paste the official articles and clauses that the AI Assistant will rely on...'
              )}
              className="w-full rounded-lg border border-slate-300 bg-white p-3.5 text-sm leading-7 text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? t('جاري الحفظ...', 'Saving...')
                  : editingDocId
                    ? t('حفظ التعديلات', 'Save Changes')
                    : t('اعتماد ورفع الوثيقة', 'Approve & Upload Document')}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setFilterClassification('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filterClassification === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('جميع الوثائق', 'All Documents')} ({documents.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterClassification('internal')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filterClassification === 'internal'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('وثائق الموظفين', 'Employee Docs')} (
            {documents.filter((d) => d.classification === 'internal').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterClassification('top_secret')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filterClassification === 'top_secret'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('سري للغاية للمديرين', 'Top Secret (Managers)')} (
            {documents.filter((d) => d.classification === 'top_secret').length})
          </button>
        </div>

        <div className="relative w-full max-w-xs">
          <Search
            className={`pointer-events-none absolute top-2.5 h-4 w-4 text-slate-400 ${
              isRtl ? 'right-3' : 'left-3'
            }`}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t(
              'بحث بالعنوان أو الرقم المرجعي...',
              'Search by title or reference...'
            )}
            className={`w-full rounded-lg border border-slate-200 bg-white py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none ${
              isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>
      </div>

      {/* Documents List */}
      {filteredDocs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm font-semibold text-slate-800">
            {t(
              'لا توجد مستندات رسمية مطابقة',
              'No matching official documents'
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t(
              'اضغط على «استعادة اللوائح الحكومية النموذجية» أو «رفع مستند رسمي جديد» لإضافة اللوائح.',
              'Click "Restore Sample Official Regulations" or "Upload New Official Document" to add regulations.'
            )}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {filteredDocs.map((docItem) => (
            <div
              key={docItem.id}
              className="p-5 transition-colors hover:bg-slate-50/70"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold tabular-nums text-slate-700">
                      {docItem.referenceNumber}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{docItem.category}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        docItem.classification === 'top_secret'
                          ? 'font-semibold text-amber-700'
                          : 'font-semibold text-emerald-700'
                      }
                    >
                      {docItem.classification === 'top_secret'
                        ? t(
                            'سري للغاية — خاص بالمديرين فقط',
                            'Top Secret — Managers Only'
                          )
                        : t(
                            'داخلي — متاح للموظفين والمديرين',
                            'Internal — Employees & Managers'
                          )}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {docItem.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(docItem)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>{t('تحديث', 'Edit')}</span>
                  </button>

                  {confirmDeleteId === docItem.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteDocument(docItem.id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap shrink-0"
                      >
                        {t('تأكيد الحذف', 'Confirm Delete')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        {t('تراجع', 'Cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(docItem.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t('حذف', 'Delete')}</span>
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-3 line-clamp-3 text-xs leading-6 text-slate-600">
                {docItem.content}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>
                  {t('الكلمات الدلالية:', 'Keywords:')} {docItem.keywords}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t('بواسطة:', 'By:')} {docItem.authorName}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

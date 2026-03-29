import React, { useState, useMemo } from 'react';
import { SavedReport, OtherReport, Memo } from '../types';
import { useTranslations } from '../hooks/useTranslations';

import { Modal } from './ui/Modal';

interface StatisticsPageProps {
  reports: SavedReport[];
  otherReports: OtherReport[];
  memos: Memo[];
  onSaveMemo: (memo: Omit<Memo, 'id'> & { id?: string }) => void;
  onDeleteMemo: (id: string) => void;
  onGoHome: () => void;
}

export const StatisticsPage: React.FC<StatisticsPageProps> = ({ 
    otherReports, 
    memos,
    onSaveMemo,
    onDeleteMemo,
    onGoHome 
}) => {
  const { t } = useTranslations();
  const [selectedActivityType, setSelectedActivityType] = useState('');
  const [memoTitle, setMemoTitle] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [viewingMemo, setViewingMemo] = useState<Memo | null>(null);

  // Get unique activity types from other reports
  const activityTypes = useMemo(() => {
    const types = new Set<string>();
    otherReports.forEach(report => {
      if (report.activityType) {
        types.add(report.activityType);
      }
    });
    return Array.from(types).sort();
  }, [otherReports]);

  const handleSave = () => {
    if (!selectedActivityType || !memoContent.trim()) return;
    
    onSaveMemo({
      id: editingMemoId || undefined,
      title: memoTitle.trim(),
      activityType: selectedActivityType,
      content: memoContent.trim()
    });

    setMemoTitle('');
    setMemoContent('');
    setSelectedActivityType('');
    setEditingMemoId(null);
  };

  const handleEdit = (memo: Memo) => {
    setSelectedActivityType(memo.activityType);
    setMemoTitle(memo.title || '');
    setMemoContent(memo.content);
    setEditingMemoId(String(memo.id));
  };

  return (
    <div className="max-w-4xl mx-auto pb-20" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text-base))] flex items-center gap-3">
          <i className="fas fa-book text-cyan-500"></i>
          إدارة المذكرات
        </h1>
        <button
          onClick={onGoHome}
          className="p-2 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] transition-colors"
        >
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>

      <div className="bg-[rgb(var(--color-card))] p-6 rounded-2xl border border-[rgb(var(--color-border))] shadow-sm mb-8">
        <h2 className="text-lg font-bold text-[rgb(var(--color-text-base))] mb-4">
          {editingMemoId ? 'تعديل مذكرة' : 'إضافة مذكرة جديدة'}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1 text-right">نوع النشاط</label>
            <select
              value={selectedActivityType}
              onChange={(e) => setSelectedActivityType(e.target.value)}
              className="w-full p-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text-base))] focus:ring-2 focus:ring-cyan-500 outline-none text-right"
            >
              <option value="">اختر نوع النشاط...</option>
              {activityTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1 text-right">عنوان المذكرة</label>
            <input
              type="text"
              value={memoTitle}
              onChange={(e) => setMemoTitle(e.target.value)}
              placeholder="اكتب عنوان المذكرة هنا..."
              className="w-full p-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text-base))] focus:ring-2 focus:ring-cyan-500 outline-none text-right"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1 text-right">نص المذكرة</label>
            <textarea
              value={memoContent}
              onChange={(e) => setMemoContent(e.target.value)}
              placeholder="اكتب نص المذكرة هنا..."
              className="w-full p-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text-base))] focus:ring-2 focus:ring-cyan-500 outline-none min-h-[120px] text-right"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!selectedActivityType || !memoContent.trim()}
              className="flex-1 bg-cyan-600 text-white py-3 rounded-xl font-bold hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingMemoId ? 'تحديث المذكرة' : 'حفظ المذكرة'}
            </button>
            {editingMemoId && (
              <button
                onClick={() => {
                  setEditingMemoId(null);
                  setMemoTitle('');
                  setMemoContent('');
                  setSelectedActivityType('');
                }}
                className="px-6 bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300 transition-colors"
              >
                إلغاء
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-[rgb(var(--color-text-base))] mb-4 text-right">قائمة المذكرات</h2>
        {memos.length === 0 ? (
          <div className="text-center py-12 bg-[rgb(var(--color-card))] rounded-2xl border border-dashed border-[rgb(var(--color-border))]">
            <i className="fas fa-sticky-note text-4xl text-slate-300 mb-3"></i>
            <p className="text-slate-500">لا توجد مذكرات مضافة حالياً</p>
          </div>
        ) : (
          memos.map(memo => (
            <div key={memo.id} className="bg-[rgb(var(--color-card))] p-4 rounded-xl border border-[rgb(var(--color-border))] shadow-sm flex justify-between items-start gap-4">
              <div className="flex-1 text-right">
                <div className="flex items-center gap-2 mb-2 justify-end">
                  {memo.title && (
                    <h3 className="text-sm font-bold text-[rgb(var(--color-text-base))]">{memo.title}</h3>
                  )}
                  <div className="inline-block px-2 py-1 rounded bg-cyan-100 text-cyan-700 text-xs font-bold">
                    {memo.activityType}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewingMemo(memo)}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 transition-colors rounded-lg"
                  title="عرض"
                >
                  <i className="fas fa-eye"></i>
                </button>
                <button
                  onClick={() => handleEdit(memo)}
                  className="p-2 text-sky-600 hover:bg-sky-50 transition-colors rounded-lg"
                  title="تعديل"
                >
                  <i className="fas fa-edit"></i>
                </button>
                <button
                  onClick={() => onDeleteMemo(String(memo.id))}
                  className="p-2 text-rose-600 hover:bg-rose-50 transition-colors rounded-lg"
                  title="حذف"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={!!viewingMemo} onClose={() => setViewingMemo(null)} title={viewingMemo?.title || "عرض المذكرة"}>
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="mb-4">
              <span className="inline-block px-2 py-1 rounded bg-cyan-100 text-cyan-700 text-xs font-bold">
                {viewingMemo?.activityType}
              </span>
            </div>
            <p className="text-[rgb(var(--color-text-base))] whitespace-pre-wrap leading-relaxed">
              {viewingMemo?.content}
            </p>
          </div>
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setViewingMemo(null)}
              className="btn bg-slate-200 text-slate-800 hover:bg-slate-300"
            >
              إغلاق
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

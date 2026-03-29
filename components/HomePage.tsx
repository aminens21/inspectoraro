
import React, { useMemo } from 'react';
import { SavedReport, OtherReport, ReportType } from '../types';
import { useTranslations } from '../hooks/useTranslations';

interface HomePageProps {
  reports: SavedReport[];
  otherReports: OtherReport[];
  onShowInspectorModal: () => void;
  onNavigateToTeachers: () => void;
  onNavigateToReports: () => void;
  onNavigateToOtherReports: () => void;
  onNavigateToActivitySummary: () => void;
  onNavigateToTransmissionSlip: () => void;
  onNavigateToInspectionSpace: () => void;
  onNavigateToStatistics: () => void;
  onNavigateToResearch: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ 
    reports,
    otherReports,
    onShowInspectorModal, 
    onNavigateToTeachers, 
    onNavigateToReports, 
    onNavigateToOtherReports, 
    onNavigateToActivitySummary,
    onNavigateToTransmissionSlip,
    onNavigateToInspectionSpace,
    onNavigateToStatistics,
    onNavigateToResearch
}) => {
  const { t } = useTranslations();

  const stats = useMemo(() => {
    const visits = reports.filter(r => r.reportType === ReportType.VISIT).length;
    const inspections = reports.filter(r => r.reportType === ReportType.INSPECTION).length;
    const other = otherReports.length;
    const total = visits + inspections + other;
    return { visits, inspections, other, total };
  }, [reports, otherReports]);
  
  return (
    <div className="flex flex-col items-center justify-start text-center">
       <h1 className="text-3xl md:text-4xl font-bold text-[rgb(var(--color-primary))]">{t('appTitle')}</h1>
       <p className="text-lg text-[rgb(var(--color-text-muted))] mt-2 mb-12 max-w-2xl">{t('appDescription')}</p>

      <div className="w-full max-w-4xl mx-auto">
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <button type="button" onClick={onShowInspectorModal} className="bg-[rgb(var(--color-card))] p-4 rounded-xl border border-[rgb(var(--color-border))] hover:border-sky-500 hover:shadow-xl transition-all duration-300 text-center group flex flex-col justify-center items-center h-full min-h-[140px]">
                <i className="fas fa-user-tie text-3xl sm:text-4xl text-sky-500 mb-2 transition-transform duration-300 group-hover:scale-110"></i>
                <h2 className="text-base sm:text-xl font-bold text-sky-500 mb-1">{t('home_inspectorCardTitle')}</h2>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('home_inspectorCardDesc')}</p>
            </button>
            <button type="button" onClick={onNavigateToInspectionSpace} className="bg-[rgb(var(--color-card))] p-4 rounded-xl border border-[rgb(var(--color-border))] hover:border-emerald-500 hover:shadow-xl transition-all duration-300 text-center group flex flex-col justify-center items-center h-full min-h-[140px]">
                <i className="fas fa-users text-3xl sm:text-4xl text-emerald-500 mb-2 transition-transform duration-300 group-hover:scale-110"></i>
                <h2 className="text-base sm:text-xl font-bold text-emerald-500 mb-1">{t('home_teachersCardTitle')}</h2>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('home_teachersCardDesc')}</p>
            </button>
            <button type="button" onClick={onNavigateToReports} className="bg-[rgb(var(--color-card))] p-4 rounded-xl border border-[rgb(var(--color-border))] hover:border-amber-500 hover:shadow-xl transition-all duration-300 text-center group flex flex-col justify-center items-center h-full min-h-[140px]">
                <i className="fas fa-file-alt text-3xl sm:text-4xl text-amber-500 mb-2 transition-transform duration-300 group-hover:scale-110"></i>
                <h2 className="text-base sm:text-xl font-bold text-amber-500 mb-1">{t('home_reportsCardTitle')}</h2>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('home_reportsCardDesc')}</p>
            </button>
             <button type="button" onClick={onNavigateToOtherReports} className="bg-[rgb(var(--color-card))] p-4 rounded-xl border border-[rgb(var(--color-border))] hover:border-violet-500 hover:shadow-xl transition-all duration-300 text-center group flex flex-col justify-center items-center h-full min-h-[140px]">
                <i className="fas fa-file-invoice text-3xl sm:text-4xl text-violet-500 mb-2 transition-transform duration-300 group-hover:scale-110"></i>
                <h2 className="text-base sm:text-xl font-bold text-violet-500 mb-1">{t('home_otherReportsCardTitle')}</h2>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('home_otherReportsCardDesc')}</p>
            </button>
            <button type="button" onClick={onNavigateToTransmissionSlip} className="bg-[rgb(var(--color-card))] p-4 rounded-xl border border-[rgb(var(--color-border))] hover:border-stone-600 hover:shadow-xl transition-all duration-300 text-center group flex flex-col justify-center items-center h-full min-h-[140px]">
                <i className="fas fa-paper-plane text-3xl sm:text-4xl text-stone-600 mb-2 transition-transform duration-300 group-hover:scale-110"></i>
                <h2 className="text-base sm:text-xl font-bold text-stone-600 mb-1">{t('home_transmissionSlipCardTitle')}</h2>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('home_transmissionSlipCardDesc')}</p>
            </button>
             <button type="button" onClick={onNavigateToActivitySummary} className="bg-[rgb(var(--color-card))] p-4 rounded-xl border border-[rgb(var(--color-border))] hover:border-red-500 hover:shadow-xl transition-all duration-300 text-center group flex flex-col justify-center items-center h-full min-h-[140px]">
                <i className="fas fa-tasks text-3xl sm:text-4xl text-red-500 mb-2 transition-transform duration-300 group-hover:scale-110"></i>
                <h2 className="text-base sm:text-xl font-bold text-red-500 mb-1">{t('home_activitySummaryCardTitle')}</h2>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('home_activitySummaryCardDesc')}</p>
            </button>
            <button type="button" onClick={onNavigateToResearch} className="bg-[rgb(var(--color-card))] p-4 rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-500 hover:shadow-xl transition-all duration-300 text-center group flex flex-col justify-center items-center h-full min-h-[140px]">
                <i className="fas fa-lightbulb text-3xl sm:text-4xl text-indigo-500 mb-2 transition-transform duration-300 group-hover:scale-110"></i>
                <h2 className="text-base sm:text-xl font-bold text-indigo-500 mb-1">{t('research_pageTitle')}</h2>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('home_researchCardDesc')}</p>
            </button>
            <button type="button" onClick={onNavigateToStatistics} className="bg-[rgb(var(--color-card))] p-4 rounded-xl border border-[rgb(var(--color-border))] hover:border-cyan-500 hover:shadow-xl transition-all duration-300 text-center group flex flex-col justify-center items-center h-full min-h-[140px]">
                <i className="fas fa-book text-3xl sm:text-4xl text-cyan-500 mb-2 transition-transform duration-300 group-hover:scale-110"></i>
                <h2 className="text-base sm:text-xl font-bold text-cyan-500 mb-1">المذكرات</h2>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">تدبير والاطلاع على المذكرات</p>
            </button>
        </div>

        {/* Concise Statistics Section */}
        <div className="mt-12 mb-8 text-right w-full md:w-1/2 mx-auto" dir="rtl">
            <h2 className="text-base font-bold text-[rgb(var(--color-text-base))] mb-4 flex items-center justify-center gap-2">
                <i className="fas fa-chart-pie text-emerald-500"></i>
                إحصائيات عامة
            </h2>
            
            <div className="grid grid-cols-4 gap-0 mb-4 max-w-xs mx-auto">
                <div className="text-center">
                    <div className="text-xl font-black text-sky-600">{stats.visits}</div>
                    <div className="text-[9px] text-[rgb(var(--color-text-muted))] uppercase font-bold">زيارات</div>
                </div>
                <div className="text-center">
                    <div className="text-xl font-black text-violet-600">{stats.inspections}</div>
                    <div className="text-[9px] text-[rgb(var(--color-text-muted))] uppercase font-bold">تفتيشات</div>
                </div>
                <div className="text-center">
                    <div className="text-xl font-black text-amber-600">{stats.other}</div>
                    <div className="text-[9px] text-[rgb(var(--color-text-muted))] uppercase font-bold">أخرى</div>
                </div>
                <div className="text-center">
                    <div className="text-xl font-black text-emerald-600">{stats.total}</div>
                    <div className="text-[9px] text-[rgb(var(--color-text-muted))] uppercase font-bold">المجموع</div>
                </div>
            </div>

            <div className="flex justify-center">
                <div className="relative h-20 w-full max-w-xs flex items-end justify-center gap-3 px-2 border-b border-r border-[rgb(var(--color-border))]" dir="ltr">
                    <div className="w-8 h-full flex flex-col justify-end items-center gap-1 group">
                        <div className="w-full bg-sky-500 rounded-t-md transition-all duration-500 hover:brightness-110" style={{ height: `${stats.total > 0 ? (stats.visits / stats.total) * 100 : 0}%` }}></div>
                    </div>
                    <div className="w-8 h-full flex flex-col justify-end items-center gap-1 group">
                        <div className="w-full bg-violet-500 rounded-t-md transition-all duration-500 hover:brightness-110" style={{ height: `${stats.total > 0 ? (stats.inspections / stats.total) * 100 : 0}%` }}></div>
                    </div>
                    <div className="w-8 h-full flex flex-col justify-end items-center gap-1 group">
                        <div className="w-full bg-amber-500 rounded-t-md transition-all duration-500 hover:brightness-110" style={{ height: `${stats.total > 0 ? (stats.other / stats.total) * 100 : 0}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

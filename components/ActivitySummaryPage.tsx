
import React, { useState, useMemo, useEffect } from 'react';
import { SavedReport, OtherReport, ReportType, Inspector, Teacher, CalendarEvent } from '../types';
import { useTranslations } from '../hooks/useTranslations';
import { Modal } from './ui/Modal';
import { PageHeader } from './ui/PageHeader';
import { exportFile } from '../services/fileExport';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ar-ma';
import 'moment/locale/ar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { saveEvent, deleteEvent, exportAllData } from '../services/localStorageManager';
import { scheduleEventNotifications, ReminderSetting } from '../services/notificationService';

moment.locale('ar');
const localizer = momentLocalizer(moment);

declare global {
  interface Window {
    XLSX: any;
    jspdf: any;
    html2canvas: any;
    docx: any;
  }
}

interface ActivitySummaryPageProps {
  reports: SavedReport[];
  otherReports: OtherReport[];
  teachers: Teacher[];
  onViewReport: (report: SavedReport) => void;
  onViewOtherReport: (report: OtherReport) => void;
  onGoHome: () => void;
  onEditReport: (report: SavedReport) => void;
  onDeleteReport: (report: SavedReport) => void;
  onEditOtherReport: (report: OtherReport) => void;
  onDeleteOtherReport: (report: OtherReport) => void;
  onToggleReportDelivered: (report: SavedReport) => void;
  onToggleOtherReportDelivered: (report: OtherReport) => void;
  onDeleteAcademicYear: (year: string) => void;
  inspector: Inspector;
  ministryLogo: string;
  ministryLogoHeight?: number;
}

interface UnifiedReport {
  id: string | number;
  seqNumber: number;
  type: 'visit' | 'inspection' | 'other';
  activityType: string; // Specific label for display
  date: string;
  subject: string;
  concernedDepartment: string;
  originalReport: SavedReport | OtherReport;
  isSavedReport: boolean;
  academicYear: string;
  delivered?: boolean;
}

type PeriodType = 's1' | 's2' | 'annual';

const escapeHtml = (unsafe: any): string => {
    const str = String(unsafe || '');
    return str
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

const getAcademicYear = (dateString: string): string => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

export const ActivitySummaryPage: React.FC<ActivitySummaryPageProps> = ({
  reports,
  otherReports,
  teachers,
  onViewReport,
  onViewOtherReport,
  onGoHome,
  onEditReport,
  onDeleteReport,
  onEditOtherReport,
  onDeleteOtherReport,
  onToggleReportDelivered,
  onToggleOtherReportDelivered,
  onDeleteAcademicYear,
  inspector,
  ministryLogo,
  ministryLogoHeight = 120,
}) => {
  const { t } = useTranslations();
  const [filterType, setFilterType] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<'all' | 's1' | 's2'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [reminder1, setReminder1] = useState<ReminderSetting>({ value: 1, unit: 'weeks' });
  const [reminder2, setReminder2] = useState<ReminderSetting>({ value: 1, unit: 'days' });
  const [notificationStatus, setNotificationStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);

  // Archive Years Calculation
  const allAcademicYears = useMemo(() => {
    const years = new Set<string>();
    reports.forEach(r => years.add(getAcademicYear(r.date)));
    otherReports.forEach(o => years.add(getAcademicYear(o.date)));
    return Array.from(years).sort((a, b) => b.localeCompare(a)); // Newest first
  }, [reports, otherReports]);

  // Period Selection State
  const [showSelectionScreen, setShowSelectionScreen] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('s1');
  
  // Calculate default dates based on current academic year
  const defaultDates = useMemo(() => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11
      // If we are in Sept(8) or later, start year is current year. Else it's previous year.
      const startYear = currentMonth >= 8 ? currentYear : currentYear - 1;
      const endYear = startYear + 1;

      return {
          s1Start: `${startYear}-09-01`,
          s1End: `${endYear}-01-31`,
          s2Start: `${endYear}-02-01`,
          s2End: `${endYear}-07-30`, // Updated to July 30th
          annualStart: `${startYear}-09-01`,
          annualEnd: `${endYear}-07-30` // Updated to July 30th
      };
  }, []);

  const [s1Dates, setS1Dates] = useState({ start: defaultDates.s1Start, end: defaultDates.s1End });
  const [s2Dates, setS2Dates] = useState({ start: defaultDates.s2Start, end: defaultDates.s2End });

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<Partial<CalendarEvent>>({});
  const [activeView, setActiveView] = useState<'summary' | 'program'>('summary');
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [isDayEventsModalOpen, setIsDayEventsModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());

  useEffect(() => {
      const data = exportAllData();
      if (data.events) {
          const parsedEvents = data.events.map((e: any) => ({
              ...e,
              start: new Date(e.start),
              end: new Date(e.end)
          }));
          setEvents(parsedEvents);
      }
  }, []);

  const activeDateRange = useMemo(() => {
      if (selectedPeriod === 's1') return s1Dates;
      if (selectedPeriod === 's2') return s2Dates;
      // Annual covers from S1 start to S2 end
      return { start: s1Dates.start, end: s2Dates.end };
  }, [selectedPeriod, s1Dates, s2Dates]);

  // Combine and Filter Reports based on Date Range
  const unifiedReports: UnifiedReport[] = useMemo(() => {
    // 1. Combine
    let combined = [
      ...reports.map((r) => ({ ...r, sourceType: 'SavedReport' as const })),
      ...otherReports.map((o) => ({ ...o, sourceType: 'OtherReport' as const })),
    ];

    // 2. Filter by Date Range IF selection screen is closed (meaning a period is active)
    if (!showSelectionScreen) {
        combined = combined.filter(r => {
            return r.date >= activeDateRange.start && r.date <= activeDateRange.end;
        });
    }

    // 3. Sort
    combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 4. Map to Unified Structure with proper sequence numbers
    return combined.map((report, index) => {
      const academicYear = getAcademicYear(report.date);
      if (report.sourceType === 'SavedReport') {
        const teacher = teachers.find(t => String(t.id) === String(report.teacherId));
        const teacherTitle = teacher?.genre === 'female' ? t('teacher_female') : t('teacher_male');
        const typeLabel = report.reportType === ReportType.VISIT 
            ? t('activitySummary_type_visit') 
            : t('activitySummary_type_inspection');
        return {
          id: report.id!,
          seqNumber: index + 1,
          type: report.reportType,
          activityType: typeLabel,
          date: report.date,
          subject: `${typeLabel} ${teacherTitle}: ${report.teacherName}`,
          concernedDepartment: t('department_pedagogicalAffairs'), 
          originalReport: report,
          isSavedReport: true,
          academicYear,
          delivered: report.delivered,
        };
      } else {
        return {
          id: report.id!,
          seqNumber: index + 1,
          type: 'other',
          activityType: report.activityType || t('activitySummary_type_other'),
          date: report.date,
          subject: report.subject,
          concernedDepartment: report.concernedDepartment,
          originalReport: report,
          isSavedReport: false,
          academicYear,
          delivered: report.delivered,
        };
      }
    });
  }, [reports, otherReports, t, teachers, showSelectionScreen, activeDateRange]);

  const uniqueActivityTypes = useMemo(() => {
      return Array.from(new Set(unifiedReports.map(r => r.activityType)));
  }, [unifiedReports]);

  const filteredAndSearchedReports = useMemo(() => {
    return unifiedReports.filter(report => {
      const typeMatch = filterType === 'all' || report.activityType === filterType;
      const searchMatch = searchTerm === '' || 
        report.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.concernedDepartment.toLowerCase().includes(searchTerm.toLowerCase());
      
      let semesterMatch = true;
      if (semesterFilter === 's1') {
        semesterMatch = report.date >= s1Dates.start && report.date <= s1Dates.end;
      } else if (semesterFilter === 's2') {
        semesterMatch = report.date >= s2Dates.start && report.date <= s2Dates.end;
      }

      return typeMatch && searchMatch && semesterMatch;
    });
  }, [unifiedReports, filterType, searchTerm, semesterFilter, s1Dates, s2Dates]);

  // Statistics Calculation (Based on FILTERED reports by date)
  const stats = useMemo(() => {
      // Use the unifiedReports which are already filtered by date
      const sourceReports = unifiedReports;
      
      // Split Teachers by Sector
      const publicTeachersCount = teachers.filter(t => (t.sector || 'public') === 'public').length;
      const privateTeachersCount = teachers.filter(t => t.sector === 'private').length;

      // Helper: Determine sector of a report
      const getReportSector = (r: UnifiedReport): 'public' | 'private' => {
          if (r.isSavedReport) {
              // For pedagogical reports, verify teacher sector
              const reportData = r.originalReport as SavedReport;
              const teacher = teachers.find(t => String(t.id) === String(reportData.teacherId));
              return teacher?.sector || 'public';
          }
          // Administrative/Other reports are usually general/public
          return 'public';
      };

      const publicReports = sourceReports.filter(r => getReportSector(r) === 'public');
      const privateReports = sourceReports.filter(r => getReportSector(r) === 'private');

      return {
          // Teacher Counts
          teachersCount: teachers.length,
          publicTeachersCount,
          privateTeachersCount,

          // Public Sector Stats
          publicInspections: publicReports.filter(r => r.type === ReportType.INSPECTION).length,
          publicVisits: publicReports.filter(r => r.type === ReportType.VISIT).length,

          // Private Sector Stats
          privateInspections: privateReports.filter(r => r.type === ReportType.INSPECTION).length,
          privateVisits: privateReports.filter(r => r.type === ReportType.VISIT).length,

          // Total Stats
          totalInspections: sourceReports.filter(r => r.type === ReportType.INSPECTION).length,
          totalVisits: sourceReports.filter(r => r.type === ReportType.VISIT).length,

          // General Activities (Usually considered Public/General duty)
          seminars: sourceReports.filter(r => r.activityType === 'الندوات واللقاءات التربوية' || r.activityType === 'ندوة تربوية' || r.activityType === 'لقاء تأطيري').length,
          experimentalLessons: sourceReports.filter(r => r.activityType === 'الدروس التجريبية' || r.activityType === 'درس تجريبي').length,
          trainings: sourceReports.filter(r => r.activityType === 'التكوينات' || r.activityType === 'تكوين' || r.activityType?.includes('تكوين')).length,
          sharedWork: sourceReports.filter(r => r.activityType === 'العمل المشترك').length,
          tenure: sourceReports.filter(r => r.activityType === 'الترسيم والكفاءة').length,
          otherActivities: sourceReports.filter(r => r.type === 'other' && !['الندوات واللقاءات التربوية', 'ندوة تربوية', 'لقاء تأطيري', 'الدروس التجريبية', 'درس تجريبي', 'التكوينات', 'تكوين', 'العمل المشترك', 'الترسيم والكفاءة'].some(k => r.activityType?.includes(k))).length,
      };
  }, [teachers, unifiedReports]);

  const currentAcademicYear = useMemo(() => {
      const now = new Date();
      const year = now.getFullYear();
      return now.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }, []);

  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const handleSelectPeriod = (p: PeriodType) => {
      setSelectedPeriod(p);
      setSemesterFilter('all');
      setShowSelectionScreen(false);
  };

  const handleSelectArchiveYear = (yearStr: string) => {
      const [startYear] = yearStr.split('/');
      const sYear = parseInt(startYear);
      
      // Update the dates to match the archived year
      setS1Dates({ start: `${sYear}-09-01`, end: `${sYear + 1}-01-31` });
      setS2Dates({ start: `${sYear + 1}-02-01`, end: `${sYear + 1}-07-30` });
      
      setSelectedPeriod('annual');
      setSemesterFilter('all');
      setShowSelectionScreen(false);
  };

  const getPeriodDisplayName = () => {
      if (selectedPeriod === 's1') return t('activitySummary_semester1');
      if (selectedPeriod === 's2') return t('activitySummary_semester2');
      return t('activitySummary_annual');
  };

  const getStatsHtml = () => {
      const periodName = getPeriodDisplayName();
      
      // Transform Name and Subject to stack vertically (word by word)
      const formattedName = escapeHtml(inspector.fullName).replace(/\s+/g, '<br/>');
      const formattedSubject = escapeHtml(inspector.subject).replace(/\s+/g, '<br/>');

      return `
        <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <style>
                    @page { 
                        size: landscape; 
                        margin: 0; /* Important: Let the container handle margin for exact PDF replication */
                    }
                    body { 
                        font-family: 'Arial', sans-serif; 
                        background-color: #ffffff; 
                        color: black; 
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100%;
                    }
                    /* Container mimics A4 Landscape Page with padding */
                    .stats-page-container {
                        width: 297mm;
                        height: 210mm;
                        padding: 1cm; /* 1cm margin from edges */
                        box-sizing: border-box;
                        text-align: center;
                        background: white;
                        display: flex;
                        flex-direction: column;
                        /* Justify content to ensure vertical centering if needed, though top align is usually better for reports */
                        align-items: center; 
                    }
                    /* Reset spacing for exact control */
                    p, div, td, th {
                        margin-top: 0;
                        margin-bottom: 0;
                        line-height: 1.4; 
                    }
                    .title-section { 
                        text-align: center; 
                        margin-bottom: 15px; 
                        width: 100%;
                    }
                    /* Exact 3cm x 3cm logo */
                    .ministry-logo {
                        width: auto;
                        height: ${ministryLogoHeight}px;
                        object-fit: contain;
                        display: block;
                        margin: 0 auto;
                    }
                    .admin-info {
                        font-size: 11pt;
                        font-weight: bold;
                        margin-top: 2px;
                    }
                    .title { font-size: 20pt; font-weight: bold; margin-top: 5px; }
                    .subtitle { font-size: 18pt; font-weight: bold; margin-top: 5px; }
                    .period { font-size: 16pt; font-weight: bold; margin-top: 5px; text-decoration: underline; }
                    
                    /* Specific table class for the stats grid */
                    table.stats-table { 
                        border-collapse: collapse; 
                        width: 100%; 
                        direction: rtl; 
                        margin-top: 10px;
                        margin-left: auto;
                        margin-right: auto;
                    }
                    
                    table.stats-table th, table.stats-table td { 
                        border: 1px solid black; 
                        padding: 8px 5px; 
                        text-align: center; 
                        vertical-align: middle; 
                        font-size: 13pt; 
                    }
                    .header-cell { background-color: #e6f3ff; font-weight: bold; } 
                    .blue-cell { background-color: #dae8fc; }

                    /* Signatures Section */
                    .signatures-section {
                        width: 100%;
                        margin-top: 30px;
                        display: flex;
                        justify-content: space-between;
                        padding: 0 20px;
                        box-sizing: border-box;
                    }
                    .signature-box {
                        text-align: center;
                        width: 40%;
                    }
                    .signature-title {
                        font-weight: bold; 
                        font-size: 14pt; 
                        text-decoration: underline; 
                        margin-bottom: 50px;
                    }
                </style>
            </head>
            <body>
                <div class="stats-page-container">
                    <div class="title-section">
                        <img src="${ministryLogo}" class="ministry-logo" alt="Logo" />
                        
                        <div class="title">حصيلة المفتش لموسم ${currentAcademicYear}</div>
                        <div class="subtitle">${escapeHtml(inspector.subject)}</div>
                        ${selectedPeriod !== 'annual' ? `<div class="period">حصيلة ${periodName}</div>` : ''}
                    </div>

                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th class="header-cell" rowspan="2">الإسم<br/>والنسب</th>
                                <th class="header-cell" rowspan="2">رقم<br/>التأجير</th>
                                <th class="header-cell" rowspan="2">التخصص</th>
                                <th class="header-cell blue-cell" colspan="2" rowspan="2"></th> 
                                <th class="header-cell" rowspan="2">عدد<br/>الأساتذة</th>
                                <th class="header-cell" colspan="2">عدد التقارير</th>
                                <th class="header-cell" rowspan="2">الدروس<br/>التجريبية</th>
                                <th class="header-cell" rowspan="2">الندوات<br/>واللقاءات<br/>التربوية</th>
                                <th class="header-cell" rowspan="2">التكوينات</th>
                                <th class="header-cell" rowspan="2">أنشطة<br/>أخرى</th>
                                <th class="header-cell" rowspan="2">العمل<br/>المشترك</th>
                                <th class="header-cell" rowspan="2">الترسيم<br/>والكفاءة</th>
                            </tr>
                            <tr>
                                <th class="header-cell">التفتيشات</th>
                                <th class="header-cell">الزيارات</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td rowspan="4"><strong>${formattedName}</strong></td>
                                <td rowspan="4">${escapeHtml(inspector.financialId || '--')}</td>
                                <td rowspan="4">${formattedSubject}</td>

                                <td class="header-cell" rowspan="2">حضري</td>
                                <td class="header-cell">عمومي</td>
                                
                                <td>${stats.publicTeachersCount}</td>
                                <td>${stats.publicInspections}</td>
                                <td>${stats.publicVisits}</td>
                                
                                <td rowspan="4">${stats.experimentalLessons || '00'}</td>
                                <td rowspan="4">${stats.seminars || '00'}</td>
                                <td rowspan="4">${stats.trainings || '00'}</td>
                                <td rowspan="4">${stats.otherActivities || '00'}</td>
                                <td rowspan="4">${stats.sharedWork || '00'}</td>
                                <td rowspan="4">${stats.tenure || '00'}</td>
                            </tr>
                            <tr>
                                <td class="header-cell">خصوصي</td>
                                <td>${stats.privateTeachersCount}</td> 
                                <td>${stats.privateInspections}</td> 
                                <td>${stats.privateVisits}</td>
                            </tr>
                            <tr>
                                <td class="header-cell" colspan="2">قروي</td>
                                <td>00</td> <td>00</td> <td>00</td>
                            </tr>
                            <tr style="font-weight: bold;">
                                <td class="header-cell" colspan="2">المجموع</td>
                                <td>${stats.teachersCount}</td>
                                <td>${stats.totalInspections}</td>
                                <td>${stats.totalVisits}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="signatures-section">
                        <div class="signature-box">
                            <div class="signature-title">${t('signature_title_1')}</div>
                        </div>
                        <div class="signature-box">
                            <div class="signature-title">${t('signature_regionalDirector')}</div>
                        </div>
                    </div>
                </div>
            </body>
        </html>
      `;
  };

  const getSummaryHtml = () => {
    const periodName = getPeriodDisplayName();
    const currentDate = new Date().toLocaleDateString('ar-MA').replace(/\//g, '/');

    const headerHtmlTemplate = `
        <div style="text-align: center; margin-bottom: 20px; width: 100%;">
            <img src="${ministryLogo}" alt="Logo" style="height: ${ministryLogoHeight}px; display: block; margin: 0 auto 10px auto;" />
            <div style="font-size: 18pt; font-weight: bold; text-decoration: underline; margin-bottom: 10px;">حصيلة أنشطة المفتش التربوي: ${escapeHtml(inspector.fullName)}</div>
            <div style="font-size: 14pt; margin-bottom: 5px; font-weight: bold;">${periodName} (${currentAcademicYear})</div>
            <div style="font-size: 12pt; font-weight: bold;">المادة: ${escapeHtml(inspector.subject)}</div>
        </div>
    `;

    const tableHeaderHtml = `
        <thead>
            <tr style="background-color: #f2f2f2;">
                <th style="white-space: nowrap; border: 1px solid black; padding: 8px 5px; font-size: 12pt; color: black; text-align: center; font-weight: bold; width: 5%;">ر.ت</th>
                <th style="white-space: nowrap; border: 1px solid black; padding: 8px 5px; font-size: 12pt; color: black; text-align: center; font-weight: bold; width: 10%;">النوع</th>
                <th style="white-space: nowrap; border: 1px solid black; padding: 8px 5px; font-size: 12pt; color: black; text-align: center; font-weight: bold; width: 10%;">التاريخ</th>
                <th style="border: 1px solid black; padding: 8px 8px; font-size: 12pt; color: black; text-align: right; font-weight: bold; width: 45%;">الموضوع</th>
                <th style="border: 1px solid black; padding: 8px 8px; font-size: 12pt; color: black; text-align: right; font-weight: bold; width: 30%;">المصلحة المعنية</th>
            </tr>
        </thead>
    `;

    // 10 rows per page to match typical document density
    const reportChunks = chunkArray(filteredAndSearchedReports, 10);

    const pagesHtml = reportChunks.map((chunk, pageIdx) => {
        const rowsHtml = chunk.map((report: UnifiedReport) => `
            <tr>
                <td style="border: 1px solid black; padding: 6px 10px; text-align: center; color: black; font-size: 11pt;">${report.seqNumber}</td>
                <td style="border: 1px solid black; padding: 6px 10px; text-align: center; color: black; font-size: 11pt;">${escapeHtml(report.activityType)}</td>
                <td style="border: 1px solid black; padding: 6px 10px; text-align: center; color: black; font-size: 11pt; white-space: nowrap;">${new Date(report.date).toLocaleDateString('ar-MA')}</td>
                <td style="border: 1px solid black; padding: 6px 10px; text-align: right; color: black; font-size: 11pt; word-wrap: break-word; overflow-wrap: break-word;">${escapeHtml(report.subject)}</td>
                <td style="border: 1px solid black; padding: 6px 10px; text-align: right; color: black; font-size: 11pt; word-wrap: break-word; overflow-wrap: break-word;">${escapeHtml(report.concernedDepartment)}</td>
            </tr>
        `).join('');

        const isLastPage = pageIdx === reportChunks.length - 1;

        return `
            <div class="summary-page-block" style="
                padding: 10mm 15mm; 
                background-color: white; 
                width: 297mm; 
                height: 210mm; 
                box-sizing: border-box; 
                position: relative; 
                page-break-after: always;
                display: block;
                color: black;
                overflow: hidden;
            ">
                ${headerHtmlTemplate}
                <table style="width: 100%; border-collapse: collapse; margin-top: 5px; background-color: white; table-layout: fixed;">
                    ${tableHeaderHtml}
                    <tbody>${rowsHtml}</tbody>
                </table>
                ${isLastPage ? `<div style="margin-top: 30px; text-align: left; color: black; display: block; clear: both; padding-left: 20px;"><p style="margin: 0; font-weight: bold; text-decoration: underline; font-size: 14pt;">${t('report_signature_line')}</p></div>` : ''}
                <div style="position: absolute; bottom: 10mm; left: 0; width: 100%; text-align: center; font-size: 10pt; color: black;">الصفحة ${pageIdx + 1} من ${reportChunks.length}</div>
            </div>
        `;
    }).join('');

    return `
        <html dir="rtl">
            <head><meta charset="UTF-8"><style>@font-face {font-family:'Sakkal Majalla';src:local('Sakkal Majalla'), local('SakkalMajalla'), url('https://db.onlinewebfonts.com/t/056353a27c68233bc7a545e1459b2528.woff2') format('woff2');}body{font-family:'Sakkal Majalla',Arial,sans-serif;margin:0;padding:0;background-color:#ffffff;}.summary-page-block{font-family:'Sakkal Majalla',Arial,sans-serif;}table{border-spacing:0;width:100%;}th,td{color:black!important;border-color:black!important;word-wrap:break-word;overflow-wrap:break-word;}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}</style></head>
            <body><div id="full-summary-export-wrapper">${pagesHtml || `<div class="summary-page-block" style="padding: 40px; background-color: white; text-align: center; color: black;">${t('activitySummary_noReports')}</div>`}</div></body>
        </html>
    `;
  };

  const generatePdfBlob = async (htmlContent: string, landscape = true): Promise<Blob | null> => {
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
        alert(t('errorExportLibrary'));
        return null;
    }
    const { jsPDF } = window.jspdf;
    
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-10000px';
    container.style.top = '0';
    // Match the CSS dimension exactly for optimal capture
    container.style.width = landscape ? '297mm' : '210mm'; 
    // Allow height to grow for multi-page, but for single stats page, it should match
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    const images = container.getElementsByTagName('img');
    await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
    }));

    await new Promise(r => setTimeout(r, 1200));

    try {
        const pdf = new jsPDF({
            orientation: landscape ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        // Check if this is the stats page by class name
        const isStatsPage = container.querySelector('.stats-page-container');

        if (isStatsPage) {
             // For Stats Page: Capture the single container and stretch to fit the entire A4 landscape page
             // This ensures margins defined in HTML/CSS are respected relative to the edge
             const canvas = await window.html2canvas(isStatsPage as HTMLElement, { 
                 scale: 2, 
                 useCORS: true, 
                 backgroundColor: '#ffffff',
                 logging: false
             });
             const imgData = canvas.toDataURL('image/png');
             // Add image at 0,0 with full A4 dimensions. The padding inside .stats-page-container provides the margins.
             pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
        } else {
            // For multi-page detailed summary
            const pageElements = container.querySelectorAll('.summary-page-block');
            if (pageElements.length > 0) {
                for (let i = 0; i < pageElements.length; i++) {
                    if (i > 0) pdf.addPage();
                    const pageEl = pageElements[i] as HTMLElement;
                    const canvas = await window.html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, width: pageEl.offsetWidth, height: pageEl.offsetHeight });
                    const imgData = canvas.toDataURL('image/png');
                    const margin = 10;
                    const imgWidth = (landscape ? 297 : 210) - (margin * 2);
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
                }
            } else {
                // Fallback
                const canvas = await window.html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/png');
                const margin = 10;
                const imgWidth = (landscape ? 297 : 210) - (margin * 2);
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
            }
        }
        return pdf.output('blob');
    } catch (err) {
        console.error('PDF Generation Error:', err);
        return null;
    } finally {
        document.body.removeChild(container);
    }
  };

  const handleExportWord = async () => {
    const periodName = getPeriodDisplayName();
    const currentDate = new Date().toLocaleDateString('ar-MA').replace(/\//g, '/');

    const tableRows = filteredAndSearchedReports.map(report => `
        <tr>
            <td style="border: 1px solid black; padding: 8px; text-align: center; color: black; font-size: 11pt;">${report.seqNumber}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: center; color: black; font-size: 11pt;">${escapeHtml(report.activityType)}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: center; color: black; white-space: nowrap; font-size: 11pt;">${new Date(report.date).toLocaleDateString('ar-MA')}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: right; color: black; font-size: 11pt;">${escapeHtml(report.subject)}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: right; color: black; font-size: 11pt;">${escapeHtml(report.concernedDepartment)}</td>
        </tr>
    `).join('');

    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <style>
                @page { size: a4 landscape; margin: 1cm; }
                body { font-family: 'Sakkal Majalla', Arial, sans-serif; direction: rtl; color: black; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid black; padding: 8px; text-align: right; font-size: 11pt; color: black; }
                th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
            </style>
        </head>
        <body>
            <table style="width: 100%; margin-bottom: 20px; border: none;">
                <tr style="border: none;">
                    <td style="width: 35%; text-align: right; vertical-align: top; border: none;">
                        <p style="font-size: 9pt; margin: 0; text-align: center; display: inline-block;">المملكة المغربية</p>
                    </td>
                    <td style="width: 45%; text-align: center; vertical-align: middle; border: none;">
                        <p style="font-size: 18pt; font-weight: bold; text-decoration: underline; margin-bottom: 10px;">حصيلة أنشطة المفتش التربوي: ${escapeHtml(inspector.fullName)}</p>
                        <p style="font-size: 14pt; margin: 0; font-weight: bold;">${periodName} (${currentAcademicYear})</p>
                        <p style="font-size: 12pt; font-weight: bold; margin: 0;">المادة: ${escapeHtml(inspector.subject)}</p>
                    </td>
                    <td style="width: 20%; text-align: left; vertical-align: top; border: none;">
                        <p style="font-size: 12pt; font-weight: bold; margin: 0;">${currentDate}</p>
                    </td>
                </tr>
            </table>
            <table>
                <thead>
                    <tr><th style="width: 5%;">ر.ت</th><th style="width: 10%;">النوع</th><th style="width: 10%;">التاريخ</th><th style="width: 45%;">الموضوع</th><th style="width: 30%;">المصلحة المعنية</th></tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </body>
        </html>
    `;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    await exportFile(blob, `${t('activitySummary_pageTitle')}.doc`);
  };

  const handleExportStatsWord = async () => {
    const htmlContent = getStatsHtml();
    // Wrap in Word-specific XML/HTML envelope for landscape and margins
    const wordHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <style>
                /* Force Landscape and margins for Word */
                @page { 
                    size: 29.7cm 21cm; /* A4 Landscape dimensions */
                    mso-page-orientation: landscape;
                    margin: 1cm; 
                }
                body { 
                    font-family: 'Arial', sans-serif; 
                    direction: rtl; 
                    margin: 0; 
                    padding: 0; 
                    background-color: #ffffff; 
                }
                /* Reset spacing for Word */
                p, div, td, th {
                    margin: 0;
                    padding: 0;
                    line-height: 1.0;
                }
                /* Ensure Logo is 3cm */
                .ministry-logo {
                    width: 3cm;
                    height: 3cm;
                }
                .stats-page-container {
                    width: 100%;
                    box-sizing: border-box;
                    text-align: center;
                }
                table { 
                    border-collapse: collapse; 
                    width: 100%; 
                    direction: rtl; 
                    margin-top: 20px;
                    margin-left: auto;
                    margin-right: auto;
                }
                th, td { 
                    border: 1px solid black; 
                    padding: 4px 5px; 
                    text-align: center; 
                    vertical-align: middle; 
                    font-size: 11pt; 
                }
                .header-cell { background-color: #e6f3ff; font-weight: bold; }
                .blue-cell { background-color: #dae8fc; }
                .title-section { text-align: center; margin-bottom: 30px; }
                .title { font-size: 18pt; font-weight: bold; margin-top: 10px; }
                .subtitle { font-size: 16pt; font-weight: bold; margin-top: 5px; }
                .period { font-size: 14pt; font-weight: bold; margin-top: 5px; text-decoration: underline; }
            </style>
        </head>
        <body>
            ${htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || htmlContent}
        </body>
        </html>
    `;
    const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword' });
    await exportFile(blob, `الحصيلة_الرقمية.doc`);
  };
  
  const handleExportPdf = async (html: string = getSummaryHtml(), landscape: boolean = true, filename: string = t('activitySummary_pageTitle')) => {
    const pdfBlob = await generatePdfBlob(html, landscape);
    if (pdfBlob) {
        await exportFile(pdfBlob, `${filename}.pdf`);
    }
  };

  const exportToICS = () => {
      if (events.length === 0) {
          alert('لا توجد أنشطة لتصديرها');
          return;
      }

      let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Tafteesh App//AR\r\nCALSCALE:GREGORIAN\r\n";
      
      events.forEach(event => {
          const startDate = moment(event.start).format('YYYYMMDDTHHmmss');
          const endDate = moment(event.end).format('YYYYMMDDTHHmmss');
          const dtStamp = moment().format('YYYYMMDDTHHmmss');
          
          icsContent += "BEGIN:VEVENT\r\n";
          icsContent += `DTSTART:${startDate}\r\n`;
          icsContent += `DTEND:${endDate}\r\n`;
          icsContent += `DTSTAMP:${dtStamp}Z\r\n`;
          icsContent += `UID:${event.id}@tafteesh.app\r\n`;
          icsContent += `SUMMARY:${event.title}\r\n`;
          icsContent += `DESCRIPTION:نشاط: ${event.title}\r\n`;
          
          // Alarm 1 week before
          icsContent += "BEGIN:VALARM\r\n";
          icsContent += "TRIGGER:-P1W\r\n";
          icsContent += "ACTION:DISPLAY\r\n";
          icsContent += `DESCRIPTION:تذكير: ${event.title} بعد أسبوع\r\n`;
          icsContent += "END:VALARM\r\n";

          // Alarm 3 days before
          icsContent += "BEGIN:VALARM\r\n";
          icsContent += "TRIGGER:-P3D\r\n";
          icsContent += "ACTION:DISPLAY\r\n";
          icsContent += `DESCRIPTION:تذكير: ${event.title} بعد 3 أيام\r\n`;
          icsContent += "END:VALARM\r\n";

          icsContent += "END:VEVENT\r\n";
      });

      icsContent += "END:VCALENDAR";

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', 'البرنامج_السنوي.ics');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleScheduleNotifications = () => {
      setNotificationStatus(null);
      setIsNotificationModalOpen(true);
  };

  const confirmScheduleNotifications = async () => {
      const success = await scheduleEventNotifications(events, reminder1, reminder2);
      if (success) {
          setNotificationStatus({ type: 'success', message: 'تمت جدولة الإشعارات المحلية بنجاح!' });
          setTimeout(() => {
              setIsNotificationModalOpen(false);
              setNotificationStatus(null);
          }, 2000);
      } else {
          setNotificationStatus({ type: 'error', message: 'تعذر جدولة الإشعارات. تأكد من منح الصلاحيات اللازمة.' });
      }
  };

  const handleShare = async (html: string = getSummaryHtml(), landscape: boolean = true, filename: string = t('activitySummary_pageTitle')) => {
    const pdfBlob = await generatePdfBlob(html, landscape);
    if (pdfBlob) {
        await exportFile(pdfBlob, `${filename}.pdf`);
    }
  };

  const handleView = (report: UnifiedReport) => {
    if (report.isSavedReport) onViewReport(report.originalReport as SavedReport);
    else onViewOtherReport(report.originalReport as OtherReport);
  };

  const handleEdit = (report: UnifiedReport) => {
    if (report.isSavedReport) onEditReport(report.originalReport as SavedReport);
    else onEditOtherReport(report.originalReport as OtherReport);
  };

  const handleDelete = (report: UnifiedReport) => {
    if (report.isSavedReport) onDeleteReport(report.originalReport as SavedReport);
    else onDeleteOtherReport(report.originalReport as OtherReport);
  };

  const handleToggleDelivered = (report: UnifiedReport) => {
    if (report.isSavedReport) onToggleReportDelivered(report.originalReport as SavedReport);
    else onToggleOtherReportDelivered(report.originalReport as OtherReport);
  };

  const previewBodyHtml = useMemo(() => {
    const html = getSummaryHtml();
    // Extract styles (in head) and body content to render correctly in shadow DOM-like structure
    const styleMatch = html.match(/<style>([\s\S]*)<\/style>/i);
    const styleContent = styleMatch ? styleMatch[1] : '';
    
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';
    
    // Return concatenated style + body for dangeroustSetInnerHTML
    return `<style>${styleContent}</style>${bodyContent}`;
  }, [filteredAndSearchedReports, inspector, ministryLogo, ministryLogoHeight, selectedPeriod, activeDateRange]);

  const statsBodyHtml = useMemo(() => {
      const html = getStatsHtml();
      
      const styleMatch = html.match(/<style>([\s\S]*)<\/style>/i);
      const styleContent = styleMatch ? styleMatch[1] : '';
      
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyContent = bodyMatch ? bodyMatch[1] : '';

      return `<style>${styleContent}</style>${bodyContent}`;
  }, [stats, inspector, ministryLogo, ministryLogoHeight, selectedPeriod, activeDateRange]);

  if (showSelectionScreen) {
      return (
        <div className="container mx-auto p-4 md:p-6 min-h-screen flex flex-col items-center justify-center">
            <h1 className="text-3xl font-bold text-sky-700 mb-8">{t('activitySummary_pageTitle')}</h1>
            
            <div className="flex flex-col gap-6 w-full max-w-4xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Program Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-sky-200 dark:border-sky-800 p-6 flex flex-col gap-4 transform transition-all hover:scale-105 cursor-pointer" onClick={() => { setActiveView('program'); setSelectedPeriod('annual'); setShowSelectionScreen(false); }}>
                        <div className="text-center mb-2">
                            <div className="inline-block p-4 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 mb-4">
                                <i className="fas fa-calendar-alt text-4xl"></i>
                            </div>
                            <h2 className="text-3xl font-bold text-sky-700 dark:text-sky-400">البرنامج</h2>
                            <p className="text-slate-500 mt-2">تخطيط وبرمجة الأنشطة والمهام</p>
                        </div>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-emerald-200 dark:border-emerald-800 p-6 flex flex-col gap-4 transform transition-all hover:scale-105 cursor-pointer" onClick={() => { setActiveView('summary'); setSelectedPeriod('annual'); setShowSelectionScreen(false); }}>
                        <div className="text-center mb-2">
                            <div className="inline-block p-4 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 mb-4">
                                <i className="fas fa-chart-bar text-4xl"></i>
                            </div>
                            <h2 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">الحصيلة</h2>
                            <p className="text-slate-500 mt-2">عرض إحصائيات وتقارير الأنشطة المنجزة</p>
                        </div>
                    </div>
                </div>

                {/* Archive Section */}
                {allAcademicYears.length > 0 && (
                    <div className="mt-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-px flex-grow bg-slate-200 dark:bg-slate-700"></div>
                            <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider">{t('activitySummary_archiveTitle')}</h3>
                            <div className="h-px flex-grow bg-slate-200 dark:bg-slate-700"></div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {allAcademicYears.map(year => (
                                <div key={year} className="relative group">
                                    <button
                                        onClick={() => handleSelectArchiveYear(year)}
                                        className="w-full flex flex-col items-center gap-2 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition-all"
                                    >
                                        <div className="text-amber-500 group-hover:scale-110 transition-transform">
                                            <i className="fas fa-folder text-4xl"></i>
                                        </div>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{year}</span>
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteAcademicYear(year);
                                        }}
                                        className="absolute top-2 left-2 p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                        title={t('delete')}
                                    >
                                        <i className="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <button onClick={onGoHome} className="mt-12 text-slate-500 hover:text-slate-700 font-bold flex items-center gap-2 px-6 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                <i className="fas fa-home"></i> {t('home')}
            </button>
        </div>
      );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <PageHeader
        title={
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-4">
                    <button onClick={onGoHome} title={t('home')} className="btn bg-slate-600 text-white hover:bg-slate-700">
                        <i className="fas fa-home"></i>
                    </button>
                    <h1 className="text-xl md:text-2xl font-bold text-red-500">
                        {activeView === 'program' ? 'البرنامج السنوي' : t('activitySummary_pageTitle')}
                    </h1>
                </div>
                <div className="text-sm font-bold text-slate-500 pr-14">
                    {getPeriodDisplayName()} ({activeDateRange.start} / {activeDateRange.end})
                </div>
            </div>
        }
        actions={
            <div className="flex flex-wrap gap-2 justify-end items-center">
                {activeView === 'program' && (
                    <>
                    <button onClick={handleScheduleNotifications} className="btn bg-emerald-600 text-white hover:bg-emerald-700 shadow-md">
                        <i className="fas fa-bell ltr:mr-2 rtl:ml-2"></i>
                        <span className="hidden sm:inline">تفعيل الإشعارات المحلية</span>
                    </button>
                    <button onClick={exportToICS} className="btn bg-indigo-600 text-white hover:bg-indigo-700 shadow-md">
                        <i className="fas fa-calendar-plus ltr:mr-2 rtl:ml-2"></i>
                        <span className="hidden sm:inline">تصدير للتقويم</span>
                    </button>
                    </>
                )}
                <button onClick={() => setShowSelectionScreen(true)} className="btn bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200">
                    <i className="fas fa-calendar-alt ltr:mr-2 rtl:ml-2"></i>
                    <span className="hidden sm:inline">{t('activitySummary_changePeriod')}</span>
                </button>
                {activeView === 'summary' && (
                    <>
                        <button onClick={() => setIsStatsModalOpen(true)} className="btn bg-emerald-600 text-white hover:bg-emerald-700 shadow-md">
                            <i className="fas fa-chart-bar ltr:mr-2 rtl:ml-2"></i>
                            <span className="hidden sm:inline">الحصيلة الرقمية</span>
                        </button>
                        <button onClick={() => setIsPreviewModalOpen(true)} className="btn bg-sky-600 text-white hover:bg-sky-700">
                            <i className="fas fa-print ltr:mr-2 rtl:ml-2"></i>
                            <span className="hidden sm:inline">معاينة وطباعة الحصيلة</span>
                        </button>
                    </>
                )}
            </div>
        }
      />

      {activeView === 'summary' ? (
        <>
          <div className="bg-[rgb(var(--color-card))] p-6 rounded-xl border border-[rgb(var(--color-border))] mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[rgb(var(--color-text-base))] mb-1">{t('activitySummary_reportType')}</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-style w-full"
            >
              <option value="all">{t('activitySummary_allTypes')}</option>
              {uniqueActivityTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[rgb(var(--color-text-base))] mb-1">{t('reportsList_academicYear')}</label>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value as any)}
              className="input-style w-full"
            >
              <option value="all">{t('reportsList_allYears')}</option>
              <option value="s1">{t('activitySummary_semester1')}</option>
              <option value="s2">{t('activitySummary_semester2')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[rgb(var(--color-text-base))] mb-1">{t('search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('activitySummary_searchPlaceholder')}
              className="input-style w-full"
            />
          </div>
        </div>
      </div>

      {filteredAndSearchedReports.length === 0 ? (
          <div className="text-center py-16 bg-[rgb(var(--color-card))] rounded-xl border border-[rgb(var(--color-border))]">
              <i className="fas fa-folder-open text-6xl text-slate-300 mb-4"></i>
              <p className="text-[rgb(var(--color-text-muted))] text-xl">{t('activitySummary_noReports')}</p>
          </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSearchedReports.map((report) => {
              // Custom coloring based on type
              let borderColor = 'border-slate-500';
              let badgeBg = 'bg-slate-100';
              let badgeText = 'text-slate-800';

              if (report.type === 'visit') {
                  borderColor = 'border-sky-500'; badgeBg = 'bg-sky-100'; badgeText = 'text-sky-800';
              } else if (report.type === 'inspection') {
                  borderColor = 'border-violet-500'; badgeBg = 'bg-violet-100'; badgeText = 'text-violet-800';
              } else if (report.activityType === 'ندوة تربوية') {
                  borderColor = 'border-amber-500'; badgeBg = 'bg-amber-100'; badgeText = 'text-amber-800';
              }

              return (
                <div key={report.id} className={`bg-[rgb(var(--color-card))] rounded-lg shadow-sm border border-l-4 ${borderColor} p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:shadow-md transition-shadow`}>
                    <div className="flex items-start gap-4 flex-grow">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-[rgb(var(--color-background))] rounded-full font-bold text-[rgb(var(--color-text-base))]">
                            {report.seqNumber}
                        </div>
                        <div className="flex-grow">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                                <h3 className={`font-bold text-md ${report.delivered ? 'text-slate-500 dark:text-slate-400' : 'text-[rgb(var(--color-text-base))]'}`}>
                                    {report.subject}
                                </h3>
                                <span className={`flex-shrink-0 px-2 py-1 text-xs font-semibold rounded-full ${badgeBg} ${badgeText}`}>
                                    {report.activityType}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1 text-sm text-[rgb(var(--color-text-muted))]">
                                <span className="flex items-center gap-1.5">
                                    <i className="fas fa-building fa-fw w-4 text-center"></i>
                                    <span>{report.concernedDepartment}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <i className="fas fa-calendar-alt fa-fw w-4 text-center"></i>
                                    <span>{new Date(report.date).toLocaleDateString('ar-MA')}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4 rtl:space-x-reverse self-end sm:self-center flex-shrink-0">
                        <button 
                            onClick={() => handleToggleDelivered(report)} 
                            className={`${report.delivered ? 'text-emerald-600' : 'text-slate-400'} hover:text-emerald-700 transition-colors`}
                            title={report.delivered ? t('delivered') : t('mark_as_delivered')}
                        >
                            <i className={`fas ${report.delivered ? 'fa-check-circle' : 'fa-check'} fa-lg`}></i>
                        </button>
                        <button onClick={() => handleView(report)} className="text-sky-600 hover:text-sky-900" title={t('view')}><i className="fas fa-eye fa-lg"></i></button>
                        <button onClick={() => handleEdit(report)} className="text-amber-600 hover:text-amber-900" title={t('edit')}><i className="fas fa-edit fa-lg"></i></button>
                        <button onClick={() => handleDelete(report)} className="text-rose-600 hover:text-rose-900" title={t('delete')}><i className="fas fa-trash-alt fa-lg"></i></button>
                    </div>
                </div>
              );
          })}
        </div>
      )}
      </>
      ) : (
      <div className="bg-[rgb(var(--color-card))] p-6 rounded-xl border border-[rgb(var(--color-border))]">
          <h2 className="text-2xl font-bold text-[rgb(var(--color-text-base))] mb-6 border-b pb-2">البرنامج</h2>
          <div className="calendar-container">
              <Calendar
                  localizer={localizer}
                  culture="ar"
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%' }}
                  selectable
                  eventPropGetter={(event: CalendarEvent) => {
                      let backgroundColor = '#64748b'; // Default Slate
                      
                      if (event.importance === 'high') backgroundColor = '#e11d48'; // Red
                      else if (event.importance === 'medium') backgroundColor = '#f59e0b'; // Amber
                      else if (event.importance === 'low') backgroundColor = '#3b82f6'; // Blue
                      else {
                          // Fallback to hash-based color if no importance is set
                          const colors = ['#0284c7', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2', '#4f46e5', '#be123c'];
                          const hash = String(event.id || event.title).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                          const colorIndex = hash % colors.length;
                          backgroundColor = colors[colorIndex];
                      }

                      return {
                          style: {
                              backgroundColor,
                              borderRadius: '4px',
                              opacity: 0.9,
                              color: 'white',
                              border: '0px',
                              display: 'block'
                          }
                      };
                  }}
                  components={{
                      event: (props) => {
                          const firstWord = props.title.split(' ')[0];
                          const event = props.event as CalendarEvent;
                          return (
                              <div className="text-xs sm:text-sm truncate" title={`${props.title}${event.location ? ` - ${event.location}` : ''}`}>
                                  <span className="sm:hidden">{firstWord}</span>
                                  <span className="hidden sm:inline">{props.title}</span>
                                  {event.location && <span className="hidden md:inline text-[10px] opacity-80 mr-1">({event.location})</span>}
                              </div>
                          );
                      },
                      month: {
                          dateHeader: ({ date, label }) => {
                              const isSunday = date.getDay() === 0;
                              return (
                                  <span style={isSunday ? { color: '#e11d48', fontWeight: 'bold' } : {}}>
                                      {label}
                                  </span>
                              );
                          }
                      }
                  }}
                  onSelectSlot={(slotInfo) => {
                      const dayEvents = events.filter(e => 
                          moment(e.start).isSame(slotInfo.start, 'day') || 
                          moment(e.end).isSame(slotInfo.start, 'day') ||
                          (moment(e.start).isBefore(slotInfo.start) && moment(e.end).isAfter(slotInfo.start))
                      );
                      if (dayEvents.length > 0) {
                          setSelectedDayEvents(dayEvents);
                          setSelectedDay(slotInfo.start);
                          setIsDayEventsModalOpen(true);
                      } else {
                          setCurrentEvent({
                              start: slotInfo.start,
                              end: slotInfo.end,
                          });
                          setIsEventModalOpen(true);
                      }
                  }}
                  onSelectEvent={(event) => {
                      setCurrentEvent(event);
                      setIsEventModalOpen(true);
                  }}
                  messages={{
                      next: "التالي",
                      previous: "السابق",
                      today: "اليوم",
                      month: "شهر",
                      week: "أسبوع",
                      day: "يوم",
                      agenda: "أجندة",
                      date: "تاريخ",
                      time: "وقت",
                      event: "حدث",
                      noEventsInRange: "لا توجد أحداث في هذه الفترة."
                  }}
                  formats={{
                      monthHeaderFormat: (date) => {
                          const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
                          return `${months[date.getMonth()]} ${date.getFullYear()}`;
                      }
                  }}
                  rtl={true}
              />
          </div>
      </div>
      )}

       {/* Day Events Modal */}
       <Modal isOpen={isDayEventsModalOpen} onClose={() => setIsDayEventsModalOpen(false)} title={`أحداث يوم ${selectedDay ? moment(selectedDay).format('LL') : ''}`}>
           <div className="flex flex-col gap-4">
               {selectedDayEvents.map(event => (
                   <div key={event.id} className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 hover:border-sky-400 cursor-pointer transition-colors" onClick={() => {
                       setCurrentEvent(event);
                       setIsDayEventsModalOpen(false);
                       setIsEventModalOpen(true);
                   }}>
                       <h3 className="font-bold text-lg text-slate-800 dark:text-white">{event.title}</h3>
                       <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                           <p className="text-sm text-slate-500">
                               <i className="fas fa-clock ml-1"></i>
                               {moment(event.start).format('LT')} - {moment(event.end).format('LT')}
                           </p>
                           {event.location && (
                               <p className="text-sm text-teal-600 dark:text-teal-400">
                                   <i className="fas fa-map-marker-alt ml-1"></i>
                                   {event.location}
                               </p>
                           )}
                       </div>
                   </div>
               ))}
               <button onClick={() => {
                   setCurrentEvent({
                       start: selectedDay || new Date(),
                       end: selectedDay || new Date(),
                   });
                   setIsDayEventsModalOpen(false);
                   setIsEventModalOpen(true);
               }} className="btn bg-emerald-600 text-white hover:bg-emerald-700 w-full justify-center mt-2">
                   <i className="fas fa-plus ml-2"></i> إضافة حدث جديد
               </button>
           </div>
       </Modal>

       {/* Detailed Report Preview Modal */}
       <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title={t('activitySummary_pageTitle')} size="5xl">
           <div
            className="report-preview-container-forced-style max-h-[65vh] overflow-auto p-2 rounded-lg bg-gray-50 flex flex-col items-center gap-4"
           >
                <div className="w-full flex flex-col items-center transition-all duration-300 origin-top" style={{ 
                    zoom: window.innerWidth < 768 ? '0.35' : '0.55', 
                    width: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    cursor: 'zoom-in'
                }} onClick={(e) => {
                    const target = e.currentTarget;
                    const currentZoom = target.style.zoom;
                    const defaultZoom = window.innerWidth < 768 ? '0.35' : '0.55';
                    target.style.zoom = currentZoom === '1' ? defaultZoom : '1';
                    target.style.cursor = currentZoom === '1' ? 'zoom-in' : 'zoom-out';
                }}>
                    <div dangerouslySetInnerHTML={{ __html: previewBodyHtml }} />
                </div>
           </div>
           <div className="text-center text-[10px] text-slate-400 mt-1">انقر على المعاينة للتكبير/التصغير (Zoom)</div>
           <div className="flex justify-end pt-4 mt-4 border-t border-[rgb(var(--color-border))] print-hidden space-x-2 rtl:space-x-reverse">
                <button onClick={() => handleShare(getSummaryHtml(), true)} title={t('share')} className="btn p-0 h-10 w-10 justify-center bg-teal-600 text-white hover:bg-teal-700">
                    <i className="fas fa-share-alt"></i>
                </button>
                <button onClick={handleExportWord} title={t('exportWord')} className="btn p-0 h-10 w-10 justify-center bg-blue-600 text-white hover:bg-blue-700">
                    <i className="fas fa-file-word"></i>
                </button>
                <button onClick={() => handleExportPdf(getSummaryHtml(), true)} title={t('exportPdf')} className="btn p-0 h-10 w-10 justify-center bg-red-600 text-white hover:bg-red-700">
                    <i className="fas fa-file-pdf"></i>
                </button>
                <button onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if(printWindow) {
                        printWindow.document.write(getSummaryHtml());
                        printWindow.document.close();
                        setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 1000);
                    }
                }} title={t('print')} className="btn p-0 h-10 w-10 justify-center bg-sky-700 text-white hover:bg-sky-800">
                    <i className="fas fa-print"></i>
                </button>
           </div>
       </Modal>

       {/* Notification Settings Modal */}
       <Modal isOpen={isNotificationModalOpen} onClose={() => setIsNotificationModalOpen(false)} title="إعدادات الإشعارات المحلية">
           <div className="p-4 space-y-6">
               {notificationStatus && (
                   <div className={`p-4 rounded-lg border ${notificationStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                       <i className={`fas ${notificationStatus.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} ltr:mr-2 rtl:ml-2`}></i>
                       {notificationStatus.message}
                   </div>
               )}

               {events.length === 0 ? (
                   <div className="bg-amber-50 text-amber-800 p-4 rounded-lg border border-amber-200">
                       <i className="fas fa-exclamation-triangle ltr:mr-2 rtl:ml-2"></i>
                       لا توجد أنشطة في البرنامج السنوي لجدولتها. يرجى إضافة أنشطة أولاً.
                   </div>
               ) : (
                   <>
                       <p className="text-slate-600 text-sm">
                           سيتم إرسال إشعارين لكل نشاط قادم. يمكنك تحديد وقت الإشعارات أدناه:
                       </p>
                       
                       <div className="space-y-4">
                           <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                               <h4 className="font-bold text-slate-700 mb-3">الإشعار الأول</h4>
                               <div className="flex gap-2 items-center">
                                   <span className="text-sm text-slate-600">تذكير قبل:</span>
                                   <input 
                                       type="number" 
                                       min="1" 
                                       value={reminder1.value} 
                                       onChange={(e) => setReminder1({...reminder1, value: parseInt(e.target.value) || 1})}
                                       className="input w-20 text-center"
                                   />
                                   <select 
                                       value={reminder1.unit} 
                                       onChange={(e) => setReminder1({...reminder1, unit: e.target.value as any})}
                                       className="input flex-1"
                                   >
                                       <option value="minutes">دقائق</option>
                                       <option value="hours">ساعات</option>
                                       <option value="days">أيام</option>
                                       <option value="weeks">أسابيع</option>
                                   </select>
                               </div>
                           </div>

                           <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                               <h4 className="font-bold text-slate-700 mb-3">الإشعار الثاني</h4>
                               <div className="flex gap-2 items-center">
                                   <span className="text-sm text-slate-600">تذكير قبل:</span>
                                   <input 
                                       type="number" 
                                       min="1" 
                                       value={reminder2.value} 
                                       onChange={(e) => setReminder2({...reminder2, value: parseInt(e.target.value) || 1})}
                                       className="input w-20 text-center"
                                   />
                                   <select 
                                       value={reminder2.unit} 
                                       onChange={(e) => setReminder2({...reminder2, unit: e.target.value as any})}
                                       className="input flex-1"
                                   >
                                       <option value="minutes">دقائق</option>
                                       <option value="hours">ساعات</option>
                                       <option value="days">أيام</option>
                                       <option value="weeks">أسابيع</option>
                                   </select>
                               </div>
                           </div>
                       </div>
                   </>
               )}

               <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 mt-6">
                   <button onClick={() => setIsNotificationModalOpen(false)} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300">
                       إلغاء
                   </button>
                   {events.length > 0 && (
                       <button onClick={confirmScheduleNotifications} className="btn bg-emerald-600 text-white hover:bg-emerald-700">
                           <i className="fas fa-check ltr:mr-2 rtl:ml-2"></i>
                           تأكيد وجدولة الإشعارات
                       </button>
                   )}
               </div>
           </div>
       </Modal>

       {/* Statistics Modal - Improved Preview for A4 Landscape */}
       <Modal isOpen={isStatsModalOpen} onClose={() => setIsStatsModalOpen(false)} title="الحصيلة الرقمية" size="5xl">
           <div className="report-preview-container-forced-style max-h-[65vh] overflow-auto p-4 rounded-lg bg-gray-50 flex flex-col items-center gap-4">
                {/* 
                    This container simulates the physical A4 Landscape Paper (297mm width). 
                    We use a scale transform to fit it into the modal view without breaking layout flow.
                */}
                <div style={{ 
                    width: '297mm', // Exact A4 Landscape width
                    minHeight: '210mm',
                    backgroundColor: 'white',
                    padding: '0', 
                    boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                    transform: 'scale(0.6)', // Scale down to view whole page
                    transformOrigin: 'top center',
                    marginBottom: '-40%', // Adjust margin to reduce whitespace caused by scaling
                }}>
                    <div dangerouslySetInnerHTML={{ __html: statsBodyHtml }} />
                </div>
           </div>
           <div className="flex justify-end pt-4 mt-4 border-t border-[rgb(var(--color-border))] print-hidden space-x-2 rtl:space-x-reverse">
                <button onClick={() => handleShare(getStatsHtml(), true, 'stats-summary')} title={t('share')} className="btn p-0 h-10 w-10 justify-center bg-teal-600 text-white hover:bg-teal-700">
                    <i className="fas fa-share-alt"></i>
                </button>
                <button onClick={handleExportStatsWord} title="تصدير Word" className="btn p-0 h-10 w-10 justify-center bg-blue-600 text-white hover:bg-blue-700">
                    <i className="fas fa-file-word"></i>
                </button>
                <button onClick={() => handleExportPdf(getStatsHtml(), true, 'stats-summary')} title={t('exportPdf')} className="btn p-0 h-10 w-10 justify-center bg-red-600 text-white hover:bg-red-700">
                    <i className="fas fa-file-pdf"></i>
                </button>
                <button onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if(printWindow) {
                        printWindow.document.write(getStatsHtml());
                        printWindow.document.close();
                        setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 1000);
                    }
                }} title={t('print')} className="btn p-0 h-10 w-10 justify-center bg-sky-700 text-white hover:bg-sky-800">
                    <i className="fas fa-print"></i>
                </button>
           </div>
       </Modal>

       {/* Event Modal */}
       <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title={currentEvent.id ? "تعديل الحدث" : "إضافة حدث"}>
           <div className="space-y-4">
               <div>
                   <label className="block text-sm font-medium text-[rgb(var(--color-text-base))] mb-1">عنوان الحدث</label>
                   <input
                       type="text"
                       value={currentEvent.title || ''}
                       onChange={(e) => setCurrentEvent({ ...currentEvent, title: e.target.value })}
                       className="input-style w-full"
                       placeholder="مثال: زيارة تفتيشية، ندوة تربوية..."
                   />
               </div>
               <div>
                   <label className="block text-sm font-medium text-[rgb(var(--color-text-base))] mb-1">المكان</label>
                   <div className="relative">
                       <i className="fas fa-map-marker-alt absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                       <input
                           type="text"
                           value={currentEvent.location || ''}
                           onChange={(e) => setCurrentEvent({ ...currentEvent, location: e.target.value })}
                           className="input-style w-full pr-10"
                           placeholder="مثال: مدرسة ابن خلدون، القاعة 4..."
                       />
                   </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                   <div>
                       <label className="block text-sm font-medium text-[rgb(var(--color-text-base))] mb-1">من</label>
                       <input
                           type="datetime-local"
                           value={currentEvent.start ? moment(currentEvent.start).format('YYYY-MM-DDTHH:mm') : ''}
                           onChange={(e) => setCurrentEvent({ ...currentEvent, start: new Date(e.target.value) })}
                           className="input-style w-full"
                       />
                   </div>
                   <div>
                       <label className="block text-sm font-medium text-[rgb(var(--color-text-base))] mb-1">إلى</label>
                       <input
                           type="datetime-local"
                           value={currentEvent.end ? moment(currentEvent.end).format('YYYY-MM-DDTHH:mm') : ''}
                           onChange={(e) => setCurrentEvent({ ...currentEvent, end: new Date(e.target.value) })}
                           className="input-style w-full"
                       />
                   </div>
               </div>
               <div>
                   <label className="block text-sm font-medium text-[rgb(var(--color-text-base))] mb-1">الأهمية</label>
                   <select
                       value={currentEvent.importance || 'low'}
                       onChange={(e) => setCurrentEvent({ ...currentEvent, importance: e.target.value as any })}
                       className="input-style w-full"
                   >
                       <option value="low">عادية (أزرق)</option>
                       <option value="medium">متوسطة (برتقالي)</option>
                       <option value="high">عالية (أحمر)</option>
                   </select>
               </div>
               <div className="flex justify-end gap-2 mt-6">
                   {currentEvent.id && (
                       <button
                           onClick={() => {
                               deleteEvent(String(currentEvent.id));
                               setEvents(events.filter(e => String(e.id) !== String(currentEvent.id)));
                               setIsEventModalOpen(false);
                           }}
                           className="btn bg-red-600 text-white hover:bg-red-700 ml-auto"
                       >
                           حذف
                       </button>
                   )}
                   <button onClick={() => setIsEventModalOpen(false)} className="btn bg-slate-200 text-slate-800 hover:bg-slate-300">
                       إلغاء
                   </button>
                   <button
                       onClick={() => {
                           if (currentEvent.title && currentEvent.start && currentEvent.end) {
                               const newEvent = {
                                   ...currentEvent,
                                   id: currentEvent.id || Date.now().toString()
                               } as CalendarEvent;
                               saveEvent(newEvent);
                               if (currentEvent.id) {
                                   setEvents(events.map(e => String(e.id) === String(newEvent.id) ? newEvent : e));
                               } else {
                                   setEvents([...events, newEvent]);
                               }
                               setIsEventModalOpen(false);
                           }
                       }}
                       className="btn bg-teal-600 text-white hover:bg-teal-700"
                   >
                       حفظ
                   </button>
               </div>
           </div>
       </Modal>
    </div>
  );
};

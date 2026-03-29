
import React, { useMemo } from 'react';
import { SavedReport, ReportType, Teacher, Inspector, EvaluationCriterion, LessonObservation } from '../types';
import { Modal } from './ui/Modal';
import { useTranslations } from '../hooks/useTranslations';
import { exportFile } from '../services/fileExport';

// Déclarations pour les bibliothèques globales chargées via CDN
declare global {
  interface Window {
    XLSX: any;
    jspdf: any;
    html2canvas: any;
    docx: any;
  }
}

const dataUrlToBuffer = async (dataUrl: string): Promise<ArrayBuffer> => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return await blob.arrayBuffer();
};


const escapeHtml = (unsafe: any): string => {
    if (unsafe === null || unsafe === undefined) return '';
    const str = String(unsafe);
    return str
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

const reportTranslations: Record<string, any> = {
    ar: {
        inspectionReport: "تقرير تفتيش",
        visitReport: "تقرير زيارة صفية",
        ministryLogoAlt: "شعار الوزارة",
        teacherDetail_infoCardTitle: "المعلومات المهنية",
        teacher_fullName: "الإسم الكامل",
        teacher_subject: "المادة",
        teacher_lastScore: "آخر نقطة",
        teacher_employeeId: "رقم التأجير",
        teacher_grade: "الدرجة",
        teacher_lastDate: "تاريخ آخر تفتيش",
        teacher_framework: "الإطار",
        teacher_rank: "الرتبة",
        teacher_lastInspector: "المفتش",
        teacher_institution: "المؤسسة",
        reportModal_lessonObservation: "ملاحظات حول سير الدرس",
        evaluation_field_activityCategory: "نوع النشاط",
        evaluation_field_activity: "النشاط",
        evaluation_field_level: "المستوى",
        evaluation_field_class: "القسم",
        evaluation_field_studentCount: "عدد التلاميذ",
        evaluation_field_tools: "الوسائل التعليمية",
        evaluation_field_lessonGoal: "هدف الحصة",
        report_dateLabel: "حرر بتاريخ",
        reportModal_newScore: "النقطة الممنوحة",
        signature_title_1: "توقيع المفتش",
        signature_regionalDirector: "توقيع المدير الإقليمي",
        signature_institutionDirector: "توقيع مدير المؤسسة",
        teacher: "الأستاذ"
    },
    fr: {
        inspectionReport: "Rapport d'inspection",
        visitReport: "Rapport de visite de classe",
        ministryLogoAlt: "Logo du Ministère",
        teacherDetail_infoCardTitle: "Informations Professionnelles",
        teacher_fullName: "Nom complet",
        teacher_subject: "Matière",
        teacher_lastScore: "Dernière note",
        teacher_employeeId: "PPR",
        teacher_grade: "Grade",
        teacher_lastDate: "Date de dernière inspection",
        teacher_framework: "Cadre",
        teacher_rank: "Échelon",
        teacher_lastInspector: "Inspecteur",
        teacher_institution: "Établissement",
        reportModal_lessonObservation: "Observations sur le déroulement de la leçon",
        evaluation_field_activityCategory: "Type d'activité",
        evaluation_field_activity: "Activité",
        evaluation_field_level: "Niveau",
        evaluation_field_class: "Classe",
        evaluation_field_studentCount: "Nombre d'élèves",
        evaluation_field_tools: "Matériel didactique",
        evaluation_field_lessonGoal: "Objectif de la séance",
        report_dateLabel: "Fait le",
        reportModal_newScore: "Note attribuée",
        signature_title_1: "Signature de l'inspecteur",
        signature_regionalDirector: "Signature du Directeur Provincial",
        signature_institutionDirector: "Signature du Directeur de l'établissement",
        teacher: "Enseignant"
    }
};


interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: SavedReport | null;
  teacher: Teacher | null;
  inspector: Inspector;
  ministryLogo: string;
  ministryLogoHeight?: number;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, report, teacher, inspector, ministryLogo, ministryLogoHeight = 120 }) => {
  const { t, language, dir } = useTranslations();
  
  const [zoomLevel, setZoomLevel] = React.useState<number>(() => {
    if (typeof window !== 'undefined') {
      const savedZoom = localStorage.getItem('reportModalZoomLevel');
      if (savedZoom) {
        return parseFloat(savedZoom);
      }
      return window.innerWidth < 768 ? 0.35 : 0.75;
    }
    return 0.75;
  });

  const [reportFontSize, setReportFontSize] = React.useState<number>(14);
  const [reportFontFamily, setReportFontFamily] = React.useState<string>('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('reportModalZoomLevel', zoomLevel.toString());
    }
  }, [zoomLevel]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.05, 2));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.05, 0.1));
  };

  const handleResetZoom = () => {
    setReportFontSize(14);
    setReportFontFamily('');
    setZoomLevel(window.innerWidth < 768 ? 0.35 : 0.75);
  };

  const parsedCriteria = useMemo(() => {
    if (!report?.criteria) return [];
    if (typeof report.criteria === 'string') {
      try {
        const parsed = JSON.parse(report.criteria);
        return Array.isArray(parsed) ? parsed.map(c => ({
            ...c,
            name: c.name || t('evaluation_criterion') 
        })) : [];
      } catch (e) {
        console.error("Impossible de parser les critères du rapport:", e);
        return [];
      }
    }
    return Array.isArray(report.criteria) ? report.criteria.map(c => ({
        ...c,
        name: c.name || t('evaluation_criterion')
    })) : [];
  }, [report, t]);

  const parsedObservation: LessonObservation | undefined = useMemo(() => {
    if (!report?.observation) return undefined;
    if (typeof report.observation === 'string') {
      try {
        const parsed = JSON.parse(report.observation);
        return (typeof parsed === 'object' && parsed !== null) ? parsed : undefined;
      } catch (e) {
        console.error("Impossible de parser l'observation du rapport:", e);
        return undefined;
      }
    }
    return (typeof report.observation === 'object' && report.observation !== null) ? report.observation : undefined;
  }, [report]);


  if (!isOpen || !report) return null;

  const reportTypeLabel = report.reportType === ReportType.INSPECTION ? t('inspectionReport') : t('visitReport');
  const teacherTitle = teacher?.genre === 'female' ? t('teacher_female') : t('teacher_male');

  const getReportHtml = () => {
    const reportLanguage = report.language || 'ar';
    const direction = reportLanguage === 'ar' ? 'rtl' : 'ltr';
    const defaultFontFamily = reportLanguage === 'ar' ? "'Sakkal Majalla', Arial, sans-serif" : "'Times New Roman', Times, serif";
    const fontFamily = reportFontFamily || defaultFontFamily;
    const isInspection = report.reportType === ReportType.INSPECTION;

    const rt = reportTranslations[reportLanguage] || reportTranslations['ar'];
    const currentReportTypeLabel = isInspection ? rt.inspectionReport : rt.visitReport;
    const teacherTitle = teacher?.genre === 'female' && reportLanguage === 'ar' ? 'الأستاذة' : rt.teacher;

    // Robust Date Formatter (DD/MM/YYYY)
    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '';
        try {
            // Check if it matches YYYY-MM-DD exactly to parse manually
            if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const [year, month, day] = dateStr.split('-');
                return `${day}/${month}/${year}`;
            }
            
            // Fallback for ISO strings or other formats
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr; // Return original if invalid
            
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (e) {
            return dateStr;
        }
    };

    // Use historical data from the report if available, otherwise fallback to current teacher data
    const rawLastScore = report.previousInspectionScore !== undefined && report.previousInspectionScore !== null 
        ? report.previousInspectionScore 
        : (teacher?.lastInspectionScore ?? '');
        
    const lastScore = rawLastScore !== '' ? rawLastScore : '';
        
    const lastDateRaw = report.previousInspectionDate || teacher?.lastInspectionDate;
    const lastDate = lastDateRaw ? formatDate(lastDateRaw) : '';
    
    // Only show last inspector if there is a last score
    const lastInspector = lastScore !== '' ? (report.previousInspector || teacher?.lastInspector || '') : '';
    
    const reportDateForDisplay = formatDate(report.date);

    const headerHtml = `
      <div style="text-align: center; margin-bottom: 0.5rem; width: 100%;">
        <img src="${ministryLogo}" alt="${rt.ministryLogoAlt}" style="height: ${ministryLogoHeight}px; max-width: 100%; object-fit: contain; margin: 0 auto;" />
      </div>
      <div style="text-align: center; margin-bottom: 0.75rem;">
        <h3 style="font-size: 1.8rem; font-weight: bold; text-decoration: underline; text-underline-offset: 4px;">${escapeHtml(currentReportTypeLabel)}</h3>
      </div>`;

    
    const teacherInfoHtml = teacher ? `
    <div style="margin-top: 0.75rem;">
        <div style="background-color: #f2f2f2; padding: 0.2rem; text-align: center; font-weight: bold; border: 1px solid #ddd;">${rt.teacherDetail_infoCardTitle}</div>
        <div style="border: 1px solid #ddd; border-top: none; padding: 0.5rem;">
            <table style="width: 100%; border-collapse: collapse; text-align: ${reportLanguage === 'ar' ? 'right' : 'left'};">
                <tbody>
                    <tr>
                        <td style="padding: 1px 0.2rem; line-height: 1.2; font-weight: bold; width: 1%; white-space: nowrap;">${rt.teacher_fullName}:</td>
                        <td style="padding: 1px 0.5rem; line-height: 1.2;">${escapeHtml(teacher.fullName)}</td>
                        <td style="padding: 1px 0.2rem; line-height: 1.2; font-weight: bold; width: 1%; white-space: nowrap;">${rt.teacher_subject}:</td>
                        <td style="padding: 1px 0.5rem; line-height: 1.2;">${escapeHtml(teacher.subject)}</td>
                        <td style="padding: 1px 0.2rem; line-height: 1.2; font-weight: bold; width: 1%; white-space: nowrap;">${rt.teacher_lastScore}:</td>
                        <td style="padding: 1px 0.5rem; line-height: 1.2;">${escapeHtml(lastScore)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 1px 0.2rem; line-height: 1.2; font-weight: bold; width: 1%; white-space: nowrap;">${rt.teacher_employeeId}:</td>
                        <td style="padding: 1px 0.5rem; line-height: 1.2;">${escapeHtml(teacher.employeeId)}</td>
                        <td style="padding: 1px 0.2rem; line-height: 1.2; font-weight: bold; width: 1%; white-space: nowrap;">${rt.teacher_grade}:</td>
                        <td style="padding: 1px 0.5rem; line-height: 1.2;">${escapeHtml(String(teacher.grade).replace('الدرجة ', '').replace('الدرجة', ''))}</td>
                        <td style="padding: 1px 0.2rem; line-height: 1.2; font-weight: bold; width: 1%; white-space: nowrap;">${rt.teacher_lastDate}:</td>
                        <td style="padding: 1px 0.5rem; line-height: 1.2;">${escapeHtml(lastDate)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 1px 0.2rem; line-height: 1.2; font-weight: bold; width: 1%; white-space: nowrap;">${rt.teacher_framework}:</td>
                        <td style="padding: 1px 0.5rem; line-height: 1.2;">${escapeHtml(teacher.framework)}</td>
                        <td style="padding: 1px 0.2rem; line-height: 1.2; font-weight: bold; width: 1%; white-space: nowrap;">${rt.teacher_rank}:</td>
                        <td style="padding: 1px 0.5rem; line-height: 1.2;">${escapeHtml(teacher.rank)}</td>
                        <td style="padding: 1px 0.2rem; line-height: 1.2; font-weight: bold; width: 1%; white-space: nowrap;">${lastScore !== '' ? rt.teacher_lastInspector + ':' : ''}</td>
                        <td style="padding: 1px 0.5rem; line-height: 1.2;">${escapeHtml(lastInspector)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 1px 0.2rem; line-height: 1.2; font-weight: bold; width: 1%; white-space: nowrap;">${rt.teacher_institution}:</td>
                        <td style="padding: 1px 0.5rem; line-height: 1.2;" colspan="5">${escapeHtml(teacher.institution)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>` : '';
      
    const observationHtml = parsedObservation ? `
      <div style="margin-top: 0.75rem;">
          <div style="background-color: #f2f2f2; padding: 0.2rem; text-align: center; font-weight: bold; border: 1px solid #ddd; font-size: 1.2rem;">${rt.reportModal_lessonObservation}</div>
          <div style="border: 1px solid #ddd; border-top: none;">
              <table style="width: 100%; border-collapse: collapse; text-align: center;">
                <tr style="background-color: #e0e0e0;">
                  <th style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${rt.evaluation_field_activityCategory}</th>
                  <th style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${rt.evaluation_field_activity}</th>
                  <th style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${rt.evaluation_field_level}</th>
                  <th style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${rt.evaluation_field_class}</th>
                  <th style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${rt.evaluation_field_studentCount}</th>
                  <th style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${rt.evaluation_field_tools}</th>
                </tr>
                <tr>
                  <td style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${escapeHtml(parsedObservation.activityCategory)}</td>
                  <td style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${escapeHtml(parsedObservation.activity)}</td>
                  <td style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${escapeHtml(parsedObservation.level)}</td>
                  <td style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${escapeHtml(parsedObservation.class)}</td>
                  <td style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${escapeHtml(parsedObservation.studentCount)}</td>
                  <td style="padding: 0.2rem; border: 1px solid #ccc; vertical-align: middle;">${escapeHtml(parsedObservation.tools)}</td>
                </tr>
              </table>
              <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #ddd;">
                  <tr>
                    <td style="background-color: #f2f2f2; padding: 0.2rem; text-align: center; font-weight: bold; border-right: 1px solid #ddd; width: 20%; vertical-align: middle;">${rt.evaluation_field_lessonGoal} :</td>
                    <td style="padding: 0.2rem; text-align: ${reportLanguage === 'ar' ? 'right' : 'left'}; padding-right: 0.5rem; vertical-align: middle;">${escapeHtml(parsedObservation.lessonGoal).replace(/\n/g, '<br />')}</td>
                  </tr>
              </table>
          </div>
      </div>` : '';
    
    const getAchievementLevelText = (level: string) => {
        switch (level) {
            case '3': return 'جيد';
            case '2': return 'لا بأس بها';
            case '1': return 'ينبغي الأشتغال عليه';
            case '0': return 'غير متوفر';
            default: return level || (reportLanguage === 'ar' ? 'غير مقيم' : 'Non évalué');
        }
    };

    let criteriaHtml = '';
    if (report.reportTemplate === 'network') {
        criteriaHtml = `
        <div style="margin-top: 0.5rem; text-align: ${reportLanguage === 'ar' ? 'right' : 'left'};">
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd; font-size: 0.85em; line-height: 1.1;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="padding: 4px; border: 1px solid #ccc; width: 20%; vertical-align: middle; text-align: center;">${reportLanguage === 'ar' ? 'المجالات' : 'Domaines'}</th>
                        <th style="padding: 4px; border: 1px solid #ccc; width: 35%; vertical-align: middle; text-align: center;">${reportLanguage === 'ar' ? 'المؤشرات' : 'Indicateurs'}</th>
                        <th style="padding: 4px; border: 1px solid #ccc; width: 15%; vertical-align: middle; text-align: center;">${reportLanguage === 'ar' ? 'مستوى الإنجاز' : 'Niveau de réalisation'}</th>
                        <th style="padding: 4px; border: 1px solid #ccc; width: 30%; vertical-align: middle; text-align: center;">${reportLanguage === 'ar' ? 'الملاحظات والتوجيهات' : 'Observations et orientations'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${parsedCriteria.map((c: EvaluationCriterion) => {
                        const indicators = c.indicators || [];
                        const rowSpan = indicators.length > 0 ? indicators.length : 1;
                        
                        if (indicators.length === 0) {
                            return `
                            <tr>
                                <td style="padding: 4px; border: 1px solid #ccc; font-weight: bold; vertical-align: middle; text-align: center;">${escapeHtml(c.name)}</td>
                                <td style="padding: 4px; border: 1px solid #ccc; vertical-align: middle; text-align: center;">-</td>
                                <td style="padding: 4px; border: 1px solid #ccc; text-align: center; vertical-align: middle;">-</td>
                                <td style="padding: 4px; border: 1px solid #ccc; text-align: center; vertical-align: middle;">${escapeHtml(c.comment.trim()).replace(/\n/g, '<br />')}</td>
                            </tr>`;
                        }

                        return indicators.map((ind, index) => {
                            if (index === 0) {
                                return `
                                <tr>
                                    <td style="padding: 6px; border: 1px solid #ccc; font-weight: bold; vertical-align: middle; text-align: center;" rowspan="${rowSpan}">${escapeHtml(c.name)}</td>
                                    <td style="padding: 6px; border: 1px solid #ccc; vertical-align: middle; text-align: center;">${escapeHtml(ind.name)}</td>
                                    <td style="padding: 6px; border: 1px solid #ccc; text-align: center; vertical-align: middle;"><strong>${escapeHtml(getAchievementLevelText(ind.level))}</strong></td>
                                    <td style="padding: 6px; border: 1px solid #ccc; vertical-align: middle; text-align: center;" rowspan="${rowSpan}">${escapeHtml(c.comment.trim()).replace(/\n/g, '<br />')}</td>
                                </tr>`;
                            } else {
                                return `
                                <tr>
                                    <td style="padding: 6px; border: 1px solid #ccc; vertical-align: middle; text-align: center;">${escapeHtml(ind.name)}</td>
                                    <td style="padding: 6px; border: 1px solid #ccc; text-align: center; vertical-align: middle;"><strong>${escapeHtml(getAchievementLevelText(ind.level))}</strong></td>
                                </tr>`;
                            }
                        }).join('');
                    }).join('')}
                </tbody>
            </table>
        </div>`;
    } else {
        criteriaHtml = `
          <div style="margin-top: 0.75rem; text-align: ${reportLanguage === 'ar' ? 'right' : 'left'};">
            ${parsedCriteria.map((c: EvaluationCriterion) => `
                  <div style="margin-bottom: 0.5rem;">
                    <p style="font-weight: bold;">${escapeHtml(c.name)} :</p>
                    <div style="padding: 0.4rem; min-height: 40px; white-space: pre-wrap; text-align: justify; text-indent: 1.5em;">${escapeHtml(c.comment).replace(/\n/g, '<br />') || '<br/>'}</div>
                  </div>
                `).join('')}
          </div>`;
    }

    const overallAssessmentHtml = report.reportTemplate === 'network' && report.overallAssessment ? `
      <div style="margin-top: 0.5rem; border: 1px solid #ddd; padding: 0.3rem; background-color: #fafafa; font-size: 0.85em;">
        <p style="font-weight: bold; margin-bottom: 0.2rem;">${reportLanguage === 'ar' ? 'التقدير الإجمالي' : 'Appréciation globale'} :</p>
        <div style="white-space: pre-wrap; text-align: justify; text-indent: 1.5em; line-height: 1.2;">${escapeHtml(report.overallAssessment).replace(/\n/g, '<br />')}</div>
      </div>
    ` : '';

    const dateLabel = rt.report_dateLabel;

    const scoreLine = isInspection && report.score != null ? `
        <span style="font-weight: bold; margin-right: 1rem; margin-left: 1rem; display: inline-block; white-space: nowrap;">
            <strong>${rt.reportModal_newScore}:</strong> <span dir="ltr" style="unicode-bidi: isolate;">${report.score} / 20</span>
        </span>
    ` : '';

    const dateAndScoreHtml = `
      <div style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid #ccc; page-break-inside: avoid; text-align: ${reportLanguage === 'ar' ? 'left' : 'right'};">
        <p style="margin-bottom: 0.2rem; white-space: nowrap;">
          <strong>${dateLabel}:</strong> ${reportDateForDisplay}
          ${scoreLine}
        </p>
      </div>
    `;

    // Updated Signature Order: Inspector (Right) -> Reg Dir -> Inst Dir -> Teacher (Left)
    const signaturesHtml = teacher ? `
      <div style="margin-top: 1rem; padding-top: 0.5rem; text-align: right; page-break-inside: avoid;">
        <table style="width: 100%; border-collapse: collapse; text-align: center;">
          <tr>
            <td style="width: 25%; vertical-align: middle;"><strong>${rt.signature_title_1}</strong></td>
            <td style="width: 25%; vertical-align: middle;"><strong>${rt.signature_regionalDirector}</strong></td>
            <td style="width: 25%; vertical-align: middle;"><strong>${rt.signature_institutionDirector}</strong></td>
            <td style="width: 25%; vertical-align: middle;"><strong>${teacherTitle}</strong></td>
          </tr>
          <tr>
            <td style="padding-top: 4rem;"></td>
            <td style="padding-top: 4rem;"></td>
            <td style="padding-top: 4rem;"></td>
            <td style="padding-top: 4rem;"></td>
          </tr>
        </table>
      </div>` : '';
      
    const bodyContent = `${headerHtml}${teacherInfoHtml}${observationHtml}${criteriaHtml}${overallAssessmentHtml}${dateAndScoreHtml}${signaturesHtml}`;

    return `
      <html lang="${reportLanguage}">
      <head>
          <meta charset="UTF-8">
      </head>
      <body>
          <style>
              @page {
                  margin: 1cm;
              }
              body { 
                  direction: ${direction}; 
                  font-family: ${fontFamily}; 
                  line-height: ${report.reportTemplate === 'network' ? '1.1' : '1.5'}; 
                  font-size: ${reportFontSize}pt;
                  background-color: white;
                  color: black;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
              } 
              p { white-space: pre-wrap; margin: 0; }
              table { border-spacing: 0; }
          </style>
          ${bodyContent}
      </body>
      </html>`;
  };

  // Safe extract for Excel
  const lastScoreForExcel = report.previousInspectionScore !== undefined && report.previousInspectionScore !== null 
      ? report.previousInspectionScore 
      : (teacher?.lastInspectionScore ?? '');

  const lastDateRawForExcel = report.previousInspectionDate || teacher?.lastInspectionDate;
  const lastDateForExcel = lastDateRawForExcel ? new Date(lastDateRawForExcel).toLocaleDateString('fr-CA') : '';
  
  const lastInspectorForExcel = report.previousInspector || teacher?.lastInspector || '';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        const fullHtml = getReportHtml();
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 500);
    } else {
        alert(t('errorPopupBlocker'));
    }
  };

  const handleExportWord = async () => {
    if (!report || !teacher) {
        return;
    }
    
    const fullHtml = getReportHtml();
    const reportLanguage = report.language || 'ar';
    const direction = reportLanguage === 'ar' ? 'rtl' : 'ltr';
    const isInspection = report.reportType === ReportType.INSPECTION;
    const rt = reportTranslations[reportLanguage] || reportTranslations['ar'];
    const currentReportTypeLabel = isInspection ? rt.inspectionReport : rt.visitReport;

    // Extract body content
    const bodyContent = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || fullHtml;
    const defaultFontFamily = reportLanguage === 'ar' ? "'Sakkal Majalla', Arial, sans-serif" : "'Times New Roman', Times, serif";
    const fontFamily = reportFontFamily || defaultFontFamily;

    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>${currentReportTypeLabel}</title>
            <style>
                body { font-family: ${fontFamily}; direction: ${direction}; text-align: ${direction === 'rtl' ? 'right' : 'left'}; font-size: ${reportFontSize}pt; line-height: ${report.reportTemplate === 'network' ? '1.1' : '1.5'}; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid black; padding: 2px; vertical-align: middle; }
            </style>
        </head>
        <body>
            ${bodyContent}
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
    });

    await exportFile(blob, `${reportTypeLabel} - ${report.teacherName}.doc`);
  };
  
  const generatePdfBlob = async (): Promise<Blob | null> => {
    const fullHtml = getReportHtml();
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
      alert(t('errorExportLibrary'));
      return null;
    }

    const { jsPDF } = window.jspdf;
    
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '1000px'; 
    container.innerHTML = fullHtml;
    document.body.appendChild(container);

    try {
        const canvas = await window.html2canvas(container.querySelector('body') || container, {
          scale: 2, 
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: container.scrollWidth,
          windowHeight: container.scrollHeight
        });
      
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;

        let imgWidth = pdfWidth - 20; // 10mm on each side
        let imgHeight = imgWidth / ratio;
        
        // Force fit on one page
        if (imgHeight > pdfHeight - 20) {
            imgHeight = pdfHeight - 20;
            imgWidth = imgHeight * ratio;
        }
        
        const xOffset = (pdfWidth - imgWidth) / 2;
        const yOffset = 10; // 10mm top margin

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
        
        return pdf.output('blob');

    } finally {
        document.body.removeChild(container);
    }
  };

  const handleExportPdf = async () => {
    const pdfBlob = await generatePdfBlob();
    if (pdfBlob) {
        await exportFile(pdfBlob, `${reportTypeLabel} - ${report.teacherName}.pdf`);
    }
  };

  const handleShare = async () => {
    // Sur mobile, l'export PDF agit comme un partage (ouvre le menu de partage avec le fichier)
    // On utilise donc exportFile
    try {
        const pdfBlob = await generatePdfBlob();
        if (!pdfBlob) return;

        const reportFileName = `${reportTypeLabel} - ${report.teacherName}.pdf`;
        await exportFile(pdfBlob, reportFileName);
    } catch (error) {
        console.error('Error sharing:', error);
    }
  };


  const fullHtml = getReportHtml();
  const reportBodyHtml = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || fullHtml;
  
  // Recalculate label for modal title
  const reportLanguage = report.language || 'ar';
  const rt = reportTranslations[reportLanguage] || reportTranslations['ar'];
  const modalTitle = report.reportType === ReportType.INSPECTION ? rt.inspectionReport : rt.visitReport;
  const defaultFontFamily = reportLanguage === 'ar' ? "'Sakkal Majalla', serif" : "'Times New Roman', Times, serif";
  const fontFamily = reportFontFamily || defaultFontFamily;

  const ARABIC_FONTS = [
    { label: 'Sakkal Majalla', value: "'Sakkal Majalla', Arial, sans-serif" },
    { label: 'Traditional Arabic', value: "'Traditional Arabic', serif" },
    { label: 'Arial', value: "Arial, sans-serif" },
    { label: 'Tahoma', value: "Tahoma, sans-serif" },
    { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
    { label: 'Cairo', value: "'Cairo', sans-serif" },
    { label: 'Amiri', value: "'Amiri', serif" },
    { label: 'Tajawal', value: "'Tajawal', sans-serif" }
  ];

  const FRENCH_FONTS = [
    { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
    { label: 'Arial', value: "Arial, sans-serif" },
    { label: 'Calibri', value: "Calibri, sans-serif" },
    { label: 'Helvetica', value: "Helvetica, sans-serif" },
    { label: 'Georgia', value: "Georgia, serif" }
  ];

  const currentFonts = reportLanguage === 'ar' ? ARABIC_FONTS : FRENCH_FONTS;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="5xl">
       <div className="flex flex-wrap items-center justify-center gap-4 mb-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-[rgb(var(--color-border))] print-hidden">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <button 
              onClick={handleZoomOut}
              className="btn p-0 h-8 w-8 justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              title={t('zoomOut')}
            >
              <i className="fas fa-search-minus"></i>
            </button>
            <span className="text-sm font-medium min-w-[3rem] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button 
              onClick={handleZoomIn}
              className="btn p-0 h-8 w-8 justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              title={t('zoomIn')}
            >
              <i className="fas fa-search-plus"></i>
            </button>
            <button 
              onClick={handleResetZoom}
              className="btn px-2 h-8 text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {t('resetZoom')}
            </button>
          </div>

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">الخط:</label>
            <select 
              value={reportFontFamily}
              onChange={(e) => setReportFontFamily(e.target.value)}
              className="p-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            >
              <option value="">الافتراضي</option>
              {currentFonts.map(font => (
                <option key={font.value} value={font.value}>{font.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">حجم الخط:</label>
            <div className="flex items-center bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
              <button 
                onClick={() => setReportFontSize(prev => Math.max(prev - 1, 8))}
                className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
              >
                <i className="fas fa-minus text-xs"></i>
              </button>
              <span className="px-2 text-sm font-medium text-gray-700 dark:text-gray-200 min-w-[2rem] text-center">{reportFontSize}</span>
              <button 
                onClick={() => setReportFontSize(prev => Math.min(prev + 1, 36))}
                className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>
          </div>
       </div>

       <div
        id="report-modal-content-for-export"
        className="max-h-[65vh] overflow-auto p-4 rounded-lg bg-gray-50 flex flex-col items-center"
        dir={reportLanguage === 'ar' ? 'rtl' : 'ltr'}
        style={{
            fontFamily: fontFamily,
            fontSize: `${reportFontSize}pt`,
            textAlign: reportLanguage === 'ar' ? 'right' : 'left',
        }}
       >
          <div 
            className="report-preview-container-forced-style w-full transition-all duration-300 origin-top"
            style={{ 
              zoom: zoomLevel,
              width: '100%',
              cursor: 'default'
            }}
            dangerouslySetInnerHTML={{ __html: reportBodyHtml }} 
          />
      </div>
      
      <div className="flex justify-end pt-4 mt-4 border-t border-[rgb(var(--color-border))] print-hidden space-x-2 rtl:space-x-reverse">
        <button onClick={onClose} title={t('close')} className="btn p-0 h-10 w-10 justify-center bg-[rgb(var(--color-button-secondary-bg))] text-[rgb(var(--color-text-base))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))]">
            <i className="fas fa-times"></i>
        </button>
        {/* Sur mobile, le bouton partage fait la même chose que l'export PDF, on peut le garder ou l'enlever */}
        <button onClick={handleShare} title={t('share')} className="btn p-0 h-10 w-10 justify-center bg-teal-600 text-white hover:bg-teal-700">
            <i className="fas fa-share-alt"></i>
        </button>
        <button onClick={handleExportWord} title={t('exportWord')} className="btn p-0 h-10 w-10 justify-center bg-blue-600 text-white hover:bg-blue-700">
            <i className="fas fa-file-word"></i>
        </button>
        <button onClick={handleExportPdf} title={t('exportPdf')} className="btn p-0 h-10 w-10 justify-center bg-red-600 text-white hover:bg-red-700">
            <i className="fas fa-file-pdf"></i>
        </button>
        <button onClick={handlePrint} title={t('print')} className="btn p-0 h-10 w-10 justify-center bg-sky-700 text-white hover:bg-sky-800">
            <i className="fas fa-print"></i>
        </button>
      </div>
    </Modal>
  );
};

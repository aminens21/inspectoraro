
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { OtherReport, Teacher, TeacherStatus, TransmissionSlip, Memo } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { useTranslations } from '../hooks/useTranslations';
import { PageHeader } from './ui/PageHeader';
import { REPORT_TEMPLATES, INITIAL_OTHER_REPORT_STATE } from '../constants/templates';
import { analyzeTeacherAlerts } from '../services/timetableAnalysis';
import { loadInitialData } from '../services/localStorageManager';

interface OtherReportsPageProps {
  reports: OtherReport[];
  slips: TransmissionSlip[];
  onSave: (report: Omit<OtherReport, 'id'> | OtherReport) => void;
  onViewReport: (report: OtherReport) => void;
  onDeleteReport: (report: OtherReport) => void;
  onGoHome: () => void;
  departments: string[];
  reportToEdit?: OtherReport | null;
  onEditHandled?: () => void;
  teachers: Teacher[];
  onToggleReportDelivered: (report: OtherReport) => void;
  onMarkAllDelivered?: (reportIds: string[]) => void;
  memos?: Memo[];
}

// Helper to determine Academic Year
const getAcademicYear = (dateString: string): string => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  // If month is September (9) or later, it's part of the Year/Year+1 cycle
  // e.g. 9/2024 is 2024/2025
  return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

export const OtherReportsPage: React.FC<OtherReportsPageProps> = ({ 
  reports, slips, onSave, onViewReport, onDeleteReport, onGoHome, departments, reportToEdit, onEditHandled, teachers, onToggleReportDelivered, onMarkAllDelivered, memos = []
}) => {
    const { t, language } = useTranslations();
    
    // Helper to generate next document number
    const generateNextDocumentNumber = (dateString?: string) => {
        const date = dateString ? new Date(dateString) : new Date();
        const year = date.getFullYear();
        // Regex to match format "Number/Year" e.g., "15/2025"
        const pattern = new RegExp(`^(\\d+)/${year}$`);
        let maxNum = 0;

        // Check other reports only
        reports.forEach(r => {
            if (r.documentNumber) {
                const match = r.documentNumber.trim().match(pattern);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && num > maxNum) {
                        maxNum = num;
                    }
                }
            }
        });

        const nextNum = maxNum + 1;
        const paddedNum = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
        return `${paddedNum}/${year}`;
    };

    const [formData, setFormData] = useState<Omit<OtherReport, 'id'>>({
        ...INITIAL_OTHER_REPORT_STATE,
        documentNumber: generateNextDocumentNumber()
    });
    
    const [editingReportId, setEditingReportId] = useState<string | number | null>(null);
    const [isRephrasing, setIsRephrasing] = useState(false);
    const [aiError, setAiError] = useState<string|null>(null);
    const [aiInstructions, setAiInstructions] = useState('');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterInstitution, setFilterInstitution] = useState('');
    const [filterFramework, setFilterFramework] = useState('');

    // Archive Filters
    const [archiveYearFilter, setArchiveYearFilter] = useState('');
    const [archiveTypeFilter, setArchiveTypeFilter] = useState('');

    // Custom Dropdown State
    const [showActivityDropdown, setShowActivityDropdown] = useState(false);
    const activityDropdownRef = useRef<HTMLDivElement>(null);

    // Initial List + State to allow additions
    const [activityTypes, setActivityTypes] = useState([
        "الدروس التجريبية",
        "الندوات واللقاءات التربوية",
        "التكوينات",
        "أنشطة أخرى",
        "العمل المشترك",
        "الترسيم والكفاءة",
        "المصادقة على جداول الحصص",
        "المصادقة على التوزيع الحلقي"
    ]);

    const isValidationTemplate = formData.templateId === 'timetable_validation' || formData.activityType === 'المصادقة على جداول الحصص';
    const isCycleValidation = formData.templateId === 'cycle_validation' || formData.activityType === 'المصادقة على التوزيع الحلقي';
    const isAnyValidation = isValidationTemplate || isCycleValidation;

    // Handle clicking outside dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (activityDropdownRef.current && !activityDropdownRef.current.contains(event.target as Node)) {
                setShowActivityDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const loadReportIntoForm = (report: OtherReport) => {
        if (report.id === '') { 
            setEditingReportId(null); 
        } else { 
            setEditingReportId(report.id); 
        }
        
        // If the loaded report has a custom activity type not in our list, add it temporarily
        if (report.activityType && !activityTypes.includes(report.activityType)) {
            setActivityTypes(prev => [...prev, report.activityType!]);
        }

        setFormData({
            ...report,
            documentNumber: report.documentNumber || '',
            references: report.references && report.references.length > 0 ? [...report.references] : [''],
            invitedTeacherIds: report.invitedTeacherIds || [],
            invitedTeacherStatuses: report.invitedTeacherStatuses || {},
            subType: report.subType || 'report',
            activityType: report.activityType || '',
            templateId: report.templateId || '',
            generalRejectionReason: report.generalRejectionReason || '',
            validationDisplayMode: report.validationDisplayMode || (report.templateId === 'cycle_validation' ? 'institutions' : 'teachers'),
            includeTeachersList: report.includeTeachersList !== undefined ? report.includeTeachersList : false
        });
        
        // Scroll to top to show the form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCloneReport = (report: OtherReport) => {
        // 1. Ensure we are NOT in edit mode (so it saves as new)
        setEditingReportId(null);
        
        // 2. Generate new document number for the current year
        const newDocNumber = generateNextDocumentNumber();

        // 3. Populate form with report data but fresh metadata
        setFormData({
            documentNumber: newDocNumber,
            date: new Date().toISOString().split('T')[0], // Reset date to today
            subject: report.subject,
            content: report.content,
            references: report.references && report.references.length > 0 ? [...report.references] : [''],
            concernedDepartment: report.concernedDepartment,
            invitedTeacherIds: report.invitedTeacherIds ? [...report.invitedTeacherIds] : [],
            invitedTeacherStatuses: report.invitedTeacherStatuses ? {...report.invitedTeacherStatuses} : {},
            subType: report.subType || 'report',
            activityType: report.activityType || '',
            templateId: report.templateId || '',
            generalRejectionReason: report.generalRejectionReason || '',
            validationDisplayMode: report.validationDisplayMode || 'teachers',
            includeTeachersList: report.includeTeachersList !== undefined ? report.includeTeachersList : false
        });

        // 4. Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        if (reportToEdit) {
            loadReportIntoForm(reportToEdit);
        } else {
            // Only reset if we are NOT currently editing anything (fresh load)
            if (!editingReportId) {
                setFormData({
                    ...INITIAL_OTHER_REPORT_STATE,
                    documentNumber: generateNextDocumentNumber()
                });
            }
        }
    }, [reportToEdit]);

    const uniqueInstitutions = useMemo(() => [...new Set(teachers.map(t => t.institution).filter(Boolean))].sort(), [teachers]);
    const uniqueFrameworks = useMemo(() => [...new Set(teachers.map(t => t.framework).filter(Boolean))].sort(), [teachers]);

    // Derived lists for filters
    const availableYears = useMemo(() => [...new Set(reports.map(r => getAcademicYear(r.date)))].sort().reverse(), [reports]);
    const availableTypes = useMemo(() => [...new Set(reports.map(r => r.activityType || 'أخرى'))].sort(), [reports]);

    // Calculate counts for display
    const selectedTeachersCount = (formData.invitedTeacherIds || []).length;
    
    const selectedInstitutionsCount = useMemo(() => {
        const selectedIds = new Set((formData.invitedTeacherIds || []).map(String));
        const selectedInsts = new Set<string>();
        teachers.forEach(t => {
            if (selectedIds.has(String(t.id)) && t.institution) {
                selectedInsts.add(t.institution);
            }
        });
        return selectedInsts.size;
    }, [formData.invitedTeacherIds, teachers]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // Auto-load template when activityType is selected
        if (name === 'activityType') {
            const matchedTemplate = REPORT_TEMPLATES.find(t => t.activityType === value);
            
            // Find memos for this activity type
            const matchedMemos = memos.filter(m => m.activityType === value);
            const newReferences = matchedMemos.length > 0 ? matchedMemos.map(m => m.content) : [''];

            if (matchedTemplate) {
                setFormData(prev => ({
                    ...prev,
                    activityType: value,
                    subject: matchedTemplate.subject,
                    content: '', // Force empty content to encourage bullet points usage
                    subType: matchedTemplate.subType as any,
                    templateId: matchedTemplate.id,
                    validationDisplayMode: matchedTemplate.id === 'cycle_validation' ? 'institutions' : (matchedTemplate.id === 'timetable_validation' ? 'teachers' : prev.validationDisplayMode),
                    includeTeachersList: true, // Templates usually require list
                    references: newReferences
                }));
                return;
            } else {
                setFormData(prev => ({
                    ...prev,
                    activityType: value,
                    references: newReferences
                }));
                return;
            }
        }

        if (name === 'date' && !editingReportId) {
            // If date changes and we are creating a new report, update the document number if it was the default one
            const currentYear = new Date(formData.date).getFullYear();
            const currentPattern = new RegExp(`^\\d+/${currentYear}$`);
            
            if (formData.documentNumber?.match(currentPattern)) {
                const nextNum = generateNextDocumentNumber(value);
                setFormData(prev => ({ ...prev, [name]: value, documentNumber: nextNum }));
                return;
            }
        }

        setFormData(prev => ({...prev, [name]: value}));
    };

    const handleActivityTypeSelect = (type: string) => {
        // Create a synthetic event to reuse existing logic
        const event = {
            target: {
                name: 'activityType',
                value: type
            }
        } as React.ChangeEvent<HTMLInputElement>;
        
        handleChange(event);
        setShowActivityDropdown(false);
    };

    const handleAddActivityType = () => {
        const newType = formData.activityType?.trim();
        if (newType && !activityTypes.includes(newType)) {
            setActivityTypes(prev => [...prev, newType]);
            handleActivityTypeSelect(newType);
        }
    };

    const handleReferenceChange = (index: number, value: string) => {
        const newRefs = [...(formData.references || [])];
        newRefs[index] = value;
        setFormData(prev => ({ ...prev, references: newRefs }));
    };

    const addReference = () => {
        setFormData(prev => ({ ...prev, references: [...(prev.references || []), ''] }));
    };

    const removeReference = (index: number) => {
        const newRefs = [...(formData.references || [])];
        if (newRefs.length > 1) {
            newRefs.splice(index, 1);
            setFormData(prev => ({ ...prev, references: newRefs }));
        } else {
            setFormData(prev => ({ ...prev, references: [''] }));
        }
    };

    const handleSave = () => {
        if (!formData.subject || !formData.content || !formData.concernedDepartment) { 
            alert(t('otherReports_fillAllFields')); 
            return; 
        }
        
        onSave(editingReportId ? { ...formData, id: editingReportId } : formData);
        handleCancelEdit();
    };

    const handleCancelEdit = () => {
        setEditingReportId(null);
        setFormData({
            ...INITIAL_OTHER_REPORT_STATE,
            documentNumber: generateNextDocumentNumber()
        });
        if (onEditHandled) onEditHandled();
    };

    const handleRephrase = async () => {
        if (!formData.content.trim()) { alert(t('otherReports_writeTextFirst')); return; }
        
        const localData = loadInitialData();
        const apiKey = localData.geminiApiKey || process.env.GEMINI_API_KEY;
        
        if (!apiKey || apiKey === '') { setAiError(t('errorApiKeyMissingBuild') || 'مفتاح API الخاص بالذكاء الاصطناعي غير متوفر. يرجى إعداده في إعدادات البيئة.'); return; }
        setIsRephrasing(true); setAiError(null);
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            const prompt = `أنت مفتش تربوي خبير في مادة التربية البدنية والرياضية بالمغرب.
المهمة: تحرير وصياغة وتدقيق تقرير أو مراسلة إدارية بناءً على المعطيات التالية:

1. **نوع النشاط:** ${formData.activityType || 'غير محدد'} (مهم جداً: هذا يحدد سياق وهيكلة التقرير والمصطلحات المستخدمة).
2. **الموضوع الحالي:** ${formData.subject}
3. **مسودة المحتوى/رؤوس الأقلام:** 
"${formData.content}"
4. **تعليمات إضافية:** ${aiInstructions || 'صياغة رسمية، دقيقة، وموجزة.'}

**المطلوب:**
1. **عنوان الموضوع (Subject):** اقترح عنواناً رسمياً ودقيقاً يتناسب تماماً مع "نوع النشاط" ومحتوى التقرير. **تنبيه هام:** لا تضف عبارة "في مادة التربية البدنية والرياضية" إلى العنوان، فهي ضمنية ومعروفة من السياق.
2. **متن المحتوى (Content):** 
   - حرر محتوى التقرير بأسلوب إداري مغربي رصين (النمط المعمول به في وزارة التربية الوطنية).
   - قم بتدقيق النص لغوياً ونحوياً وإملائياً بشكل دقيق جداً.
   - لا تكتب الديباجة (المملكة المغربية...) ولا التحية الختامية ولا التوقيع. فقط المتن.

**قواعد التحرير والشكل (صارمة جداً):**
- **المسافة البادئة (Indentation):** يجب إلزامياً ترك مسافة فارغة واضحة (حوالي 4-5 مسافات فارغة) في بداية السطر الأول من كل فقرة.
- **الفقرات:** يجب تقسيم النص إلى فقرات واضحة، مع الرجوع الإلزامي للسطر عند نهاية كل فقرة وبداية فكرة جديدة.
- **علامات الترقيم:** احترم علامات الترقيم بدقة (الفواصل، النقط، النقطتان، علامات التنصيص). ضع نقطة (.) في نهاية كل فقرة بشكل دائم.
- **التنسيق:** النص يجب أن يكون متناسقاً، خالياً تماماً من الأخطاء اللغوية، وجاهزاً للطباعة المباشرة.
`;

            const response = await ai.models.generateContent({ 
                model: 'gemini-3-flash-preview', 
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            suggestedSubject: { type: Type.STRING, description: "العنوان الرسمي المقترح للموضوع (بدون ذكر اسم المادة)" },
                            refinedContent: { type: Type.STRING, description: "متن التقرير المصاغ والمصحح لغوياً بشكل رسمي مع احترام دقيق للمسافات البادئة والرجوع للسطر وعلامات الترقيم." }
                        },
                        required: ["suggestedSubject", "refinedContent"]
                    }
                }
            });

            const resultText = response.text;
            if (resultText) { 
                const json = JSON.parse(resultText);
                setFormData(prev => ({ 
                    ...prev, 
                    subject: json.suggestedSubject || prev.subject,
                    content: json.refinedContent || prev.content
                })); 
            }
        } catch (e: any) { 
            setAiError("فشل في التواصل مع الذكاء الاصطناعي: " + e.message); 
        } finally { 
            setIsRephrasing(false); 
        }
    };

    const toggleTeacherSelection = (teacherId: string | number) => {
        setFormData(prev => {
            const currentIds = prev.invitedTeacherIds || [];
            const id = String(teacherId);
            const exists = currentIds.some(existingId => String(existingId) === id);
            const newIds = exists ? currentIds.filter(i => String(i) !== id) : [...currentIds, teacherId];
            const newStatuses = { ...prev.invitedTeacherStatuses };
            if (!exists) {
                const teacher = teachers.find(t => String(t.id) === id);
                let status: 'approved' | 'rejected' = 'rejected';
                if (teacher) {
                    const analysis = analyzeTeacherAlerts(teacher) as any;
                    if (analysis.status === 'green') status = 'approved';
                }
                newStatuses[id] = { status };
            } else { delete newStatuses[id]; }
            return { ...prev, invitedTeacherIds: newIds, invitedTeacherStatuses: newStatuses };
        });
    };

    const toggleInstitutionSelection = (instName: string) => {
        const instTeachers = teachers.filter(t => t.institution === instName);
        const instTeacherIds = instTeachers.map(t => String(t.id));
        
        setFormData(prev => {
            const currentIds = new Set((prev.invitedTeacherIds || []).map(String));
            const isAllSelected = instTeacherIds.every(id => currentIds.has(id));
            const newStatuses = { ...prev.invitedTeacherStatuses };

            if (isAllSelected) {
                instTeacherIds.forEach(id => {
                    currentIds.delete(id);
                    delete newStatuses[id];
                });
            } else {
                instTeacherIds.forEach(id => {
                    currentIds.add(id);
                    if (!newStatuses[id]) newStatuses[id] = { status: 'approved' };
                });
            }

            return { ...prev, invitedTeacherIds: Array.from(currentIds), invitedTeacherStatuses: newStatuses };
        });
    };

    const handleInstitutionStatusChange = (instName: string, status: 'approved' | 'rejected') => {
        const instTeacherIds = teachers.filter(t => t.institution === instName).map(t => String(t.id));
        setFormData(prev => {
            const newStatuses = { ...prev.invitedTeacherStatuses };
            instTeacherIds.forEach(id => {
                newStatuses[id] = { status };
            });
            return { ...prev, invitedTeacherStatuses: newStatuses };
        });
    };

    const filteredTeachers = useMemo(() => {
        return teachers.filter(t => {
            const matchSearch = !searchTerm || t.fullName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchInstitution = !filterInstitution || t.institution === filterInstitution;
            const matchFramework = !filterFramework || t.framework === filterFramework;
            return matchSearch && matchInstitution && matchFramework;
        }).sort((a, b) => (a.institution || '').localeCompare(b.institution || '', 'ar') || (a.fullName || '').localeCompare(b.fullName || '', 'ar'));
    }, [teachers, searchTerm, filterInstitution, filterFramework]);

    const isAllFilteredSelected = useMemo(() => filteredTeachers.length > 0 && filteredTeachers.every(t => (formData.invitedTeacherIds || []).map(String).includes(String(t.id))), [filteredTeachers, formData.invitedTeacherIds]);

    const handleSelectAllToggle = () => {
        if (isAllFilteredSelected) {
            const filteredIds = filteredTeachers.map(t => String(t.id));
            setFormData(prev => {
                const newStatuses = { ...prev.invitedTeacherStatuses };
                filteredIds.forEach(id => delete newStatuses[id]);
                return { ...prev, invitedTeacherIds: (prev.invitedTeacherIds || []).filter(id => !filteredIds.includes(String(id))), invitedTeacherStatuses: newStatuses };
            });
        } else {
            const filteredIds = filteredTeachers.map(t => String(t.id));
            setFormData(prev => {
                const newIds = Array.from(new Set([...(prev.invitedTeacherIds || []), ...filteredIds]));
                const newStatuses = { ...prev.invitedTeacherStatuses };
                filteredTeachers.forEach(t => {
                    const id = String(t.id);
                    if (!newStatuses[id]) {
                        const analysis = analyzeTeacherAlerts(t) as any;
                        const status: 'approved' | 'rejected' = analysis.status === 'green' ? 'approved' : 'rejected';
                        newStatuses[id] = { status };
                    }
                });
                return { ...prev, invitedTeacherIds: newIds, invitedTeacherStatuses: newStatuses };
            });
        }
    };

    const selectTeachersByAnalysisStatus = (target: 'approved' | 'rejected') => {
        const filteredIds = filteredTeachers
            .filter(t => {
                const analysis = analyzeTeacherAlerts(t) as any;
                return target === 'approved' ? analysis.status === 'green' : analysis.status !== 'green';
            })
            .map(t => String(t.id));

        setFormData(prev => {
            const currentIds = new Set((prev.invitedTeacherIds || []).map(String));
            const newStatuses = { ...prev.invitedTeacherStatuses };
            
            filteredIds.forEach(id => {
                currentIds.add(id);
                newStatuses[id] = { status: target };
            });

            return { ...prev, invitedTeacherIds: Array.from(currentIds), invitedTeacherStatuses: newStatuses };
        });
    };

    const hasRejectedItems = Object.values(formData.invitedTeacherStatuses || {}).some((s: any) => s.status === 'rejected');

    // Group reports by Academic Year and then by Activity Type with Filtering
    const groupedReports = useMemo(() => {
        const groups: Record<string, Record<string, OtherReport[]>> = {};
        
        // Sort reports by date descending first
        const sortedReports = [...reports].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        sortedReports.forEach(r => {
            const year = getAcademicYear(r.date);
            const type = r.activityType || 'أخرى'; // Fallback if no type
            
            // Apply Filters
            if (archiveYearFilter && year !== archiveYearFilter) return;
            if (archiveTypeFilter && type !== archiveTypeFilter) return;

            if (!groups[year]) groups[year] = {};
            if (!groups[year][type]) groups[year][type] = [];
            
            groups[year][type].push(r);
        });
        
        return groups;
    }, [reports, archiveYearFilter, archiveTypeFilter]);

    return (
        <div className="container mx-auto p-4 md:p-6">
            <PageHeader
                title={<div className="flex items-center gap-4"><button onClick={onGoHome} title={t('home')} className="btn bg-slate-600 text-white hover:bg-slate-700"><i className="fas fa-home"></i></button><h1 className="text-xl md:text-2xl font-bold text-violet-500">{t('otherReports_pageTitle')}</h1></div>}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className={`bg-[rgb(var(--color-card))] p-6 rounded-xl border shadow-sm transition-colors ${editingReportId ? 'border-amber-500 ring-1 ring-amber-500/20' : 'border-[rgb(var(--color-border))]'}`}>
                        <div className="flex items-center justify-between border-b border-[rgb(var(--color-border))] pb-3 mb-4">
                            <h2 className="text-2xl font-bold text-[rgb(var(--color-text-base))]">
                                {editingReportId ? (
                                    <span className="text-amber-600"><i className="fas fa-edit ml-2"></i>{t('editReport')}</span>
                                ) : t('otherReports_formTitle')}
                            </h2>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className="block text-xs font-bold text-[rgb(var(--color-text-muted))] mb-1">{t('otherReports_documentNumber')}</label><input type="text" name="documentNumber" value={formData.documentNumber || ''} onChange={handleChange} className="input-style" placeholder="مثلاً: 05/2026" /></div>
                                <div><label className="block text-xs font-bold text-[rgb(var(--color-text-muted))] mb-1">{t('date')}</label><input type="date" name="date" value={formData.date} onChange={handleChange} className="input-style"/></div>
                                <div><label className="block text-xs font-bold text-[rgb(var(--color-text-muted))] mb-1">{t('otherReports_department')}</label><select name="concernedDepartment" value={formData.concernedDepartment} onChange={handleChange} className="input-style"><option value="" disabled>-- {t('otherReports_selectDepartment')} --</option>{departments.map(dep => <option key={dep} value={dep}>{dep}</option>)}</select></div>
                            </div>
                            
                            {/* Activity Type Selection (Custom Dropdown) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="relative" ref={activityDropdownRef}>
                                    <label className="block text-xs font-bold text-[rgb(var(--color-text-muted))] mb-1">نوع النشاط (يظهر في الحصيلة)</label>
                                    <div className="relative">
                                        <input 
                                            type="text"
                                            name="activityType" 
                                            value={formData.activityType} 
                                            onChange={(e) => {
                                                handleChange(e);
                                                setShowActivityDropdown(true);
                                            }}
                                            onFocus={() => setShowActivityDropdown(true)}
                                            className="input-style font-bold text-sky-700 w-full pl-8" 
                                            placeholder="اختر أو اكتب نوعاً..." 
                                            autoComplete="off"
                                        />
                                        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none">
                                            <i className={`fas fa-chevron-${showActivityDropdown ? 'up' : 'down'}`}></i>
                                        </div>
                                    </div>
                                    
                                    {showActivityDropdown && (
                                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {activityTypes.filter(t => t.includes(formData.activityType || '')).length > 0 ? (
                                                activityTypes.filter(t => t.includes(formData.activityType || '')).map((type) => (
                                                    <div 
                                                        key={type}
                                                        onClick={() => handleActivityTypeSelect(type)}
                                                        className={`px-4 py-2 cursor-pointer text-sm font-medium hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors flex justify-between items-center ${formData.activityType === type ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400' : 'text-slate-700 dark:text-slate-300'}`}
                                                    >
                                                        <span>{type}</span>
                                                        {formData.activityType === type && <i className="fas fa-check text-sky-600"></i>}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-xs text-slate-400 text-center">لا توجد نتائج مطابقة</div>
                                            )}

                                            {/* Add New Activity Option */}
                                            {formData.activityType && !activityTypes.includes(formData.activityType) && formData.activityType.trim() !== '' && (
                                                <div 
                                                    onClick={handleAddActivityType}
                                                    className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 cursor-pointer text-sm font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-2"
                                                >
                                                    <i className="fas fa-plus-circle"></i>
                                                    <span>إضافة "{formData.activityType}" للقائمة</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-[rgb(var(--color-text-muted))] mb-1">{t('otherReports_subject')}</label>
                                    <input type="text" name="subject" value={formData.subject} onChange={handleChange} placeholder={t('otherReports_subjectPlaceholder')} className="input-style font-bold"/>
                                </div>
                            </div>

                            {/* Reference Inputs - RESTORED */}
                            <div>
                                <label className="block text-xs font-bold text-[rgb(var(--color-text-muted))] mb-1">{t('otherReports_reference')}</label>
                                {(formData.references || ['']).map((ref, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={ref}
                                            onChange={(e) => handleReferenceChange(index, e.target.value)}
                                            placeholder={t('otherReports_referencePlaceholder')}
                                            className="input-style flex-grow text-sm"
                                        />
                                        <button onClick={() => removeReference(index)} className="text-rose-500 hover:text-rose-700 p-2 border border-rose-200 rounded-lg hover:bg-rose-50" title="حذف المرجع">
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                ))}
                                <button onClick={addReference} className="text-xs text-sky-600 font-bold hover:underline flex items-center gap-1 bg-sky-50 px-2 py-1 rounded border border-sky-100">
                                    <i className="fas fa-plus"></i> {t('otherReports_addReference')}
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[rgb(var(--color-text-muted))] mb-1">{t('otherReports_content')}</label>
                                <textarea name="content" value={formData.content} onChange={handleChange} rows={10} placeholder="اكتب رؤوس أقلام أو مسودة المحتوى هنا ليقوم الذكاء الاصطناعي بصياغتها..." className="input-style text-justify"></textarea>
                            </div>
                            
                            <div className="bg-violet-50 dark:bg-violet-900/10 p-4 rounded-xl border border-violet-200 dark:border-violet-800">
                                <label className="block text-sm font-bold text-violet-700 dark:text-violet-400 mb-2"><i className="fas fa-magic ml-2"></i> مساعد تحرير (AI)</label>
                                <input type="text" value={aiInstructions} onChange={(e) => setAiInstructions(e.target.value)} placeholder="تعليمات إضافية للصياغة (اختياري)..." className="input-style w-full text-sm border-violet-300 mb-3"/>
                                <button 
                                    onClick={handleRephrase} 
                                    disabled={isRephrasing || !formData.content} 
                                    className="w-full py-2 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700 transition flex items-center justify-center shadow-sm"
                                >
                                    {isRephrasing ? <><i className="fas fa-spinner fa-spin ml-2"></i> جاري الصياغة والتدقيق...</> : <><i className="fas fa-magic ml-2"></i> صياغة وتدقيق المحتوى (AI)</>}
                                </button>
                                {aiError && <p className="text-rose-600 text-[10px] mt-2 font-bold">{aiError}</p>}
                            </div>

                            {isValidationTemplate && !isCycleValidation && (
                                <div className="p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-200 dark:border-sky-800">
                                    <label className="block text-sm font-bold text-sky-700 dark:text-sky-400 mb-2">طريقة عرض ملحق المصادقة:</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="validationDisplayMode" value="teachers" checked={formData.validationDisplayMode === 'teachers'} onChange={handleChange} className="h-4 w-4 text-sky-600"/>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">عرض لائحة الأساتذة</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="validationDisplayMode" value="institutions" checked={formData.validationDisplayMode === 'institutions'} onChange={handleChange} className="h-4 w-4 text-sky-600"/>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">عرض لائحة المؤسسات فقط</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 pt-6 border-t border-[rgb(var(--color-border))]">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-lg font-bold text-sky-700 dark:text-sky-400">
                                        {isCycleValidation 
                                            ? `اختيار المؤسسات للمصادقة (${selectedInstitutionsCount})` 
                                            : `${t('otherReports_invitedTeachersTitle')} (${selectedTeachersCount})`
                                        }
                                    </h3>
                                    <label className="flex items-center gap-2 cursor-pointer bg-[rgb(var(--color-card))] px-3 py-1.5 rounded-lg border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-card-hover))] transition-colors shadow-sm">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.includeTeachersList !== false} 
                                            onChange={(e) => setFormData(prev => ({...prev, includeTeachersList: e.target.checked}))} 
                                            className="h-4 w-4 text-sky-600 rounded focus:ring-sky-500"
                                        />
                                        <span className="text-xs font-bold text-[rgb(var(--color-text-base))] select-none">إدراج اللائحة في التقرير</span>
                                    </label>
                                </div>
                                
                                {formData.includeTeachersList !== false && (
                                    <>
                                        {!isCycleValidation && isValidationTemplate && (
                                            <div className="flex flex-wrap gap-2 mb-4 bg-sky-50 dark:bg-sky-900/10 p-3 rounded-xl border border-sky-100 dark:border-sky-800">
                                                <span className="text-xs font-bold text-sky-700 dark:text-sky-400 w-full mb-1">اختصارات المصادقة التلقائية (بناءً على تحليل الجداول):</span>
                                                <button onClick={() => selectTeachersByAnalysisStatus('approved')} className="text-[10px] font-bold px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1"><i className="fas fa-check-circle"></i>تحديد جميع الجداول السليمة</button>
                                                <button onClick={() => selectTeachersByAnalysisStatus('rejected')} className="text-[10px] font-bold px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors shadow-sm flex items-center gap-1"><i className="fas fa-exclamation-circle"></i>تحديد الجداول التي بها ملاحظات</button>
                                            </div>
                                        )}

                                        {!isCycleValidation && (
                                            <div className="flex flex-col gap-3 mb-4">
                                                <div className="flex-grow"><input type="text" placeholder={t('otherReports_searchTeacher')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-style text-xs w-full"/></div>
                                                <div className="flex gap-2">
                                                    <div className="w-1/2">
                                                        <select value={filterInstitution} onChange={(e) => setFilterInstitution(e.target.value)} className="input-style text-xs w-full">
                                                            <option value="">كل المؤسسات</option>
                                                            {uniqueInstitutions.map(i => <option key={i} value={i}>{i}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="w-1/2">
                                                        <select value={filterFramework} onChange={(e) => setFilterFramework(e.target.value)} className="input-style text-xs w-full">
                                                            <option value="">كل الأطر</option>
                                                            {uniqueFrameworks.map(f => <option key={f} value={f}>{f}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="max-h-80 overflow-y-auto border border-[rgb(var(--color-border))] rounded-lg bg-[rgb(var(--color-background))] p-2">
                                            {isCycleValidation ? (
                                                uniqueInstitutions.map(instName => {
                                                    const instTeachers = teachers.filter(t => t.institution === instName);
                                                    const instTeacherIds = instTeachers.map(t => String(t.id));
                                                    const isSelected = instTeacherIds.some(id => (formData.invitedTeacherIds || []).map(String).includes(id));
                                                    const isFullySelected = instTeacherIds.every(id => (formData.invitedTeacherIds || []).map(String).includes(id));
                                                    const status = instTeacherIds.some(id => (formData.invitedTeacherStatuses as any)?.[id]?.status === 'rejected') ? 'rejected' : 'approved';

                                                    return (
                                                        <div key={instName} className={`flex flex-col p-3 rounded-xl transition-colors mb-2 ${isSelected ? 'bg-sky-500/5 ring-1 ring-sky-500/20' : 'hover:bg-[rgb(var(--color-card-hover))] border border-transparent'}`}>
                                                            <div className="flex items-center cursor-pointer" onClick={() => toggleInstitutionSelection(instName)}>
                                                                <input type="checkbox" checked={isFullySelected} readOnly className="ml-3 h-5 w-5 rounded text-violet-600"/>
                                                                <div className="text-sm flex-grow">
                                                                    <div className={`font-bold ${isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-[rgb(var(--color-text-base))]'}`}>{instName}</div>
                                                                    <div className="text-[10px] text-[rgb(var(--color-text-muted))]">عدد الأساتذة: {instTeachers.length}</div>
                                                                </div>
                                                                {isSelected && (
                                                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                                        <button onClick={() => handleInstitutionStatusChange(instName, 'approved')} className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${status === 'approved' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-200 text-slate-400 hover:bg-emerald-100'}`}><i className="fas fa-check text-xs"></i></button>
                                                                        <button onClick={() => handleInstitutionStatusChange(instName, 'rejected')} className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${status === 'rejected' ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-200 text-slate-400 hover:bg-rose-100'}`}><i className="fas fa-times text-xs"></i></button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <>
                                                    <div className="flex items-center px-2 py-2 mb-1 bg-slate-50 dark:bg-slate-900/20 rounded-t-lg border border-[rgb(var(--color-border))] select-none"><label className="flex items-center gap-2 cursor-pointer w-full group"><input type="checkbox" checked={isAllFilteredSelected} onChange={handleSelectAllToggle} className="h-4 w-4 rounded text-sky-600"/><span className="text-[10px] font-black text-sky-700 dark:text-sky-400 group-hover:underline">{t('otherReports_selectAll')} ({filteredTeachers.length})</span></label></div>
                                                    {filteredTeachers.map(teacher => {
                                                        const isSelected = (formData.invitedTeacherIds || []).some(id => String(id) === String(teacher.id));
                                                        const teacherStatus = formData.invitedTeacherStatuses?.[String(teacher.id)] || { status: 'approved' };
                                                        const analysis = analyzeTeacherAlerts(teacher) as any;
                                                        const colorMap = { green: 'bg-emerald-500', red: 'bg-rose-500', blue: 'bg-sky-500' };
                                                        const analysisStatus = analysis.status as 'green' | 'red' | 'blue';

                                                        return (
                                                            <div key={teacher.id} className={`flex flex-col p-2 rounded transition-colors mb-2 ${isSelected ? 'bg-sky-500/5 ring-1 ring-sky-500/20' : 'hover:bg-[rgb(var(--color-card-hover))]'}`}>
                                                                <div className="flex items-center cursor-pointer" onClick={() => toggleTeacherSelection(teacher.id)}>
                                                                    <input type="checkbox" checked={isSelected} readOnly className="ml-3 h-4 w-4 rounded text-violet-600"/>
                                                                    <div className="text-xs flex-grow">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className={`w-2.5 h-2.5 rounded-full ${colorMap[analysisStatus] || 'bg-slate-400'}`} title={analysis.title}></div>
                                                                            <div className={`font-bold ${isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-[rgb(var(--color-text-base))]'}`}>{teacher.fullName}</div>
                                                                        </div>
                                                                        <div className="text-[rgb(var(--color-text-muted))] mr-4.5">{teacher.institution} - {teacher.framework}</div>
                                                                    </div>
                                                                    {isSelected && isValidationTemplate && (
                                                                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                                            <button onClick={() => setFormData(prev => ({...prev, invitedTeacherStatuses: {...prev.invitedTeacherStatuses, [String(teacher.id)]: {status: 'approved'}}}))} className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${teacherStatus.status === 'approved' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-200 text-slate-400 hover:bg-emerald-100'}`}><i className="fas fa-check text-[10px]"></i></button>
                                                                            <button onClick={() => setFormData(prev => ({...prev, invitedTeacherStatuses: {...prev.invitedTeacherStatuses, [String(teacher.id)]: {status: 'rejected'}}}))} className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${teacherStatus.status === 'rejected' ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-200 text-slate-400 hover:bg-rose-100'}`}><i className="fas fa-times text-[10px]"></i></button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                            {formData.includeTeachersList !== false && isAnyValidation && hasRejectedItems && (
                                <div className="mt-4 bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-200 dark:border-rose-800 animate-fadeIn">
                                    <label className="block text-sm font-bold text-rose-700 dark:text-rose-400 mb-2"><i className="fas fa-exclamation-triangle ml-2"></i> السبب والملاحظات (لجميع المؤسسات/الأساتذة غير المصادق عليهم)</label>
                                    <textarea name="generalRejectionReason" value={formData.generalRejectionReason || ''} onChange={handleChange} className="input-style w-full text-sm border-rose-300" rows={3} placeholder="أدخل سبب عدم المصادقة هنا..."/>
                                </div>
                            )}
                            <div className="flex gap-2 mt-6 pt-4 border-t border-[rgb(var(--color-border))]">
                                <button onClick={handleSave} className="flex-grow px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition shadow-md flex items-center justify-center gap-2">
                                    <i className="fas fa-save"></i> 
                                    {editingReportId ? t('saveChanges') : t('save')}
                                </button>
                                {editingReportId && (
                                    <button onClick={handleCancelEdit} className="px-4 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition">
                                        {t('cancel')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-[rgb(var(--color-text-base))] flex items-center gap-2">
                            <i className="fas fa-archive text-slate-400"></i>
                            الأرشيف
                        </h2>
                        {onMarkAllDelivered && Object.values(groupedReports).flatMap(yg => Object.values(yg).flat()).some(r => !r.delivered) && (
                            <button 
                                onClick={() => onMarkAllDelivered(Object.values(groupedReports).flatMap(yg => Object.values(yg).flat()).map(r => String(r.id)))} 
                                title="تسليم الكل" 
                                className="btn btn-secondary bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 text-sm py-1 px-3"
                            >
                                <i className="fas fa-check-double ml-1"></i> تسليم الكل
                            </button>
                        )}
                    </div>
                    
                    {/* Archive Filters */}
                    <div className="mb-4 space-y-2 bg-[rgb(var(--color-card))] p-3 rounded-xl border border-[rgb(var(--color-border))]">
                        <div>
                            <label className="block text-[10px] font-bold text-[rgb(var(--color-text-muted))] mb-1">الموسم الدراسي</label>
                            <select 
                                value={archiveYearFilter} 
                                onChange={(e) => setArchiveYearFilter(e.target.value)} 
                                className="input-style text-xs w-full py-1.5"
                            >
                                <option value="">جميع المواسم</option>
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-[rgb(var(--color-text-muted))] mb-1">نوع التقرير</label>
                            <select 
                                value={archiveTypeFilter} 
                                onChange={(e) => setArchiveTypeFilter(e.target.value)} 
                                className="input-style text-xs w-full py-1.5"
                            >
                                <option value="">جميع الأنواع</option>
                                {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    {reports.length === 0 ? (
                        <div className="text-center py-10 bg-[rgb(var(--color-background))] rounded-xl border border-dashed border-[rgb(var(--color-border))]">
                            <p className="text-[rgb(var(--color-text-muted))] text-sm">لا توجد تقارير محفوظة.</p>
                        </div>
                    ) : (
                       <div className="space-y-6">
                            {Object.entries(groupedReports).sort((a, b) => b[0].localeCompare(a[0])).map(([year, types]) => {
                                // Skip empty years (if filtered out)
                                if (Object.keys(types).length === 0) return null;
                                
                                return (
                                <div key={year} className="mb-4 animate-fadeIn">
                                    <h3 className="text-sm font-black text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 px-3 py-1.5 rounded-lg border border-sky-100 dark:border-sky-800 mb-3 inline-block">
                                        الموسم الدراسي {year}
                                    </h3>
                                    <div className="space-y-3">
                                        {Object.entries(types).map(([type, typeReports]) => (
                                            <div key={type} className="mr-2 border-r-2 border-slate-200 dark:border-slate-700 pr-3">
                                                <h4 className="text-xs font-bold text-[rgb(var(--color-text-muted))] mb-2 flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                                                    {type}
                                                </h4>
                                                <div className="space-y-2">
                                                    {typeReports.map(report => (
                                                        <div key={report.id} className={`bg-[rgb(var(--color-card))] rounded-lg shadow-sm border p-3 hover:shadow-md transition-all ${editingReportId === report.id ? 'border-amber-500 ring-1 ring-amber-500/20 scale-[1.02]' : 'border-[rgb(var(--color-border))]'}`}>
                                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                                <h3 className={`font-bold text-xs line-clamp-2 leading-tight ${report.delivered ? 'text-slate-500 dark:text-slate-400' : 'text-[rgb(var(--color-text-base))]'}`} title={report.subject}>{report.subject}</h3>
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 mb-2 flex flex-col gap-1">
                                                                <div className="flex items-center gap-1"><i className="far fa-calendar-alt"></i> {new Date(report.date).toLocaleDateString('ar-MA')}</div>
                                                                {report.documentNumber && (
                                                                    <div className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-400">
                                                                        <i className="fas fa-hashtag"></i> {report.documentNumber}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-[rgb(var(--color-border))]">
                                                                <button 
                                                                    onClick={() => onToggleReportDelivered(report)} 
                                                                    className={`${report.delivered ? 'text-emerald-600' : 'text-slate-400'} hover:text-emerald-700 transition-colors p-1.5 rounded`} 
                                                                    title={report.delivered ? "تم التسليم" : "تحديد كمُسلّم"}
                                                                >
                                                                    <i className={`fas ${report.delivered ? 'fa-check-circle' : 'fa-check'}`}></i>
                                                                </button>
                                                                <button onClick={() => onViewReport(report)} className="text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30 p-1.5 rounded" title={t('view')}><i className="fas fa-eye"></i></button>
                                                                <button onClick={() => handleCloneReport(report)} className="text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 p-1.5 rounded" title="نسخ كتقرير جديد"><i className="fas fa-copy"></i></button>
                                                                <button onClick={() => loadReportIntoForm(report)} className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 p-1.5 rounded" title={t('edit')}><i className="fas fa-edit"></i></button>
                                                                <button onClick={() => onDeleteReport(report)} className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-1.5 rounded" title={t('delete')}><i className="fas fa-trash-alt"></i></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )})}
                            
                            {/* Empty state when filters match nothing */}
                            {Object.values(groupedReports).every(types => Object.keys(types).length === 0) && (
                                <div className="text-center py-8">
                                    <p className="text-xs text-[rgb(var(--color-text-muted))]">لا توجد تقارير تطابق خيارات التصفية.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

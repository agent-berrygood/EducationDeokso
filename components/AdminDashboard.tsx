'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SurveyFormPlaceholder } from '@/components/SurveyFormPlaceholder';
import ApplicationEditModal from '@/components/ApplicationEditModal';
import WaterparkRoster from '@/components/WaterparkRoster';
import StaffApplicationsRoster from '@/components/StaffApplicationsRoster';
import AdminSettingsPanel from '@/components/admin/AdminSettingsPanel';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import TypedConfirmDialog from '@/components/ui/TypedConfirmDialog';
import { useToast, useConfirm } from '@/components/ui/Feedback';
import type { FeesConfig } from '@/lib/types';
import { genderLabel, departmentFullLabel } from '@/lib/labels';
import { getPresetSubDepartments } from '@/lib/subDepartments';
import { unassignedSubDepartmentIds } from '@/lib/tracks';
import type { NewCustomFieldDraft, SettingsForm, TrackInfo } from '@/components/admin/types';

interface Application {
  id: string;
  parent_name: string;
  parent_phone: string;
  depositor_name: string;
  grand_total: number;
  created_at: string;
  children: any[];
}

interface AdminDashboardProps {
  department: 'kinder' | 'kids' | 'teens' | string;
  /** 외부에서 지정한 세부 부서 필터 (통합 어드민 등) */
  subDepartment?: string;
}

export default function AdminDashboard({ department, subDepartment: externalSubDepartment }: AdminDashboardProps) {
  const router = useRouter();
  const showToast = useToast();
  const confirmDialog = useConfirm();
  const [activeTab, setActiveTab] = useState<'applications' | 'settings' | 'payment' | 'surveys' | string>('applications');
  const [applications, setApplications] = useState<Application[]>([]);

  const [config, setConfig] = useState<any>(null);
  const [fees, setFees] = useState<FeesConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingApp, setEditingApp] = useState<any>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // 페이징, 검색 및 정렬 상태 추가
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'childName' | 'age' | 'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // 하위 부서 탭 필터 state (외부 prop 우선)
  const [selectedSubDept, setSelectedSubDept] = useState<string>('all');
  const effectiveSubDept = externalSubDepartment ?? selectedSubDept;

  // 트랙(연합/분리 운영) state
  const [operatingMode, setOperatingMode] = useState<'union' | 'split'>('union');
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [activeTrackKey, setActiveTrackKey] = useState<string>('main'); // 설정 탭에서 편집 중인 트랙
  const [selectedTrack, setSelectedTrack] = useState<string>('all');    // 신청 현황 탭 필터
  const [newTrack, setNewTrack] = useState<{ label: string; subs: string[] }>({ label: '', subs: [] });
  const unassignedSubDeptIds = useMemo(
    () => unassignedSubDepartmentIds(getPresetSubDepartments(department).map((sd) => sd.id), tracks),
    [department, tracks]
  );

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<SettingsForm>({
    title: '',
    eventType: '',
    subtitle: '',
    scripture: '',
    primaryColor: department === 'kinder' ? '#EAB308' : department === 'kids' ? '#3B82F6' : '#22C55E',
    bgColor: department === 'kinder' ? '#FEF08A' : department === 'kids' ? '#DBEAFE' : '#0F172A',
    tshirtSizes: [],
    customFields: [],
    subDepartments: getPresetSubDepartments(department),
    campStartDate: '',
    campSchedule: [],
    campType: 'continuous',
    campDuration: 3,
    posterUrl: '',
    events: [],
    isStepRecruitmentActive: false,
    tshirtDeadline: '',
    stepTshirtSizes: [],
    isWaterparkActive: true,
    waterparkInfo: { title: '', date: '', time: '', location: '', note: '' },
    isCampActive: true,
    isExternalApply: false,
    externalApplyUrl: '',
  });

  const [newTshirtSize, setNewTshirtSize] = useState('');
  const [newStepTshirtSize, setNewStepTshirtSize] = useState('');
  const [newSchedule, setNewSchedule] = useState({
    day: 1,
    time: '',
    title: '',
    description: '',
  });
  const [newCustomField, setNewCustomField] = useState<NewCustomFieldDraft>({
    label: '',
    type: 'text',
    required: false,
    options: '',
    columnIndex: 1,
  });

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError('');
      // 어드민 SQL 페이징 및 정렬 연동 호출
      const sqlSortField = sortField === 'childName' ? 'parentName' : 'createdAt'; // API가 'createdAt' 외의 값은 parent_name 정렬로 처리
      const trackParam = operatingMode === 'split' && selectedTrack !== 'all' ? `&track=${encodeURIComponent(selectedTrack)}` : '';
      const res = await fetch(`/api/applications?department=${department}&limit=100&offset=${offset}&sortBy=${sqlSortField}&sortOrder=${sortDirection.toUpperCase()}${trackParam}`);
      if (!res.ok) throw new Error('Fetch failed');
      const { data } = await res.json();
      setApplications(data || []);
    } catch (err) {
      setError('신청서 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data: any) => {
    setConfig(data);
    setSettingsForm({
      title: data.title || '',
      eventType: data.event_type || '',
      subtitle: data.subtitle || '',
      scripture: data.scripture || '',
      primaryColor: data.primary_color || (department === 'kinder' ? '#EAB308' : department === 'kids' ? '#3B82F6' : '#22C55E'),
      bgColor: data.bg_color || (department === 'kinder' ? '#FEF08A' : department === 'kids' ? '#DBEAFE' : '#0F172A'),
      tshirtSizes: data.tshirtSizes || [],
      customFields: data.customFieldMappings || [],
      // 세부부서는 CMS에서 편집 불가 — 항상 부서별 고정 프리셋만 사용 (DB 값은 무시)
      subDepartments: getPresetSubDepartments(department),
      campStartDate: data.camp_start_date || '',
      campSchedule: data.campSchedule || [],
      campType: data.campType || 'continuous',
      campDuration: Number(data.campDuration || 3),
      posterUrl: data.posterUrl || '',
      events: data.events || [],
      isStepRecruitmentActive: data.isStepRecruitmentActive || false,
      tshirtDeadline: (data.tshirtDeadline && !isNaN(new Date(data.tshirtDeadline).getTime())) ? new Date(data.tshirtDeadline).toISOString() : '',
      stepTshirtSizes: data.stepTshirtSizes || [],
      isWaterparkActive: data.isWaterparkActive ?? true,
      waterparkInfo: { title: '', date: '', time: '', location: '', note: '', ...(data.waterparkInfo || {}) },
      isCampActive: data.isCampActive ?? true,
      isExternalApply: data.isExternalApply ?? false,
      externalApplyUrl: data.externalApplyUrl || '',
    });
  };

  const loadTrackConfig = async (trackKey: string) => {
    const res = await fetch(`/api/config/${department}?track=${encodeURIComponent(trackKey)}`);
    if (!res.ok) throw new Error('Fetch failed');
    const { data } = await res.json();
    populateForm(data);
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError('');
      // 트랙 목록 + 운영모드 로드
      const listRes = await fetch(`/api/config/${department}?list=1`);
      const listJson = await listRes.json();
      const mode: 'union' | 'split' = listJson?.data?.operatingMode === 'split' ? 'split' : 'union';
      const trackList = listJson?.data?.tracks || [];
      setOperatingMode(mode);
      setTracks(trackList);
      let tk = trackList.some((t: any) => t.trackKey === activeTrackKey) ? activeTrackKey : 'main';
      // 분리 모드에서는 'main'(전체 연합)을 편집 대상으로 삼지 않음 — non-main 트랙이 있으면 자동 전환
      if (mode === 'split' && tk === 'main') {
        const firstNonMain = trackList.find((t: any) => t.trackKey !== 'main');
        if (firstNonMain) tk = firstNonMain.trackKey;
      }
      setActiveTrackKey(tk);
      await loadTrackConfig(tk);
    } catch (err) {
      setError('CMS 설정을 로드하는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 설정 탭에서 편집 트랙 전환
  const switchTrack = async (trackKey: string) => {
    setActiveTrackKey(trackKey);
    try {
      setLoading(true);
      await loadTrackConfig(trackKey);
    } catch {
      setError('트랙 설정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'applications') {
      loadApplications();
    } else if (activeTab === 'settings') {
      loadConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, offset, department, sortField, sortDirection, selectedTrack]);

  // 트랙 메타 로드 (모든 탭에서 운영모드/트랙 필터 사용 가능하도록 부서 변경 시 1회)
  useEffect(() => {
    setSelectedTrack('all');
    (async () => {
      try {
        const res = await fetch(`/api/config/${department}?list=1`);
        const json = await res.json();
        if (json?.success) {
          setOperatingMode(json.data.operatingMode === 'split' ? 'split' : 'union');
          setTracks(json.data.tracks || []);
        }
      } catch {
        showToast('트랙/운영모드 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.', 'error');
      }
    })();
  }, [department]);

  // 글로벌 요금 정보 로드 (수납 모니터에서 사용)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/fees');
        const json = await res.json();
        if (json.success) setFees(json.data);
      } catch {
        showToast('요금 정보를 불러오지 못했습니다.', 'error');
      }
    })();
  }, []);

  const deleteApplication = async (id: string) => {
    if (!(await confirmDialog('정말 이 신청 정보 및 동반 자녀 데이터를 삭제하시겠습니까?\n관련 데이터가 영구히 제거됩니다.'))) return;
    try {
      const res = await fetch(`/api/applications?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      showToast('데이터가 성공적으로 제거되었습니다.', 'success');
      loadApplications();
    } catch (err) {
      showToast('삭제 도중 에러가 발생했습니다.', 'error');
    }
  };

  // 부서별 명단 초기화 — 해당 부서 자녀만 삭제(다른 부서 형제자매 보존)
  const resetDepartment = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/applications/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department, confirmationPhrase: department }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Reset failed');
      showToast(
        `초기화 완료: 자녀 ${json.data.childrenRemoved}명, 신청서 ${json.data.applicationsRemoved}건 삭제됨.`,
        'success'
      );
      setResetModalOpen(false);
      loadApplications();
    } catch (err) {
      showToast('명단 초기화 도중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const exportExcel = async () => {
    try {
      const res = await fetch(`/api/export?department=${department}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `신청현황_${department}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
    } catch (err) {
      showToast('엑셀 파일 생성에 실패했습니다.', 'error');
    }
  };

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 제한 (2MB) - Neon DB 용량 최적화용
    if (file.size > 2 * 1024 * 1024) {
      showToast('파일 크기가 너무 큽니다. 데이터베이스 최적화를 위해 2MB 이하의 이미지만 업로드해주세요.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSettingsForm((prev: any) => ({
          ...prev,
          posterUrl: base64String
        }));
        setIsSaving(false);
        showToast('포스터 이미지가 정상적으로 변환되었습니다! 하단 저장 버튼을 눌러 확정해주세요.', 'success');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error(err);
      showToast('이미지 파일 변환 중 에러가 발생했습니다.', 'error');
      setIsSaving(false);
    }
  };

  // 저장 전 필수 입력값 검증
  const validateSettings = (): string | null => {
    if (!settingsForm.title.trim()) return '공식 행사 명칭을 입력해주세요.';
    if (!/^#[0-9A-Fa-f]{6}$/.test(settingsForm.primaryColor)) return '메인 테마 컬러 값이 올바르지 않습니다.';
    if (!/^#[0-9A-Fa-f]{6}$/.test(settingsForm.bgColor)) return '배경 톤 컬러 값이 올바르지 않습니다.';
    const duration = Number(settingsForm.campDuration);
    if (!Number.isFinite(duration) || duration < 1 || duration > 30) return '수련회 기간은 1~30 사이의 숫자여야 합니다.';
    return null;
  };

  const saveSettings = async () => {
    const validationError = validateSettings();
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }
    try {
      setIsSaving(true);
      const res = await fetch(`/api/config/${department}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: settingsForm.title,
          eventType: settingsForm.eventType,
          subtitle: settingsForm.subtitle,
          scripture: settingsForm.scripture,
          primaryColor: settingsForm.primaryColor,
          bgColor: settingsForm.bgColor,
          tshirtSizes: settingsForm.tshirtSizes,
          customFieldMappings: settingsForm.customFields,
          subDepartments: settingsForm.subDepartments,
          campStartDate: settingsForm.campStartDate,
          campSchedule: settingsForm.campSchedule,
          campType: settingsForm.campType,
          campDuration: settingsForm.campDuration,
          posterUrl: settingsForm.posterUrl,
          events: settingsForm.events,
          isStepRecruitmentActive: settingsForm.isStepRecruitmentActive,
          tshirtDeadline: (settingsForm.tshirtDeadline && !isNaN(new Date(settingsForm.tshirtDeadline).getTime())) ? new Date(settingsForm.tshirtDeadline).toISOString() : null,
          stepTshirtSizes: settingsForm.stepTshirtSizes,
          isWaterparkActive: settingsForm.isWaterparkActive,
          waterparkInfo: settingsForm.waterparkInfo,
          isCampActive: settingsForm.isCampActive,
          isExternalApply: settingsForm.isExternalApply,
          externalApplyUrl: settingsForm.externalApplyUrl,
          // 현재 편집 중인 트랙 + 운영 모드
          trackKey: activeTrackKey,
          trackLabel: tracks.find((t) => t.trackKey === activeTrackKey)?.label ?? null,
          subDepartmentIds: tracks.find((t) => t.trackKey === activeTrackKey)?.subDepartmentIds ?? [],
          operatingMode,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast('CMS 테마 및 행사 설정이 반영되었습니다.', 'success');
      loadConfig();
    } catch (err) {
      showToast('설정 저장 도중 문제가 발생했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 현재 settingsForm을 config POST body로 직렬화 (트랙 필드 제외)
  const configBodyFromForm = () => ({
    title: settingsForm.title,
    eventType: settingsForm.eventType,
    subtitle: settingsForm.subtitle,
    scripture: settingsForm.scripture,
    primaryColor: settingsForm.primaryColor,
    bgColor: settingsForm.bgColor,
    tshirtSizes: settingsForm.tshirtSizes,
    customFieldMappings: settingsForm.customFields,
    subDepartments: settingsForm.subDepartments,
    campStartDate: settingsForm.campStartDate,
    campSchedule: settingsForm.campSchedule,
    campType: settingsForm.campType,
    campDuration: settingsForm.campDuration,
    posterUrl: settingsForm.posterUrl,
    events: settingsForm.events,
    isStepRecruitmentActive: settingsForm.isStepRecruitmentActive,
    tshirtDeadline: (settingsForm.tshirtDeadline && !isNaN(new Date(settingsForm.tshirtDeadline).getTime())) ? new Date(settingsForm.tshirtDeadline).toISOString() : null,
    stepTshirtSizes: settingsForm.stepTshirtSizes,
    isWaterparkActive: settingsForm.isWaterparkActive,
    waterparkInfo: settingsForm.waterparkInfo,
    isCampActive: settingsForm.isCampActive,
    isExternalApply: settingsForm.isExternalApply,
    externalApplyUrl: settingsForm.externalApplyUrl,
  });

  const postConfig = async (extra: Record<string, any>) => {
    const res = await fetch(`/api/config/${department}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...configBodyFromForm(), ...extra }),
    });
    if (!res.ok) throw new Error('Save failed');
    return res.json();
  };

  // 운영 모드(연합/분리) 전환 — main 트랙 기준으로 현재 폼 데이터 보존하며 반영
  const changeOperatingMode = async (mode: 'union' | 'split') => {
    try {
      setIsSaving(true);
      setActiveTrackKey('main');
      await postConfig({ trackKey: 'main', operatingMode: mode });
      setOperatingMode(mode);
      await loadConfig();
    } catch {
      showToast('운영 모드 변경에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 수련회 운영 여부(부서 단위) 전환 — 즉시 대부서 전체 행에 반영 (운영 모드와 동일 UX)
  const changeCampActive = async (active: boolean) => {
    try {
      setIsSaving(true);
      setSettingsForm((prev) => ({ ...prev, isCampActive: active }));
      await postConfig({ trackKey: activeTrackKey, isCampActive: active });
      await loadConfig();
      showToast(active ? '이 부서 수련회를 운영합니다.' : '이 부서는 올해 수련회를 진행하지 않습니다.', 'success');
    } catch {
      showToast('수련회 운영 여부 변경에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 트랙(그룹) 추가 — 현재 설정을 템플릿으로 복사해 신규 트랙 생성
  const addTrack = async () => {
    if (!newTrack.label.trim()) { showToast('트랙(그룹) 이름을 입력하세요.', 'error'); return; }
    if (newTrack.subs.length === 0) { showToast('이 트랙에 포함할 세부부서를 1개 이상 선택하세요.', 'error'); return; }
    try {
      setIsSaving(true);
      const trackKey = `track_${Date.now()}`;
      await postConfig({
        trackKey,
        trackLabel: newTrack.label.trim(),
        subDepartmentIds: newTrack.subs,
        operatingMode: 'split',
      });
      setNewTrack({ label: '', subs: [] });
      setOperatingMode('split');
      await loadConfig();
      await switchTrack(trackKey);
    } catch {
      showToast('트랙 추가에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTrack = async (trackKey: string) => {
    if (trackKey === 'main') return;
    if (!(await confirmDialog('이 트랙을 삭제하시겠습니까?\n트랙 설정이 제거됩니다. (신청 데이터는 보존)'))) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/config/${department}?track=${encodeURIComponent(trackKey)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      if (activeTrackKey === trackKey) setActiveTrackKey('main');
      await loadConfig();
    } catch {
      showToast('트랙 삭제에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addTshirtSize = () => {
    const size = newTshirtSize.trim().toUpperCase();
    if (!size) return;
    if (settingsForm.tshirtSizes.includes(size)) {
      showToast('이미 등록된 사이즈입니다.', 'error');
      return;
    }
    setSettingsForm((prev: any) => ({
      ...prev,
      tshirtSizes: [...prev.tshirtSizes, size],
    }));
    setNewTshirtSize('');
  };

  const removeTshirtSize = (size: string) => {
    setSettingsForm((prev: any) => ({
      ...prev,
      tshirtSizes: prev.tshirtSizes.filter((s: string) => s !== size),
    }));
  };

  const addStepTshirtSize = () => {
    const size = newStepTshirtSize.trim().toUpperCase();
    if (!size) return;
    if ((settingsForm.stepTshirtSizes || []).includes(size)) {
      showToast('이미 등록된 사이즈입니다.', 'error');
      return;
    }
    setSettingsForm((prev: any) => ({
      ...prev,
      stepTshirtSizes: [...(prev.stepTshirtSizes || []), size],
    }));
    setNewStepTshirtSize('');
  };

  const removeStepTshirtSize = (size: string) => {
    setSettingsForm((prev: any) => ({
      ...prev,
      stepTshirtSizes: (prev.stepTshirtSizes || []).filter((s: string) => s !== size),
    }));
  };

  const addCustomField = () => {
    if (!newCustomField.label.trim()) return;
    const field = {
      ...newCustomField,
      id: `field_${Date.now()}`,
      options: newCustomField.options ? newCustomField.options.split(',').map((o: string) => o.trim()).filter(Boolean) : [],
    };
    setSettingsForm((prev: any) => ({
      ...prev,
      customFields: [...prev.customFields, field],
    }));
    setNewCustomField({ label: '', type: 'text', required: false, options: '', columnIndex: 1 });
  };

  const removeCustomField = (id: string) => {
    setSettingsForm((prev: any) => ({
      ...prev,
      customFields: prev.customFields.filter((f: any) => f.id !== id),
    }));
  };

  const addScheduleItem = () => {
    if (!newSchedule.time.trim() || !newSchedule.title.trim()) {
      showToast('시간과 일정명은 필수 입력 항목입니다.', 'error');
      return;
    }
    setSettingsForm((prev: any) => ({
      ...prev,
      campSchedule: [
        ...(prev.campSchedule || []),
        {
          id: `sched_${Date.now()}`,
          day: Number(newSchedule.day),
          time: newSchedule.time.trim(),
          title: newSchedule.title.trim(),
          description: newSchedule.description.trim(),
        }
      ].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)),
    }));
    setNewSchedule({ day: newSchedule.day, time: '', title: '', description: '' });
  };

  const removeScheduleItem = (id: string) => {
    setSettingsForm((prev: any) => ({
      ...prev,
      campSchedule: (prev.campSchedule || []).filter((s: any) => s.id !== id),
    }));
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 0;
    try {
      const birthYear = new Date(birthDate).getFullYear();
      const currentYear = new Date().getFullYear();
      return currentYear - birthYear + 1;
    } catch (e) {
      return 0;
    }
  };

  // 알러지 데이터를 다양한 저장 형태(배열/JSON 문자열/쉼표 구분 문자열/null)에서 안전 변환
  const parseAllergies = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw !== 'string') return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmed);
        return Array.isArray(arr) ? arr.filter(Boolean) : [];
      } catch {
        return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  };

  // 아이 단위(자녀 중심)의 리스토어 평탄화 연산
  const processedChildren = useMemo(() => {
    const rows: any[] = [];
    try {
      applications.forEach(app => {
        if (!app?.children || !Array.isArray(app.children)) return;
        app.children.forEach((child: any) => {
          if (!child) return;
          if (child.department === department || !child.department) {
            rows.push({
              appId: app.id,
              parentName: app.parent_name,
              parentPhone: app.parent_phone,
              depositorName: app.depositor_name || app.parent_name,
              childName: child.name || '',
              birthDate: child.birthDate || child.birth_date || '',
              age: calculateAge(child.birthDate || child.birth_date || ''),
              tshirtSize: child.tshirtSize || child.tshirt_size || '',
              allergies: parseAllergies(child.allergies),
              customAllergy: child.customAllergy || child.custom_allergy || '',
              attendsWaterpark: !!(child.attendsWaterpark ?? child.attends_waterpark),
              grandTotal: app.grand_total,
              createdAt: app.created_at,
              originalChild: child
            });
          }
        });
      });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('processedChildren 변환 오류:', err);
    }

    // 1. 검색어 필터링
    let filtered = rows;
    if (searchQuery.trim()) {
      const queryStr = searchQuery.toLowerCase().trim();
      filtered = rows.filter(row => 
        row.childName.toLowerCase().includes(queryStr) ||
        row.parentName.toLowerCase().includes(queryStr) ||
        row.parentPhone.includes(queryStr) ||
        row.depositorName.toLowerCase().includes(queryStr)
      );
    }

    // 3. 연령 범위 필터는 제거 (부서는 신청 단계에서 자녀 카드별로 명시 선택하므로
    //    department 컬럼만으로 충분히 분리됨. 한국 나이 자동 계산이 0이거나 경계에 걸려
    //    데이터가 사라지는 부작용을 방지)

    // 4. 하위 부서 탭 필터 (외부 prop 우선)
    if (effectiveSubDept !== 'all') {
      filtered = filtered.filter(row =>
        (row.originalChild?.subDepartment === effectiveSubDept) ||
        (row.originalChild?.sub_department === effectiveSubDept)
      );
    }

    // 2. 클라이언트 정렬
    filtered.sort((a, b) => {
      let valA: any = a.createdAt;
      let valB: any = b.createdAt;

      if (sortField === 'childName') {
        valA = a.childName;
        valB = b.childName;
      } else if (sortField === 'age') {
        valA = a.age;
        valB = b.age;
      }

      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB, 'ko') 
          : valB.localeCompare(valA, 'ko');
      } else {
        return sortDirection === 'asc' 
          ? (valA > valB ? 1 : -1) 
          : (valB > valA ? 1 : -1);
      }
    });

    return filtered;
  }, [applications, department, searchQuery, sortField, sortDirection, effectiveSubDept]);

  const handleLogout = async () => {
    if (await confirmDialog('로그아웃 하시겠습니까?')) {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push(`/admin/login?dept=${department}`);
    }
  };

  return (
    <div 
      className={`min-h-screen pb-20 ${department === 'teens' ? 'bg-slate-950 text-white' : 'bg-gray-50 text-gray-900'}`}
      style={{
        '--primary-color': settingsForm.primaryColor,
        '--bg-color': settingsForm.bgColor,
      } as React.CSSProperties}
    >
      {/* Header Bar */}
      <header className={`border-b p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔑</span>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{departmentFullLabel(department) || department} 관리자 패널</h1>
            <p className="text-sm text-gray-400">교사 전용 성경학교 및 여름 수련회 실시간 CMS 통합 대시보드</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button
            onClick={exportExcel}
            className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow transition duration-200 cursor-pointer whitespace-nowrap"
          >
            📥 엑셀 내보내기
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 md:flex-none px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-sm font-semibold rounded-lg transition duration-200 cursor-pointer whitespace-nowrap"
          >
            🔒 로그아웃
          </button>
        </div>
      </header>

      <div className="container mx-auto px-6 mt-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-300 dark:border-slate-800 gap-4 overflow-x-auto whitespace-nowrap">
          {[
            { id: 'applications', label: `📝 신청 현황 (${processedChildren.length}명)` },
            { id: 'waterpark', label: '💦 워터풀 명단' },
            { id: 'staff', label: '🙌 스텝 신청' },
            { id: 'settings', label: '🎨 CMS & 스킨 설정' },
            { id: 'surveys', label: '📊 설문조사 관리 (Phase 2)' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 px-4 font-bold border-b-2 text-lg transition duration-200 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-xl">
            {error}
          </div>
        )}

        {/* Tab Contents */}
        <div className="mt-8">
          
          {/* 1. Applications Tab */}
          {activeTab === 'applications' && (
            <ErrorBoundary label="신청 현황">
            <div className="space-y-4">
              {/* 트랙(분리 운영) 필터 — 분리 모드일 때 세부부서 칩 대신 트랙 칩 노출 */}
              {operatingMode === 'split' && !externalSubDepartment && tracks.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs font-bold text-gray-400 self-center mr-1">트랙:</span>
                  <button
                    onClick={() => setSelectedTrack('all')}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition cursor-pointer ${
                      selectedTrack === 'all'
                        ? 'bg-cyan-600 text-white shadow'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  {tracks.filter((t) => t.trackKey !== 'main' || (t.subDepartmentIds?.length ?? 0) > 0).map((t) => (
                    <button
                      key={t.trackKey}
                      onClick={() => setSelectedTrack(t.trackKey)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition cursor-pointer ${
                        selectedTrack === t.trackKey
                          ? 'bg-cyan-600 text-white shadow'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              {/* 하위 부서 탭 필터 (연합 모드 + 외부 subDepartment prop이 없을 때) */}
              {operatingMode === 'union' && !externalSubDepartment && getPresetSubDepartments(department).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setSelectedSubDept('all')}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition cursor-pointer ${
                      selectedSubDept === 'all'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  {getPresetSubDepartments(department).map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubDept(sub.id)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition cursor-pointer ${
                        selectedSubDept === sub.id
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="자녀 이름, 부모 성함, 연락처 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-gray-900 shadow-sm transition"
                  />
                </div>
                <div className="text-sm text-gray-400">
                  검색 결과: <strong className="text-indigo-600 font-bold">{processedChildren.length}</strong>명
                </div>
              </div>

              {/* 모바일 카드 뷰 (md 미만) — 가로 스크롤 테이블 대신 세로 카드 목록 */}
              <div className={`md:hidden rounded-xl border overflow-hidden shadow-md ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                {loading ? (
                  <div className="p-12 text-center text-gray-400">데이터를 스트리밍 중입니다...</div>
                ) : !processedChildren.length ? (
                  <div className="p-12 text-center text-gray-400">조건에 일치하는 자녀 정보가 존재하지 않습니다.</div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-slate-800">
                    {processedChildren.map((row, idx) => (
                      <div key={`m-${row.appId}-${idx}`} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-base text-indigo-600 dark:text-indigo-400">{row.childName}</span>
                          <span className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200">
                            {row.age}세 ({row.birthDate})
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 grid grid-cols-2 gap-1">
                          <div>성별: {genderLabel(row.originalChild?.gender) || row.originalChild?.custom20 || row.originalChild?.custom_20 || '-'}</div>
                          <div>단체티: {row.tshirtSize || '미선택'}</div>
                          <div className="col-span-2">보호자: {row.parentName} ({row.parentPhone})</div>
                          {row.depositorName !== row.parentName && <div className="col-span-2">입금자: {row.depositorName}</div>}
                          <div className="col-span-2 text-red-500">⚠️ 알러지: {row.allergies.join(', ') || '없음'}{row.customAllergy ? ` / 기타: ${row.customAllergy}` : ''}</div>
                          <div>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.attendsWaterpark ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30' : 'bg-gray-100 text-gray-400 dark:bg-slate-800'}`}>
                              {row.attendsWaterpark ? '워터파크 참가' : '워터파크 미참가'}
                            </span>
                          </div>
                          <div>{new Date(row.createdAt).toLocaleString('ko-KR')}</div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setEditingApp(applications.find((a) => a.id === row.appId))}
                            className="flex-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded transition duration-150 shadow cursor-pointer"
                          >
                            ✏️ 수정
                          </button>
                          <button
                            onClick={() => deleteApplication(row.appId)}
                            className="flex-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded transition duration-150 shadow cursor-pointer"
                          >
                            🗑️ 삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 데스크톱 테이블 뷰 (md 이상) */}
              <div className={`hidden md:block rounded-xl border overflow-hidden shadow-md ${department === 'teens' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                {loading ? (
                  <div className="p-12 text-center text-gray-400">데이터를 스트리밍 중입니다...</div>
                ) : !processedChildren.length ? (
                  <div className="p-12 text-center text-gray-400">조건에 일치하는 자녀 정보가 존재하지 않습니다.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className={`border-b text-xs font-semibold uppercase tracking-wider ${department === 'teens' ? 'bg-slate-950/50 border-slate-800 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          <th 
                            className="p-4 cursor-pointer hover:bg-gray-100/50 select-none transition"
                            onClick={() => {
                              if (sortField === 'childName') {
                                setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('childName');
                                setSortDirection('asc');
                              }
                            }}
                          >
                            자녀 이름 {sortField === 'childName' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </th>
                          <th 
                            className="p-4 cursor-pointer hover:bg-gray-100/50 select-none transition"
                            onClick={() => {
                              if (sortField === 'age') {
                                setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('age');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            연령 (나이) {sortField === 'age' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </th>
                          <th className="p-4">성별</th>
                          <th className="p-4">단체티 사이즈</th>
                          <th className="p-4">알레르기 및 기타 특이사항</th>
                          <th className="p-4">보호자 / 연락처</th>
                          <th className="p-4 text-center">워터파크 참가</th>
                          <th 
                            className="p-4 cursor-pointer hover:bg-gray-100/50 select-none transition"
                            onClick={() => {
                              if (sortField === 'createdAt') {
                                setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('createdAt');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            신청일시 {sortField === 'createdAt' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </th>
                          <th className="p-4 text-center">작업</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                        {processedChildren.map((row, idx) => (
                          <tr key={`${row.appId}-${idx}`} className={`${department === 'teens' ? 'hover:bg-slate-800/40' : 'hover:bg-gray-50/50'}`}>
                            <td className="p-4 font-bold text-base text-indigo-600 dark:text-indigo-400">
                              {row.childName}
                            </td>
                            <td className="p-4 text-sm">
                              <span className="px-2.5 py-1 font-semibold rounded bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200">
                                {row.age}세 ({row.birthDate})
                              </span>
                            </td>
                            <td className="p-4 text-sm font-semibold">
                              {genderLabel(row.originalChild?.gender)
                                || row.originalChild?.custom20
                                || row.originalChild?.custom_20
                                || '-'}
                            </td>
                            <td className="p-4 font-semibold text-gray-900 dark:text-white">
                              {row.tshirtSize || '미선택'}
                            </td>
                            <td className="p-4 text-xs text-red-500 font-medium">
                              <div>⚠️ 알러지: {row.allergies.join(', ') || '없음'}</div>
                              {row.customAllergy && <div className="mt-1 text-gray-400">기타: {row.customAllergy}</div>}
                            </td>
                            <td className="p-4 text-sm">
                              <div className="font-semibold">{row.parentName}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{row.parentPhone}</div>
                              {row.depositorName !== row.parentName && (
                                <div className="text-xs text-gray-500">입금자: {row.depositorName}</div>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                row.attendsWaterpark
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30'
                                  : 'bg-gray-100 text-gray-400 dark:bg-slate-800'
                              }`}>
                                {row.attendsWaterpark ? '참가' : '미참가'}
                              </span>
                            </td>
                            <td className="p-4 text-xs text-gray-400">
                              {new Date(row.createdAt).toLocaleString('ko-KR')}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex flex-col gap-2 items-center justify-center">
                                <button
                                  onClick={() => setEditingApp(applications.find((a) => a.id === row.appId))}
                                  className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded transition duration-150 shadow cursor-pointer w-full"
                                >
                                  ✏️ 수정
                                </button>
                                <button
                                  onClick={() => deleteApplication(row.appId)}
                                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded transition duration-150 shadow cursor-pointer w-full"
                                >
                                  🗑️ 삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Paging Buttons */}
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={() => setOffset(Math.max(0, offset - 100))}
                  disabled={offset === 0}
                  className="px-4 py-2 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 disabled:opacity-50 text-sm font-semibold rounded-lg transition"
                >
                  이전 페이지
                </button>
                <button
                  onClick={() => setOffset(offset + 100)}
                  disabled={applications.length < 100}
                  className="px-4 py-2 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 disabled:opacity-50 text-sm font-semibold rounded-lg transition"
                >
                  다음 페이지
                </button>
              </div>
            </div>
            </ErrorBoundary>
          )}

          {/* 2. Settings Tab */}
          {activeTab === 'settings' && (
            <ErrorBoundary label="CMS 설정">
              <AdminSettingsPanel
                department={department}
                dark={department === 'teens'}
                isSaving={isSaving}
                operatingMode={operatingMode}
                tracks={tracks}
                unassignedSubDeptIds={unassignedSubDeptIds}
                activeTrackKey={activeTrackKey}
                newTrack={newTrack}
                setNewTrack={setNewTrack}
                settingsForm={settingsForm}
                setSettingsForm={setSettingsForm}
                newTshirtSize={newTshirtSize}
                setNewTshirtSize={setNewTshirtSize}
                newStepTshirtSize={newStepTshirtSize}
                setNewStepTshirtSize={setNewStepTshirtSize}
                newCustomField={newCustomField}
                setNewCustomField={setNewCustomField}
                saveSettings={saveSettings}
                changeOperatingMode={changeOperatingMode}
                changeCampActive={changeCampActive}
                switchTrack={switchTrack}
                addTrack={addTrack}
                deleteTrack={deleteTrack}
                addTshirtSize={addTshirtSize}
                removeTshirtSize={removeTshirtSize}
                addStepTshirtSize={addStepTshirtSize}
                removeStepTshirtSize={removeStepTshirtSize}
                addCustomField={addCustomField}
                removeCustomField={removeCustomField}
                handlePosterUpload={handlePosterUpload}
              />

              {/* 위험 구역 — 부서별 명단 초기화 (폼과 분리된 별도 파괴적 작업) */}
              <div className="mt-8 p-6 rounded-2xl border-2 border-red-300 bg-red-50">
                <h3 className="text-lg font-bold text-red-700">⚠️ 위험 구역 — 명단 초기화</h3>
                <p className="text-sm text-red-600 mt-1">
                  {departmentFullLabel(department) || department} 부서의 <strong>모든 신청 자녀 데이터</strong>를 영구히 삭제합니다.
                  다른 부서 형제자매의 신청 정보는 유지됩니다. 되돌릴 수 없으니 필요 시 먼저 엑셀로 백업하세요.
                </p>
                <button
                  type="button"
                  onClick={() => setResetModalOpen(true)}
                  className="mt-4 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow cursor-pointer"
                >
                  🗑️ 이 부서 명단 초기화
                </button>
              </div>
            </ErrorBoundary>
          )}

          {/* 워터풀선데이 신청 명단 (가족 단위) — 공용 컴포넌트 */}
          {activeTab === 'waterpark' && (
            <ErrorBoundary label="워터풀 명단">
              <WaterparkRoster department={department} dark={department === 'teens'} />
            </ErrorBoundary>
          )}

          {/* 스텝(봉사자) 신청 명단 */}
          {activeTab === 'staff' && (
            <ErrorBoundary label="스텝 신청">
              <StaffApplicationsRoster department={department} dark={department === 'teens'} />
            </ErrorBoundary>
          )}

          {/* 4. Surveys Tab */}
          {activeTab === 'surveys' && (
            <SurveyFormPlaceholder department={department as 'kinder' | 'kids' | 'teens'} />
          )}

        </div>
      </div>

      {editingApp && (
        <ErrorBoundary label="신청서 수정">
          <ApplicationEditModal
            application={editingApp}
            config={config}
            onClose={() => setEditingApp(null)}
            onSaved={() => {
              setEditingApp(null);
              loadApplications();
            }}
          />
        </ErrorBoundary>
      )}

      <TypedConfirmDialog
        open={resetModalOpen}
        title="⚠️ 부서 명단 초기화"
        description={`${departmentFullLabel(department) || department} (${department}) 부서의 모든 신청 자녀 데이터를 영구히 삭제합니다.\n다른 부서 형제자매의 신청 정보는 유지됩니다.\n이 작업은 되돌릴 수 없습니다.`}
        requiredText={department}
        confirmLabel="초기화"
        onCancel={() => setResetModalOpen(false)}
        onConfirm={resetDepartment}
        loading={isSaving}
      />
    </div>
  );
}

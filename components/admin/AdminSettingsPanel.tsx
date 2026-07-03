'use client';

import React from 'react';
import RichTextEditor from '@/components/RichTextEditor';
import Accordion from '@/components/ui/Accordion';
import { formatToLocalDatetime } from '@/lib/datetime';
import { getPresetSubDepartments } from '@/lib/subDepartments';
import type { NewCustomFieldDraft, SettingsForm, TrackInfo } from './types';

interface AdminSettingsPanelProps {
  department: string;
  dark: boolean;
  isSaving: boolean;
  operatingMode: 'union' | 'split';
  tracks: TrackInfo[];
  /** 아직 어떤 non-main 트랙에도 배정되지 않은 프리셋 세부부서 id 목록 */
  unassignedSubDeptIds: string[];
  activeTrackKey: string;
  newTrack: { label: string; subs: string[] };
  setNewTrack: (v: { label: string; subs: string[] }) => void;
  settingsForm: SettingsForm;
  setSettingsForm: React.Dispatch<React.SetStateAction<SettingsForm>>;
  newTshirtSize: string;
  setNewTshirtSize: (v: string) => void;
  newStepTshirtSize: string;
  setNewStepTshirtSize: (v: string) => void;
  newCustomField: NewCustomFieldDraft;
  setNewCustomField: React.Dispatch<React.SetStateAction<NewCustomFieldDraft>>;
  saveSettings: () => void;
  changeOperatingMode: (mode: 'union' | 'split') => void;
  changeCampActive: (active: boolean) => void;
  switchTrack: (trackKey: string) => void;
  addTrack: () => void;
  deleteTrack: (trackKey: string) => void;
  addTshirtSize: () => void;
  removeTshirtSize: (size: string) => void;
  addStepTshirtSize: () => void;
  removeStepTshirtSize: (size: string) => void;
  addCustomField: () => void;
  removeCustomField: (id: string) => void;
  handlePosterUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function AdminSettingsPanel({
  department,
  dark,
  isSaving,
  operatingMode,
  tracks,
  unassignedSubDeptIds,
  activeTrackKey,
  newTrack,
  setNewTrack,
  settingsForm,
  setSettingsForm,
  newTshirtSize,
  setNewTshirtSize,
  newStepTshirtSize,
  setNewStepTshirtSize,
  newCustomField,
  setNewCustomField,
  saveSettings,
  changeOperatingMode,
  changeCampActive,
  switchTrack,
  addTrack,
  deleteTrack,
  addTshirtSize,
  removeTshirtSize,
  addStepTshirtSize,
  removeStepTshirtSize,
  addCustomField,
  removeCustomField,
  handlePosterUpload,
}: AdminSettingsPanelProps) {
  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); saveSettings(); }} className="space-y-6">

        {/* 운영 모드 & 트랙(연합/분리) 관리 */}
        <Accordion title="운영 모드 (연합 / 분리)" icon="🔀" dark={dark} defaultOpen>
          {/* 부서 단위 "수련회 없음" 토글 — 부서 전체에 즉시 적용 */}
          <div className="mb-5 p-4 rounded-xl border-2 border-red-200 bg-red-50 flex items-center justify-between gap-4">
            <div>
              <p className="font-bold text-red-700">🚫 이 부서는 올해 수련회를 진행하지 않습니다</p>
              <p className="text-xs text-red-500 mt-1">
                체크하면 신청서의 부서 선택 목록과 부서 랜딩페이지에서 즉시 숨겨집니다. (부서 전체 적용)
              </p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={!settingsForm.isCampActive}
                onChange={(e) => changeCampActive(!e.target.checked)}
                disabled={isSaving}
                className="w-5 h-5 accent-red-600"
              />
              <span className="text-sm font-bold text-red-700">수련회 없음</span>
            </label>
          </div>

          {/* 부서 단위 외부(구글폼 등) 신청 링크 — 활성 시 메인페이지에 이 부서 전용 외부 신청 버튼 노출 */}
          <div className="mb-5 p-4 rounded-xl border-2 border-amber-200 bg-amber-50">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div>
                <p className="font-bold text-amber-700">🔗 외부 링크로 신청받기 (구글폼 등)</p>
                <p className="text-xs text-amber-600 mt-1">
                  체크하면 이 부서는 내부 신청서 대신 외부 링크로 신청받습니다. 신청서 부서 선택 목록에서 숨겨지고,
                  메인페이지에 이 부서 전용 외부 신청 버튼이 표시됩니다. (부서 전체 적용 · 저장 버튼을 눌러야 반영)
                </p>
              </div>
              <input
                type="checkbox"
                checked={settingsForm.isExternalApply}
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, isExternalApply: e.target.checked }))}
                disabled={isSaving}
                className="w-5 h-5 accent-amber-600 shrink-0 mt-0.5"
              />
            </label>
            {settingsForm.isExternalApply && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-amber-700 mb-1">외부 신청 링크 URL</label>
                <input
                  type="url"
                  value={settingsForm.externalApplyUrl}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, externalApplyUrl: e.target.value }))}
                  placeholder="https://forms.gle/..."
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>
            )}
          </div>

          <fieldset disabled={settingsForm.isExternalApply} className={settingsForm.isExternalApply ? "opacity-40 pointer-events-none transition-opacity" : "transition-opacity"}>
          <p className="text-xs text-gray-400 mb-4">
            이 대부서의 세부부서가 함께 운영(연합)되는지, 별도 트랙으로 분리 운영되는지 설정합니다.
            분리 시 트랙마다 독립된 CMS 설정·일정과 신청/워터풀 명단 분리 조회가 가능합니다.
          </p>
          <div className="flex gap-3 mb-4">
            {([
              { v: 'union', label: '전체 연합', desc: '세부부서 모두 함께' },
              { v: 'split', label: '부서 분리', desc: '트랙별 독립 운영' },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                type="button"
                disabled={isSaving}
                onClick={() => changeOperatingMode(opt.v)}
                className={`flex-1 px-4 py-3 rounded-xl border-2 text-left transition-colors disabled:opacity-50 ${
                  operatingMode === opt.v
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className="block font-bold">{opt.label}</span>
                <span className="block text-xs">{opt.desc}</span>
              </button>
            ))}
          </div>

          {operatingMode === 'split' && (() => {
            const editableTracks = tracks.filter((t) => t.trackKey !== 'main');
            const claimedElsewhere = new Set(editableTracks.flatMap((t) => t.subDepartmentIds));
            const unassignedLabels = getPresetSubDepartments(department)
              .filter((sd) => unassignedSubDeptIds.includes(sd.id))
              .map((sd) => sd.label);
            return (
              <div className="space-y-4 pt-4 border-t border-dashed">
                <div>
                  <p className="text-sm font-semibold text-gray-500 mb-2">
                    편집할 트랙 선택 — 아래 모든 설정은 선택된 트랙에 저장됩니다. (분리 모드에서는
                    「전체 연합」 트랙을 더 이상 편집할 수 없습니다)
                  </p>
                  {editableTracks.length === 0 ? (
                    <p className="text-xs text-gray-400">아직 생성된 트랙이 없습니다. 아래에서 먼저 트랙을 추가하세요.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {editableTracks.map((t) => (
                        <span
                          key={t.trackKey}
                          className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm font-semibold border-2 ${
                            activeTrackKey === t.trackKey
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 bg-white text-gray-500'
                          }`}
                        >
                          <button type="button" onClick={() => switchTrack(t.trackKey)}>
                            {t.label}
                            <span className="text-xs text-gray-400 ml-1">({t.subDepartmentIds.length}개 부서)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTrack(t.trackKey)}
                            className="text-red-400 hover:text-red-600 font-bold"
                            aria-label="트랙 삭제"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {activeTrackKey !== 'main' && editableTracks.some((t) => t.trackKey === activeTrackKey) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                      <span className="text-sm font-bold text-indigo-700">✎ 트랙 이름:</span>
                      <input
                        type="text"
                        value={settingsForm.trackLabel || editableTracks.find((t) => t.trackKey === activeTrackKey)?.label || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, trackLabel: e.target.value })}
                        className="flex-1 min-w-[200px] max-w-sm px-3 py-1.5 border border-indigo-200 rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-semibold text-gray-900"
                        placeholder="수정할 트랙 이름을 입력하세요 (예: 통미영유)"
                      />
                      <span className="text-xs text-indigo-500 w-full md:w-auto mt-1 md:mt-0">이름을 변경한 뒤 화면 맨 아래의 <strong>[설정 저장]</strong> 버튼을 눌러주세요.</span>
                    </div>
                  )}
                </div>

                {unassignedLabels.length > 0 && (
                  <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm">
                    ⚠️ 아직 트랙에 배정되지 않은 세부부서가 있습니다: <strong>{unassignedLabels.join(', ')}</strong>.
                    이 세부부서를 선택한 신청자는 자동으로 「전체 연합」 설정으로 안내됩니다. 트랙을 추가하거나 기존 트랙에 포함시켜주세요.
                  </div>
                )}

                <div className="p-4 rounded-xl bg-gray-50/60 dark:bg-slate-800/30 border border-dashed">
                  <p className="text-sm font-semibold text-gray-600 mb-2">＋ 새 트랙(그룹) 추가</p>
                  <input
                    type="text"
                    placeholder="트랙 이름 (예: 유치부 단독, 통미+영유 연합)"
                    value={newTrack.label}
                    onChange={(e) => setNewTrack({ ...newTrack, label: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 text-sm mb-2"
                  />
                  <p className="text-xs text-gray-500 mb-1">포함할 세부부서 선택:</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {getPresetSubDepartments(department).map((sd) => {
                      const checked = newTrack.subs.includes(sd.id);
                      const claimed = claimedElsewhere.has(sd.id);
                      return (
                        <label
                          key={sd.id}
                          className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                            claimed
                              ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                              : checked
                              ? 'bg-indigo-100 border-indigo-400 text-indigo-700 cursor-pointer'
                              : 'bg-white border-gray-300 text-gray-600 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={claimed}
                            onChange={(e) => {
                              const subs = e.target.checked
                                ? [...newTrack.subs, sd.id]
                                : newTrack.subs.filter((s) => s !== sd.id);
                              setNewTrack({ ...newTrack, subs });
                            }}
                            className="hidden"
                          />
                          {sd.label}
                          {claimed && <span className="ml-1 text-[11px]">(이미 다른 트랙에 배정됨)</span>}
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={addTrack}
                    disabled={isSaving}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow disabled:opacity-50"
                  >
                    트랙 추가
                  </button>
                </div>
              </div>
            );
          })()}
        </fieldset>
        </Accordion>

        {operatingMode === 'split' && activeTrackKey === 'main' ? (
          <div className="p-6 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 text-indigo-700 text-sm text-center">
            트랙을 선택하거나 새로 추가하면 이 아래에 해당 트랙의 CMS 설정 항목이 나타납니다.
          </div>
        ) : (
        <>
        <fieldset disabled={settingsForm.isExternalApply} className={settingsForm.isExternalApply ? "opacity-40 pointer-events-none transition-opacity" : "transition-opacity"}>
        {/* 기본 정보 */}
        <Accordion title="기본 행사 정보 설정" icon="🎨" dark={dark} defaultOpen>
          <div className="grid grid-cols-1 gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">공식 행사 명칭</label>
                <input
                  type="text"
                  value={settingsForm.title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                  placeholder="예: 2026 나우킨더 여름성경학교"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">행사 종류 (Top-Right 배지 텍스트)</label>
                <input
                  type="text"
                  value={settingsForm.eventType}
                  onChange={(e) => setSettingsForm({ ...settingsForm, eventType: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                  placeholder="예: 여름성경학교, 여름수련회"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">📢 공식 홍보 포스터 등록 (다이렉트 파일 업로드 지원)</label>
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <label className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-center cursor-pointer shadow transition duration-200">
                  📁 내 컴퓨터에서 이미지 선택...
                  <input type="file" accept="image/*" onChange={handlePosterUpload} className="hidden" />
                </label>
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    value={settingsForm.posterUrl}
                    onChange={(e) => setSettingsForm({ ...settingsForm, posterUrl: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900"
                    placeholder="파일을 선택하면 주소가 자동 주입되며 직접 입력도 가능합니다."
                  />
                </div>
              </div>
              {settingsForm.posterUrl && (
                <div className="mt-3 p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div className="text-xs text-gray-500 truncate mr-4">등록된 포스터: <span className="font-semibold text-indigo-600">{settingsForm.posterUrl}</span></div>
                  <button
                    type="button"
                    onClick={() => setSettingsForm({ ...settingsForm, posterUrl: '' })}
                    className="px-2 py-1 text-xs font-bold text-red-500 hover:text-red-700 transition"
                  >
                    ✕ 삭제
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">📅 캠프 시작일 (카운트다운 기준)</label>
                <input
                  type="date"
                  value={settingsForm.campStartDate}
                  onChange={(e) => setSettingsForm({ ...settingsForm, campStartDate: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">🗓️ 수련회 진행 방식</label>
                <select
                  value={settingsForm.campType}
                  onChange={(e) => setSettingsForm({ ...settingsForm, campType: e.target.value as SettingsForm['campType'] })}
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 text-sm"
                >
                  <option value="continuous">연속 수련회 (예: 2박 3일 연속)</option>
                  <option value="weekly">주일 분산 수련회 (예: 수주에 걸쳐 매주일)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">⏳ 수련회 기간 (총 일차 / 주차)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settingsForm.campDuration}
                  onChange={(e) => setSettingsForm({ ...settingsForm, campDuration: Number(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">행사 주제 (Theme Slogan) - 리치 텍스트</label>
              <RichTextEditor
                value={settingsForm.subtitle}
                onChange={(html) => setSettingsForm({ ...settingsForm, subtitle: html })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">성경 구절 (Scripture Verse) - 리치 텍스트</label>
              <RichTextEditor
                value={settingsForm.scripture}
                onChange={(html) => setSettingsForm({ ...settingsForm, scripture: html })}
              />
            </div>
          </div>
        </Accordion>

        {/* 테마 컬러 제어 */}
        <Accordion title="배너 & 테마 스킨 제어" icon="🎨" dark={dark}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">메인 테마 컬러 (Hex)</label>
              <input
                type="color"
                value={settingsForm.primaryColor}
                onChange={(e) => setSettingsForm({ ...settingsForm, primaryColor: e.target.value })}
                className="w-full h-12 border rounded-lg p-1 bg-white cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">배경 톤 컬러 (Hex)</label>
              <input
                type="color"
                value={settingsForm.bgColor}
                onChange={(e) => setSettingsForm({ ...settingsForm, bgColor: e.target.value })}
                className="w-full h-12 border rounded-lg p-1 bg-white cursor-pointer"
              />
            </div>
          </div>
        </Accordion>

        {/* 캠프 부가 설정 */}
        <Accordion title="기타 캠프 부가 설정" icon="⚙️" dark={dark}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 cursor-pointer font-medium mb-1">
                <input
                  type="checkbox"
                  checked={settingsForm.isStepRecruitmentActive}
                  onChange={(e) => setSettingsForm({ ...settingsForm, isStepRecruitmentActive: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                여름캠프 스텝 모집 활성화
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-7">신청서 작성 완료 페이지에 스텝 지원 버튼이 노출됩니다.</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium mb-1">티셔츠 신청 마감일시</label>
                {settingsForm.tshirtDeadline && new Date(settingsForm.tshirtDeadline) < new Date() && (
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded animate-pulse">마감일 경과됨! (현재 신청서에서 항목이 숨겨진 상태입니다)</span>
                )}
              </div>
              <input
                type="datetime-local"
                value={formatToLocalDatetime(settingsForm.tshirtDeadline)}
                onChange={(e) => setSettingsForm({ ...settingsForm, tshirtDeadline: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">이 시각 이후로는 신청서에 티셔츠 선택 항목이 아예 노출되지 않습니다.</p>
            </div>
          </div>

          {settingsForm.isStepRecruitmentActive && (
            <div className="mt-5 pt-5 border-t border-dashed">
              <label className="block text-sm font-semibold mb-2">👕 스텝 티셔츠 사이즈 옵션</label>
              <p className="text-xs text-gray-500 mb-3">
                입력한 사이즈가 스텝 신청서에 선택 항목으로 노출됩니다. 비워두면 선택 항목이 표시되지 않습니다.
              </p>
              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  value={newStepTshirtSize}
                  onChange={(e) => setNewStepTshirtSize(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStepTshirtSize())}
                  placeholder="예: S, M, L, XL"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                />
                <button
                  type="button"
                  onClick={addStepTshirtSize}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
                >
                  추가
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(!settingsForm.stepTshirtSizes || settingsForm.stepTshirtSizes.length === 0) ? (
                  <p className="text-sm text-gray-400">등록된 스텝 티셔츠 사이즈가 없습니다.</p>
                ) : (
                  settingsForm.stepTshirtSizes.map((size) => (
                    <div
                      key={size}
                      className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-sm font-bold"
                    >
                      {size}
                      <button
                        type="button"
                        onClick={() => removeStepTshirtSize(size)}
                        className="ml-1 text-indigo-400 hover:text-red-500 text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </Accordion>

        {/* 워터풀선데이 설정 */}
        <Accordion title="워터풀선데이 설정" icon="💦" dark={dark}>
          <div className="mb-5">
            <label className="flex items-center gap-2 cursor-pointer font-medium mb-1">
              <input
                type="checkbox"
                checked={settingsForm.isWaterparkActive}
                onChange={(e) => setSettingsForm({ ...settingsForm, isWaterparkActive: e.target.checked })}
                className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              이 부서의 워터풀선데이 신청 활성화
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-7">
              비활성화하면 신청서에서 이 부서 자녀의 워터풀선데이 참석 항목이 노출되지 않습니다.
            </p>
          </div>

          {settingsForm.isWaterparkActive && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-dashed">
              <div className="md:col-span-2">
                <p className="text-sm font-semibold text-gray-500 mb-2">
                  📌 부서별 커스텀 안내 — 일정이 다른 부서(예: 나우틴즈)는 여기에서 별도 일정/장소를 지정하세요.
                  입력한 내용이 신청서의 워터풀 참석 항목에 안내로 표시됩니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">행사명 (비우면 기본: 워터풀선데이)</label>
                <input
                  type="text"
                  placeholder="예: 워터풀선데이"
                  value={settingsForm.waterparkInfo.title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, waterparkInfo: { ...settingsForm.waterparkInfo, title: e.target.value } })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">날짜</label>
                <input
                  type="date"
                  value={settingsForm.waterparkInfo.date}
                  onChange={(e) => setSettingsForm({ ...settingsForm, waterparkInfo: { ...settingsForm.waterparkInfo, date: e.target.value } })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">시간</label>
                <input
                  type="text"
                  placeholder="예: 14:00 - 18:00"
                  value={settingsForm.waterparkInfo.time}
                  onChange={(e) => setSettingsForm({ ...settingsForm, waterparkInfo: { ...settingsForm.waterparkInfo, time: e.target.value } })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">장소</label>
                <input
                  type="text"
                  placeholder="예: 교회 앞마당 야외풀장"
                  value={settingsForm.waterparkInfo.location}
                  onChange={(e) => setSettingsForm({ ...settingsForm, waterparkInfo: { ...settingsForm.waterparkInfo, location: e.target.value } })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">추가 안내문</label>
                <textarea
                  rows={2}
                  placeholder="예: 나우틴즈는 본 캠프와 별도 일정으로 진행됩니다. 수영복과 여벌 옷을 준비해주세요."
                  value={settingsForm.waterparkInfo.note}
                  onChange={(e) => setSettingsForm({ ...settingsForm, waterparkInfo: { ...settingsForm.waterparkInfo, note: e.target.value } })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900"
                />
              </div>
            </div>
          )}
        </Accordion>

        {/* 단체티 사이즈 관리 */}
        <Accordion title="부서별 티셔츠 사이즈 옵션 관리" icon="👕" dark={dark}>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="추가할 사이즈 입력 (예: L, 100, 2XL)"
              value={newTshirtSize}
              onChange={(e) => setNewTshirtSize(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg bg-white text-gray-900"
            />
            <button
              type="button"
              onClick={addTshirtSize}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow cursor-pointer"
            >
              옵션 추가
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {settingsForm.tshirtSizes.length === 0 ? (
              <p className="text-sm font-semibold text-red-500">등록된 사이즈가 없습니다. (사이즈를 추가하지 않으면 신청서에서 티셔츠 조사 항목이 아예 나타나지 않습니다!)</p>
            ) : (
              settingsForm.tshirtSizes.map((size) => (
                <div
                  key={size}
                  className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-full text-indigo-700 font-semibold text-sm"
                >
                  <span>{size}</span>
                  <button
                    type="button"
                    onClick={() => removeTshirtSize(size)}
                    className="text-red-500 hover:text-red-700 font-bold cursor-pointer text-base"
                  >
                    &times;
                  </button>
                </div>
              ))
            )}
          </div>
        </Accordion>

        {/* 수련회 세부 일정(타임라인) 설정 */}
        <Accordion title="수련회 세부 일정(타임라인) 그래픽 설정" icon="📅" dark={dark}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b pb-4">
            <p className="text-xs text-gray-400">드래그 앤 드롭과 프리셋이 지원되는 단독 전체화면 디자인 에디터에서 일정을 한눈에 편집하세요.</p>
            <button
              type="button"
              onClick={() => window.open(`/${department}/admin/schedule`, '_blank')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg shadow-lg cursor-pointer flex items-center gap-2 transform active:scale-95 transition shrink-0"
            >
              🎨 일정 그래픽 캔버스 에디터 열기
            </button>
          </div>

          <div className="text-sm p-4 rounded-xl bg-indigo-50/50 dark:bg-slate-800/20 text-indigo-700 dark:text-indigo-300 font-semibold mb-6">
            💡 현재 설정된 방식: <strong className="underline">{settingsForm.campType === 'continuous' ? '연속 수련회' : '주일 분산 수련회'}</strong> ({settingsForm.campDuration}일간 / {settingsForm.campDuration}주간)
          </div>

          <div className="space-y-2">
            {!settingsForm.campSchedule || settingsForm.campSchedule.length === 0 ? (
              <p className="text-center p-6 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-gray-400">등록된 세부 일정이 없습니다. 그래픽 에디터를 열고 프리셋 템플릿을 생성해보세요.</p>
            ) : (
              settingsForm.campSchedule.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-xl bg-gray-50/50 dark:bg-slate-900/50 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                      {item.day}{settingsForm.campType === 'continuous' ? '일차' : '주차'}
                    </span>
                    <span className="font-bold text-gray-500">🕒 {item.time}</span>
                    <span className="font-bold text-gray-800 dark:text-white">{item.title}</span>
                  </div>
                </div>
              ))
            )}
            {settingsForm.campSchedule && settingsForm.campSchedule.length > 10 && (
              <p className="text-center text-xs text-gray-400 mt-2">외에 {settingsForm.campSchedule.length - 10}개의 일정이 더 있습니다. 에디터에서 전체 상세 보기가 가능합니다.</p>
            )}
          </div>
        </Accordion>

        {/* 추가 맞춤 문항 질문 설정 */}
        <Accordion title="신청서 추가 수집 질문 문항 설정" icon="📋" dark={dark}>
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={addCustomField}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow cursor-pointer"
            >
              ➕ 새 문항 임시 추가
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-xl bg-gray-50/50 dark:bg-slate-800/40">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">문항 질문 제목 (Label)</label>
                <input
                  type="text"
                  placeholder="예: 셔틀버스를 어디서 타시나요?"
                  value={newCustomField.label}
                  onChange={(e) => setNewCustomField({ ...newCustomField, label: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded-lg bg-white text-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">입력 컨트롤 타입 (Type)</label>
                <select
                  value={newCustomField.type}
                  onChange={(e) => setNewCustomField({ ...newCustomField, type: e.target.value as NewCustomFieldDraft['type'] })}
                  className="w-full px-3 py-1.5 border rounded-lg bg-white text-gray-900 text-sm"
                >
                  <option value="text">단답형 텍스트</option>
                  <option value="textarea">장문형 텍스트</option>
                  <option value="select">드롭다운 선택 (Select)</option>
                  <option value="checkbox">동의/체크박스 (Checkbox)</option>
                </select>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newCustomField.required}
                    onChange={(e) => setNewCustomField({ ...newCustomField, required: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-semibold">필수 응답 항목 지정</span>
                </label>
              </div>
              {(newCustomField.type === 'select' || newCustomField.type === 'checkbox') && (
                <div className="md:col-span-3 pt-2 border-t border-dashed border-gray-200">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">선택지 옵션 리스트 (콤마 , 로 구분)</label>
                  <input
                    type="text"
                    placeholder="예: 덕소역 탑승, 삼패동 탑승, 개별 이동"
                    value={newCustomField.options}
                    onChange={(e) => setNewCustomField({ ...newCustomField, options: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg bg-white text-gray-900 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {settingsForm.customFields.length === 0 ? (
              <p className="text-center p-6 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-gray-400">추가적으로 수집할 맞춤 질문이 없습니다.</p>
            ) : (
              settingsForm.customFields.map((field) => (
                <div key={field.id} className="flex items-center justify-between p-4 border rounded-xl bg-gray-50/50 dark:bg-slate-900/50 dark:border-slate-800">
                  <div>
                    <p className="font-bold text-base flex items-center gap-1.5">
                      <span>❓</span> {field.label} {field.required && <span className="text-red-500 font-bold text-xs">*필수</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      타입: {field.type === 'text' ? '단답형' : field.type === 'textarea' ? '장문형' : field.type === 'select' ? '드롭다운' : '체크박스'}
                      {field.options && field.options.length > 0 && ` | 선택지: [${field.options.join(', ')}]`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustomField(field.id)}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded shadow transition cursor-pointer"
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>
        </Accordion>
        </fieldset>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-xl shadow-lg transition duration-200 disabled:opacity-50 cursor-pointer transform active:scale-95"
          >
            {isSaving ? '설정 데이터 동기화 중...' : '💾 CMS 설정 최종 적용'}
          </button>
        </div>
        </>
        )}
      </form>
    </div>
  );
}

import { queryOne, queryMany, query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { MAIN_TRACK_KEY, resolveTrackKey, parseStringArray, type EventTrack, type OperatingMode } from '@/lib/tracks';

function safeParse(val: any) {
  if (!val) return [];
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      return [];
    }
  }
  return val;
}

function parseObj(val: any) {
  if (!val) return {};
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return {}; }
  }
  return val;
}

const CONFIG_COLUMNS = `
  id, department, title, event_type, subtitle, scripture,
  primary_color, bg_color, camp_start_date, camp_schedule,
  camp_type, camp_duration, poster_url,
  is_step_recruitment_active, tshirt_deadline,
  is_waterpark_active, waterpark_info,
  track_key, track_label, sub_department_ids, operating_mode,
  sub_departments, events, tshirt_sizes, custom_field_mappings,
  step_tshirt_sizes, is_camp_active`;

/**
 * 마이그레이션(/api/init) 미적용 환경에서도 설정 조회/저장이 깨지지 않도록
 * 이 라우트가 참조하는 컬럼을 자동 보장. (applications 라우트와 동일 패턴)
 */
async function ensureConfigSchema() {
  await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS is_step_recruitment_active BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS tshirt_deadline TIMESTAMP`);
  await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS is_waterpark_active BOOLEAN DEFAULT TRUE`);
  await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS waterpark_info JSONB DEFAULT '{}'::jsonb`);
  // 트랙(연합/분리) 지원 컬럼 — 마이그레이션 미적용 환경 보장
  await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS track_key VARCHAR(50) DEFAULT 'main'`);
  await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS track_label VARCHAR(100)`);
  await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS sub_department_ids JSONB DEFAULT '[]'::jsonb`);
  await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS operating_mode VARCHAR(20) DEFAULT 'union'`);
  await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS step_tshirt_sizes JSONB DEFAULT '[]'::jsonb`);
  // 부서 단위 "올해 미운영" 토글 (department-wide) — 기본 TRUE(운영)
  await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS is_camp_active BOOLEAN DEFAULT TRUE`);
  // UNIQUE(department) → UNIQUE(department, track_key) (멱등)
  await query(`ALTER TABLE event_configs DROP CONSTRAINT IF EXISTS event_configs_department_key`);
  await query(`DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'event_configs'::regclass AND conname = 'event_configs_dept_track_key'
      ) THEN
        ALTER TABLE event_configs ADD CONSTRAINT event_configs_dept_track_key UNIQUE (department, track_key);
      END IF;
    END $$;`);
}

/** 대부서의 운영 모드 (main 행 기준). 행이 없으면 union. */
async function getOperatingMode(department: string): Promise<OperatingMode> {
  const row = await queryOne(
    `SELECT operating_mode FROM event_configs WHERE department = $1 AND track_key = $2`,
    [department, MAIN_TRACK_KEY]
  );
  return (row?.operating_mode === 'split' ? 'split' : 'union');
}

/** 대부서의 모든 트랙 메타 (config 본문 제외). */
async function listTracks(department: string): Promise<EventTrack[]> {
  const rows = await queryMany(
    `SELECT track_key, track_label, sub_department_ids
       FROM event_configs WHERE department = $1
       ORDER BY (track_key <> 'main'), track_key`,
    [department]
  );
  return rows.map((r: any) => ({
    trackKey: r.track_key || MAIN_TRACK_KEY,
    label: r.track_label || (r.track_key === MAIN_TRACK_KEY ? '전체 연합' : r.track_key),
    subDepartmentIds: parseStringArray(r.sub_department_ids),
  }));
}

function serializeConfig(config: any) {
  return {
    ...config,
    camp_start_date: config.camp_start_date || null,
    campType: config.camp_type || 'continuous',
    campDuration: Number(config.camp_duration || 3),
    posterUrl: config.poster_url || '',
    isStepRecruitmentActive: config.is_step_recruitment_active || false,
    tshirtDeadline: config.tshirt_deadline || null,
    isWaterparkActive: config.is_waterpark_active ?? true,
    isCampActive: config.is_camp_active ?? true,
    waterparkInfo: parseObj(config.waterpark_info),
    trackKey: config.track_key || MAIN_TRACK_KEY,
    trackLabel: config.track_label || null,
    subDepartmentIds: parseStringArray(config.sub_department_ids),
    operatingMode: config.operating_mode === 'split' ? 'split' : 'union',
    subDepartments: safeParse(config.sub_departments),
    events: safeParse(config.events),
    tshirtSizes: safeParse(config.tshirt_sizes),
    stepTshirtSizes: safeParse(config.step_tshirt_sizes),
    customFieldMappings: safeParse(config.custom_field_mappings),
    campSchedule: safeParse(config.camp_schedule),
  };
}

/**
 * GET /api/config/[dept]
 *  - 기본(파라미터 없음): 'main' 트랙 설정 (하위호환)
 *  - ?list=1            : 대부서의 모든 트랙 메타 + 운영모드
 *  - ?track=<key>       : 특정 트랙 설정
 *  - ?sub=<세부부서id>   : 세부부서가 속한 트랙으로 리졸브한 설정
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ dept: string }> }
) {
  let department: string = '';
  try {
    const { dept } = await params;
    department = dept;
    await ensureConfigSchema();

    const { searchParams } = new URL(request.url);

    // 트랙 목록 조회
    if (searchParams.get('list') === '1') {
      const [tracks, operatingMode] = await Promise.all([listTracks(department), getOperatingMode(department)]);
      return Response.json({ success: true, data: { operatingMode, tracks } });
    }

    // 조회 대상 트랙 결정
    let trackKey = searchParams.get('track') || MAIN_TRACK_KEY;
    const sub = searchParams.get('sub');
    if (sub) {
      const [tracks, operatingMode] = await Promise.all([listTracks(department), getOperatingMode(department)]);
      trackKey = resolveTrackKey(tracks, sub, operatingMode);
    }

    let config = await queryOne(
      `SELECT ${CONFIG_COLUMNS} FROM event_configs WHERE department = $1 AND track_key = $2`,
      [department, trackKey]
    );
    // 요청 트랙이 없으면 main 폴백
    if (!config && trackKey !== MAIN_TRACK_KEY) {
      config = await queryOne(
        `SELECT ${CONFIG_COLUMNS} FROM event_configs WHERE department = $1 AND track_key = $2`,
        [department, MAIN_TRACK_KEY]
      );
    }

    if (!config) {
      return Response.json({ success: false, error: '설정을 찾을 수 없습니다' }, { status: 404 });
    }

    return Response.json({ success: true, data: serializeConfig(config) });
  } catch (error) {
    console.error(`GET /config/${department} 오류:`, error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/config/[dept]
 * 트랙별 설정 저장 (관리자). body.trackKey 미지정 시 'main'.
 * body.operatingMode가 오면 대부서 전체 행에 반영.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ dept: string }> }
) {
  let department: string = '';
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { dept } = await params;
    department = dept;
    await ensureConfigSchema();
    const body = await request.json();
    const {
      title, eventType, subtitle, scripture, primaryColor, bgColor,
      subDepartments, events, tshirtSizes, customFieldMappings,
      campStartDate, campSchedule, campType, campDuration, posterUrl,
      isStepRecruitmentActive, tshirtDeadline,
      isWaterparkActive, waterparkInfo,
      stepTshirtSizes, isCampActive,
      trackKey: rawTrackKey, trackLabel, subDepartmentIds, operatingMode,
    } = body;

    const trackKey = (rawTrackKey && String(rawTrackKey).trim()) || MAIN_TRACK_KEY;
    const validatedStartDate = campStartDate && campStartDate.trim() !== '' ? campStartDate : null;
    const validatedTshirtDeadline = tshirtDeadline && tshirtDeadline.trim() !== '' ? tshirtDeadline : null;
    const incomingSubDeptIds: string[] = Array.isArray(subDepartmentIds) ? subDepartmentIds : [];
    const subDeptIdsJson = JSON.stringify(incomingSubDeptIds);

    // 세부부서 배타성 검증 — 같은 세부부서가 두 non-main 트랙에 동시에 배정되면
    // resolveTrackKey()의 첫 매치 우선 규칙이 깨져 신청자가 잘못된 트랙으로 안내될 수 있음
    if (trackKey !== MAIN_TRACK_KEY && incomingSubDeptIds.length > 0) {
      const siblingTracks = await listTracks(department);
      const conflicts = new Set<string>();
      for (const t of siblingTracks) {
        if (t.trackKey === MAIN_TRACK_KEY || t.trackKey === trackKey) continue;
        for (const id of t.subDepartmentIds) {
          if (incomingSubDeptIds.includes(id)) conflicts.add(id);
        }
      }
      if (conflicts.size > 0) {
        return Response.json(
          { success: false, error: `이미 다른 트랙에 배정된 세부부서입니다: ${[...conflicts].join(', ')}` },
          { status: 400 }
        );
      }
    }

    // 운영 모드가 오면 대부서 전체 행에 반영 (main 행 기준 일관성)
    if (operatingMode === 'union' || operatingMode === 'split') {
      await query(`UPDATE event_configs SET operating_mode = $1 WHERE department = $2`, [operatingMode, department]);
    }

    // 수련회 운영 여부는 부서 단위 값 — 오면 대부서 전체 행에 반영 (operating_mode와 동일 패턴)
    if (typeof isCampActive === 'boolean') {
      await query(`UPDATE event_configs SET is_camp_active = $1 WHERE department = $2`, [isCampActive, department]);
    }

    const existing = await queryOne(
      `SELECT id FROM event_configs WHERE department = $1 AND track_key = $2`,
      [department, trackKey]
    );

    if (!existing) {
      // operating_mode는 대부서 일관값 — 요청값 우선, 없으면 main 행 기준, 그래도 없으면 union
      let opMode: OperatingMode = operatingMode === 'split' ? 'split' : operatingMode === 'union' ? 'union' : 'union';
      if (operatingMode !== 'split' && operatingMode !== 'union') {
        const mainRow = await queryOne(
          `SELECT operating_mode FROM event_configs WHERE department = $1 AND track_key = 'main'`,
          [department]
        );
        opMode = mainRow?.operating_mode === 'split' ? 'split' : 'union';
      }
      await query(
        `INSERT INTO event_configs (
          department, title, event_type, subtitle, scripture,
          primary_color, bg_color, sub_departments, events,
          tshirt_sizes, custom_field_mappings, camp_start_date, camp_schedule,
          camp_type, camp_duration, poster_url, is_step_recruitment_active, tshirt_deadline,
          is_waterpark_active, waterpark_info,
          step_tshirt_sizes,
          track_key, track_label, sub_department_ids, operating_mode, is_camp_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [
          department, title || null, eventType || null, subtitle || null, scripture || null,
          primaryColor || null, bgColor || null,
          JSON.stringify(subDepartments || []), JSON.stringify(events || []),
          JSON.stringify(tshirtSizes || []), JSON.stringify(customFieldMappings || []),
          validatedStartDate, JSON.stringify(campSchedule || []),
          campType || 'continuous', Number(campDuration || 3), posterUrl || null,
          isStepRecruitmentActive || false, validatedTshirtDeadline,
          isWaterparkActive ?? true, JSON.stringify(waterparkInfo || {}),
          JSON.stringify(Array.isArray(stepTshirtSizes) ? stepTshirtSizes : []),
          trackKey, trackLabel || null, subDeptIdsJson, opMode, isCampActive ?? true,
        ]
      );
    } else {
      await query(
        `UPDATE event_configs SET
          title = $1, event_type = $2, subtitle = $3, scripture = $4,
          primary_color = $5, bg_color = $6,
          sub_departments = $7, events = $8,
          tshirt_sizes = $9, custom_field_mappings = $10,
          camp_start_date = $11, camp_schedule = $12,
          camp_type = $13, camp_duration = $14, poster_url = $15,
          is_step_recruitment_active = $16, tshirt_deadline = $17,
          is_waterpark_active = $18, waterpark_info = $19,
          step_tshirt_sizes = $20,
          track_label = $21, sub_department_ids = $22,
          is_camp_active = $23,
          updated_at = NOW()
         WHERE department = $24 AND track_key = $25`,
        [
          title || null, eventType || null, subtitle || null, scripture || null,
          primaryColor || null, bgColor || null,
          JSON.stringify(subDepartments || []), JSON.stringify(events || []),
          JSON.stringify(tshirtSizes || []), JSON.stringify(customFieldMappings || []),
          validatedStartDate, JSON.stringify(campSchedule || []),
          campType || 'continuous', Number(campDuration || 3), posterUrl || null,
          isStepRecruitmentActive || false, validatedTshirtDeadline,
          isWaterparkActive ?? true, JSON.stringify(waterparkInfo || {}),
          JSON.stringify(Array.isArray(stepTshirtSizes) ? stepTshirtSizes : []),
          trackLabel || null, subDeptIdsJson, isCampActive ?? true,
          department, trackKey,
        ]
      );
    }

    return Response.json({ success: true, message: '설정 저장 완료', data: { trackKey } }, { status: 200 });
  } catch (error) {
    console.error(`POST /config/${department} 오류:`, error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/config/[dept]?track=<key>
 * 트랙 삭제 ('main' 트랙은 삭제 불가).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ dept: string }> }
) {
  let department: string = '';
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { dept } = await params;
    department = dept;
    await ensureConfigSchema();
    const { searchParams } = new URL(request.url);
    const trackKey = searchParams.get('track');
    if (!trackKey) {
      return Response.json({ success: false, error: 'track 파라미터가 필요합니다' }, { status: 400 });
    }
    if (trackKey === MAIN_TRACK_KEY) {
      return Response.json({ success: false, error: '기본(연합) 트랙은 삭제할 수 없습니다' }, { status: 400 });
    }
    await query(`DELETE FROM event_configs WHERE department = $1 AND track_key = $2`, [department, trackKey]);
    return Response.json({ success: true, message: '트랙 삭제 완료' });
  } catch (error) {
    console.error(`DELETE /config/${department} 오류:`, error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

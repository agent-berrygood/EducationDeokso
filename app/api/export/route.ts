import { queryMany, queryOne, query } from '@/lib/db';
import ExcelJS from 'exceljs';
import { deriveDayCount } from '@/lib/session-grid';
import { genderLabel, subDepartmentLabel, buildSubDeptMap } from '@/lib/labels';
import { requireAdmin } from '@/lib/auth';

async function ensureSchema() {
  await query(`ALTER TABLE application_children ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`);
  await query(`ALTER TABLE application_children ADD COLUMN IF NOT EXISTS attended_sessions JSONB DEFAULT '[]'::jsonb`);
  await query(`ALTER TABLE application_children ADD COLUMN IF NOT EXISTS partial_attendance_reason TEXT`);
}

/**
 * camp_start_date + 일차 수 + 운영타입으로 캠프 날짜(YYYY-MM-DD) 목록 생성.
 * 신청서(ApplyWizard)가 참석 일정을 날짜로 저장하므로 동일한 방식으로 날짜를 만들어 매칭한다.
 */
function buildCampDates(
  campStartDate: string | null | undefined,
  dayCount: number,
  campType: string | null | undefined
): { date: string; label: string }[] {
  if (!campStartDate) return [];
  const start = new Date(campStartDate);
  if (isNaN(start.getTime())) return [];
  const step = campType === 'weekly' ? 7 : 1;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const out: { date: string; label: string }[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * step);
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, label: `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})` });
  }
  return out;
}

/**
 * GET /api/export?department=kids
 * 신청 현황 + 부분 참석 매트릭스 시트를 함께 추출
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    if (!department) {
      return Response.json({ success: false, error: 'department 필수' }, { status: 400 });
    }

    // 부서 설정 조회 (커스텀 필드 + camp_schedule + sub_departments)
    const config = await queryOne(
      `SELECT custom_field_mappings, camp_schedule, camp_duration, camp_type, camp_start_date, sub_departments
         FROM event_configs WHERE department = $1`,
      [department]
    );

    const safeParse = (v: any): any[] => {
      if (Array.isArray(v)) return v;
      if (typeof v !== 'string') return [];
      try { return JSON.parse(v); } catch { return []; }
    };

    const customFields = safeParse(config?.custom_field_mappings);
    const campSchedule = safeParse(config?.camp_schedule);
    const subDepartments = safeParse(config?.sub_departments);
    const subDeptMap = buildSubDeptMap(subDepartments);
    const dayCount = deriveDayCount(campSchedule, config?.camp_duration);

    // 신청 + 자녀 데이터 조회 (attended_sessions 포함)
    const rows = await queryMany(
      `SELECT
        a.id, a.parent_name, a.parent_phone, a.depositor_name, a.grand_total, a.created_at,
        a.vehicle_info, a.carpool_available, a.carpool_capacity,
        ac.id AS child_id, ac.name, ac.birth_date, ac.gender, ac.sub_department,
        ac.tshirt_size, ac.allergies, ac.custom_allergy, ac.attends_waterpark,
        ac.attended_sessions, ac.partial_attendance_reason,
        ac.custom_1, ac.custom_2, ac.custom_3, ac.custom_4, ac.custom_5,
        ac.custom_6, ac.custom_7, ac.custom_8, ac.custom_9, ac.custom_10,
        ac.custom_11, ac.custom_12, ac.custom_13, ac.custom_14, ac.custom_15,
        ac.custom_16, ac.custom_17, ac.custom_18, ac.custom_19, ac.custom_20
       FROM applications a
       INNER JOIN application_children ac ON a.id = ac.application_id AND ac.department = $1
       ORDER BY a.created_at DESC`,
      [department]
    );

    const workbook = new ExcelJS.Workbook();

    // === Sheet 1: 신청 현황 ===
    const ws1 = workbook.addWorksheet('신청현황');
    const headers1 = [
      '부모이름', '부모폰', '입금자',
      '자녀이름', '생년월일', '성별', '하위부서', '셔츠사이즈', '알러지', '물놀이',
      '차량정보', '카풀지원', '카풀인원',
      ...customFields.map((f: any) => f.label),
      '신청날짜',
    ];
    ws1.addRow(headers1);

    rows.forEach((r: any) => {
      ws1.addRow([
        r.parent_name ?? '',
        r.parent_phone ?? '',
        r.depositor_name ?? '',
        r.name ?? '',
        r.birth_date ?? '',
        genderLabel(r.gender),
        subDepartmentLabel(r.sub_department, subDeptMap),
        r.tshirt_size ?? '',
        r.allergies ?? '',
        r.attends_waterpark ? '참석' : '불참',
        r.vehicle_info ?? '',
        r.carpool_available ? '가능' : '',
        r.carpool_capacity ?? '',
        ...customFields.map((f: any) => r[`custom_${f.columnIndex}`] ?? ''),
        r.created_at ?? '',
      ]);
    });
    setColumnWidths(ws1, 15);
    ws1.getRow(1).font = { bold: true };

    // === Sheet 2: 부분 참석 (일부 날짜만 참석한 자녀만) ===
    // 신청서는 참석 일정을 "날짜(YYYY-MM-DD)"로 저장하므로, 캠프 날짜 기준 매트릭스로 표시하고
    // 전체 일정 중 일부 날짜만 참석한 자녀만 필터링한다. (전체 참석/미지정 자녀는 제외)
    const ws2 = workbook.addWorksheet('부분참석');

    const campDates = buildCampDates(config?.camp_start_date, dayCount, config?.camp_type);
    const campDateSet = new Set(campDates.map((c) => c.date));

    // 부분참석자 판별 + (캠프 날짜를 못 만들 때) 컬럼용 날짜 수집
    type PartialRow = { r: any; attendedSet: Set<string>; attendedCount: number };
    const partialRows: PartialRow[] = [];
    const fallbackDates = new Set<string>();

    rows.forEach((r: any) => {
      const raw = r.attended_sessions;
      const list: string[] = (Array.isArray(raw) ? raw : safeParse(raw)).filter(
        (s: any) => typeof s === 'string'
      );
      if (campDates.length > 0) {
        // 캠프 날짜 목록이 있으면: 캠프 날짜와 교집합이 1개 이상이면서 전체보다 적으면 "부분참석"
        const inCamp = list.filter((d) => campDateSet.has(d));
        if (inCamp.length > 0 && inCamp.length < campDates.length) {
          partialRows.push({ r, attendedSet: new Set(inCamp), attendedCount: inCamp.length });
        }
      } else {
        // 캠프 날짜를 만들 수 없으면(시작일 미설정): 참석 일정을 지정한 자녀를 부분참석으로 간주(베스트에포트)
        if (list.length > 0) {
          list.forEach((d) => fallbackDates.add(d));
          partialRows.push({ r, attendedSet: new Set(list), attendedCount: list.length });
        }
      }
    });

    // 컬럼 날짜: 캠프 날짜 우선, 없으면 수집된 날짜 정렬
    const dateCols = campDates.length > 0
      ? campDates
      : Array.from(fallbackDates).sort().map((d) => ({ date: d, label: d }));

    const headers2 = [
      '자녀이름', '부모', '연락처', '하위부서',
      ...dateCols.map((c) => c.label),
      '참석일수', '부분참석 사유',
    ];
    ws2.addRow(headers2);

    const dateTotals: Record<string, number> = {};
    partialRows.forEach(({ r, attendedSet, attendedCount }) => {
      const dataRow: any[] = [
        r.name ?? '',
        r.parent_name ?? '',
        r.parent_phone ?? '',
        subDepartmentLabel(r.sub_department, subDeptMap),
      ];
      for (const c of dateCols) {
        const attend = attendedSet.has(c.date);
        dataRow.push(attend ? '✓' : '');
        if (attend) dateTotals[c.date] = (dateTotals[c.date] || 0) + 1;
      }
      dataRow.push(attendedCount);
      dataRow.push(r.partial_attendance_reason ?? '');
      ws2.addRow(dataRow);
    });

    if (partialRows.length > 0) {
      // 합계 행 (날짜별 부분참석 인원)
      const totalsRow: any[] = ['합계', '', '', ''];
      let grand = 0;
      for (const c of dateCols) {
        const cnt = dateTotals[c.date] || 0;
        totalsRow.push(cnt);
        grand += cnt;
      }
      totalsRow.push(grand);
      totalsRow.push('');
      ws2.addRow(totalsRow);
      ws2.getRow(ws2.rowCount).font = { bold: true };
      ws2.getRow(ws2.rowCount).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' },
      };
    } else {
      // 부분참석자가 없으면 안내 문구
      ws2.addRow(['부분참석자가 없습니다.']);
    }

    setColumnWidths(ws2, 12);
    ws2.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const today = new Date().toISOString().split('T')[0];
    const filenameKo = `신청현황_${department}_${today}.xlsx`;
    const filenameAscii = `applications_${department}_${today}.xlsx`;

    return new Response(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // RFC 5987로 한글 파일명 안전 인코딩 (구버전 브라우저용 ASCII fallback 포함)
        'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${encodeURIComponent(filenameKo)}`,
      },
    });
  } catch (error) {
    console.error('GET /export 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * 워크시트에 addRow만 했을 경우 ws.columns가 undefined일 수 있으므로
 * 안전하게 열 너비 일괄 설정.
 */
function setColumnWidths(ws: ExcelJS.Worksheet, width: number) {
  const headerRow = ws.getRow(1);
  const colCount = headerRow.cellCount || (headerRow.values as any[])?.length || 0;
  for (let i = 1; i <= colCount; i++) {
    ws.getColumn(i).width = width;
  }
}

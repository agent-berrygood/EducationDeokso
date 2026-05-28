import { queryMany, queryOne, query } from '@/lib/db';
import ExcelJS from 'exceljs';
import {
  SLOTS,
  SLOT_LABELS,
  buildSessionKey,
  deriveDayCount,
  isSessionKey,
} from '@/lib/session-grid';

async function ensureSchema() {
  await query(`ALTER TABLE application_children ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`);
  await query(`ALTER TABLE application_children ADD COLUMN IF NOT EXISTS attended_sessions JSONB DEFAULT '[]'::jsonb`);
}

/**
 * GET /api/export?department=kids
 * 신청 현황 + 부분 참석 매트릭스 시트를 함께 추출
 */
export async function GET(request: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    if (!department) {
      return Response.json({ success: false, error: 'department 필수' }, { status: 400 });
    }

    // 부서 설정 조회 (커스텀 필드 + camp_schedule + camp_duration)
    const config = await queryOne(
      `SELECT custom_field_mappings, camp_schedule, camp_duration
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
    const dayCount = deriveDayCount(campSchedule, config?.camp_duration);

    // 신청 + 자녀 데이터 조회 (attended_sessions 포함)
    const rows = await queryMany(
      `SELECT
        a.id, a.parent_name, a.parent_phone, a.depositor_name, a.grand_total, a.created_at,
        ac.id AS child_id, ac.name, ac.birth_date, ac.gender, ac.sub_department,
        ac.tshirt_size, ac.allergies, ac.custom_allergy, ac.attends_waterpark,
        ac.attended_sessions,
        ac.custom_1, ac.custom_2, ac.custom_3, ac.custom_4, ac.custom_5,
        ac.custom_6, ac.custom_7, ac.custom_8, ac.custom_9, ac.custom_10,
        ac.custom_11, ac.custom_12, ac.custom_13, ac.custom_14, ac.custom_15,
        ac.custom_16, ac.custom_17, ac.custom_18, ac.custom_19, ac.custom_20,
        ps.kinder_paid, ps.kids_paid, ps.teens_paid, ps.waterpark_paid
       FROM applications a
       INNER JOIN application_children ac ON a.id = ac.application_id AND ac.department = $1
       LEFT JOIN payment_status ps ON a.id = ps.application_id
       ORDER BY a.created_at DESC`,
      [department]
    );

    const workbook = new ExcelJS.Workbook();

    // === Sheet 1: 신청 현황 ===
    const ws1 = workbook.addWorksheet('신청현황');
    const headers1 = [
      '부모이름', '부모폰', '입금자',
      '자녀이름', '생년월일', '성별', '하위부서', '셔츠사이즈', '알러지', '물놀이',
      ...customFields.map((f: any) => f.label),
      '결제상태', '신청날짜',
    ];
    ws1.addRow(headers1);

    rows.forEach((r: any) => {
      ws1.addRow([
        r.parent_name, r.parent_phone, r.depositor_name,
        r.name, r.birth_date, r.gender || '', r.sub_department, r.tshirt_size, r.allergies,
        r.attends_waterpark ? 'Y' : 'N',
        ...customFields.map((f: any) => r[`custom_${f.columnIndex}`] || ''),
        [
          r.kinder_paid ? '✓킨더' : '',
          r.kids_paid ? '✓키즈' : '',
          r.teens_paid ? '✓틴즈' : '',
          r.waterpark_paid ? '✓워터풀' : '',
        ].filter(Boolean).join('/') || '미결제',
        r.created_at,
      ]);
    });
    ws1.columns.forEach((col) => { col.width = 15; });

    // === Sheet 2: 부분 참석 매트릭스 ===
    const ws2 = workbook.addWorksheet('부분참석');
    const sessionHeaders = ['자녀이름', '부모', '연락처', '하위부서'];
    for (let d = 1; d <= dayCount; d++) {
      for (const slot of SLOTS) {
        sessionHeaders.push(`${d}일차 ${SLOT_LABELS[slot]}`);
      }
    }
    sessionHeaders.push('참석 합계');
    ws2.addRow(sessionHeaders);

    // 슬롯별 집계용
    const slotTotals: Record<string, number> = {};

    rows.forEach((r: any) => {
      const sessionsRaw = r.attended_sessions;
      const sessions: string[] = Array.isArray(sessionsRaw)
        ? sessionsRaw
        : safeParse(sessionsRaw);
      const sessionSet = new Set(sessions.filter(isSessionKey));

      const dataRow: any[] = [r.name, r.parent_name, r.parent_phone, r.sub_department];
      let attendCount = 0;
      for (let d = 1; d <= dayCount; d++) {
        for (const slot of SLOTS) {
          const key = buildSessionKey(d, slot);
          const attend = sessionSet.has(key);
          dataRow.push(attend ? '✓' : '');
          if (attend) {
            attendCount++;
            slotTotals[key] = (slotTotals[key] || 0) + 1;
          }
        }
      }
      dataRow.push(attendCount);
      ws2.addRow(dataRow);
    });

    // 합계 행
    const totalsRow: any[] = ['합계', '', '', ''];
    let grand = 0;
    for (let d = 1; d <= dayCount; d++) {
      for (const slot of SLOTS) {
        const c = slotTotals[buildSessionKey(d, slot)] || 0;
        totalsRow.push(c);
        grand += c;
      }
    }
    totalsRow.push(grand);
    ws2.addRow(totalsRow);

    // 스타일
    ws2.columns.forEach((col) => { col.width = 12; });
    ws2.getRow(1).font = { bold: true };
    ws2.getRow(ws2.rowCount).font = { bold: true };
    ws2.getRow(ws2.rowCount).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' },
    };

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="신청현황_${department}_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('GET /export 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

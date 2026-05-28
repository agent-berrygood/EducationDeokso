import { cookies } from 'next/headers';
import { queryMany, queryOne, query } from '@/lib/db';
import { decryptSession } from '@/lib/auth';
import { genderLabel, subDepartmentLabel, buildSubDeptMap, departmentLabel } from '@/lib/labels';
import type { DepartmentId } from '@/lib/types';
import ExcelJS from 'exceljs';

async function ensureSchema() {
  await query(`ALTER TABLE application_children ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`);
  await query(`ALTER TABLE application_children ADD COLUMN IF NOT EXISTS attended_sessions JSONB DEFAULT '[]'::jsonb`);
  await query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS waterfall_parents JSONB DEFAULT '[]'::jsonb`);
}

const ALL_DEPTS: DepartmentId[] = ['kinder', 'kids', 'teens'];
const DEPT_LABEL: Record<DepartmentId, string> = {
  kinder: '나우킨더',
  kids: '나우키즈',
  teens: '나우틴즈',
};

function safeJsonArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string') return [];
  try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

/**
 * GET /api/payment/export
 * 수납 모니터 데이터를 단일 엑셀 파일에 4시트로 출력:
 *  - 전체 / 나우킨더 / 나우키즈 / 나우틴즈
 *
 * 권한: 토큰의 allowed_departments에 해당하는 시트만 데이터가 채워지고,
 *       나머지 시트는 헤더만 노출.
 */
export async function GET() {
  try {
    await ensureSchema();

    // 권한 확인
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;
    if (!token) {
      return Response.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const session = await decryptSession(token);
    if (!session) {
      return Response.json({ success: false, error: '세션이 만료되었습니다.' }, { status: 401 });
    }
    const allowed: DepartmentId[] = session.allowed_departments ?? [];

    // 글로벌 요금 + 부서별 sub_departments 매핑 로드
    const fees = await queryOne(`SELECT * FROM fees_config LIMIT 1`);
    const configs = await queryMany(
      `SELECT department, sub_departments FROM event_configs`
    );
    const subDeptMaps: Record<DepartmentId, Map<string, string>> = {
      kinder: new Map(), kids: new Map(), teens: new Map(),
    };
    (configs as any[]).forEach((c) => {
      const d = c.department as DepartmentId;
      if (subDeptMaps[d]) {
        subDeptMaps[d] = buildSubDeptMap(safeJsonArray(c.sub_departments));
      }
    });

    const kinderUnit = Number(fees?.kinder || 0);
    const kidsUnit = Number(fees?.kids || 0);
    const teensUnit = Number(fees?.teens || 0);
    const childWaterUnit = Number(fees?.child_waterpark || 0);
    const parentWaterUnit = Number(fees?.parent_waterpark || 0);

    // 권한 안의 부서로 한정해 신청 + 자녀 + 결제 상태 조회
    const apps = allowed.length === 0
      ? []
      : await queryMany(
          `SELECT
            a.id, a.parent_name, a.parent_phone, a.depositor_name, a.waterfall_parents,
            a.created_at,
            json_agg(
              json_build_object(
                'id', ac.id,
                'name', ac.name,
                'department', ac.department,
                'subDepartment', ac.sub_department,
                'attendsWaterpark', ac.attends_waterpark,
                'gender', ac.gender,
                'birthDate', ac.birth_date
              )
            ) FILTER (WHERE ac.id IS NOT NULL) AS children,
            ps.kinder_paid, ps.kids_paid, ps.teens_paid, ps.waterpark_paid
          FROM applications a
          LEFT JOIN application_children ac ON a.id = ac.application_id
          LEFT JOIN payment_status ps ON a.id = ps.application_id
          WHERE ac.department = ANY($1::text[])
          GROUP BY a.id, ps.kinder_paid, ps.kids_paid, ps.teens_paid, ps.waterpark_paid
          ORDER BY a.created_at DESC`,
          [allowed]
        );

    // 행 빌더
    interface PaymentRow {
      parentName: string;
      parentPhone: string;
      depositorName: string;
      counts: { kinder: number; kids: number; teens: number };
      waterparkChildren: number;
      waterfallParentCount: number;
      childNames: string[];
      subDepartments: { kinder: string[]; kids: string[]; teens: string[] };
      paid: {
        kinder: boolean; kids: boolean; teens: boolean; waterpark: boolean;
      };
      created_at: any;
      filterDepartments: Set<DepartmentId>;
    }

    const rows: PaymentRow[] = (apps as any[]).map((a) => {
      const children = Array.isArray(a.children) ? a.children : safeJsonArray(a.children);
      const counts = { kinder: 0, kids: 0, teens: 0 };
      const subDeps: { kinder: string[]; kids: string[]; teens: string[] } = { kinder: [], kids: [], teens: [] };
      let waterparkChildren = 0;
      const childNames: string[] = [];
      const filterDepartments = new Set<DepartmentId>();
      children.forEach((c: any) => {
        const d = c?.department as DepartmentId;
        if (d === 'kinder' || d === 'kids' || d === 'teens') {
          counts[d] += 1;
          filterDepartments.add(d);
          if (c.subDepartment) subDeps[d].push(c.subDepartment);
        }
        if (c?.attendsWaterpark) waterparkChildren += 1;
        if (c?.name) childNames.push(c.name);
      });
      const wf = safeJsonArray(a.waterfall_parents);
      return {
        parentName: a.parent_name || '',
        parentPhone: a.parent_phone || '',
        depositorName: a.depositor_name || a.parent_name || '',
        counts,
        waterparkChildren,
        waterfallParentCount: wf.length,
        childNames,
        subDepartments: subDeps,
        paid: {
          kinder: !!a.kinder_paid,
          kids: !!a.kids_paid,
          teens: !!a.teens_paid,
          waterpark: !!a.waterpark_paid,
        },
        created_at: a.created_at,
        filterDepartments,
      };
    });

    const workbook = new ExcelJS.Workbook();

    // 공통 헤더 빌더
    function buildSheet(name: string, filterDept: DepartmentId | 'all') {
      const ws = workbook.addWorksheet(name);
      const headers = [
        '보호자', '연락처', '입금자', '자녀',
        '나우킨더 회비', '나우킨더 수납',
        '나우키즈 회비', '나우키즈 수납',
        '나우틴즈 회비', '나우틴즈 수납',
        '워터풀선데이 비용', '워터풀선데이 수납',
        '합계', '수납 합계', '잔여',
        '하위부서 (킨더/키즈/틴즈)',
        '신청일시',
      ];
      ws.addRow(headers);
      ws.getRow(1).font = { bold: true };

      const filtered = filterDept === 'all'
        ? rows
        : rows.filter((r) => r.filterDepartments.has(filterDept));

      let sumK = 0, sumKd = 0, sumT = 0, sumW = 0, sumPaid = 0;

      filtered.forEach((r) => {
        const amtK = r.counts.kinder * kinderUnit;
        const amtKd = r.counts.kids * kidsUnit;
        const amtT = r.counts.teens * teensUnit;
        const amtW = r.waterparkChildren * childWaterUnit
                   + (r.waterparkChildren > 0 ? r.waterfallParentCount * parentWaterUnit : 0);

        const paidTotal =
          (r.paid.kinder ? amtK : 0)
          + (r.paid.kids ? amtKd : 0)
          + (r.paid.teens ? amtT : 0)
          + (r.paid.waterpark ? amtW : 0);
        const total = amtK + amtKd + amtT + amtW;

        sumK += amtK; sumKd += amtKd; sumT += amtT; sumW += amtW;
        sumPaid += paidTotal;

        const formatDept = (dep: DepartmentId, count: number, amount: number) =>
          count === 0 ? '-' : `${count}명 ${amount.toLocaleString()}원`;

        const formatPaid = (paid: boolean, count: number) =>
          count === 0 ? '-' : (paid ? '✓ 수납' : '미수납');

        const formatSubDeps = () => {
          const k = r.subDepartments.kinder.map((sd) => subDepartmentLabel(sd, subDeptMaps.kinder));
          const kd = r.subDepartments.kids.map((sd) => subDepartmentLabel(sd, subDeptMaps.kids));
          const t = r.subDepartments.teens.map((sd) => subDepartmentLabel(sd, subDeptMaps.teens));
          return [
            k.length ? `킨더: ${k.join(', ')}` : '',
            kd.length ? `키즈: ${kd.join(', ')}` : '',
            t.length ? `틴즈: ${t.join(', ')}` : '',
          ].filter(Boolean).join(' / ');
        };

        ws.addRow([
          r.parentName,
          r.parentPhone,
          r.depositorName,
          r.childNames.join(', '),
          formatDept('kinder', r.counts.kinder, amtK),
          formatPaid(r.paid.kinder, r.counts.kinder),
          formatDept('kids', r.counts.kids, amtKd),
          formatPaid(r.paid.kids, r.counts.kids),
          formatDept('teens', r.counts.teens, amtT),
          formatPaid(r.paid.teens, r.counts.teens),
          r.waterparkChildren === 0 ? '-' : `자녀 ${r.waterparkChildren} + 부모 ${r.waterfallParentCount} → ${amtW.toLocaleString()}원`,
          formatPaid(r.paid.waterpark, r.waterparkChildren),
          total.toLocaleString() + '원',
          paidTotal.toLocaleString() + '원',
          (total - paidTotal).toLocaleString() + '원',
          formatSubDeps(),
          r.created_at,
        ]);
      });

      // 합계 행
      if (filtered.length > 0) {
        const grandTotal = sumK + sumKd + sumT + sumW;
        ws.addRow([
          '합계', '', '', `${filtered.length}건`,
          sumK.toLocaleString() + '원', '',
          sumKd.toLocaleString() + '원', '',
          sumT.toLocaleString() + '원', '',
          sumW.toLocaleString() + '원', '',
          grandTotal.toLocaleString() + '원',
          sumPaid.toLocaleString() + '원',
          (grandTotal - sumPaid).toLocaleString() + '원',
          '', '',
        ]);
        const totalRow = ws.getRow(ws.rowCount);
        totalRow.font = { bold: true };
        totalRow.fill = {
          type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' },
        };
      }

      // 너비
      const colCount = (ws.getRow(1).values as any[])?.length || 0;
      for (let i = 1; i <= colCount; i++) {
        ws.getColumn(i).width = i <= 4 ? 14 : 18;
      }
    }

    // 전체 시트는 항상 노출, 부서 시트는 권한 안에서만
    buildSheet('전체', 'all');
    ALL_DEPTS.forEach((d) => {
      if (allowed.includes(d)) {
        buildSheet(DEPT_LABEL[d], d);
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const today = new Date().toISOString().split('T')[0];
    const filenameKo = `수납현황_${today}.xlsx`;
    const filenameAscii = `payment_${today}.xlsx`;

    return new Response(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${encodeURIComponent(filenameKo)}`,
      },
    });
  } catch (error) {
    console.error('GET /payment/export 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

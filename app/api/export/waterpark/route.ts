import { queryMany } from '@/lib/db';
import ExcelJS from 'exceljs';
import { genderLabel } from '@/lib/labels';

function safeParse(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return [];
  try { return JSON.parse(val); } catch { return []; }
}

const DEPT_LABELS: Record<string, string> = {
  kinder: '나우킨더',
  kids: '나우키즈',
  teens: '나우틴즈',
};

/**
 * GET /api/export/waterpark?department=kids
 * 워터풀선데이 신청 명단 엑셀 추출 — 가족 단위 시트 + 개별 명단(체크인용) 시트.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    const params: any[] = [];
    let deptHaving = '';
    if (department) {
      params.push(department);
      deptHaving = `AND bool_or(ac.attends_waterpark AND ac.department = $1)`;
    }

    const rows = await queryMany(
      `SELECT
         a.id, a.parent_name, a.parent_phone, a.depositor_name,
         a.waterfall_parents, a.created_at,
         json_agg(
           json_build_object(
             'name', ac.name,
             'gender', ac.gender,
             'department', ac.department,
             'subDepartment', ac.sub_department
           ) ORDER BY ac.department, ac.name
         ) FILTER (WHERE ac.attends_waterpark) AS waterpark_children
       FROM applications a
       INNER JOIN application_children ac ON a.id = ac.application_id
       GROUP BY a.id
       HAVING bool_or(ac.attends_waterpark) ${deptHaving}
       ORDER BY a.parent_name`,
      params
    );

    const workbook = new ExcelJS.Workbook();

    // === Sheet 1: 가족 단위 명단 ===
    const ws1 = workbook.addWorksheet('가족단위');
    ws1.addRow(['대표 보호자', '연락처', '입금자', '동반 보호자 명단', '참석 자녀 명단', '보호자 수', '자녀 수', '총 인원', '신청일']);

    let totalParents = 0;
    let totalChildren = 0;

    rows.forEach((r: any) => {
      const parents = safeParse(r.waterfall_parents);
      const children = Array.isArray(r.waterpark_children) ? r.waterpark_children : [];
      totalParents += parents.length;
      totalChildren += children.length;
      ws1.addRow([
        r.parent_name ?? '',
        r.parent_phone ?? '',
        r.depositor_name ?? '',
        parents.map((p: any) => `${p.name}(${p.relation})`).join(', '),
        children.map((c: any) => `${c.name}(${DEPT_LABELS[c.department] || c.department})`).join(', '),
        parents.length,
        children.length,
        parents.length + children.length,
        r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
      ]);
    });

    if (rows.length > 0) {
      const totalRow = ws1.addRow(['합계', '', '', '', '', totalParents, totalChildren, totalParents + totalChildren, '']);
      totalRow.font = { bold: true };
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } };
    }
    setColumnWidths(ws1, 18);
    ws1.getRow(1).font = { bold: true };

    // === Sheet 2: 개별 명단 (현장 체크인용) ===
    const ws2 = workbook.addWorksheet('개별명단');
    ws2.addRow(['NO', '구분', '이름', '관계/부서', '성별', '대표 보호자', '연락처', '체크인']);

    let no = 0;
    rows.forEach((r: any) => {
      const parents = safeParse(r.waterfall_parents);
      const children = Array.isArray(r.waterpark_children) ? r.waterpark_children : [];
      parents.forEach((p: any) => {
        ws2.addRow([++no, '보호자', p.name ?? '', p.relation ?? '', '', r.parent_name ?? '', p.phone || r.parent_phone || '', '']);
      });
      children.forEach((c: any) => {
        ws2.addRow([++no, '자녀', c.name ?? '', DEPT_LABELS[c.department] || c.department || '', genderLabel(c.gender), r.parent_name ?? '', r.parent_phone ?? '', '']);
      });
    });
    setColumnWidths(ws2, 14);
    ws2.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const today = new Date().toISOString().split('T')[0];
    const deptSuffix = department ? `_${department}` : '_전체';
    const filenameKo = `워터풀명단${deptSuffix}_${today}.xlsx`;
    const filenameAscii = `waterpark${department ? `_${department}` : '_all'}_${today}.xlsx`;

    return new Response(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${encodeURIComponent(filenameKo)}`,
      },
    });
  } catch (error) {
    console.error('GET /export/waterpark 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

function setColumnWidths(ws: ExcelJS.Worksheet, width: number) {
  const headerRow = ws.getRow(1);
  const colCount = headerRow.cellCount || (headerRow.values as any[])?.length || 0;
  for (let i = 1; i <= colCount; i++) {
    ws.getColumn(i).width = width;
  }
}

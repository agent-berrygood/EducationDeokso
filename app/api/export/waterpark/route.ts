import ExcelJS from 'exceljs';
import { genderLabel } from '@/lib/labels';
import { requireAdmin } from '@/lib/auth';
import { fetchWaterparkFamilies } from '@/lib/waterpark-query';

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
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const track = searchParams.get('track');

    // 성경학교 워터풀 참석자 + 워터풀 단독 신청을 병합 후 이름순 정렬
    const families = (await fetchWaterparkFamilies({ department, track }))
      .sort((a, b) => (a.parentName || '').localeCompare(b.parentName || '', 'ko'));

    const workbook = new ExcelJS.Workbook();

    // === Sheet 1: 가족 단위 명단 ===
    // 이름은 한 셀에 한 명씩. 컬럼 수는 실제 최대 인원에 맞춰 늘린다(최소 1칸).
    const ws1 = workbook.addWorksheet('가족단위');
    const maxParents = Math.max(1, ...families.map((f) => f.parents.length));
    const maxChildren = Math.max(1, ...families.map((f) => f.children.length));
    const parentCols = Array.from({ length: maxParents }, (_, i) => `보호자${i + 1}`);
    const childCols = Array.from({ length: maxChildren }, (_, i) => `자녀${i + 1}`);
    ws1.addRow([
      '대표 보호자', '연락처', '입금자',
      ...parentCols, ...childCols,
      '보호자 수', '자녀 수', '총 인원', '신청일',
    ]);

    let totalParents = 0;
    let totalChildren = 0;

    families.forEach((f) => {
      const parents = f.parents;
      const children = f.children;
      totalParents += parents.length;
      totalChildren += children.length;
      // 빈 칸까지 채워 컬럼 정렬을 맞춘다
      const parentCells = parentCols.map((_, i) => {
        const p = parents[i];
        return p ? `${p.name}${p.relation ? `(${p.relation})` : ''}` : '';
      });
      const childCells = childCols.map((_, i) => {
        const c = children[i];
        return c ? `${c.name}(${DEPT_LABELS[c.department] || c.department})` : '';
      });
      ws1.addRow([
        f.parentName ?? '',
        f.parentPhone ?? '',
        f.depositorName ?? '',
        ...parentCells,
        ...childCells,
        parents.length,
        children.length,
        parents.length + children.length,
        f.createdAt ? new Date(f.createdAt).toISOString().slice(0, 10) : '',
      ]);
    });

    if (families.length > 0) {
      const totalRow = ws1.addRow([
        '합계', '', '',
        ...parentCols.map(() => ''), ...childCols.map(() => ''),
        totalParents, totalChildren, totalParents + totalChildren, '',
      ]);
      totalRow.font = { bold: true };
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } };
    }
    setColumnWidths(ws1, 14);
    ws1.getRow(1).font = { bold: true };
    ws1.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];

    // === Sheet 2: 개별 명단 (현장 체크인용) ===
    const ws2 = workbook.addWorksheet('개별명단');
    ws2.addRow(['NO', '구분', '이름', '관계/부서', '성별', '대표 보호자', '연락처', '체크인']);

    let no = 0;
    families.forEach((f) => {
      f.parents.forEach((p: any) => {
        ws2.addRow([++no, '보호자', p.name ?? '', p.relation ?? '', '', f.parentName ?? '', p.phone || f.parentPhone || '', '']);
      });
      f.children.forEach((c: any) => {
        ws2.addRow([++no, '자녀', c.name ?? '', DEPT_LABELS[c.department] || c.department || '', genderLabel(c.gender), f.parentName ?? '', f.parentPhone ?? '', '']);
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

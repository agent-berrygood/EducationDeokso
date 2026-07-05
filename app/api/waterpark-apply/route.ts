import { queryOne, query } from '@/lib/db';
import { waterparkApplicationSubmitSchema } from '@/lib/schemas';

/**
 * 마이그레이션(/api/init) 미적용 환경에서도 동작하도록 워터풀 단독 신청 테이블을 자동 보장.
 * 이미 적용된 환경에서는 noop.
 */
async function ensureWaterparkApplySchema() {
  await query(`CREATE TABLE IF NOT EXISTS waterpark_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_name VARCHAR(100) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    depositor_name VARCHAR(100) NOT NULL,
    grand_total DECIMAL(10, 2) DEFAULT 0,
    waterfall_parents JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS waterpark_application_children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waterpark_application_id UUID NOT NULL REFERENCES waterpark_applications(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    birth_date DATE,
    gender VARCHAR(10),
    department VARCHAR(50),
    sub_department VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wp_children_app ON waterpark_application_children(waterpark_application_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wp_children_dept ON waterpark_application_children(department)`);
}

/**
 * POST /api/waterpark-apply
 * 워터풀선데이 단독 신청 생성 (보호자 + 동반 보호자 + 자녀들).
 * 성경학교 신청과 별개이며, 관리자 워터풀 명단에서는 전화+이름 기준으로 병합되어 함께 조회된다.
 */
export async function POST(request: Request) {
  try {
    await ensureWaterparkApplySchema();
    const body = await request.json();
    const parsed = waterparkApplicationSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, error: '입력값 검증 실패', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { parentName, parentPhone, depositorName, waterfallParents, children, grandTotal } = parsed.data;

    const app = await queryOne(
      `INSERT INTO waterpark_applications (parent_name, parent_phone, depositor_name, grand_total, waterfall_parents)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
      [parentName, parentPhone, depositorName, grandTotal || 0, JSON.stringify(waterfallParents)]
    );
    const applicationId = app.id;

    for (const child of children) {
      await query(
        `INSERT INTO waterpark_application_children
           (waterpark_application_id, name, birth_date, gender, department, sub_department)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          applicationId,
          child.name,
          child.birthDate || null,
          child.gender || null,
          child.department || null,
          child.subDepartment || null,
        ]
      );
    }

    return Response.json({ success: true, data: { id: applicationId } }, { status: 201 });
  } catch (error) {
    console.error('POST /waterpark-apply 오류:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

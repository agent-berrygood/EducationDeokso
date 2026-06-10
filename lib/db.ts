import { Pool } from 'pg';

// PostgreSQL 연결 풀
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Neon 필수
  },
});

// 쿼리 실행
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// 단일 행 조회
export async function queryOne(text: string, params?: any[]) {
  const result = await query(text, params);
  return result.rows[0];
}

// 여러 행 조회
export async function queryMany(text: string, params?: any[]) {
  const result = await query(text, params);
  return result.rows;
}

// ============================================================
// 마이그레이션 시스템
// ============================================================
interface Migration {
  version: number;
  description: string;
  up: string[];
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Add waterfall_parents JSONB to applications',
    up: [
      `ALTER TABLE applications ADD COLUMN IF NOT EXISTS waterfall_parents JSONB DEFAULT '[]'::jsonb`,
      `UPDATE applications SET waterfall_parents = '[]'::jsonb WHERE waterfall_parents IS NULL`,
    ],
  },
  {
    version: 2,
    description: 'Add composite indexes for filtering and sorting',
    up: [
      `CREATE INDEX IF NOT EXISTS idx_children_dept_sub ON application_children(department, sub_department)`,
      `CREATE INDEX IF NOT EXISTS idx_apps_created ON applications(created_at DESC)`,
    ],
  },
  {
    version: 3,
    description: 'Add gender column to application_children',
    up: [
      `ALTER TABLE application_children ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`,
    ],
  },
  {
    version: 5,
    description: 'Add child_waterpark fee and account columns to fees_config',
    up: [
      `ALTER TABLE fees_config ADD COLUMN IF NOT EXISTS child_waterpark DECIMAL(10, 2) DEFAULT 0`,
      `ALTER TABLE fees_config ADD COLUMN IF NOT EXISTS kinder_account VARCHAR(120)`,
      `ALTER TABLE fees_config ADD COLUMN IF NOT EXISTS kids_account VARCHAR(120)`,
      `ALTER TABLE fees_config ADD COLUMN IF NOT EXISTS teens_account VARCHAR(120)`,
      `ALTER TABLE fees_config ADD COLUMN IF NOT EXISTS waterpark_account VARCHAR(120)`,
      // 기존 행에 자녀 워터파크 디폴트 채움 (운영에 자녀=학부모와 동일 금액으로 두지 않기 위해 0으로)
      `UPDATE fees_config SET child_waterpark = COALESCE(child_waterpark, 0) WHERE child_waterpark IS NULL`,
    ],
  },
  {
    version: 6,
    description: 'Add attended_sessions JSONB + GIN index to application_children',
    up: [
      `ALTER TABLE application_children ADD COLUMN IF NOT EXISTS attended_sessions JSONB DEFAULT '[]'::jsonb`,
      `UPDATE application_children SET attended_sessions = '[]'::jsonb WHERE attended_sessions IS NULL`,
      `CREATE INDEX IF NOT EXISTS idx_children_sessions ON application_children USING GIN (attended_sessions)`,
    ],
  },
  {
    version: 4,
    description: 'Repair corrupted Korean labels in event_configs sub_departments / title',
    up: [
      // kinder
      `UPDATE event_configs
         SET sub_departments = '[
           {"id":"integrated_preschool","label":"통합미취학부"},
           {"id":"infant","label":"영유아부"},
           {"id":"kindergarten","label":"유치부"}
         ]'::jsonb
       WHERE department = 'kinder'
         AND (
           sub_departments IS NULL
           OR sub_departments = '[]'::jsonb
           OR sub_departments::text LIKE '%?%'
           OR jsonb_array_length(sub_departments) = 0
         )`,
      `UPDATE event_configs
         SET title = '2026 여름성경학교',
             event_type = '여름성경학교'
       WHERE department = 'kinder'
         AND (title IS NULL OR title LIKE '%?%' OR event_type IS NULL OR event_type LIKE '%?%')`,
      `UPDATE event_configs
         SET tshirt_sizes = '["SS","S","M","L","XL"]'::jsonb
       WHERE department = 'kinder'
         AND (
           tshirt_sizes IS NULL
           OR tshirt_sizes = '[]'::jsonb
           OR tshirt_sizes::text LIKE '%?%'
         )`,

      // kids
      `UPDATE event_configs
         SET sub_departments = '[
           {"id":"integrated_kids","label":"통합아동부"},
           {"id":"junior","label":"유년부"},
           {"id":"senior","label":"소년부"}
         ]'::jsonb
       WHERE department = 'kids'
         AND (
           sub_departments IS NULL
           OR sub_departments = '[]'::jsonb
           OR sub_departments::text LIKE '%?%'
           OR jsonb_array_length(sub_departments) = 0
         )`,
      `UPDATE event_configs
         SET title = '2026 여름성경학교',
             event_type = '여름성경학교'
       WHERE department = 'kids'
         AND (title IS NULL OR title LIKE '%?%' OR event_type IS NULL OR event_type LIKE '%?%')`,
      `UPDATE event_configs
         SET tshirt_sizes = '["SS","S","M","L","XL","2XL"]'::jsonb
       WHERE department = 'kids'
         AND (
           tshirt_sizes IS NULL
           OR tshirt_sizes = '[]'::jsonb
           OR tshirt_sizes::text LIKE '%?%'
         )`,

      // teens
      `UPDATE event_configs
         SET sub_departments = '[
           {"id":"middle","label":"중등부"},
           {"id":"high","label":"고등부"}
         ]'::jsonb
       WHERE department = 'teens'
         AND (
           sub_departments IS NULL
           OR sub_departments = '[]'::jsonb
           OR sub_departments::text LIKE '%?%'
           OR jsonb_array_length(sub_departments) = 0
         )`,
      `UPDATE event_configs
         SET title = '2026 여름수련회',
             event_type = '여름수련회'
       WHERE department = 'teens'
         AND (title IS NULL OR title LIKE '%?%' OR event_type IS NULL OR event_type LIKE '%?%')`,
      `UPDATE event_configs
         SET tshirt_sizes = '["S","M","L","XL","2XL","3XL"]'::jsonb
       WHERE department = 'teens'
         AND (
           tshirt_sizes IS NULL
           OR tshirt_sizes = '[]'::jsonb
           OR tshirt_sizes::text LIKE '%?%'
         )`,

      // 누락된 부서 시드 보강 (3부서 모두 행이 존재하도록)
      `INSERT INTO event_configs (department, title, event_type, sub_departments, tshirt_sizes, primary_color, bg_color)
       VALUES
        ('kinder', '2026 여름성경학교', '여름성경학교',
         '[{"id":"integrated_preschool","label":"통합미취학부"},{"id":"infant","label":"영유아부"},{"id":"kindergarten","label":"유치부"}]'::jsonb,
         '["SS","S","M","L","XL"]'::jsonb, '#EAB308', '#FEF08A'),
        ('kids', '2026 여름성경학교', '여름성경학교',
         '[{"id":"integrated_kids","label":"통합아동부"},{"id":"junior","label":"유년부"},{"id":"senior","label":"소년부"}]'::jsonb,
         '["SS","S","M","L","XL","2XL"]'::jsonb, '#3B82F6', '#DBEAFE'),
        ('teens', '2026 여름수련회', '여름수련회',
         '[{"id":"middle","label":"중등부"},{"id":"high","label":"고등부"}]'::jsonb,
         '["S","M","L","XL","2XL","3XL"]'::jsonb, '#22C55E', '#0F172A')
       ON CONFLICT (department) DO NOTHING`,
    ],
  },
  {
    version: 7,
    description: 'Add step recruitment flag, tshirt deadline, and partial attendance reason',
    up: [
      `ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS is_step_recruitment_active BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS tshirt_deadline TIMESTAMP`,
      `ALTER TABLE application_children ADD COLUMN IF NOT EXISTS partial_attendance_reason TEXT`,
    ],
  },
  {
    version: 8,
    description: 'Drop payment_status table',
    up: [
      `DROP TABLE IF EXISTS payment_status CASCADE`,
    ],
  },
  {
    version: 9,
    description: 'Add staff application tables (multi-camp, full/partial attendance)',
    up: [
      `CREATE TABLE IF NOT EXISTS staff_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS staff_application_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_application_id UUID NOT NULL REFERENCES staff_applications(id) ON DELETE CASCADE,
        department VARCHAR(50) NOT NULL,
        attendance_type VARCHAR(20) NOT NULL DEFAULT 'full',
        attended_sessions JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (staff_application_id, department)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_staff_entries_app ON staff_application_entries(staff_application_id)`,
      `CREATE INDEX IF NOT EXISTS idx_staff_entries_dept ON staff_application_entries(department)`,
    ],
  },
  {
    version: 10,
    description: 'Add per-department waterpark toggle and custom info to event_configs',
    up: [
      // 기존 동작 보존을 위해 디폴트 활성화
      `ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS is_waterpark_active BOOLEAN DEFAULT TRUE`,
      `ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS waterpark_info JSONB DEFAULT '{}'::jsonb`,
    ],
  },
];

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT PRIMARY KEY,
      description TEXT,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function runMigrations() {
  await ensureMigrationsTable();
  const applied = await queryMany(`SELECT version FROM schema_migrations`);
  const appliedVersions = new Set(applied.map((r: any) => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;
    console.log(`▶ Migration v${migration.version}: ${migration.description}`);
    for (const stmt of migration.up) {
      await query(stmt);
    }
    await query(
      `INSERT INTO schema_migrations (version, description) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [migration.version, migration.description]
    );
    console.log(`✓ Migration v${migration.version} applied`);
  }
}

// ============================================================
// 데이터베이스 초기화 (테이블 생성)
// ============================================================
export async function initializeDatabase() {
  try {
    console.log('🔄 PostgreSQL 테이블 생성 중...');

    // 1. 요금 설정
    await query(`
      CREATE TABLE IF NOT EXISTS fees_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kinder DECIMAL(10, 2) DEFAULT 10000,
        kids DECIMAL(10, 2) DEFAULT 15000,
        teens DECIMAL(10, 2) DEFAULT 20000,
        parent_waterpark DECIMAL(10, 2) DEFAULT 30000,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. 이벤트 설정
    await query(`
      CREATE TABLE IF NOT EXISTS event_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        department VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(255),
        event_type VARCHAR(100),
        subtitle TEXT,
        scripture TEXT,
        primary_color VARCHAR(7),
        bg_color VARCHAR(7),
        sub_departments JSONB DEFAULT '[]',
        events JSONB DEFAULT '[]',
        tshirt_sizes JSONB DEFAULT '["S","M","L","XL","2XL","3XL"]',
        custom_field_mappings JSONB DEFAULT '[]',
        camp_start_date DATE,
        camp_schedule JSONB DEFAULT '[]',
        camp_type VARCHAR(50) DEFAULT 'continuous',
        camp_duration INT DEFAULT 3,
        poster_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. 신청서
    await query(`
      CREATE TABLE IF NOT EXISTS applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_name VARCHAR(100) NOT NULL,
        parent_phone VARCHAR(20) NOT NULL,
        depositor_name VARCHAR(100) NOT NULL,
        grand_total DECIMAL(10, 2) DEFAULT 0,
        waterfall_parents JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. 자녀 정보
    await query(`
      CREATE TABLE IF NOT EXISTS application_children (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        birth_date DATE NOT NULL,
        gender VARCHAR(10),
        department VARCHAR(50) NOT NULL,
        sub_department VARCHAR(50) NOT NULL,
        tshirt_size VARCHAR(10),
        allergies TEXT,
        custom_allergy VARCHAR(255),
        attends_waterpark BOOLEAN DEFAULT FALSE,
        custom_1 TEXT, custom_2 TEXT, custom_3 TEXT, custom_4 TEXT, custom_5 TEXT,
        custom_6 TEXT, custom_7 TEXT, custom_8 TEXT, custom_9 TEXT, custom_10 TEXT,
        custom_11 TEXT, custom_12 TEXT, custom_13 TEXT, custom_14 TEXT, custom_15 TEXT,
        custom_16 TEXT, custom_17 TEXT, custom_18 TEXT, custom_19 TEXT, custom_20 TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_children_application_id ON application_children(application_id);
      CREATE INDEX IF NOT EXISTS idx_children_department ON application_children(department);
    `);

    // 5. 행사 참석 현황
    await query(`
      CREATE TABLE IF NOT EXISTS event_attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        child_id UUID NOT NULL REFERENCES application_children(id) ON DELETE CASCADE,
        event_id VARCHAR(100) NOT NULL,
        event_title VARCHAR(255),
        attendance_type VARCHAR(20) NOT NULL,
        partial_dates JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_event_attendance_child ON event_attendance(child_id);
      CREATE INDEX IF NOT EXISTS idx_event_attendance_event ON event_attendance(event_id);
    `);

    // 결제 상태 테이블 생성 구문 삭제됨 (v8 마이그레이션에서 DROP)

    // 7. 기본 부서 설정 시드 (한글 정상 표기)
    await query(`
      INSERT INTO event_configs (department, title, event_type, sub_departments, tshirt_sizes, primary_color, bg_color)
      VALUES
        ('kinder', '2026 여름성경학교', '여름성경학교',
         '[{"id":"integrated_preschool","label":"통합미취학부"},{"id":"infant","label":"영유아부"},{"id":"kindergarten","label":"유치부"}]'::jsonb,
         '["SS","S","M","L","XL"]'::jsonb, '#EAB308', '#FEF08A'),
        ('kids', '2026 여름성경학교', '여름성경학교',
         '[{"id":"integrated_kids","label":"통합아동부"},{"id":"junior","label":"유년부"},{"id":"senior","label":"소년부"}]'::jsonb,
         '["SS","S","M","L","XL","2XL"]'::jsonb, '#3B82F6', '#DBEAFE'),
        ('teens', '2026 여름수련회', '여름수련회',
         '[{"id":"middle","label":"중등부"},{"id":"high","label":"고등부"}]'::jsonb,
         '["S","M","L","XL","2XL","3XL"]'::jsonb, '#22C55E', '#0F172A')
      ON CONFLICT (department) DO NOTHING
    `);

    // 8. 기본 요금 시드
    await query(`
      INSERT INTO fees_config (kinder, kids, teens, parent_waterpark)
      SELECT 10000, 15000, 20000, 30000
      WHERE NOT EXISTS (SELECT 1 FROM fees_config)
    `);

    // 9. 마이그레이션 실행
    await runMigrations();

    console.log('✅ PostgreSQL 테이블 생성 및 마이그레이션 완료!');
    return true;
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 오류:', error);
    throw error;
  }
}

export default pool;

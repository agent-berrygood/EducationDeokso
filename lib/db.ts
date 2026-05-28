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

// 데이터베이스 초기화 (테이블 생성)
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

    // 6. 결제 상태
    await query(`
      CREATE TABLE IF NOT EXISTS payment_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
        kinder_paid BOOLEAN DEFAULT FALSE,
        kids_paid BOOLEAN DEFAULT FALSE,
        teens_paid BOOLEAN DEFAULT FALSE,
        waterpark_paid BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('??PostgreSQL ???????? ???!');

    await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS camp_start_date DATE`);
    await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS camp_schedule JSONB DEFAULT '[]'`);
    await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS camp_type VARCHAR(50) DEFAULT 'continuous'`);
    await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS camp_duration INT DEFAULT 3`);
    await query(`ALTER TABLE event_configs ADD COLUMN IF NOT EXISTS poster_url TEXT`);

    await query(`
      INSERT INTO event_configs (department, title, event_type, sub_departments, tshirt_sizes, primary_color, bg_color)
      VALUES
        ('kinder', '2026 ?????? ?????????', '?????????',
         '[{"id":"integrated_preschool","label":"?????????"},{"id":"infant","label":"??????"},{"id":"kindergarten","label":"?????"}]',
         '["SS","S","M","L","XL"]', '#EAB308', '#FEF08A'),
        ('kids', '2026 ?????? ?????????', '?????????',
         '[{"id":"integrated_kids","label":"????????"},{"id":"junior","label":"?????"},{"id":"senior","label":"?????"}]',
         '["SS","S","M","L","XL","2XL"]', '#3B82F6', '#DBEAFE'),
        ('teens', '2026 ?????? ????????', '????????',
         '[{"id":"middle","label":"?????"},{"id":"high","label":"?????"}]',
         '["S","M","L","XL","2XL","3XL"]', '#22C55E', '#0F172A')
      ON CONFLICT (department) DO NOTHING
    `);

    console.log('✅ PostgreSQL 테이블 생성 완료!');
    return true;
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 오류:', error);
    throw error;
  }
}

export default pool;

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: '파일이 제공되지 않았습니다.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // public/uploads 폴더 생성 및 저장
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // 고유 파일 이름 생성
    const uniqueFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const filePath = join(uploadDir, uniqueFilename);
    
    await writeFile(filePath, buffer);
    const posterUrl = `/uploads/${uniqueFilename}`;

    return NextResponse.json({ success: true, url: posterUrl });
  } catch (error) {
    console.error('파일 업로드 오류:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  const formData = await req.formData();
  const projectId = formData.get('projectId') as string;
  const files = formData.getAll('files') as File[];

  if (!projectId || files.length === 0) {
    return NextResponse.json({ error: 'Missing projectId or files' }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', projectId);
  fs.mkdirSync(uploadDir, { recursive: true });

  const results = await Promise.all(
    files.map(async (file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const storedFilename = `${uuidv4()}.${ext}`;
      const filePath = path.join(uploadDir, storedFilename);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      return {
        id: uuidv4(),
        filename: file.name,
        storedFilename,
        path: `/uploads/${projectId}/${storedFilename}`,
        fileSizeBytes: file.size,
        format: ext,
      };
    })
  );

  return NextResponse.json(results);
}

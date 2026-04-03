import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface PhotoInput {
  id: number;
  url: string;
  width: number;
  height: number;
  alt: string;
}

export async function POST(req: Request) {
  const { photos, projectId } = await req.json() as { photos: PhotoInput[]; projectId: string };

  if (!projectId || !photos?.length) {
    return NextResponse.json({ error: 'Missing projectId or photos' }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', projectId);
  fs.mkdirSync(uploadDir, { recursive: true });

  const results = await Promise.allSettled(
    photos.map(async (photo) => {
      const storedFilename = `pexels-${photo.id}-${uuidv4()}.jpg`;
      const filePath = path.join(uploadDir, storedFilename);

      const res = await fetch(photo.url);
      if (!res.ok) throw new Error(`Failed to fetch ${photo.url}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      return {
        id: uuidv4(),
        filename: photo.alt ? `${photo.alt.slice(0, 40)}.jpg` : storedFilename,
        storedFilename,
        path: `/uploads/${projectId}/${storedFilename}`,
        fileSizeBytes: buffer.length,
        format: 'jpg',
        width: photo.width,
        height: photo.height,
      };
    })
  );

  const successful = results
    .filter((r): r is PromiseFulfilledResult<ReturnType<typeof Object.assign>> => r.status === 'fulfilled')
    .map((r) => r.value);

  return NextResponse.json(successful);
}

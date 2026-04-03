import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  src: { large: string; medium: string };
}

const MODEL_BEST_PRACTICES: Record<string, string> = {
  'lifestyle-photography': 'clear in-focus people, natural lighting, varied poses, no large group shots, person fills most of the frame',
  'photorealistic-portraiture': 'sharp well-lit close-up portraits, single subject, multiple angles, clean or simple backgrounds',
  'still-life-product': 'even studio lighting, clean backgrounds (white/neutral), isolated product, no clutter',
  'character-development': 'illustrated or stylized characters, accurate anatomy, consistent art style, varied poses',
  'iconography-graphics': 'clean vector-style icons, consistent stroke width, simple shapes, single item per image',
  '3d-isometric': '3D rendered objects or scenes, consistent lighting direction, cohesive color palette',
};

export async function POST(req: Request) {
  const { description, modelType, keyTerm, page = 1 } = await req.json();

  const bestPractices = MODEL_BEST_PRACTICES[modelType] ?? 'high quality, well-lit, clear subject';

  // Ask Groq to generate targeted Pexels search queries
  const queryResponse = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are an expert at finding training images for Adobe Firefly custom models.

Model type: ${modelType}
${keyTerm ? `Subject key term: ${keyTerm}` : ''}
User description: "${description}"
Best practices for this model type: ${bestPractices}

Generate 5 specific Pexels search queries that would return the best training images. Each query should be 2-5 words targeting slightly different angles of the subject.

Return ONLY valid JSON: { "queries": ["query1", "query2", "query3", "query4", "query5"], "explanation": "One sentence on why these images will work well for training." }`,
      },
    ],
  });

  const raw = queryResponse.choices[0]?.message?.content ?? '{}';
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  let queries: string[] = [];
  let explanation = '';
  try {
    const parsed = JSON.parse(cleaned);
    queries = parsed.queries ?? [];
    explanation = parsed.explanation ?? '';
  } catch {
    queries = [description];
  }

  if (!process.env.PEXELS_API_KEY || process.env.PEXELS_API_KEY === 'your_pexels_api_key_here') {
    return NextResponse.json(
      { error: 'PEXELS_API_KEY is not configured. Add it to .env.local — free at pexels.com/api' },
      { status: 503 }
    );
  }

  // Fetch from Pexels for each query (5 per query = ~25 total)
  const perQuery = 5;
  const photoMap = new Map<number, PexelsPhoto>();

  await Promise.all(
    queries.map(async (query, i) => {
      try {
        const res = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perQuery}&page=${page + i}`,
          { headers: { Authorization: process.env.PEXELS_API_KEY! } }
        );
        const data = await res.json();
        for (const photo of data.photos ?? []) {
          photoMap.set(photo.id, {
            id: photo.id,
            width: photo.width,
            height: photo.height,
            alt: photo.alt ?? query,
            photographer: photo.photographer,
            src: { large: photo.src.large, medium: photo.src.medium },
          });
        }
      } catch {
        // skip failed query
      }
    })
  );

  const photos = Array.from(photoMap.values());
  return NextResponse.json({ queries, explanation, photos });
}

import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

/** Try direct parse first; fall back to extracting the outermost { … } from the raw text. */
function extractJson(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error('No JSON object found in model response');
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { assetPath, modelType, keyTerm } = body as { assetPath: string; modelType: string; keyTerm?: string };

  const filePath = path.join(process.cwd(), 'public', assetPath);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const imageBuffer = fs.readFileSync(filePath);
  const base64 = imageBuffer.toString('base64');
  const ext = assetPath.split('.').pop()?.toLowerCase();
  const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const keyTermInstruction = keyTerm
    ? `\nIMPORTANT: This is a subject model with the key term "${keyTerm}". The caption and reversedPrompt MUST include "${keyTerm}" naturally as the subject identifier — e.g. "photo of ${keyTerm}, ..." or "${keyTerm} wearing ...". Every caption and prompt for this model's training assets must reference this key term so the model learns to associate it with the subject.`
    : '';

  const prompt = `You are an expert visual analyst describing a training image for an Adobe Firefly "${modelType}" custom model.${keyTermInstruction}

Your job is to describe ONLY what you observe in the image — never use words like "generate", "create", "render", "style of", or any instructional language. Every descriptor must state what IS in the image.

The "caption" is your most critical output. It must be a long comma-separated string of purely observational descriptors covering these five layers in order:

1. SUBJECT — every visible physical detail of the main subject: specific materials, textures, surface finishes, colors, wear, reflections, clothing, expression, pose, body language, distinguishing features
2. SETTING — exact description of the environment, background elements, props, surfaces, location
3. STYLE — the photographic or artistic medium exactly as it appears: film type, rendering style, post-processing visible
4. COMPOSITION — shot type, camera angle, where the subject sits in frame, depth of field, any leading lines or geometric elements
5. ATMOSPHERE — every light source and its direction/quality, shadow behavior, highlight behavior, rim or fill lighting, the full color palette with specific tone names, mood and emotional quality of the image

Reference format to mirror exactly (if a key term like "sks person" were used, the caption would open with "photo of sks person," followed by all descriptors):
"glossy black helmet, intricate metallic respirator mask with vertical grilles, two small silver cylindrical details on the lower mask, textured dark fabric cape draped over shoulders, subtle wear and reflections on the helmet's surface, high-contrast black and white photography, sharp focus, cinematic style, minimalist indoor display setting, plain light grey wall in the blurred background, faint vertical lines on the left background, dramatic harsh directional lighting from the upper left, stark highlights on the helmet's polished surface, deep impenetrable shadows under the visor and on the right side, subtle rim lighting along the right edge of the helmet, monochromatic palette of deep obsidian blacks, reflective silvers, and stark whites, various shades of cool grey, imposing, formidable, iconic, menacing, mysterious, powerful mood, medium close-up shot, helmet angled slightly to the left, dominating the central and right portions of the frame, upper torso and cape visible in the lower foreground, shallow depth of field with a softly blurred background, strong diagonal lines from the helmet's structure"

Rules:
- Every item is a noun phrase or adjective phrase describing something visible — no verbs, no instructions
- Name specific colors (not just "dark" — say "deep obsidian black", "warm amber", "muted sage green")
- Name specific materials and finishes ("brushed aluminium", "glossy lacquer", "coarse linen weave")
- Name every light source behavior you can see ("soft diffused fill light from the left", "harsh specular highlight on the right cheekbone")
- 80-150 descriptors total

Return ONLY valid JSON (no markdown, no explanation before or after):
{
  "caption": "<80-150 comma-separated observational descriptors: Subject → Setting → Style → Composition → Atmosphere>",
  "description": "3-5 factual sentences describing exactly what is shown — subject, environment, visual style, lighting, and mood. No generative language.",
  "reversedPrompt": "A 120-180 word prompt written as comma-separated observational phrases that fully describe this image. Cover subject details, environment, lighting, color palette, style, and composition. No instructional language — only descriptive.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "qualityScore": <0-100>,
  "aiNotes": ["specific quality or composition issue observed"],
  "lightingNotes": "Describe every visible light source, its direction, quality, and effect on the subject and background.",
  "compositionNotes": "Shot type, camera angle, subject placement in frame, depth of field, and notable compositional elements."
}

tags: 4-6 permanent visual attributes (specific colors, textures, materials, styles — no actions).
aiNotes: Only real problems visible (motion blur, harsh uncontrolled shadows, subject too small, distracting background, heavy colour grading, low sharpness). Empty array [] if the image is clean.
qualityScore: Start 100. Deduct: blur -20, low apparent resolution -15, harsh shadows -10, overcrowded scene -15, subject too small -15, heavy filters -10, inconsistent style -10, obstructed subject -10.`;

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? '';
      const data = extractJson(raw);
      return NextResponse.json(data);
    } catch (err) {
      console.error(`Analyze attempt ${attempt} failed:`, err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      } else {
        return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
}

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

/**
 * Returns model-type-specific caption guidance per Adobe Firefly best practices.
 * Caption goal: ≤15-18 words, direct language matching what you'd type as a prompt later.
 * Framework: Object/Concept → Detail → Scene/Context → Style (include only what matters).
 */
function getCaptionGuidance(modelType: string, keyTerm?: string): string {
  const isSubject = !!keyTerm;

  if (isSubject) {
    // Subject models: concept token MUST appear in every caption.
    // Template varies by model type but always starts with the concept (keyTerm).
    switch (modelType) {
      case 'photorealistic-portraiture':
      case 'character-development':
        return `CAPTION RULES — Subject model (person/character):
Template: {concept}, [1-2 stable physical traits], [action or pose], [setting]
The concept token "${keyTerm}" MUST be the first element.
Focus on: identity + stable distinguishing traits + what they are doing + where.
Example: "${keyTerm}, young woman with curly red hair, laughing with friends at an outdoor café"
Example: "${keyTerm}, older man with grey beard and glasses, seated at a desk in a warm study"
≤15 words total. Vary the sentence structure across images — do NOT use a fixed opening phrase every time.`;

      case 'lifestyle-photography':
        return `CAPTION RULES — Subject model (lifestyle person):
Template: {concept}, [1-2 key stable traits], [action/pose], [setting and context]
The concept token "${keyTerm}" MUST be the first element.
Focus on: the recurring subject identity + what they are doing + the lifestyle setting.
Example: "${keyTerm}, tall man in casual denim jacket, walking through a sunlit city street"
Example: "${keyTerm}, smiling woman with short dark hair, cooking in a bright modern kitchen"
≤15 words total. Vary structure — no fixed boilerplate opener or closer.`;

      case 'still-life-product':
        return `CAPTION RULES — Subject model (product/object):
Template: {concept}, [material and color], [orientation or use], [background or setting]
The concept token "${keyTerm}" MUST be the first element.
Focus on: product identity + key material/color attributes + how it is positioned or used.
Example: "${keyTerm}, brushed stainless steel, upright on a white marble surface, soft studio lighting"
Example: "${keyTerm}, deep red canvas texture, folded neatly on a pale wooden shelf"
≤18 words total. Do not repeat the exact phrase structure in every caption.`;

      default:
        // Fallback for any subject model
        return `CAPTION RULES — Subject model:
Template: {concept}, [key visual trait], [action or context], [setting]
The concept token "${keyTerm}" MUST be the first element — this is required for Firefly training.
Write what you would actually type as a generation prompt.
≤15 words total. Vary sentence structure across images.`;
    }
  } else {
    // Style models: focus on look/feel, no fixed concept token.
    // Avoid repeating the same fixed phrase in every caption.
    switch (modelType) {
      case 'lifestyle-photography':
        return `CAPTION RULES — Style model (photographic lifestyle look):
Template: photo, [color palette/tone], [lighting quality], [composition], [generic subject placeholder]
Focus on: the visual aesthetic — palette, light, depth of field, composition. The subject is a placeholder.
Example: "photo, warm neutral tones, soft window light, shallow depth of field, candid people in modern office"
Example: "photo, cool muted blues, harsh midday sun, wide angle, family on a rocky shoreline"
≤18 words. Vary the palette/mood/subject placeholder each caption — do NOT repeat "the image shows…"`;

      case 'iconography-graphics':
        return `CAPTION RULES — Style model (iconography/graphic):
Template: [medium/format], [stroke or line quality], [color palette], [shape language], [generic subject]
Put the medium first. Focus on: stroke weight, palette, corner style, abstraction level.
Example: "monoline vector icon, 2px stroke, rounded corners, dark teal on transparent background, simple arrow shape"
Example: "flat vector graphic, bold outlines, limited two-color palette, geometric shapes, abstract location pin"
≤18 words. Vary the subject/shape placeholder — do not lock in one phrase like "icon of a…"`;

      case '3d-isometric':
        return `CAPTION RULES — Style model (3D/isometric):
Template: isometric 3D render, [palette], [lighting style], [texture/material quality], [generic scene subject]
Put the medium first. Focus on: render style, palette, lighting, surface quality.
Example: "isometric 3D render, soft pastel palette, gentle ambient occlusion, clean hard edges, small office building"
Example: "isometric 3D illustration, bold primary colors, flat shading, minimal texture, city intersection scene"
≤18 words. Vary the scene subject placeholder each caption.`;

      default:
        return `CAPTION RULES — Style model:
Template: [medium/style descriptor], [color palette], [lighting or texture], [composition], [generic subject placeholder]
Put the medium or style first. Focus on the aesthetic, not a fixed subject.
≤18 words. Vary structure and subject placeholder across captions.`;
    }
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

  const captionGuidance = getCaptionGuidance(modelType, keyTerm);

  const prompt = `You are an expert Adobe Firefly custom model trainer analyzing a training image for a "${modelType}" model.

${captionGuidance}

GLOBAL CAPTION RULES (from Adobe Firefly best practices):
- ≤15-18 words total — longer "essay" captions hurt model performance and cause overfitting
- Write in direct, concrete language — exactly what you'd type later as a generation prompt
- Use consistent vocabulary for key concepts (pick one term and stick with it)
- No flowery or abstract wording; no marketing copy; no "the image shows…" openers
- No fixed boilerplate phrases that would appear in every caption (these get over-weighted)
- Each caption must reflect what is actually unique and important in THIS specific frame

The caption goes directly into Firefly's training UI. Keep it focused and prompt-like.

The "reversedPrompt" is separate from the caption — it is a detailed 120-180 word generation prompt for our internal analysis tool, covering all visual details exhaustively (subject, environment, lighting, palette, style, composition, mood). This can be long and descriptive.

Return ONLY valid JSON (no markdown, no explanation before or after):
{
  "caption": "<≤15-18 word training caption following the template above — prompt-like, concrete, varied>",
  "description": "3-5 factual sentences describing exactly what is shown — subject, environment, visual style, lighting, and mood. No generative language.",
  "reversedPrompt": "A 120-180 word prompt written as comma-separated observational phrases fully describing this image. Cover: subject identity and details, environment/setting, lighting direction and quality, color palette with specific tone names, visual style/medium, composition/shot type, mood/atmosphere. No instructional language — purely descriptive.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "qualityScore": <0-100>,
  "aiNotes": ["specific quality or composition issue observed"],
  "lightingNotes": "Every visible light source, its direction, quality, and effect on subject and background.",
  "compositionNotes": "Shot type, camera angle, subject placement in frame, depth of field, notable compositional elements."
}

tags: 4-6 permanent visual attributes (specific colors, textures, materials, medium — no actions or verbs).
aiNotes: Only real visible problems (motion blur, harsh shadows, subject too small, distracting background, heavy grading, low sharpness). Empty array [] if clean.
qualityScore: Start 100. Deduct: blur -20, low resolution -15, harsh uncontrolled shadows -10, overcrowded -15, subject too small -15, heavy filters -10, inconsistent style -10, obstructed subject -10.`;

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

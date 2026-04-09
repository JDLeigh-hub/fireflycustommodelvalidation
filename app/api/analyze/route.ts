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
    switch (modelType) {
      case 'photoshoot-person':
        return `CAPTION RULES — Subject model (specific person):
Template: {concept}, [1-2 stable physical traits], [action or pose], [setting]
The concept token "${keyTerm}" MUST be the first element.
Focus on: identity + stable distinguishing traits + what they are doing + where.
Example: "${keyTerm}, young woman with curly red hair, laughing with friends at an outdoor café"
Example: "${keyTerm}, older man with grey beard and glasses, seated at a desk in a warm study"
≤15 words total. Vary sentence structure across images — do NOT use a fixed opener every time.`;

      case 'custom-subject':
        return `CAPTION RULES — Custom subject model (product/object/character):
Template: {concept}, [material and color or key trait], [orientation/use or action], [background or setting]
The concept token "${keyTerm}" MUST be the first element — Firefly will warn or block training if it is missing.
Focus on: subject identity + stable material/color attributes + how it is used or positioned.
Example: "${keyTerm}, brushed stainless steel, upright on a white marble surface, soft studio lighting"
Example: "${keyTerm}, small cream terrier, sitting on a couch in a modern living room"
≤18 words total. Use the SAME concept token in every caption — do not vary the name.`;

      default:
        return `CAPTION RULES — Subject model:
Template: {concept}, [key visual trait], [action or context], [setting]
The concept token "${keyTerm}" MUST be the first element — required for Firefly training.
Write what you would actually type as a generation prompt.
≤15 words total. Vary sentence structure across images.`;
    }
  } else {
    switch (modelType) {
      case 'lifestyle-photography':
        return `CAPTION RULES — Lifestyle photography style model:
Template: photo, [color palette/tone], [lighting quality], [composition], [generic subject placeholder]
Focus on: the visual aesthetic — palette, light, depth of field, mood. Subject is a generic placeholder.
Example: "photo, warm neutral tones, soft window light, shallow depth of field, candid people in modern office"
Example: "photo, cool muted blues, harsh midday sun, wide angle, family on a rocky shoreline"
≤18 words. Vary palette/mood/subject placeholder each caption — no fixed boilerplate opener.`;

      case 'still-life-photography':
        return `CAPTION RULES — Still life photography style model:
Template: photo, [subject or product type], [material or texture], [background], [lighting]
Focus on: product/object form, material quality, background simplicity, lighting.
Example: "photo, ceramic coffee mug, warm earth tones, soft white background, diffused studio light"
Example: "photo, glass perfume bottle, smooth transparent surface, dark marble surface, dramatic side lighting"
≤18 words. Vary the product/object type and background each caption.`;

      case 'illustrated-character':
        return `CAPTION RULES — Illustrated character style model:
Template: [illustration medium], [character description], [pose or action], [setting or context]
Put the medium first. Focus on rendering style, character traits, and pose variety.
Example: "flat vector illustration, round cartoon character with big eyes, waving, simple outdoor scene"
Example: "bold line illustration, friendly animal mascot, sitting and reading, cozy library background"
≤18 words. Vary pose and context — keep the rendering style consistent.`;

      case 'iconography':
        return `CAPTION RULES — Iconography style model:
Template: [medium/format], [stroke or line quality], [color palette], [shape language], [generic icon subject]
Put the medium first. Focus on: stroke weight, palette, corner style, abstraction level.
Example: "monoline vector icon, 2px stroke, rounded corners, dark teal on transparent background, simple arrow"
Example: "flat vector icon, bold outlines, two-color palette, geometric shapes, abstract location pin"
≤18 words. Vary the icon subject placeholder — do not repeat "icon of a…" every time.`;

      case 'illustrations':
        return `CAPTION RULES — Illustrations style model:
Template: [illustration medium], [color palette], [line and texture quality], [generic subject or scene]
Put the medium first. Focus on: artistic medium, palette, line quality, abstraction level.
Example: "watercolor illustration, soft muted palette, loose brushwork, people walking in a park"
Example: "digital editorial illustration, bold primary colors, clean flat shapes, urban street scene"
≤18 words. Vary the scene subject each caption while keeping medium and palette consistent.`;

      case 'isometric-3d':
        return `CAPTION RULES — Isometric and 3D graphics style model:
Template: isometric 3D [render/illustration], [palette], [lighting style], [surface quality], [generic scene]
Put the medium first. Focus on: render style, palette, lighting, surface/material quality.
Example: "isometric 3D render, soft pastel palette, gentle ambient occlusion, clean hard edges, small office building"
Example: "isometric 3D illustration, bold primary colors, flat shading, minimal texture, city intersection scene"
≤18 words. Vary the scene subject each caption.`;

      case 'brand-expressions':
        return `CAPTION RULES — Brand expressions style model:
Template: [medium], [brand color palette], [mood or tone], [composition], [generic brand scene]
Focus on: the visual language, palette, mood, and aesthetic range of the brand.
Example: "photo, deep navy and warm gold palette, confident editorial mood, wide angle, professional workspace"
Example: "graphic, muted sage and cream tones, minimal clean layout, bold typography, product lifestyle scene"
≤18 words. Vary mood and scene — capture the breadth of the brand aesthetic.`;

      case 'product-backgrounds':
        return `CAPTION RULES — Product shot backgrounds style model:
Template: [background type], [color or texture], [lighting style], [depth or atmosphere], [surface detail]
Focus on: background environment, texture, color, and lighting — product is not present.
Example: "studio background, soft warm white gradient, diffused overhead light, subtle grain texture, clean surface"
Example: "lifestyle backdrop, deep forest green, dappled natural light, shallow depth of field, wooden surface"
≤18 words. Vary color, texture, and lighting — no product in the caption.`;

      case 'custom-style':
        return `CAPTION RULES — Custom style model:
Template: [medium/style descriptor], [color palette], [lighting or texture], [composition], [generic subject placeholder]
Put the medium or style first. Focus entirely on the aesthetic — subject is a generic placeholder.
Example: "photo, warm film grain, golden hour backlighting, shallow depth of field, person in open field"
Example: "flat vector illustration, limited earth tone palette, bold outlines, minimal detail, abstract nature scene"
≤18 words. Vary the subject placeholder across captions — the style is what the model learns.`;

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

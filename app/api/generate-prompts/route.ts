import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type { IdealPrompt } from '@/lib/types';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const body = await req.json();
  const { modelType, assetCaptions, reversedPrompts, expectedOutcome, projectName } = body as {
    modelType: string;
    assetCaptions: string[];
    reversedPrompts: string[];
    expectedOutcome: string;
    projectName: string;
  };

  const userPrompt = `You are an expert in Adobe Firefly custom model training. Generate 4-5 ideal image generation prompts for a custom model with these details:

Model name: "${projectName}"
Model type: ${modelType}
Expected outcome: ${expectedOutcome}

Sample captions from training assets (visual vocabulary reference):
${assetCaptions.slice(0, 5).map((c, i) => `${i + 1}. ${c}`).join('\n')}

Reverse-engineered prompts from training assets (USE THESE AS THE DEPTH AND FORMAT BENCHMARK — your generated prompts must match this level of detail):
${reversedPrompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Return ONLY a valid JSON array (no markdown) with this structure:
[
  {
    "prompt": "The full generation prompt to use with this custom model. Must be 120-180 words of comma-separated observational phrases covering: subject identity/details, environment/setting, lighting direction and quality, color palette with specific tone names, visual style/medium, composition/shot type, mood/atmosphere. Mirror the depth and vocabulary of the sample reverse-engineered prompts above.",
    "focus": "One-line description of what this prompt focuses on",
    "rationale": "2-3 sentences explaining why this prompt works well with this model and what result it will produce",
    "breakdown": [
      {
        "text": "exact phrase or clause from the prompt",
        "role": "one of: subject | style | environment | lighting | mood | composition | quality",
        "lesson": "1 sentence teaching the user WHY this phrase type matters and how to write it well"
      }
    ]
  }
]

Guidelines:
- Include words/phrases from the training captions to activate the model's learned identity
- Vary the scenarios: different settings, lighting, moods, compositions
- For subject models: vary poses, environments, and contexts
- For style models: vary subjects while maintaining the learned style
- For object models: vary contexts and use-cases
- Each prompt should have a distinct creative angle

Breakdown guidelines:
- Every word in the prompt must belong to exactly one breakdown segment — no gaps, no overlaps
- Use 4-8 segments per prompt that reflect natural phrase boundaries
- role definitions: subject = who/what is depicted; style = medium, aesthetic, render style; environment = location, background, setting; lighting = light sources, quality, direction; mood = emotional tone, atmosphere; composition = shot type, angle, framing, depth of field; quality = resolution, detail, finish descriptors
- lesson must be a teaching moment — explain the principle, not just what the phrase says`;

  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.choices[0]?.message?.content ?? '[]';
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const prompts = JSON.parse(cleaned) as IdealPrompt[];
    return NextResponse.json(prompts);
  } catch (err) {
    console.error('Generate prompts error:', err);
    return NextResponse.json({ error: 'Failed to generate prompts' }, { status: 500 });
  }
}

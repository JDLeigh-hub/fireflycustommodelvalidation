import Groq from 'groq-sdk';
import type { ChatMessage } from '@/lib/types';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, modelType, assetSummary, reversedPrompts } = body as {
    messages: ChatMessage[];
    modelType: string;
    assetSummary: string;
    reversedPrompts?: string[];
  };

  const reversedPromptSection = reversedPrompts?.length
    ? `\nReverse-engineered prompts from training assets (use these as the benchmark for prompt detail and vocabulary when writing example prompts):
${reversedPrompts.slice(0, 4).map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : '';

  const systemPrompt = `You are an Adobe Firefly generative AI expert helping a user build a generation brief for their custom-trained model.

Model type: ${modelType}
Training asset summary: ${assetSummary}${reversedPromptSection}

Your role:
1. Ask the user what they want to generate with this model — what scenes, outputs, and use cases
2. Dig into specifics: desired visual styles, environments, moods, lighting, color palettes, intended applications (ads, social, product shots, etc.)
3. Ask about creative range — do they want tight consistency or varied interpretations?
4. After 2-3 exchanges, synthesize a clear generation brief that will guide ideal prompt creation

When you write example prompts:
- Match the depth and vocabulary of the reverse-engineered training prompts above — 120-180 words each, comma-separated observational phrases
- Cover subject, environment, lighting direction and quality, color palette, style, composition, and mood
- Number each prompt on its own line preceded by a blank line, e.g.:

1. [full detailed prompt here]

2. [full detailed prompt here]

For conversational turns (questions, clarifications, summaries): keep replies concise, 2-4 sentences.
Frame everything around generation output, not training input. Start by asking what they want to create with this model.`;

  const apiMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const stream = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    stream: true,
    messages: [{ role: 'system', content: systemPrompt }, ...apiMessages],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

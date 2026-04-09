'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Upload, X, CheckCircle, AlertTriangle,
  AlertCircle, Sparkles, MessageSquare, Wand2, ChevronDown, ChevronUp,
  Copy, Check, Loader2, Camera, User, ShoppingBag, Laugh, Shapes, Boxes,
  Tag, Save, RefreshCw, Image, Palette, Globe, Package, Brush, Mountain,
} from 'lucide-react';
import type { ModelType, TrainingAsset, ChatMessage, IdealPrompt, PromptSegmentRole, ValidationIssue } from '@/lib/types';
import { validateAsset, validateDataset, computeAssetScore } from '@/lib/validation';
import { formatBytes, cn, scoreBg } from '@/lib/utils';

const STEPS = ['Setup', 'Upload', 'Validate', 'Analyze', 'Gen Brief', 'Prompts'];

const SEGMENT_ROLE_META: Record<PromptSegmentRole, { label: string; color: string; bg: string }> = {
  subject:     { label: 'Subject',     color: 'text-[#5258E4]',  bg: 'bg-[#EEF0FF] border-[#5258E4]/30' },
  style:       { label: 'Style',       color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  environment: { label: 'Environment', color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
  lighting:    { label: 'Lighting',    color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  mood:        { label: 'Mood',        color: 'text-rose-700',   bg: 'bg-rose-50 border-rose-200' },
  composition: { label: 'Composition', color: 'text-sky-700',    bg: 'bg-sky-50 border-sky-200' },
  quality:     { label: 'Quality',     color: 'text-gray-600',   bg: 'bg-gray-100 border-gray-300' },
};

const SUBJECT_TYPES = new Set<ModelType>([
  'photoshoot-person',
  'custom-subject',
]);

const MODEL_OPTIONS: {
  value: ModelType;
  label: string;
  description: string;
  icon: React.ElementType;
  examples: string;
  tip: string;
  requiresKeyTerm: boolean;
}[] = [
  {
    value: 'lifestyle-photography',
    label: 'Lifestyle Photography',
    description: 'Extend a photographic style with consistent aesthetic and people',
    icon: Camera,
    examples: 'Brand campaigns, editorial shoots, product-in-use scenes',
    tip: 'Use clear, in-focus people with natural lighting and varied poses.',
    requiresKeyTerm: false,
  },
  {
    value: 'photoshoot-person',
    label: 'Photoshoot of a Person',
    description: 'Generate new photos of a specific recurring person',
    icon: User,
    examples: 'Brand ambassador, talent library, consistent subject across contexts',
    tip: 'Sharp, well-lit shots from multiple angles. Concept token required.',
    requiresKeyTerm: true,
  },
  {
    value: 'still-life-photography',
    label: 'Still Life Photography',
    description: 'Maintain visual consistency across product and object shoots',
    icon: ShoppingBag,
    examples: 'Product catalog, food photography, packshot variations',
    tip: 'Even lighting, consistent style, white or neutral backgrounds recommended.',
    requiresKeyTerm: false,
  },
  {
    value: 'illustrated-character',
    label: 'Illustrated Character',
    description: 'Produce a consistent illustrated character across multiple contexts',
    icon: Laugh,
    examples: 'Brand mascots, game characters, illustrated personas',
    tip: 'Consistent rendering style, varied poses and expressions.',
    requiresKeyTerm: false,
  },
  {
    value: 'iconography',
    label: 'Iconography',
    description: 'Expand an existing icon set or UI icon library',
    icon: Shapes,
    examples: 'UI icon sets, brand icons, pictograms',
    tip: 'Consistent stroke weight, corner style, and color across all assets.',
    requiresKeyTerm: false,
  },
  {
    value: 'illustrations',
    label: 'Illustrations',
    description: 'Generate new illustrations that match an established graphic style',
    icon: Brush,
    examples: 'Editorial illustrations, infographic art, brand scenes',
    tip: 'Consistent medium, palette, and line quality across the set.',
    requiresKeyTerm: false,
  },
  {
    value: 'isometric-3d',
    label: 'Isometric and 3D Graphics',
    description: 'Generate graphics that maintain an established 3D visual system',
    icon: Boxes,
    examples: '3D renders, isometric scenes, brand expression graphics',
    tip: 'Cohesive styling, consistent lighting direction and color palette.',
    requiresKeyTerm: false,
  },
  {
    value: 'brand-expressions',
    label: 'Explore Brand Expressions',
    description: 'Explore visual variations that stay true to a brand aesthetic',
    icon: Palette,
    examples: 'Brand mood boards, campaign explorations, visual language extensions',
    tip: 'Capture a wide range of brand-consistent scenarios and color palettes.',
    requiresKeyTerm: false,
  },
  {
    value: 'product-backgrounds',
    label: 'Backgrounds for Product Shots',
    description: 'Create consistent background environments for product photography',
    icon: Mountain,
    examples: 'Lifestyle backdrops, studio textures, environmental backgrounds',
    tip: 'Vary the lighting and depth while keeping the aesthetic consistent.',
    requiresKeyTerm: false,
  },
  {
    value: 'custom-subject',
    label: 'Custom Subject',
    description: 'Train a model on a specific subject — requires a unique key term',
    icon: Tag,
    examples: 'Specific product, object, vehicle, logo, or character',
    tip: 'The key term must appear in every caption so Firefly links it to the subject.',
    requiresKeyTerm: true,
  },
  {
    value: 'custom-style',
    label: 'Custom Style',
    description: 'Teach the model a visual style without locking in a fixed subject',
    icon: Globe,
    examples: 'Photography aesthetic, illustration look, graphic design system',
    tip: 'Vary subjects across training images — the style is what the model learns.',
    requiresKeyTerm: false,
  },
];

interface UploadedFile {
  file: File;
  preview: string;
  width: number;
  height: number;
}

// ---- Helper components ----

function IssueRow({ issue }: { issue: ValidationIssue }) {
  return (
    <div className={cn('flex gap-3 p-3 rounded-lg text-sm', issue.level === 'error' ? 'bg-red-50' : 'bg-yellow-50')}>
      {issue.level === 'error'
        ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        : <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />}
      <div>
        <p className={cn('font-medium text-xs', issue.level === 'error' ? 'text-red-800' : 'text-yellow-800')}>{issue.message}</p>
        <p className={cn('text-xs mt-0.5', issue.level === 'error' ? 'text-red-600' : 'text-yellow-600')}>{issue.suggestion}</p>
      </div>
    </div>
  );
}

function AssetValidationCard({
  asset,
  onRemove,
  onReplace,
}: {
  asset: TrainingAsset;
  onRemove?: () => void;
  onReplace?: (file: File) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const hasDetails = asset.validationIssues.length > 0 || (asset.aiNotes?.length ?? 0) > 0 || asset.reversedPrompt;
  const hasIssues = asset.validationIssues.length > 0;

  function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onReplace) onReplace(file);
    e.target.value = '';
  }

  return (
    <div className={cn('bg-white rounded-xl border shadow-sm overflow-hidden',
      hasIssues
        ? asset.validationIssues.some(i => i.level === 'error') ? 'border-red-200' : 'border-yellow-200'
        : 'border-gray-100')}>
      <div className="flex items-center gap-3 p-4">
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer"
          onClick={() => hasDetails && setExpanded(!expanded)}>
          <img src={asset.path} alt={asset.filename} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => hasDetails && setExpanded(!expanded)}>
          <p className="font-medium text-sm text-[#1a1a2e] truncate">{asset.filename}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {asset.width > 0 ? `${asset.width}×${asset.height}px` : '–'} · {formatBytes(asset.fileSizeBytes)}
          </p>
          {asset.caption && (
            <div className="flex flex-wrap gap-1 mt-1.5 max-h-8 overflow-hidden">
              {asset.caption.split(',').slice(0, 6).map((tag, i) => tag.trim() && (
                <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full whitespace-nowrap">{tag.trim()}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {asset.status === 'analyzing' && <Loader2 className="w-4 h-4 text-[#5258E4] animate-spin" />}
          {asset.validationScore > 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreBg(asset.validationScore)}`}>
              {asset.validationScore}%
            </span>
          )}
          {hasDetails && (
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          {!hasDetails && asset.status !== 'analyzing' && <CheckCircle className="w-4 h-4 text-green-500" />}
        </div>
      </div>

      {/* Remove / Replace actions — shown when there are issues */}
      {hasIssues && (onRemove || onReplace) && (
        <div className="flex gap-2 px-4 pb-3">
          {onReplace && (
            <>
              <button onClick={() => replaceInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs bg-[#EEF0FF] hover:bg-[#5258E4] hover:text-white text-[#5258E4] px-3 py-1.5 rounded-lg font-medium transition-colors">
                <Upload className="w-3.5 h-3.5" /> Replace
              </button>
              <input ref={replaceInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleReplaceFile} />
            </>
          )}
          {onRemove && (
            <button onClick={onRemove}
              className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-500 hover:text-white text-red-500 px-3 py-1.5 rounded-lg font-medium transition-colors">
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          )}
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
          {asset.validationIssues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
          {asset.aiNotes?.map((note, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg bg-blue-50 text-sm">
              <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-blue-800">{note}</p>
            </div>
          ))}
          {asset.reversedPrompt && (
            <div className="mt-2 p-3 bg-[#EEF0FF] rounded-lg">
              <p className="text-xs font-semibold text-[#5258E4] mb-1">Reverse-engineered prompt</p>
              <p className="text-xs text-[#3a3f9e]">{asset.reversedPrompt}</p>
            </div>
          )}
          {asset.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {asset.tags.map((tag) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Analysis review card (editable) ----

function AnalysisReviewCard({
  asset,
  onChange,
  onRetry,
}: {
  asset: TrainingAsset;
  onChange: (field: keyof TrainingAsset, value: string) => void;
  onRetry: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
          <img src={asset.path} alt={asset.filename} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-[#1a1a2e] truncate">{asset.filename}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {asset.width > 0 ? `${asset.width}×${asset.height}px` : '–'} · {formatBytes(asset.fileSizeBytes)}
          </p>
          {asset.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {asset.tags.map((tag) => (
                <span key={tag} className="text-[10px] bg-[#EEF0FF] text-[#5258E4] px-2 py-0.5 rounded-full">{tag}</span>
              ))}
              <span
                title="Permanent visual attributes for this asset — copy these into Firefly's training UI alongside the caption. They help the model lock in stable traits like color, material, and style."
                className="text-[10px] text-gray-400 cursor-help px-1 py-0.5"
              >ⓘ</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {asset.status === 'analyzing' && (
            <Loader2 className="w-4 h-4 text-[#5258E4] animate-spin" />
          )}
          {asset.status === 'error' && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(asset.id); }}
              className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full hover:bg-red-100 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          )}
          {asset.validationScore > 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreBg(asset.validationScore)}`}>
              {asset.validationScore}%
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && asset.status === 'error' && (
        <div className="border-t border-gray-50 px-4 py-4 flex items-center gap-3 bg-red-50/50">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-600">Analysis failed for this asset. Click <strong>Retry</strong> to try again.</p>
        </div>
      )}

      {expanded && asset.status === 'analyzing' && (
        <div className="border-t border-gray-50 px-4 py-4 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-[#5258E4] animate-spin flex-shrink-0" />
          <p className="text-xs text-gray-500">Analyzing…</p>
        </div>
      )}

      {expanded && asset.status === 'complete' && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-4">

          {/* Caption — short Firefly training caption (≤15-18 words) */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-xs font-semibold text-[#5258E4]">Training caption</label>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">≤15–18 words</span>
              <span
                title="This caption goes directly into Firefly's training UI. Adobe best practices require short, prompt-like captions (≤15-18 words) — longer captions hurt model performance and cause overfitting to background details."
                className="text-gray-400 cursor-help text-xs leading-none"
              >ⓘ</span>
            </div>
            <textarea
              value={asset.caption}
              onChange={(e) => onChange('caption', e.target.value)}
              rows={2}
              placeholder="e.g. sks person, young woman with auburn hair, laughing at an outdoor café"
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-[#5258E4] leading-relaxed"
            />
            {asset.caption && (
              <p className={`text-[10px] mt-1 ${asset.caption.trim().split(/\s+/).length > 18 ? 'text-amber-600' : 'text-gray-400'}`}>
                {asset.caption.trim().split(/\s+/).length} words
                {asset.caption.trim().split(/\s+/).length > 18 && ' — consider shortening to ≤18 words'}
              </p>
            )}
          </div>

          {/* Description — factual sentences */}
          <div>
            <label className="block text-xs font-semibold text-[#5258E4] mb-1.5">
              Description <span className="font-normal text-gray-400">(factual summary — edit as needed)</span>
            </label>
            <textarea
              value={asset.description}
              onChange={(e) => onChange('description', e.target.value)}
              rows={3}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-[#5258E4] leading-relaxed"
            />
          </div>

          {/* Generation prompt — also editable */}
          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-[#5258E4] mb-1.5">
              Generation prompt <span className="font-normal text-gray-400">(used for ideal prompt generation)</span>
              <span
                title="Used in Step 5 to generate your ideal Firefly prompts — the AI reads all generation prompts across your asset set to understand the visual vocabulary of your model."
                className="text-gray-400 cursor-help leading-none"
              >ⓘ</span>
            </label>
            <textarea
              value={asset.reversedPrompt}
              onChange={(e) => onChange('reversedPrompt', e.target.value)}
              rows={4}
              className="w-full text-sm text-[#3a3f9e] bg-[#EEF0FF] border border-[#5258E4]/20 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-[#5258E4] font-mono leading-relaxed"
            />
          </div>

          {/* Lighting + composition notes */}
          {(asset.lightingNotes || asset.compositionNotes) && (
            <div className="grid grid-cols-2 gap-3">
              {asset.lightingNotes && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Lighting</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{asset.lightingNotes}</p>
                </div>
              )}
              {asset.compositionNotes && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Composition</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{asset.compositionNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* AI quality notes */}
          {asset.aiNotes?.length > 0 && (
            <div className="space-y-1.5">
              {asset.aiNotes.map((note, i) => (
                <div key={i} className="flex gap-2 p-2.5 rounded-lg bg-amber-50">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">{note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Prompt card with breakdown ----

// ---- Chat message formatter ----
// Detects numbered prompt blocks (lines starting with "1." "2." etc.) and
// renders each as a distinct card so multiple prompts don't collapse into a wall.

function parseChatBlocks(content: string): Array<{ type: 'text' | 'prompt'; number?: number; text: string }> {
  const blocks: Array<{ type: 'text' | 'prompt'; number?: number; text: string }> = [];
  // Split on blank lines to get paragraphs/groups
  const paragraphs = content.split(/\n{2,}/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    // Detect "N. text" or "N) text" at the start of the paragraph
    const match = trimmed.match(/^(\d+)[.)]\s+([\s\S]+)/);
    if (match) {
      blocks.push({ type: 'prompt', number: parseInt(match[1]), text: match[2].trim() });
    } else {
      // Check if it's a multi-line numbered block (number on first line, content on remaining)
      const lines = trimmed.split('\n');
      const firstLineMatch = lines[0].match(/^(\d+)[.)]\s*(.*)/);
      if (firstLineMatch) {
        const rest = [firstLineMatch[2], ...lines.slice(1)].join('\n').trim();
        blocks.push({ type: 'prompt', number: parseInt(firstLineMatch[1]), text: rest });
      } else {
        blocks.push({ type: 'text', text: trimmed });
      }
    }
  }
  return blocks;
}

function ChatMessageContent({ content }: { content: string }) {
  const blocks = parseChatBlocks(content);
  const hasPrompts = blocks.some((b) => b.type === 'prompt');

  if (!hasPrompts) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  return (
    <div className="space-y-2 w-full">
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          return block.text ? (
            <p key={i} className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{block.text}</p>
          ) : null;
        }
        return (
          <div key={i} className="bg-white border border-[#5258E4]/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 bg-[#EEF0FF] text-[#5258E4] rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {block.number}
              </span>
              <span className="text-[10px] font-semibold text-[#5258E4] uppercase tracking-wide">Prompt</span>
            </div>
            <p className="text-xs text-[#3a3f9e] leading-relaxed font-mono whitespace-pre-wrap">{block.text}</p>
          </div>
        );
      })}
    </div>
  );
}

function PromptCard({
  prompt: p,
  index: i,
  copiedIdx,
  onCopy,
}: {
  prompt: IdealPrompt;
  index: number;
  copiedIdx: number | null;
  onCopy: (text: string, idx: number) => void;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const hasBreakdown = p.breakdown?.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 bg-[#EEF0FF] text-[#5258E4] rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
          <p className="font-semibold text-sm text-[#1a1a2e]">{p.focus}</p>
        </div>
        <button onClick={() => onCopy(p.prompt, i)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#5258E4] transition-colors flex-shrink-0">
          {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedIdx === i ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Prompt text */}
      <div className="bg-[#EEF0FF] mx-5 rounded-xl px-4 py-3 mb-3">
        <p className="text-sm text-[#3a3f9e] leading-relaxed font-mono">{p.prompt}</p>
      </div>

      {/* Rationale */}
      <div className="bg-gray-50 mx-5 rounded-xl px-4 py-3 mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">Why this works</p>
        <p className="text-xs text-gray-600 leading-relaxed">{p.rationale}</p>
      </div>

      {/* Breakdown toggle */}
      {hasBreakdown && (
        <div className="px-5 pb-5">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#5258E4] hover:text-[#4147c4] transition-colors"
          >
            {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showBreakdown ? 'Hide' : 'Show'} prompt breakdown
            <span className="font-normal text-gray-400 ml-1">— learn how this prompt is structured</span>
          </button>

          {showBreakdown && (
            <div className="mt-3 space-y-2">
              {/* Legend */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(Object.keys(SEGMENT_ROLE_META) as PromptSegmentRole[]).map((role) => {
                  const meta = SEGMENT_ROLE_META[role];
                  const used = p.breakdown.some((s) => s.role === role);
                  if (!used) return null;
                  return (
                    <span key={role} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </span>
                  );
                })}
              </div>

              {/* Annotated segments */}
              {p.breakdown.map((seg, si) => {
                const meta = SEGMENT_ROLE_META[seg.role] ?? SEGMENT_ROLE_META.quality;
                return (
                  <div key={si} className={`rounded-xl border p-3 ${meta.bg}`}>
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <p className={`text-xs font-mono font-semibold leading-snug ${meta.color}`}>"{seg.text}"</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{seg.lesson}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main wizard ----

function NewProjectWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);

  // Step 0
  const [projectName, setProjectName] = useState('');
  const [modelType, setModelType] = useState<ModelType | null>(null);
  const [keyTerm, setKeyTerm] = useState('');

  // Step 1 — upload
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileHashesRef = useRef<Set<string>>(new Set());
  const [skippedDuplicates, setSkippedDuplicates] = useState(0);

  // Step 2
  const [assets, setAssets] = useState<TrainingAsset[]>([]);
  const [datasetIssues, setDatasetIssues] = useState<ValidationIssue[]>([]);
  const [projectId, setProjectId] = useState('');
  const [validating, setValidating] = useState(false);

  // Step 3
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);

  // Step 4 — chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Step 5
  const [idealPrompts, setIdealPrompts] = useState<IdealPrompt[]>([]);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);

  // ---- Resume draft on mount ----
  useEffect(() => {
    const resumeId = searchParams.get('resume');
    if (!resumeId) return;
    fetch(`/api/projects/${resumeId}`)
      .then((r) => r.json())
      .then((project) => {
        if (!project?.id) return;
        setProjectId(project.id);
        setProjectName(project.name ?? '');
        setModelType(project.modelType ?? null);
        setKeyTerm(project.keyTerm ?? '');
        if (project.assets?.length) setAssets(project.assets);
        if (project.chatHistory?.length) setChatMessages(project.chatHistory);
        if (project.idealPrompts?.length) setIdealPrompts(project.idealPrompts);

        const resumeStep = project.currentStep ??
          ({ draft: 1, validating: 2, analyzing: 4, chatting: 4, complete: 5 }[project.status as string] ?? 1);
        setStep(typeof resumeStep === 'number' ? resumeStep : 1);
      })
      .catch(() => {});
  }, [searchParams]);

  // ---- Helpers ----

  const selectedOption = MODEL_OPTIONS.find((o) => o.value === modelType);
  const needsKeyTerm = selectedOption?.requiresKeyTerm ?? false;

  function canProceedStep0() {
    if (!projectName.trim() || !modelType) return false;
    if (needsKeyTerm && !keyTerm.trim()) return false;
    return true;
  }

  const totalSelectedCount = uploadedFiles.length;

  async function saveProgress(currentStep: number, extra?: Record<string, unknown>) {
    if (!projectId) return;
    await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentStep, assets, chatHistory: chatMessages, idealPrompts, ...extra }),
    });
  }

  async function saveAndExit(currentStep: number) {
    setSavedDraft(true);
    await saveProgress(currentStep);
    setTimeout(() => router.push('/'), 400);
  }

  async function goBack(fromStep: number) {
    await saveProgress(fromStep - 1);
    setStep(fromStep - 1);
  }

  // ---- Step 0: create project ----

  async function initProject() {
    if (projectId) { setStep(1); return; } // already created
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: projectName, modelType, keyTerm: keyTerm.trim() || undefined, currentStep: 1 }),
    });
    const project = await res.json();
    setProjectId(project.id);
    // Update URL so browser back/refresh can resume
    window.history.replaceState({}, '', `/new?resume=${project.id}`);
    setStep(1);
  }

  // ---- Step 1: upload mode ----

  async function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = url;
    });
  }

  async function hashFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => ['image/jpeg', 'image/jpg', 'image/png'].includes(f.type));

    let skipped = 0;
    const newFiles: UploadedFile[] = [];

    for (const f of arr) {
      const hash = await hashFile(f);
      if (fileHashesRef.current.has(hash)) {
        skipped++;
        continue;
      }
      fileHashesRef.current.add(hash);
      const dims = await loadImageDimensions(f);
      newFiles.push({ file: f, preview: URL.createObjectURL(f), width: dims.width, height: dims.height });
    }

    if (skipped > 0) {
      setSkippedDuplicates(skipped);
      setTimeout(() => setSkippedDuplicates(0), 3500);
    }

    setUploadedFiles((prev) => [...prev, ...newFiles].slice(0, 30));
  }, []);

  function removeUploadedFile(idx: number) {
    setUploadedFiles((prev) => {
      const file = prev[idx];
      URL.revokeObjectURL(file.preview);
      // Re-hash to remove from the set so the file can be re-added later if needed
      hashFile(file.file).then((hash) => fileHashesRef.current.delete(hash));
      return prev.filter((_, i) => i !== idx);
    });
  }

  // ---- Step 2: validate ----

  async function runValidation() {
    setValidating(true);
    let uploadedAssets: TrainingAsset[] = [];

    // Upload user files
    if (uploadedFiles.length > 0) {
      const formData = new FormData();
      formData.append('projectId', projectId);
      uploadedFiles.forEach((uf) => formData.append('files', uf.file));
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploaded: Array<Omit<TrainingAsset, 'width' | 'height' | 'status' | 'validationIssues' | 'validationScore' | 'reversedPrompt' | 'caption' | 'tags' | 'aiNotes'>> = await uploadRes.json();
      uploadedAssets = uploaded.map((u, idx) => {
        const uf = uploadedFiles[idx];
        const asset: TrainingAsset = { ...u, width: uf?.width ?? 0, height: uf?.height ?? 0, status: 'pending', validationIssues: [], validationScore: 0, reversedPrompt: '', description: '', caption: '', tags: [], aiNotes: [], lightingNotes: '', compositionNotes: '' };
        asset.validationIssues = validateAsset(asset);
        asset.validationScore = computeAssetScore(asset.validationIssues);
        return asset;
      });
    }

    const allAssets = [...uploadedAssets];
    const dsIssues = validateDataset(allAssets);
    setAssets(allAssets);
    setDatasetIssues(dsIssues);

    await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets: allAssets, status: 'validating', currentStep: 2 }),
    });

    setValidating(false);
    setStep(2);
  }

  // ---- Asset remove / replace (step 2) ----

  function removeAsset(id: string) {
    setAssets((prev) => {
      const next = prev.filter((a) => a.id !== id);
      setDatasetIssues(validateDataset(next));
      return next;
    });
  }

  async function replaceAsset(id: string, file: File) {
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = url;
    });

    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('files', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const [uploaded] = await res.json();
    if (!uploaded) return;

    const newAsset: TrainingAsset = {
      ...uploaded,
      width: dims.width,
      height: dims.height,
      status: 'pending',
      validationIssues: [],
      validationScore: 0,
      reversedPrompt: '',
      caption: '',
      tags: [],
      aiNotes: [],
    };
    newAsset.validationIssues = validateAsset(newAsset);
    newAsset.validationScore = computeAssetScore(newAsset.validationIssues);

    setAssets((prev) => {
      const next = prev.map((a) => (a.id === id ? newAsset : a));
      setDatasetIssues(validateDataset(next));
      return next;
    });
  }

  // ---- Step 3: AI analysis ----

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalyzeProgress(0);
    const updated = [...assets];

    for (let i = 0; i < updated.length; i++) {
      // Skip assets that already have a successful analysis
      if (updated[i].status === 'complete' && updated[i].caption) {
        setAnalyzeProgress(Math.round(((i + 1) / updated.length) * 100));
        continue;
      }
      updated[i] = { ...updated[i], status: 'analyzing' };
      setAssets([...updated]);
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetPath: updated[i].path, modelType, keyTerm }),
        });
        const data = await res.json();
        if (!data.error) {
          updated[i] = {
            ...updated[i],
            status: 'complete',
            reversedPrompt: data.reversedPrompt ?? '',
            description: data.description ?? '',
            caption: data.caption ?? '',
            tags: data.tags ?? [],
            aiNotes: data.aiNotes ?? [],
            lightingNotes: data.lightingNotes ?? '',
            compositionNotes: data.compositionNotes ?? '',
            validationScore: Math.round((updated[i].validationScore * 0.6) + ((data.qualityScore ?? 80) * 0.4)),
          };
        } else {
          updated[i] = { ...updated[i], status: 'error' };
        }
      } catch {
        updated[i] = { ...updated[i], status: 'error' };
      }
      setAssets([...updated]);
      setAnalyzeProgress(Math.round(((i + 1) / updated.length) * 100));
    }

    const overallScore = Math.round(updated.reduce((s, a) => s + a.validationScore, 0) / updated.length);
    await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets: updated, status: 'analyzing', overallScore, currentStep: 3 }),
    });
    setAnalyzing(false);
    // Stay on step 3 so user can review and edit descriptions before continuing
  }

  async function retryAssetAnalysis(id: string) {
    const idx = assets.findIndex((a) => a.id === id);
    if (idx === -1) return;
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, status: 'analyzing' } : a));
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetPath: assets[idx].path, modelType, keyTerm }),
      });
      const data = await res.json();
      if (!data.error) {
        setAssets((prev) => prev.map((a) => a.id === id ? {
          ...a,
          status: 'complete',
          reversedPrompt: data.reversedPrompt ?? '',
          description: data.description ?? '',
          caption: data.caption ?? '',
          tags: data.tags ?? [],
          aiNotes: data.aiNotes ?? [],
          lightingNotes: data.lightingNotes ?? '',
          compositionNotes: data.compositionNotes ?? '',
          validationScore: Math.round((a.validationScore * 0.6) + ((data.qualityScore ?? 80) * 0.4)),
        } : a));
      } else {
        setAssets((prev) => prev.map((a) => a.id === id ? { ...a, status: 'error' } : a));
      }
    } catch {
      setAssets((prev) => prev.map((a) => a.id === id ? { ...a, status: 'error' } : a));
    }
  }

  // ---- Step 4: chat ----

  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput, timestamp: new Date().toISOString() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    const assetSummary = assets.filter((a) => a.caption).slice(0, 5).map((a) => a.caption).join('; ');
    const reversedPrompts = assets.filter((a) => a.reversedPrompt).slice(0, 4).map((a) => a.reversedPrompt);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, modelType, assetSummary, reversedPrompts }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const ts = new Date().toISOString();
      setChatMessages([...newMessages, { role: 'assistant', content: '', timestamp: ts }]);
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          setChatMessages([...newMessages, { role: 'assistant', content: assistantContent, timestamp: ts }]);
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent, timestamp: ts }];
      setChatMessages(finalMessages);
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatHistory: finalMessages, status: 'chatting', currentStep: 4 }),
      });
    } catch (err) { console.error(err); }
    setChatLoading(false);
  }

  function getExpectedOutcome(): string {
    const msgs = chatMessages.filter((m) => m.role === 'assistant');
    return msgs[msgs.length - 1]?.content ?? '';
  }

  // ---- Step 5: generate prompts ----

  async function generatePrompts() {
    setGeneratingPrompts(true);
    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelType,
          assetCaptions: assets.map((a) => a.caption).filter(Boolean),
          reversedPrompts: assets.map((a) => a.reversedPrompt).filter(Boolean),
          expectedOutcome: getExpectedOutcome(),
          projectName,
        }),
      });
      const data = await res.json();
      setIdealPrompts(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    setGeneratingPrompts(false);
  }

  async function copyPrompt(prompt: string, idx: number) {
    await navigator.clipboard.writeText(prompt);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  async function saveAndFinish() {
    setSaving(true);
    const overallScore = assets.length > 0 ? Math.round(assets.reduce((s, a) => s + a.validationScore, 0) / assets.length) : 0;
    await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets, chatHistory: chatMessages, expectedOutcome: getExpectedOutcome(), idealPrompts, status: 'complete', overallScore, currentStep: 5 }),
    });
    router.push(`/projects/${projectId}`);
  }

  // ---- Render ----

  const passCount = assets.filter((a) => a.validationScore >= 80).length;
  const warnCount = assets.filter((a) => a.validationScore >= 50 && a.validationScore < 80).length;
  const failCount = assets.filter((a) => a.validationScore < 50).length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#1a1a2e] text-white px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#5258E4] rounded-md flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">{projectName || 'New Project'}</span>
        </div>
        {savedDraft && (
          <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Draft saved
          </span>
        )}
      </header>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-100 px-8 py-3">
        <div className="max-w-3xl mx-auto flex items-center">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                  i < step ? 'bg-[#5258E4] text-white' :
                  i === step ? 'bg-[#5258E4] text-white ring-4 ring-[#EEF0FF]' : 'bg-gray-200 text-gray-400')}>
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={cn('text-xs font-medium hidden sm:block', i === step ? 'text-[#5258E4]' : 'text-gray-400')}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className={cn('flex-1 h-px mx-2', i < step ? 'bg-[#5258E4]' : 'bg-gray-200')} />}
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-8">

        {/* ====== STEP 0: Setup ====== */}
        {step === 0 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a2e]">Set up your project</h2>
              <p className="text-gray-500 mt-1">Name your project and select the type of model you want to train.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a2e] mb-2">Project name</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Brand Ambassador V1, Summer Style Pack"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#5258E4] focus:ring-2 focus:ring-[#5258E4]/20 bg-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a2e] mb-3">Model type</label>
              <div className="grid grid-cols-2 gap-3">
                {MODEL_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = modelType === opt.value;
                  return (
                    <button key={opt.value} onClick={() => { setModelType(opt.value); setKeyTerm(''); }}
                      className={cn('p-4 rounded-xl border-2 text-left transition-all',
                        selected ? 'border-[#5258E4] bg-[#EEF0FF]' : 'border-gray-200 bg-white hover:border-gray-300')}>
                      <div className="flex items-start justify-between mb-2">
                        <Icon className={cn('w-5 h-5', selected ? 'text-[#5258E4]' : 'text-gray-400')} />
                        {opt.requiresKeyTerm && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                            <Tag className="w-2.5 h-2.5" /> Key term
                          </span>
                        )}
                      </div>
                      <p className={cn('font-semibold text-sm', selected ? 'text-[#5258E4]' : 'text-[#1a1a2e]')}>{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{opt.description}</p>
                      <p className="text-xs text-gray-400 mt-2 italic">{opt.examples}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {needsKeyTerm && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4 text-amber-600" />
                  <label className="text-sm font-semibold text-amber-800">Subject key term</label>
                </div>
                <p className="text-xs text-amber-700 mb-3">
                  A unique word or short phrase that identifies your subject (e.g. <span className="font-mono bg-amber-100 px-1 rounded">sks person</span>).
                  Used in generation prompts after training to invoke the model&apos;s learned identity.
                </p>
                <input type="text" value={keyTerm} onChange={(e) => setKeyTerm(e.target.value)}
                  placeholder="e.g. sks person, ohwx character"
                  className="w-full border border-amber-200 bg-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                {selectedOption && <p className="text-xs text-amber-600 mt-2">Tip: {selectedOption.tip}</p>}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={initProject} disabled={!canProceedStep0()}
                className="flex items-center gap-2 bg-[#5258E4] text-white px-6 py-3 rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#4147c4] transition-colors">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP 1: Upload ====== */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#1a1a2e]">Upload training assets</h2>
                <p className="text-gray-500 mt-1">Upload 10–30 JPG or PNG images for your custom model.</p>
              </div>
              <button onClick={() => saveAndExit(1)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1">
                <Save className="w-3.5 h-3.5" /> Save draft
              </button>
            </div>

            <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={cn('border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all',
                dragging ? 'border-[#5258E4] bg-[#EEF0FF]' : 'border-gray-300 bg-white hover:border-[#5258E4] hover:bg-[#EEF0FF]/30')}>
              <Upload className={cn('w-10 h-10 mx-auto mb-3', dragging ? 'text-[#5258E4]' : 'text-gray-300')} />
              <p className="font-medium text-gray-600">Drop images here or click to browse</p>
              <p className="text-sm text-gray-400 mt-1">JPG or PNG · Max 50MB each · 10–30 images</p>
              <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png" className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            </div>

            {uploadedFiles.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {uploadedFiles.map((uf, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img src={uf.preview} alt={uf.file.name} className="w-full h-full object-cover" />
                    <button onClick={() => removeUploadedFile(idx)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Duplicate notice */}
            {skippedDuplicates > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                {skippedDuplicates} duplicate {skippedDuplicates === 1 ? 'image' : 'images'} ignored — already in your selection.
              </div>
            )}

            {/* Count bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full overflow-hidden bg-gray-200">
                <div className={cn('h-full rounded-full transition-all', totalSelectedCount >= 10 ? 'bg-[#5258E4]' : 'bg-yellow-400')}
                  style={{ width: `${Math.min(100, (totalSelectedCount / 30) * 100)}%` }} />
              </div>
              <span className={cn('text-sm font-medium flex-shrink-0', totalSelectedCount >= 10 ? 'text-[#5258E4]' : 'text-yellow-600')}>
                {totalSelectedCount} / 30
              </span>
            </div>

            <div className="flex justify-between">
              <button onClick={() => goBack(1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={runValidation} disabled={totalSelectedCount < 10 || validating}
                className="flex items-center gap-2 bg-[#5258E4] text-white px-6 py-3 rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#4147c4] transition-colors">
                {validating && <Loader2 className="w-4 h-4 animate-spin" />}
                {validating ? 'Processing…' : 'Validate assets'}
                {!validating && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP 2: Validation Report ====== */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#1a1a2e]">Validation report</h2>
                <p className="text-gray-500 mt-1">Review issues before running AI analysis.</p>
              </div>
              <button onClick={() => saveAndExit(2)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1">
                <Save className="w-3.5 h-3.5" /> Save draft
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[['Pass', passCount, 'green'], ['Warnings', warnCount, 'yellow'], ['Errors', failCount, 'red']].map(([label, count, color]) => (
                <div key={label as string} className={`bg-${color}-50 rounded-xl p-4 text-center`}>
                  <p className={`text-2xl font-bold text-${color}-700`}>{count}</p>
                  <p className={`text-xs text-${color}-600 mt-1`}>{label}</p>
                </div>
              ))}
            </div>

            {datasetIssues.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700 mb-3">Dataset-level issues</p>
                {datasetIssues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
              </div>
            )}

            <div className="space-y-2">
              {assets.map((asset) => (
                <AssetValidationCard
                  key={asset.id}
                  asset={asset}
                  onRemove={() => removeAsset(asset.id)}
                  onReplace={(file) => replaceAsset(asset.id, file)}
                />
              ))}
            </div>

            <div className="flex justify-between">
              <button onClick={() => goBack(2)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => { setStep(3); runAnalysis(); }}
                className="flex items-center gap-2 bg-[#5258E4] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#4147c4] transition-colors">
                <Sparkles className="w-4 h-4" /> Run AI analysis
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP 3: AI Analysis ====== */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Header changes based on analyzing vs review state */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#1a1a2e]">
                  {analyzing ? 'AI analysis' : 'Review & edit descriptions'}
                </h2>
                <p className="text-gray-500 mt-1">
                  {analyzing
                    ? 'Generating detailed descriptions, prompts, and quality assessments for each asset.'
                    : 'Review the AI-generated descriptions. Edit any that need adjustment before continuing.'}
                </p>
              </div>
              {!analyzing && (
                <button onClick={() => saveAndExit(3)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1">
                  <Save className="w-3.5 h-3.5" /> Save draft
                </button>
              )}
            </div>

            {/* Progress bar — only while analyzing */}
            {analyzing && (
              <div className="bg-white rounded-xl p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 text-[#5258E4] animate-spin" />
                    <span className="font-medium text-sm">Analyzing assets…</span>
                  </div>
                  <span className="text-sm font-bold text-[#5258E4]">{analyzeProgress}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#5258E4] rounded-full transition-all duration-300" style={{ width: `${analyzeProgress}%` }} />
                </div>
              </div>
            )}

            {/* Asset cards — compact during analysis, full editable after */}
            <div className="space-y-3">
              {assets.map((asset) =>
                analyzing ? (
                  <AssetValidationCard key={asset.id} asset={asset} />
                ) : (
                  <AnalysisReviewCard
                    key={asset.id}
                    asset={asset}
                    onChange={(field, value) =>
                      setAssets((prev) => prev.map((a) => a.id === asset.id ? { ...a, [field]: value } : a))
                    }
                    onRetry={retryAssetAnalysis}
                  />
                )
              )}
            </div>

            {/* Continue button — only after analysis complete */}
            {!analyzing && (
              <div className="flex justify-between items-center">
                <button onClick={() => goBack(3)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex items-center gap-3">
                  {assets.some((a) => a.status === 'error') && (
                    <button
                      onClick={runAnalysis}
                      className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry failed ({assets.filter((a) => a.status === 'error').length})
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await saveProgress(4, { assets });
                      setStep(4);
                    }}
                    className="flex items-center gap-2 bg-[#5258E4] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#4147c4] transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" /> Build generation brief
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====== STEP 4: Generation Brief ====== */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#1a1a2e]">Define your generation brief</h2>
                <p className="text-gray-500 mt-1">Describe what you want to generate with this model — style, use cases, outputs. This shapes your ideal prompts.</p>
              </div>
              <button onClick={() => saveAndExit(4)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1">
                <Save className="w-3.5 h-3.5" /> Save draft
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col" style={{ height: '420px' }}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    Start the conversation — describe what you want to generate and the AI will help sharpen your brief
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'max-w-[80%] bg-[#5258E4] text-white rounded-br-sm'
                        : 'w-full max-w-[90%] bg-gray-100 text-gray-800 rounded-bl-sm'
                    )}>
                      {msg.role === 'user'
                        ? <span className="whitespace-pre-wrap">{msg.content}</span>
                        : msg.content === ''
                          ? <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5" />
                          : <ChatMessageContent content={msg.content} />
                      }
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-gray-100 p-3 flex gap-2">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="e.g. I want to generate lifestyle scenes of this subject in different environments, moods, and lighting styles…"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5258E4]"
                  disabled={chatLoading} />
                <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading}
                  className="bg-[#5258E4] text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-[#4147c4] transition-colors">
                  {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                </button>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => goBack(4)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => { setStep(5); generatePrompts(); }} disabled={chatMessages.length < 2}
                className="flex items-center gap-2 bg-[#5258E4] text-white px-6 py-3 rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#4147c4] transition-colors">
                <Wand2 className="w-4 h-4" /> Generate prompts
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP 5: Ideal Prompts ====== */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#1a1a2e]">Ideal generation prompts</h2>
                <p className="text-gray-500 mt-1">Use these after your model is trained in Adobe Firefly.</p>
              </div>
              <button onClick={() => saveAndExit(5)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1">
                <Save className="w-3.5 h-3.5" /> Save draft
              </button>
            </div>

            {generatingPrompts ? (
              <div className="text-center py-16">
                <Loader2 className="w-10 h-10 text-[#5258E4] animate-spin mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Generating ideal prompts…</p>
              </div>
            ) : (
              <div className="space-y-4">
                {idealPrompts.map((p, i) => (
                  <PromptCard key={i} prompt={p} index={i} copiedIdx={copiedIdx} onCopy={copyPrompt} />
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => goBack(5)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={saveAndFinish} disabled={saving || idealPrompts.length === 0}
                className="flex items-center gap-2 bg-[#5258E4] text-white px-6 py-3 rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#4147c4] transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save project
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5258E4] animate-spin" />
      </div>
    }>
      <NewProjectWizard />
    </Suspense>
  );
}

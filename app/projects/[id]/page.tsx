'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, AlertTriangle, AlertCircle, Sparkles,
  Copy, Check, ChevronDown, ChevronUp, MessageSquare, Wand2,
  Calendar, Image as ImageIcon, Star, Loader2
} from 'lucide-react';
import type { Project, TrainingAsset, ValidationIssue, PromptSegmentRole } from '@/lib/types';
import { formatDate, formatBytes, cn, scoreBg, scoreColor } from '@/lib/utils';

const SEGMENT_ROLE_META: Record<PromptSegmentRole, { label: string; color: string; bg: string }> = {
  subject:     { label: 'Subject',     color: 'text-[#5258E4]',   bg: 'bg-[#EEF0FF] border-[#5258E4]/30' },
  style:       { label: 'Style',       color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200' },
  environment: { label: 'Environment', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  lighting:    { label: 'Lighting',    color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  mood:        { label: 'Mood',        color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200' },
  composition: { label: 'Composition', color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-200' },
  quality:     { label: 'Quality',     color: 'text-gray-600',    bg: 'bg-gray-100 border-gray-300' },
};

const MODEL_LABELS: Record<string, string> = {
  'lifestyle-photography': 'Lifestyle Photography',
  'photoshoot-person': 'Photoshoot of a Person',
  'still-life-photography': 'Still Life Photography',
  'illustrated-character': 'Illustrated Character',
  'iconography': 'Iconography',
  'illustrations': 'Illustrations',
  'isometric-3d': 'Isometric and 3D Graphics',
  'brand-expressions': 'Explore Brand Expressions',
  'product-backgrounds': 'Backgrounds for Product Shots',
  'custom-subject': 'Custom Subject',
  'custom-style': 'Custom Style',
};

function PromptBreakdownCard({
  prompt: p,
  index: i,
  copiedIdx,
  onCopy,
}: {
  prompt: { prompt: string; focus: string; rationale: string; breakdown?: { text: string; role: PromptSegmentRole; lesson: string }[] };
  index: number;
  copiedIdx: number | null;
  onCopy: (text: string, idx: number) => void;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const hasBreakdown = (p.breakdown?.length ?? 0) > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
      <div className="bg-[#EEF0FF] mx-5 rounded-xl px-4 py-3 mb-3">
        <p className="text-sm text-[#3a3f9e] leading-relaxed font-mono">{p.prompt}</p>
      </div>
      <div className="bg-gray-50 mx-5 rounded-xl px-4 py-3 mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">Why this works</p>
        <p className="text-xs text-gray-600 leading-relaxed">{p.rationale}</p>
      </div>
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
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(Object.keys(SEGMENT_ROLE_META) as PromptSegmentRole[]).map((role) => {
                  const meta = SEGMENT_ROLE_META[role];
                  const used = p.breakdown!.some((s) => s.role === role);
                  if (!used) return null;
                  return (
                    <span key={role} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </span>
                  );
                })}
              </div>
              {p.breakdown!.map((seg, si) => {
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

function IssueRow({ issue }: { issue: ValidationIssue }) {
  return (
    <div className={cn('flex gap-3 p-3 rounded-lg text-sm', issue.level === 'error' ? 'bg-red-50' : 'bg-yellow-50')}>
      {issue.level === 'error'
        ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        : <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
      }
      <div>
        <p className={issue.level === 'error' ? 'text-red-800 font-medium text-xs' : 'text-yellow-800 font-medium text-xs'}>{issue.message}</p>
        <p className={issue.level === 'error' ? 'text-red-600 text-xs mt-0.5' : 'text-yellow-600 text-xs mt-0.5'}>{issue.suggestion}</p>
      </div>
    </div>
  );
}

function AssetDetailCard({ asset }: { asset: TrainingAsset }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = asset.validationIssues.length > 0 || (asset.aiNotes && asset.aiNotes.length > 0) || asset.reversedPrompt;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Top: thumbnail + meta */}
      <div className="flex gap-4 p-4">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          <img src={asset.path} alt={asset.filename} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm text-[#1a1a2e] truncate">{asset.filename}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${scoreBg(asset.validationScore)}`}>
              {asset.validationScore}%
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {asset.width > 0 ? `${asset.width}×${asset.height}px` : '–'} · {formatBytes(asset.fileSizeBytes)} · {asset.format.toUpperCase()}
          </p>

          {asset.caption && (
            <p className="text-xs text-gray-600 mt-1.5 italic leading-relaxed">"{asset.caption}"</p>
          )}

          {asset.tags && asset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {asset.tags.map((tag) => (
                <span key={tag} className="text-[10px] bg-[#EEF0FF] text-[#5258E4] px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expand toggle */}
      {hasDetails && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <span>Details &amp; validation</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {expanded && (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-2">
              {asset.validationIssues.map((issue, i) => <IssueRow key={i} issue={issue} />)}

              {asset.aiNotes && asset.aiNotes.map((note, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-blue-50">
                  <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800">{note}</p>
                </div>
              ))}

              {asset.reversedPrompt && (
                <div className="mt-2 p-3 bg-[#EEF0FF] rounded-xl">
                  <p className="text-xs font-semibold text-[#5258E4] mb-1">Reverse-engineered prompt</p>
                  <p className="text-xs text-[#3a3f9e] leading-relaxed">{asset.reversedPrompt}</p>
                </div>
              )}

              {asset.validationIssues.length === 0 && (!asset.aiNotes || asset.aiNotes.length === 0) && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>No issues detected</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'assets' | 'brief' | 'prompts'>('assets');

  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then((r) => r.json())
      .then(setProject)
      .finally(() => setLoading(false));
  }, [params.id]);

  async function copyPrompt(prompt: string, idx: number) {
    await navigator.clipboard.writeText(prompt);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5258E4] animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Project not found.</p>
        <Link href="/" className="text-[#5258E4] hover:underline">Back to home</Link>
      </div>
    );
  }

  const passCount = project.assets.filter((a) => a.validationScore >= 80).length;
  const warnCount = project.assets.filter((a) => a.validationScore >= 50 && a.validationScore < 80).length;
  const failCount = project.assets.filter((a) => a.validationScore < 50).length;
  const errorAssets = project.assets.filter((a) => a.validationIssues.some((i) => i.level === 'error'));
  const warnAssets = project.assets.filter((a) => a.validationIssues.some((i) => i.level === 'warning') && !a.validationIssues.some((i) => i.level === 'error'));

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#1a1a2e] text-white px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-semibold">{project.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-gray-400">{MODEL_LABELS[project.modelType]}</p>
                {project.keyTerm && (
                  <span className="text-xs bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                    {project.keyTerm}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(project.createdAt)}
            </div>
            {project.overallScore > 0 && (
              <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold', scoreBg(project.overallScore))}>
                <Star className="w-3.5 h-3.5" />
                {project.overallScore}% overall
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold text-[#1a1a2e]">{project.assets.length}</p>
            <p className="text-xs text-gray-400 mt-1">Assets</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{passCount}</p>
            <p className="text-xs text-green-600 mt-1">Pass</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-700">{warnCount}</p>
            <p className="text-xs text-yellow-600 mt-1">Warnings</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{failCount}</p>
            <p className="text-xs text-red-600 mt-1">Errors</p>
          </div>
        </div>

        {/* Summary cards */}
        {(errorAssets.length > 0 || warnAssets.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
            <h3 className="font-semibold text-sm text-[#1a1a2e] mb-3">Summary</h3>
            {errorAssets.length > 0 && (
              <div className="flex gap-3 p-3 bg-red-50 rounded-xl mb-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    {errorAssets.length} asset{errorAssets.length > 1 ? 's' : ''} with critical errors
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {errorAssets.map((a) => a.filename).join(', ')}
                  </p>
                </div>
              </div>
            )}
            {warnAssets.length > 0 && (
              <div className="flex gap-3 p-3 bg-yellow-50 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    {warnAssets.length} asset{warnAssets.length > 1 ? 's' : ''} with warnings
                  </p>
                  <p className="text-xs text-yellow-600 mt-0.5">
                    {warnAssets.map((a) => a.filename).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100 shadow-sm mb-6 w-fit">
          {([
            { key: 'assets', label: 'Assets', icon: ImageIcon },
            { key: 'brief', label: 'Generation brief', icon: MessageSquare },
            { key: 'prompts', label: 'Ideal prompts', icon: Wand2 },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === key
                  ? 'bg-[#5258E4] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Assets tab */}
        {activeTab === 'assets' && (
          <div className="grid grid-cols-1 gap-3">
            {project.assets.map((asset) => (
              <AssetDetailCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}

        {/* Generation brief tab */}
        {activeTab === 'brief' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {project.chatHistory.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">No generation brief available</p>
              </div>
            ) : (
              <div className="p-5 space-y-3 max-h-[600px] overflow-y-auto">
                {project.chatHistory.map((msg, i) => (
                  <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-[#5258E4] text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {project.expectedOutcome && (
              <div className="border-t border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-500 mb-1">Generation brief summary</p>
                <p className="text-sm text-gray-700 leading-relaxed">{project.expectedOutcome}</p>
              </div>
            )}
          </div>
        )}

        {/* Ideal Prompts tab */}
        {activeTab === 'prompts' && (
          <div>
            {project.idealPrompts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
                <Wand2 className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">No ideal prompts generated yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {project.idealPrompts.map((p, i) => (
                  <PromptBreakdownCard key={i} prompt={p} index={i} copiedIdx={copiedIdx} onCopy={copyPrompt} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

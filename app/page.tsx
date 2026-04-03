'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Folder, CheckCircle, Clock, AlertCircle, Trash2, Sparkles, PlayCircle } from 'lucide-react';
import type { Project } from '@/lib/types';
import { formatDate, scoreBg } from '@/lib/utils';

const MODEL_LABELS: Record<string, string> = {
  'lifestyle-photography': 'Lifestyle Photography',
  'photorealistic-portraiture': 'Portraiture',
  'still-life-product': 'Still Life / Product',
  'character-development': 'Character',
  'iconography-graphics': 'Iconography',
  '3d-isometric': '3D / Isometric',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  complete: <CheckCircle className="w-4 h-4 text-green-500" />,
  analyzing: <Clock className="w-4 h-4 text-blue-500" />,
  validating: <AlertCircle className="w-4 h-4 text-yellow-500" />,
  draft: <Clock className="w-4 h-4 text-gray-400" />,
  chatting: <Clock className="w-4 h-4 text-purple-500" />,
};

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data.reverse() : []))
      .finally(() => setLoading(false));
  }, []);

  async function deleteProject(id: string, e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm('Delete this project?')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#1a1a2e] text-white px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#5258E4] rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Firefly Training Prep</h1>
            <p className="text-xs text-gray-400">Custom model asset validator & prompt generator</p>
          </div>
        </div>
        <Link
          href="/new"
          className="flex items-center gap-2 bg-[#5258E4] hover:bg-[#4147c4] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Total Projects', value: projects.length },
            { label: 'Completed', value: projects.filter((p) => p.status === 'complete').length },
            { label: 'Total Assets', value: projects.reduce((s, p) => s + p.assets.length, 0) },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-3xl font-bold text-[#1a1a2e]">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Projects list */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1a1a2e]">All Projects</h2>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <Folder className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No projects yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-6">Create your first training prep project to get started</p>
            <Link
              href="/new"
              className="inline-flex items-center gap-2 bg-[#5258E4] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#4147c4] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const isDraft = project.status !== 'complete';
              return (
                <div key={project.id}
                  className={`bg-white rounded-xl border shadow-sm transition-all group ${isDraft ? 'border-amber-200' : 'border-gray-100 hover:shadow-md hover:border-[#5258E4]/30'}`}>
                  <div className="p-5 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDraft ? 'bg-amber-50' : 'bg-[#EEF0FF]'}`}>
                      <Folder className={`w-5 h-5 ${isDraft ? 'text-amber-500' : 'text-[#5258E4]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={isDraft ? `/new?resume=${project.id}` : `/projects/${project.id}`}
                          className="font-medium text-[#1a1a2e] truncate hover:text-[#5258E4] transition-colors">
                          {project.name}
                        </Link>
                        <span className="text-xs bg-[#EEF0FF] text-[#5258E4] px-2 py-0.5 rounded-full flex-shrink-0">
                          {MODEL_LABELS[project.modelType] ?? project.modelType}
                        </span>
                        {isDraft && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">
                            Draft
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{project.assets.length} assets</span>
                        <span>·</span>
                        <span>{formatDate(project.createdAt)}</span>
                        <span>·</span>
                        <div className="flex items-center gap-1">
                          {STATUS_ICONS[project.status]}
                          <span className="capitalize">{project.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {project.overallScore > 0 && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${scoreBg(project.overallScore)}`}>
                          {project.overallScore}%
                        </span>
                      )}
                      {isDraft && (
                        <Link href={`/new?resume=${project.id}`}
                          className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                          <PlayCircle className="w-3.5 h-3.5" /> Resume
                        </Link>
                      )}
                      <button onClick={(e) => deleteProject(project.id, e)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

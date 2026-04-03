import { NextResponse } from 'next/server';
import { readProjects, saveProject } from '@/lib/storage';
import type { Project } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const projects = readProjects();
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const body = await req.json();
  const project: Project = {
    id: uuidv4(),
    name: body.name,
    modelType: body.modelType,
    keyTerm: body.keyTerm,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    assets: [],
    expectedOutcome: '',
    chatHistory: [],
    idealPrompts: [],
    overallScore: 0,
  };
  saveProject(project);
  return NextResponse.json(project);
}

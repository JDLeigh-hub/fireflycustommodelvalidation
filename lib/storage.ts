import fs from 'fs';
import path from 'path';
import type { Project } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readProjects(): Project[] {
  ensureDataDir();
  if (!fs.existsSync(PROJECTS_FILE)) return [];
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf-8');
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

export function writeProjects(projects: Project[]): void {
  ensureDataDir();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

export function getProject(id: string): Project | null {
  const projects = readProjects();
  return projects.find((p) => p.id === id) ?? null;
}

export function saveProject(project: Project): void {
  const projects = readProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.push(project);
  }
  writeProjects(projects);
}

export function deleteProject(id: string): void {
  const projects = readProjects().filter((p) => p.id !== id);
  writeProjects(projects);
}

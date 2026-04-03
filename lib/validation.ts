import type { TrainingAsset, ValidationIssue, Project } from './types';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const MIN_DIMENSION = 1024;
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png'];
const MIN_ASSETS = 10;
const MAX_ASSETS = 30;
const MAX_ASPECT_RATIO = 16 / 9;

export function validateAsset(asset: TrainingAsset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Format check
  if (!ALLOWED_FORMATS.includes(asset.format.toLowerCase())) {
    issues.push({
      rule: 'file-format',
      level: 'error',
      message: `File format ".${asset.format}" is not supported.`,
      suggestion: 'Convert to JPG or PNG before uploading.',
    });
  }

  // File size check
  if (asset.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (asset.fileSizeBytes / 1024 / 1024).toFixed(1);
    issues.push({
      rule: 'file-size',
      level: 'error',
      message: `File size ${sizeMB}MB exceeds the 50MB limit.`,
      suggestion: 'Compress or resize the image to reduce file size below 50MB.',
    });
  }

  // Resolution check
  if (asset.width > 0 && asset.height > 0) {
    if (asset.width < MIN_DIMENSION || asset.height < MIN_DIMENSION) {
      issues.push({
        rule: 'resolution',
        level: 'error',
        message: `Resolution ${asset.width}×${asset.height}px is below the minimum 1024×1024px.`,
        suggestion: 'Use higher-resolution source images. Upscaling low-res images will not improve quality.',
      });
    }

    // Aspect ratio check
    const ratio = Math.max(asset.width, asset.height) / Math.min(asset.width, asset.height);
    if (ratio > MAX_ASPECT_RATIO + 0.01) {
      issues.push({
        rule: 'aspect-ratio',
        level: 'warning',
        message: `Aspect ratio ${asset.width}:${asset.height} exceeds the recommended 16:9 maximum.`,
        suggestion: 'Crop to a max 16:9 (landscape) or 9:16 (portrait) ratio for best results.',
      });
    }
  }

  return issues;
}

export function validateDataset(assets: TrainingAsset[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Count check
  if (assets.length < MIN_ASSETS) {
    issues.push({
      rule: 'asset-count',
      level: 'error',
      message: `Only ${assets.length} asset${assets.length === 1 ? '' : 's'} uploaded. Minimum is 10.`,
      suggestion: `Add at least ${MIN_ASSETS - assets.length} more image${MIN_ASSETS - assets.length === 1 ? '' : 's'} to meet the minimum requirement.`,
    });
  } else if (assets.length > MAX_ASSETS) {
    issues.push({
      rule: 'asset-count',
      level: 'warning',
      message: `${assets.length} assets uploaded. Adobe Firefly recommends 10–30 high-quality images.`,
      suggestion: 'Consider curating to your best 30 images to avoid diluting the training signal.',
    });
  }

  // Aspect ratio consistency check
  if (assets.length >= 2) {
    const ratios = assets
      .filter((a) => a.width > 0 && a.height > 0)
      .map((a) => {
        const isLandscape = a.width >= a.height;
        const ratio = isLandscape ? a.width / a.height : a.height / a.width;
        return { id: a.id, ratio: Math.round(ratio * 100) / 100, isLandscape };
      });

    const orientations = new Set(ratios.map((r) => r.isLandscape));
    if (orientations.size > 1) {
      issues.push({
        rule: 'aspect-ratio-consistency',
        level: 'warning',
        message: 'Mixed landscape and portrait orientations detected across assets.',
        suggestion: 'Use a consistent aspect ratio and orientation throughout the entire dataset for best training results.',
      });
    }
  }

  return issues;
}

export function computeAssetScore(issues: ValidationIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.level === 'error') score -= 30;
    else if (issue.level === 'warning') score -= 10;
  }
  return Math.max(0, score);
}

export function computeProjectScore(project: Project): number {
  if (project.assets.length === 0) return 0;
  const assetScores = project.assets.map((a) => a.validationScore);
  const avg = assetScores.reduce((s, v) => s + v, 0) / assetScores.length;
  const datasetIssues = validateDataset(project.assets);
  let penalty = 0;
  for (const issue of datasetIssues) {
    if (issue.level === 'error') penalty += 15;
    else if (issue.level === 'warning') penalty += 5;
  }
  return Math.max(0, Math.round(avg - penalty));
}

// Progress store: saved checklist state in localStorage, with export and import.
//
// State shape: { earned: { [trophyId]: true }, counts: { [trophyId]: number } }
// Exported files carry the same shape plus an app tag and an export date.

export const STORAGE_KEY = 'leonida-trophy-tracker-v1';
export const EXPORT_APP = 'leonida-trophy-tracker';

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { earned: {}, counts: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { earned: {}, counts: {} };
    return {
      earned: parsed.earned && typeof parsed.earned === 'object' ? parsed.earned : {},
      counts: parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {},
    };
  } catch {
    return { earned: {}, counts: {} };
  }
}

export function saveProgress(progress) {
  const clean = {
    earned: progress.earned || {},
    counts: progress.counts || {},
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  return clean;
}

export function isEarned(progress, trophyId) {
  return Boolean(progress.earned && progress.earned[trophyId]);
}

export function setEarned(progress, trophyId, earned) {
  const next = { earned: { ...progress.earned }, counts: { ...progress.counts } };
  if (earned) next.earned[trophyId] = true;
  else delete next.earned[trophyId];
  return saveProgress(next);
}

export function trophyCount(progress, trophyId) {
  const value = progress.counts ? progress.counts[trophyId] : undefined;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function setTrophyCount(progress, trophyId, value, target) {
  const next = { earned: { ...progress.earned }, counts: { ...progress.counts } };
  const clamped = Math.max(0, Math.min(Math.floor(value) || 0, 999999));
  if (clamped > 0) next.counts[trophyId] = clamped;
  else delete next.counts[trophyId];
  // Reaching the target counts as earning the trophy; dropping below un-earns it.
  if (typeof target === 'number' && target > 0) {
    if (clamped >= target) next.earned[trophyId] = true;
    else if (next.counts[trophyId] !== undefined || clamped < target) {
      if (clamped < target && trophyCount(progress, trophyId) >= target) delete next.earned[trophyId];
    }
  }
  return saveProgress(next);
}

export function exportProgressFile(progress) {
  const payload = {
    app: EXPORT_APP,
    version: 1,
    exportedAt: new Date().toISOString(),
    earned: progress.earned || {},
    counts: progress.counts || {},
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leonida-trophy-progress.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return payload;
}

export function parseImportedProgress(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('Not a progress file.');
  if (parsed.app && parsed.app !== EXPORT_APP) throw new Error('This file is from another app.');
  const earned = parsed.earned && typeof parsed.earned === 'object' ? parsed.earned : {};
  const counts = parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {};
  const cleanEarned = {};
  for (const [key, value] of Object.entries(earned)) {
    const id = Number(key);
    if (Number.isInteger(id) && id >= 1 && id <= 55 && value) cleanEarned[id] = true;
  }
  const cleanCounts = {};
  for (const [key, value] of Object.entries(counts)) {
    const id = Number(key);
    if (Number.isInteger(id) && id >= 1 && id <= 55 && typeof value === 'number' && value > 0) {
      cleanCounts[id] = Math.floor(value);
    }
  }
  return { earned: cleanEarned, counts: cleanCounts };
}

export function importProgressFile(file) {
  return file.text().then((text) => saveProgress(parseImportedProgress(text)));
}

export function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
  return { earned: {}, counts: {} };
}

export function earnedTotal(progress) {
  return Object.keys(progress.earned || {}).length;
}

export function gradeBreakdown(progress, trophies) {
  const earned = new Set(Object.keys(progress.earned || {}).map(Number));
  const byGrade = {};
  for (const trophy of trophies) {
    if (!byGrade[trophy.grade]) byGrade[trophy.grade] = { earned: 0, total: 0 };
    byGrade[trophy.grade].total += 1;
    if (earned.has(trophy.id)) byGrade[trophy.grade].earned += 1;
  }
  return byGrade;
}

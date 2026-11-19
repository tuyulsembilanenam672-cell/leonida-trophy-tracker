// Roadmap view: the five stages to the platinum, built from the data file's
// roadmap notes and each trophy's stage, with missable trophies flagged.

import { isEarned } from './store.js';

export const STAGE_TITLES = {
  1: 'Chapter 1 — set up your run',
  2: 'Chapters 2–3 — both characters, robberies open',
  3: 'Chapters 4–5 — the finale',
  4: 'Side stories & strangers',
  5: 'After the credits — cleanup & 100%',
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function trophyLabel(trophy, progress, spoilersOn) {
  const hiddenBySpoiler = spoilersOn && trophy.kinds.includes('story') && !isEarned(progress, trophy.id);
  const name = hiddenBySpoiler ? 'Hidden story trophy' : trophy.name;
  const flag = trophy.missable ? ' <span class="flag">⚠ missable</span>' : '';
  const earnedClass = isEarned(progress, trophy.id) ? ' class="earned"' : '';
  return `<li${earnedClass} data-trophy-id="${trophy.id}" tabindex="0" role="button" aria-label="${escapeHtml(name)}">${escapeHtml(name)}${flag}</li>`;
}

export function renderRoadmap(container, data, progress, spoilersOn, onSelectTrophy) {
  const stages = (data.roadmap || []).slice().sort((a, b) => a.stage - b.stage);
  const byStage = new Map();
  for (const trophy of data.trophies) {
    if (!byStage.has(trophy.stage)) byStage.set(trophy.stage, []);
    byStage.get(trophy.stage).push(trophy);
  }
  container.innerHTML = stages
    .map((stage) => {
      const trophies = (byStage.get(stage.stage) || []).slice().sort((a, b) => a.id - b.id);
      const items = trophies.map((t) => trophyLabel(t, progress, spoilersOn)).join('');
      return `<article class="roadmap-stage">
        <p class="stage-time">Stage ${stage.stage} · ${escapeHtml(stage.time || '')}</p>
        <h3>${escapeHtml(stage.title)}</h3>
        <p class="stage-note">${escapeHtml(stage.note || '')}</p>
        <ul class="roadmap-trophies">${items}</ul>
      </article>`;
    })
    .join('');
  container.querySelectorAll('[data-trophy-id]').forEach((item) => {
    const open = () => onSelectTrophy(Number(item.dataset.trophyId));
    item.addEventListener('click', open);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

export function stageProgress(data, progress, stageNumber) {
  const stageTrophies = data.trophies.filter((t) => t.stage === stageNumber);
  const earned = stageTrophies.filter((t) => isEarned(progress, t.id)).length;
  return { earned, total: stageTrophies.length };
}

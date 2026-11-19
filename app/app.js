// Leonida Trophy Tracker — checklist UI, detail panel, filters and spoiler mode.
//
// Data comes from data/trophies.json (official names, descriptions and grades
// plus this tracker's own-words guides). Progress lives in store.js.

import {
  loadProgress,
  setEarned,
  setTrophyCount,
  trophyCount,
  isEarned,
  exportProgressFile,
  importProgressFile,
  resetProgress,
  earnedTotal,
  gradeBreakdown,
} from './store.js';
import { renderRoadmap } from './roadmap.js';

const DATA_URL = 'data/trophies.json';
const GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

const state = {
  data: null,
  progress: loadProgress(),
  kind: 'all',
  earnedFilter: 'all',
  query: '',
  spoilers: false,
  selectedId: null,
  view: 'checklist',
};

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function gradeLabel(grade) {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function isStoryTrophy(trophy) {
  return trophy.kinds.includes('story');
}

function isHiddenBySpoiler(trophy) {
  return state.spoilers && isStoryTrophy(trophy) && !isEarned(state.progress, trophy.id);
}

function displayName(trophy) {
  return isHiddenBySpoiler(trophy) ? 'Hidden story trophy' : trophy.name;
}

function displayDescription(trophy) {
  return isHiddenBySpoiler(trophy)
    ? 'Hidden until earned — tick it off to reveal its name and guide.'
    : trophy.description;
}

function kindBadges(trophy) {
  const badges = [`<span class="badge grade-${trophy.grade}">${gradeLabel(trophy.grade)}</span>`];
  if (trophy.hidden) badges.push('<span class="badge hidden-badge">Hidden on PS5</span>');
  if (trophy.missable) badges.push('<span class="badge missable-badge">⚠ Possibly missable</span>');
  for (const kind of trophy.kinds) {
    badges.push(`<span class="badge kind-badge">${escapeHtml(kind)}</span>`);
  }
  return badges.join('');
}

function matchesFilters(trophy) {
  if (state.kind !== 'all' && !trophy.kinds.includes(state.kind)) return false;
  if (state.earnedFilter === 'earned' && !isEarned(state.progress, trophy.id)) return false;
  if (state.earnedFilter === 'unearned' && isEarned(state.progress, trophy.id)) return false;
  if (state.query) {
    const haystack = `${trophy.name} ${trophy.description} ${trophy.guide}`.toLowerCase();
    if (!haystack.includes(state.query)) return false;
  }
  return true;
}

function renderProgress() {
  const total = state.data.trophies.length;
  const earned = earnedTotal(state.progress);
  const pct = total ? Math.round((earned / total) * 100) : 0;
  $('#earned-count').textContent = `${earned} / ${total}`;
  $('#earned-pct').textContent = `${pct}%`;
  $('#progress-fill').style.width = `${pct}%`;
  const breakdown = gradeBreakdown(state.progress, state.data.trophies);
  $('#grade-breakdown').textContent = GRADE_ORDER.map(
    (grade) => `${gradeLabel(grade)} ${breakdown[grade].earned}/${breakdown[grade].total}`,
  ).join(' · ');
}

function renderList() {
  const list = $('#trophy-list');
  const visible = state.data.trophies.filter(matchesFilters);
  if (visible.length === 0) {
    const note = state.kind === 'online'
      ? 'No online trophies — the whole list is single-player, so this filter is empty by design.'
      : 'No trophies match these filters. Try clearing the search or picking another kind.';
    list.innerHTML = `<li class="empty-note">${escapeHtml(note)}</li>`;
    return;
  }
  list.innerHTML = visible
    .map((trophy) => {
      const earned = isEarned(state.progress, trophy.id);
      const count = trophy.count
        ? `<span class="count-pill">${trophyCount(state.progress, trophy.id)} / ${trophy.count.toLocaleString('en-US')} ${escapeHtml(trophy.countLabel || '')}</span>`
        : '';
      return `<li class="trophy-card${earned ? ' earned' : ''}${state.selectedId === trophy.id ? ' selected' : ''}" data-trophy-id="${trophy.id}" tabindex="0" role="button" aria-label="${escapeHtml(displayName(trophy))}">
        <input type="checkbox" class="trophy-check" data-check-id="${trophy.id}" ${earned ? 'checked' : ''} aria-label="Mark ${escapeHtml(displayName(trophy))} as earned">
        <div>
          <h3 class="trophy-name">${escapeHtml(displayName(trophy))}</h3>
          <p class="trophy-desc">${escapeHtml(displayDescription(trophy))}</p>
          <div class="trophy-meta">${kindBadges(trophy)}</div>
        </div>
        ${count}
      </li>`;
    })
    .join('');
  list.querySelectorAll('.trophy-card').forEach((card) => {
    const id = Number(card.dataset.trophyId);
    card.addEventListener('click', (event) => {
      if (event.target.closest('.trophy-check')) return;
      selectTrophy(id);
    });
    card.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.trophy-check')) {
        event.preventDefault();
        selectTrophy(id);
      }
    });
  });
  list.querySelectorAll('.trophy-check').forEach((box) => {
    box.addEventListener('change', (event) => {
      event.stopPropagation();
      const id = Number(box.dataset.checkId);
      state.progress = setEarned(state.progress, id, box.checked);
      renderAll();
    });
  });
}

function renderDetail() {
  const panel = $('#detail');
  const trophy = state.data.trophies.find((t) => t.id === state.selectedId);
  if (!trophy) {
    panel.innerHTML = '<p class="detail-empty">Pick a trophy from the list to see its guide, steps and sources.</p>';
    return;
  }
  const earned = isEarned(state.progress, trophy.id);
  const masked = isHiddenBySpoiler(trophy);
  const steps = masked
    ? '<p>Hidden until earned.</p>'
    : `<ol>${trophy.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`;
  const sources = masked
    ? '<p>Hidden until earned.</p>'
    : `<ul class="source-list">${trophy.sources.map((source) => `<li>${escapeHtml(source)}</li>`).join('')}</ul>`;
  const guide = masked
    ? 'This is a hidden story trophy. Earn it to reveal its guide — the spoiler setting hides story trophies until they are earned.'
    : trophy.guide;
  const warning = trophy.missable
    ? '<p class="missable-warning"><strong>⚠ Possibly missable.</strong> Lucia’s balcony meditation in Chapter 1 is gone after that chapter, and there is no mission replay. Do it in Chapter 1 and keep a Chapter 1 save until the trophy pops.</p>'
    : '';
  const unconfirmed = !masked && /not confirmed|unconfirmed/i.test(trophy.guide)
    ? '<p class="unconfirmed-note"><strong>Not confirmed yet.</strong> No published guide has pinned down this trophy’s exact trigger. This guide says only what the official description implies, rather than inventing steps.</p>'
    : '';
  const counter = trophy.count && !masked
    ? `<div class="counter-row">
        <button type="button" data-count-delta="-1" aria-label="Decrease count">−</button>
        <span class="counter-value">${trophyCount(state.progress, trophy.id)} / ${trophy.count.toLocaleString('en-US')} ${escapeHtml(trophy.countLabel || '')}</span>
        <button type="button" data-count-delta="1" aria-label="Increase count">+</button>
      </div>`
    : '';
  panel.innerHTML = `
    <div class="trophy-meta">${kindBadges(trophy)}</div>
    <h2>${escapeHtml(displayName(trophy))}</h2>
    <p class="official-desc">“${escapeHtml(displayDescription(trophy))}”</p>
    ${warning}
    ${unconfirmed}
    <h3>Guide</h3>
    <p>${escapeHtml(guide)}</p>
    <h3>Steps</h3>
    ${steps}
    ${counter}
    <h3>Sources</h3>
    ${sources}
    <button type="button" class="earn-btn${earned ? ' earned' : ''}" id="earn-btn">${earned ? '✓ Earned — tap to unmark' : 'Mark as earned'}</button>`;
  $('#earn-btn').addEventListener('click', () => {
    state.progress = setEarned(state.progress, trophy.id, !earned);
    renderAll();
  });
  panel.querySelectorAll('[data-count-delta]').forEach((button) => {
    button.addEventListener('click', () => {
      const delta = Number(button.dataset.countDelta);
      const next = trophyCount(state.progress, trophy.id) + delta;
      state.progress = setTrophyCount(state.progress, trophy.id, next, trophy.count);
      renderAll();
    });
  });
}

function renderRoadmapView() {
  renderRoadmap($('#roadmap'), state.data, state.progress, state.spoilers, (id) => {
    selectTrophy(id);
    switchView('checklist');
    document.querySelector('#detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderAll() {
  renderProgress();
  renderList();
  renderDetail();
  if (state.view === 'roadmap') renderRoadmapView();
}

function selectTrophy(id) {
  state.selectedId = id;
  renderList();
  renderDetail();
  history.replaceState(null, '', `#trophy=${id}`);
}

function switchView(view) {
  state.view = view;
  $('#tab-checklist').classList.toggle('active', view === 'checklist');
  $('#tab-roadmap').classList.toggle('active', view === 'roadmap');
  $('#checklist-view').classList.toggle('hidden', view !== 'checklist');
  $('#roadmap-view').classList.toggle('hidden', view !== 'roadmap');
  $('#toolbar').classList.toggle('hidden', view !== 'checklist');
  if (view === 'roadmap') {
    renderRoadmapView();
    history.replaceState(null, '', '#roadmap');
  } else if (state.selectedId) {
    history.replaceState(null, '', `#trophy=${state.selectedId}`);
  } else {
    history.replaceState(null, '', location.pathname);
  }
}

function wireEvents() {
  $('#tab-checklist').addEventListener('click', () => switchView('checklist'));
  $('#tab-roadmap').addEventListener('click', () => switchView('roadmap'));
  $('#search').addEventListener('input', (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderList();
  });
  $('#kind-chips').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-kind]');
    if (!chip) return;
    state.kind = chip.dataset.kind;
    document.querySelectorAll('#kind-chips .chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderList();
  });
  $('#earned-filter').addEventListener('change', (event) => {
    state.earnedFilter = event.target.value;
    renderList();
  });
  $('#spoiler-toggle').addEventListener('change', (event) => {
    state.spoilers = event.target.checked;
    renderAll();
  });
  $('#export-btn').addEventListener('click', () => exportProgressFile(state.progress));
  $('#import-file').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      state.progress = await importProgressFile(file);
      renderAll();
    } catch (error) {
      alert(`Could not import that file: ${error.message}`);
    }
    event.target.value = '';
  });
  $('#reset-btn').addEventListener('click', () => {
    if (confirm('Clear all saved progress in this browser?')) {
      state.progress = resetProgress();
      renderAll();
    }
  });
  window.addEventListener('hashchange', applyHash);
}

function applyHash() {
  const hash = location.hash;
  if (hash === '#roadmap') {
    switchView('roadmap');
    return;
  }
  const match = hash.match(/^#trophy=(\d+)$/);
  if (match) {
    const id = Number(match[1]);
    if (state.data && state.data.trophies.some((t) => t.id === id)) {
      state.selectedId = id;
      switchView('checklist');
      renderAll();
    }
  }
}

async function init() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Could not load ${DATA_URL}`);
  state.data = await response.json();
  wireEvents();
  applyHash();
  if (!state.selectedId) state.selectedId = 28;
  renderAll();
}

init().catch((error) => {
  $('#trophy-list').innerHTML = `<li class="empty-note">Could not load the trophy data: ${escapeHtml(error.message)}</li>`;
});

(() => {
  'use strict';
  const DB_NAME = 'stillnote-local', DB_VERSION = 1, STORE = 'records';
  const STAGES = ['wine-details', 'appearance', 'nose', 'palate', 'conclusions'];
  const LABELS = { 'wine-details': 'Wine details', appearance: 'Appearance', nose: 'Nose', palate: 'Palate', conclusions: 'Conclusions' };
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let db;
  const openDB = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onerror = () => reject(request.error);
  });
  const tx = (mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), store = t.objectStore(STORE); let result;
    try { result = fn(store); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(result?.result); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
  });
  const allRecords = async () => { await openDB(); return tx('readonly', s => s.getAll()); };
  const putRecord = async record => { await openDB(); await tx('readwrite', s => s.put(record)); return record; };
  const removeRecord = async id => { await openDB(); await tx('readwrite', s => s.delete(id)); };
  const dateText = value => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  let mode = 'single', timing = 'before', order = [], stage = 0, currentSession = null, edit = null, photoData = '';
  const sessionBadge = text => { $('.session').innerHTML = `<span></span>${safe(text)}`; };
  const toast = message => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); };
  const primaryHints = {
    Fruit: 'lemon, lime, grapefruit, apple, pear, peach, apricot, berries, cherry, tropical fruit',
    Floral: 'blossom, rose, violet', Herbal: 'grass, fresh herbs, leaf, green pepper',
    Spice: 'pepper, mint, liquorice', Oak: 'Oak-associated notes are in the independent winemaking prompts.',
    Earthy: 'Earthy or mineral-like impressions; describe what you notice in your own words.',
    Other: 'Use your own description for aromas outside these prompts.'
  };
  const processHints = {
    Secondary: { 'Yeast and lees': 'bread, yeast, biscuit, pastry', 'Malolactic fermentation': 'butter, cream, yoghurt', 'Oak ageing': 'vanilla, toast, clove, cedar, smoke, coconut' },
    Tertiary: { 'Fruit development': 'dried fruit, marmalade, prune, fig', 'Bottle age': 'dried flowers, mushroom, forest floor, leather, tobacco', 'Oxidative development': 'nuts, honey, caramel, dried fruit' }
  };
  const wineColors = {
    white: [['Lemon-green', '#cbd58b'], ['Lemon', '#eee4aa'], ['Gold', '#c9a343'], ['Amber', '#d6a65f'], ['Brown', '#98704c']],
    rose: [['Pink', '#e9b3aa'], ['Pink-orange', '#df927c'], ['Orange', '#d77950']],
    red: [['Purple', '#6c3151'], ['Ruby', '#9b3948'], ['Garnet', '#742b34'], ['Tawny', '#ad7654']]
  };
  function setupColorPalette() {
    const palette = $('#palette'); if (!palette) return;
    const setColor = (name, color, button) => {
      $$('.swatch', palette).forEach(item => item.classList.toggle('selected', item === button));
      $('#colorName').textContent = name;
      $('#glass').style.background = `linear-gradient(to top,${color} 0 47%,transparent 48%)`;
    };
    const draw = family => {
      const colors = wineColors[family] || wineColors.white;
      palette.replaceChildren(...colors.map(([name, color], index) => {
        const swatch = document.createElement('button'); swatch.className = `swatch${index === 0 ? ' selected' : ''}`;
        swatch.type = 'button'; swatch.title = name; swatch.setAttribute('aria-label', name); swatch.style.background = color;
        swatch.addEventListener('click', () => setColor(name, color, swatch)); return swatch;
      }));
      const [name, color] = colors[0]; setColor(name, color, palette.firstElementChild);
      $('.glasslabel').textContent = family === 'rose' ? 'Rosé wine' : family === 'red' ? 'Red wine' : 'White wine';
    };
    $$('#wineTypes .pill').forEach(button => button.addEventListener('click', () => {
      window.stillnoteFamily = button.dataset.family;
      draw(window.stillnoteFamily);
    }));
    window.stillnoteFamily = 'white'; draw('white');
  }
  function updateVocabulary(stage) {
    const group = $(`[data-vocab="${stage}"]`), box = $(`#${stage}Hints`);
    if (!group || !box) return;
    const families = $$('.pill.selected', group).map(x => x.textContent.trim());
    const primary = families.length ? families.map(family => {
      const terms = primaryHints[family] || primaryHints.Other;
      return `<div class="hintgroup"><b>${safe(family)}</b><br>${safe(terms)}<br>${terms.split(', ').map(term => `<button class="example" type="button" data-term="${safe(term)}">${safe(term)}</button>`).join('')}</div>`;
    }).join('') : '<div class="descriptor">Choose any primary families to browse grape and growing-condition examples.</div>';
    const termsGroup = (items) => Object.entries(items).map(([label, terms]) => `<div class="hintgroup"><b>${safe(label)}</b><br>${safe(terms)}<br>${terms.split(', ').map(term => `<button class="example" type="button" data-term="${safe(term)}">${safe(term)}</button>`).join('')}</div>`).join('');
    box.innerHTML = `<details class="aroma-stage primary-stage" open><summary>Primary · grape and growing conditions</summary>${primary}</details><details class="aroma-stage"><summary>Secondary · fermentation and winemaking</summary><p>These processes can add aromas alongside any primary family.</p>${termsGroup(processHints.Secondary)}</details><details class="aroma-stage"><summary>Tertiary · ageing and bottle development</summary><p>Ageing aromas can accompany primary and secondary notes.</p>${termsGroup(processHints.Tertiary)}</details><div class="descriptor">Tap examples to add them to your note. They are prompts, not a checklist.</div>`;
    box.querySelectorAll('.example').forEach(button => button.addEventListener('click', () => {
      const field = stage === 'nose' ? $('#nose textarea') : $('#palateNotes');
      if (!field) return;
      const terms = field.value.split(/,\s*/).filter(Boolean), term = button.dataset.term;
      if (terms.includes(term)) terms.splice(terms.indexOf(term), 1); else terms.push(term);
      field.value = terms.join(', '); button.classList.toggle('picked', terms.includes(term)); field.dispatchEvent(new Event('input', { bubbles: true }));
    }));
  }
  function setupVocabulary() {
    $$('[data-vocab]').forEach(group => {
      const stageName = group.dataset.vocab;
      updateVocabulary(stageName);
      group.addEventListener('click', event => { if (event.target.closest('.pill')) setTimeout(() => updateVocabulary(stageName), 0); });
    });
  }
  const getWine = () => {
    const data = {};
    for (const id of STAGES) {
      const section = document.getElementById(id), fields = {}, choices = {};
      if (!section) continue;
      $$('.field', section).forEach(field => {
        const box = field.closest('.formgrid > div') || field.parentElement;
        const label = [...box.children].find(x => x.classList?.contains('label'))?.textContent.replace(/\s*·.*$/, '').trim() || field.id || field.placeholder || 'Note';
        if (field.type !== 'file') fields[label] = field.value.trim();
      });
      $$('.selects', section).forEach(group => {
        const box = group.closest('.formgrid > div') || group.parentElement;
        const label = $('.label', box)?.textContent.replace(/\s*·.*$/, '').trim();
        const selected = $$('.pill.selected', group).map(x => x.textContent.trim());
        if (label && selected.length) choices[label] = selected;
      });
      data[id] = { fields, choices };
    }
    data.appearance.colorFamily = window.stillnoteFamily || 'white';
    data.appearance.color = $('#colorName')?.textContent.trim() || '';
    data.appearance.photo = photoData;
    const wineName = data['wine-details']?.fields['Wine name'] || '';
    data.name = wineName || 'Untitled wine';
    data.updatedAt = Date.now();
    return data;
  };
  const restoreWine = data => {
    $$('.stage-card .field').forEach(x => { if (x.type !== 'file') x.value = ''; });
    $$('.stage-card .pill.selected').forEach(x => x.classList.remove('selected'));
    photoData = data?.appearance?.photo || '';
    if (!data) {
      window.stillnoteFamily = 'white';
      $('#wineTypes [data-family="white"]')?.click();
      $$('.swatch')[0]?.click();
      refreshPhoto();
      return;
    }
    for (const id of STAGES) {
      const section = document.getElementById(id), saved = data[id]; if (!section || !saved) continue;
      $$('.field', section).forEach(field => {
        const box = field.closest('.formgrid > div') || field.parentElement;
        const label = [...box.children].find(x => x.classList?.contains('label'))?.textContent.replace(/\s*·.*$/, '').trim() || field.id || field.placeholder || 'Note';
        if (field.type !== 'file' && saved.fields?.[label] != null) field.value = saved.fields[label];
      });
      $$('.selects', section).forEach(group => {
        const box = group.closest('.formgrid > div') || group.parentElement;
        const label = $('.label', box)?.textContent.replace(/\s*·.*$/, '').trim();
        const values = saved.choices?.[label] || [];
        $$('.pill', group).forEach(p => p.classList.toggle('selected', values.includes(p.textContent.trim())));
      });
    }
    if (data.appearance?.colorFamily) {
      const button = $(`#wineTypes [data-family="${data.appearance.colorFamily}"]`); button?.click();
      const colorButton = $$('.swatch').find(x => x.title === data.appearance.color);
      colorButton?.click();
    }
    refreshPhoto();
    $$('[data-vocab]').forEach(g => updateVocabulary(g.dataset.vocab));
  };
  function draftPayload() { return { mode, timing, order, stage, currentSession, edit, wine: getWine(), savedAt: Date.now() }; }
  function saveDraft() {
    if (!order.length || $('#columns').style.display === 'none') return;
    try { localStorage.setItem('stillnote-draft', JSON.stringify(draftPayload())); } catch { toast('Draft could not be saved. Try a smaller bottle photo.'); }
  }
  function makeOrder() { return timing === 'before' ? [...STAGES] : ['appearance', 'nose', 'palate', 'conclusions', 'wine-details']; }
  function showStage(index) {
    stage = Math.max(0, Math.min(index, order.length - 1));
    const active = order[stage];
    $$('.stage-card').forEach(x => x.style.display = x.id === active ? 'block' : 'none');
    $('#setupCard').style.display = 'none'; if ($('#libraryView')) $('#libraryView').style.display = 'none'; $('#columns').style.display = 'grid'; $('#progress').style.display = 'flex';
    const wideLayout = active === 'appearance' && window.matchMedia('(min-width: 851px)').matches; $('#aside').style.display = wideLayout ? '' : 'none'; $('#columns').style.gridTemplateColumns = wideLayout ? 'minmax(0,1fr) 300px' : 'minmax(0,1fr)';
    $('#progress').innerHTML = order.map((id, i) => `<button class="step ${i < stage ? 'done' : i === stage ? 'current' : ''}" data-index="${i}" aria-label="${LABELS[id]}"><span class="num">${i + 1}</span><span class="text">${LABELS[id]}</span></button>`).join('');
    $$('.step').forEach(b => b.onclick = () => showStage(Number(b.dataset.index)));
    const isLast = stage === order.length - 1;
    const finalText = edit ? 'Save changes' : mode === 'session' ? 'Add wine to session' : 'Save private note';
    $('#stageNav').style.display = 'flex';
    $('#stageNav').innerHTML = `${stage ? '<button class="btn" id="backStage">← Back</button>' : `<span class="save">Private to you · ${safe(mode === 'session' ? currentSession?.name : 'Single wine note')}</span>`}<div class="actions">${active === 'wine-details' && timing === 'after' ? '<button class="btn" id="skipIdentity">Save without details</button>' : ''}<button class="btn primary" id="continueStage">${isLast ? finalText : `Continue to ${LABELS[order[stage + 1]]}　→`}</button></div>`;
    $('#backStage')?.addEventListener('click', () => showStage(stage - 1));
    $('#continueStage').addEventListener('click', () => isLast ? saveWine() : (saveDraft(), showStage(stage + 1)));
    $('#skipIdentity')?.addEventListener('click', saveWine);
    saveDraft(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function beginNewWine() { edit = null; restoreWine(null); order = makeOrder(); showStage(0); }
  async function begin() {
    if (mode === 'session') {
      currentSession = { id: uid(), type: 'session', name: $('#sessionName').value.trim() || `Tasting session · ${dateText(Date.now())}`, createdAt: Date.now(), updatedAt: Date.now(), wines: [] };
      sessionBadge(`${currentSession.name} · 0 wines`);
    } else { currentSession = null; sessionBadge('Single wine note'); }
    beginNewWine();
  }
  async function saveWine() {
    const wine = getWine();
    if (edit) {
      const records = await allRecords(), record = records.find(x => x.id === edit.recordId);
      const returnFilter = record?.type === 'session' ? 'sessions' : 'notes';
      if (record) { record.wines[edit.wineIndex] = wine; record.updatedAt = Date.now(); await putRecord(record); }
      edit = null; localStorage.removeItem('stillnote-draft'); toast('Tasting note updated on this device.'); showLibrary(returnFilter); return;
    }
    if (mode === 'session' && currentSession) {
      currentSession.wines.push(wine); currentSession.updatedAt = Date.now(); await putRecord(currentSession);
      localStorage.setItem('stillnote-session', JSON.stringify(currentSession)); localStorage.removeItem('stillnote-draft');
      showSavedPanel(`Added ${wine.name} to “${currentSession.name}”`, `<button class="btn" id="finishSession">Finish session</button><button class="btn primary" id="anotherWine">Add another wine　＋</button>`);
      $('#finishSession').onclick = () => { sessionBadge(`${currentSession.name} · ${currentSession.wines.length} wines`); currentSession = null; localStorage.removeItem('stillnote-session'); $('#donePanel').remove(); showLibrary('sessions'); };
      $('#anotherWine').onclick = () => { restoreWine(null); order = makeOrder(); showStage(0); };
    } else {
      await putRecord({ id: uid(), type: 'single', name: wine.name, createdAt: Date.now(), updatedAt: Date.now(), wines: [wine] });
      localStorage.removeItem('stillnote-draft'); showSavedPanel('Your tasting note is saved on this device.', '<button class="btn" id="viewNotes">View my notes</button><button class="btn primary" id="newNote">Start another note　＋</button>');
      $('#viewNotes').onclick = () => showLibrary('notes'); $('#newNote').onclick = resetToSetup;
    }
    toast('Saved on this device.');
  }
  function showSavedPanel(message, buttons) {
    $('#columns').style.display = 'none'; $('#progress').style.display = 'none'; $('#aside').style.display = 'none';
    $('#stageNav').style.display = 'none';
    let panel = $('#donePanel'); if (!panel) { panel = document.createElement('section'); panel.id = 'donePanel'; panel.className = 'card setup-card'; $('.main').append(panel); }
    panel.innerHTML = `<div class="eyebrow">Saved privately on this device</div><h2>${safe(message)}</h2><p class="sub">Your note stays in this browser. It won’t sync to other devices.</p><div class="actions" style="margin-top:18px">${buttons}</div>`;
  }
  function resetToSetup() {
    $('#donePanel')?.remove(); $('#dashboard').style.display = 'none'; if ($('#libraryView')) $('#libraryView').style.display = 'none'; $('#setupCard').style.display = 'block'; $('#columns').style.display = 'none'; $('#progress').style.display = 'none'; $('#stageNav').style.display = 'none'; $('.crumb').innerHTML = 'Tastings　/　<b>New tasting</b>'; $('.heading h1').textContent = 'Let’s taste something.'; $('.heading .sub').textContent = 'Start with what you can see. The rest can wait.';
    restoreWine(null); order = []; mode = 'single'; timing = 'before'; currentSession = null; sessionBadge('New tasting');
    $$('#modeChoices .pill').forEach(x => x.classList.toggle('selected', x.dataset.mode === 'single'));
    $$('#identityTiming .pill').forEach(x => x.classList.toggle('selected', x.dataset.timing === 'before'));
    $('#sessionNameRow').style.display = 'none'; $('#sessionName').value = ''; $('#donePanel')?.remove(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  async function showDashboard() {
    $('#donePanel')?.remove(); $('#setupCard').style.display = 'none'; $('#columns').style.display = 'none'; $('#progress').style.display = 'none'; $('#stageNav').style.display = 'none'; $('#aside').style.display = 'none';
    if ($('#libraryView')) $('#libraryView').style.display = 'none';
    const dashboard = $('#dashboard'); dashboard.style.display = 'block';
    $('.crumb').innerHTML = 'Tastings　/　<b>Home</b>'; $('.heading h1').textContent = 'Your tasting journal'; $('.heading .sub').textContent = 'A little record of the wines you’ve explored.';
    $$('.rail .nav').forEach(x => x.classList.toggle('active', x.dataset.view === 'overview'));
    $$('.mobilebar > div').forEach(x => x.classList.toggle('on', x.dataset.nav === 'home'));
    const records = (await allRecords()).sort((a, b) => b.updatedAt - a.updatedAt);
    const wines = records.flatMap(record => (record.wines || []).map((wine, index) => ({ record, wine, index })));
    const sessions = records.filter(record => record.type === 'session');
    const regions = new Set(wines.map(({ wine }) => wine['wine-details']?.fields?.['Country or region']).filter(Boolean));
    const draft = (() => { try { const value = JSON.parse(localStorage.getItem('stillnote-draft') || 'null'); return value?.wine && value.savedAt && Date.now() - value.savedAt < 30 * 86400000 ? value : null; } catch { return null; } })();
    const resumeStage = LABELS[draft?.order?.[draft.stage] || 'appearance'] || 'tasting';
    dashboard.innerHTML = '<section class="dash-welcome"><div><div class="eyebrow">Your private cellar</div><h2>Every glass has a story.</h2><p class="sub">Keep track of the wines you’ve tasted and the details you want to remember.</p></div><button class="btn primary" id="dashNew">Start a tasting　＋</button></section>' +
      (draft ? '<section class="card dash-resume"><div><div class="eyebrow">In progress</div><strong>Resume your ' + safe(resumeStage.toLowerCase()) + ' notes</strong><div class="sub">Your unfinished tasting is saved on this device.</div></div><button class="btn" id="dashResume">Resume tasting　→</button></section>' : '') +
      '<section class="dash-stats" aria-label="Your tasting stats"><article class="card dash-stat"><span>Wines tried</span><strong>' + wines.length + '</strong><span>Across your notes and sessions</span></article><article class="card dash-stat"><span>Tasting sessions</span><strong>' + sessions.length + '</strong><span>' + sessions.reduce((sum, session) => sum + (session.wines?.length || 0), 0) + ' wines tasted together</span></article><article class="card dash-stat"><span>Places explored</span><strong>' + regions.size + '</strong><span>' + (regions.size ? 'Different regions in your notes' : 'Add a region to your wine details') + '</span></article></section>' +
      '<div class="dash-section-head"><h2>Recently tasted</h2><button id="dashAllNotes">See all notes　→</button></div>' +
      (wines.length ? '<section class="dash-recent">' + wines.slice(0, 4).map(({ record, wine, index }) => { const region = wine['wine-details']?.fields?.['Country or region']; const vintage = wine['wine-details']?.fields?.Vintage; const color = wine.appearance?.colorFamily === 'white' ? '#c6ae5f' : wine.appearance?.colorFamily === 'rose' ? '#cf8e86' : '#80414c'; return '<article class="card dash-wine" data-record="' + safe(record.id) + '" data-wine="' + index + '" tabindex="0"><span class="dash-color"><i class="dash-dot" style="background:' + color + '"></i>' + safe(wine.appearance?.color || wine.appearance?.colorFamily || 'Tasting note') + '</span><h3>' + safe(wine.name || 'Untitled wine') + '</h3><p>' + safe([region, vintage].filter(Boolean).join(' · ') || 'Wine tasting note') + '<br>' + safe(dateText(record.updatedAt || record.createdAt)) + '</p></article>'; }).join('') + '</section>' : '<section class="card dash-empty"><h3>Your journal starts with a first tasting.</h3><p class="sub">Record a wine on its own or create a session to taste several wines together. Notes stay private on this device.</p><button class="btn primary" id="dashFirst">Begin your first tasting　→</button></section>') +
      (sessions.length ? '<section class="card dash-session"><div><h3>Last tasting session</h3><p>' + safe(sessions[0].name) + ' · ' + (sessions[0].wines?.length || 0) + ' ' + ((sessions[0].wines?.length || 0) === 1 ? 'wine' : 'wines') + ' · ' + safe(dateText(sessions[0].updatedAt || sessions[0].createdAt)) + '</p></div><button class="btn" id="dashSessions">View sessions</button></section>' : '');
    $('#dashNew').onclick = resetToSetup; $('#dashFirst')?.addEventListener('click', resetToSetup); $('#dashAllNotes').onclick = () => showLibrary('notes'); $('#dashSessions')?.addEventListener('click', () => showLibrary('sessions'));
    $('#dashResume')?.addEventListener('click', () => { mode = draft.mode || 'single'; timing = draft.timing || 'before'; order = draft.order?.length ? draft.order : makeOrder(); stage = draft.stage || 0; currentSession = draft.currentSession || null; edit = draft.edit || null; restoreWine(draft.wine); showStage(stage); });
    $$('.dash-wine').forEach(card => { const open = () => showRecord(card.dataset.record); card.addEventListener('click', open); card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }); });
  }
  function getLibraryView() { let view = $('#libraryView'); if (!view) { view = document.createElement('section'); view.id = 'libraryView'; view.className = 'library-view'; $('#stageNav').before(view); } return view; }
  async function showLibrary(filter = 'notes') {
    $('#donePanel')?.remove(); $('#setupCard').style.display = 'none'; $('#columns').style.display = 'none'; $('#progress').style.display = 'none'; $('#stageNav').style.display = 'none'; $('#aside').style.display = 'none';
    $('#dashboard').style.display = 'none'; $('.crumb').innerHTML = 'Tastings　/　<b>' + (filter === 'sessions' ? 'Sessions' : 'Notes') + '</b>'; $('.heading h1').textContent = filter === 'sessions' ? 'Tasting sessions' : 'My tasting notes'; $('.heading .sub').textContent = 'Saved privately on this device.'; $$('.rail .nav').forEach(x => x.classList.toggle('active', x.dataset.view === filter)); $$('.mobilebar > div').forEach(x => x.classList.toggle('on', x.dataset.nav === filter)); const view = getLibraryView(); view.style.display = 'block';
    const records = (await allRecords()).sort((a, b) => b.updatedAt - a.updatedAt), filtered = records.filter(r => filter === 'all' || (filter === 'sessions' ? r.type === 'session' : r.type === 'single'));
    view.replaceChildren();
    const header = document.createElement('div'); header.className = 'library-head';
    const h = document.createElement('div'); h.innerHTML = `<div class="eyebrow">Your private cellar</div><h1>${filter === 'sessions' ? 'Tasting sessions' : filter === 'all' ? 'Overview' : 'My tasting notes'}</h1><p class="sub">Saved in this browser · ${records.length} ${records.length === 1 ? 'record' : 'records'}</p>`;
    const start = document.createElement('button'); start.className = 'btn primary'; start.textContent = 'New tasting　＋'; start.onclick = resetToSetup; header.append(h, start); view.append(header);
    if (!filtered.length) { const empty = document.createElement('div'); empty.className = 'card empty-state'; empty.innerHTML = '<h2>No notes saved yet</h2><p class="sub">Start a tasting and your private notes will appear here.</p>'; const cta = document.createElement('button'); cta.className = 'btn primary'; cta.textContent = 'Begin a tasting'; cta.onclick = resetToSetup; empty.append(cta); view.append(empty); return; }
    filtered.forEach(record => {
      const card = document.createElement('article'); card.className = 'card record-card';
      const title = record.type === 'session' ? record.name : record.wines?.[0]?.name || record.name || 'Untitled wine';
      const sub = record.type === 'session' ? `${record.wines.length} ${record.wines.length === 1 ? 'wine' : 'wines'} · session` : `${record.wines?.[0]?.['wine-details']?.fields?.['Country or region'] || 'Wine tasting note'}`;
      const top = document.createElement('div'); top.className = 'record-top';
      const meta = document.createElement('div'); meta.innerHTML = `<h2>${safe(title)}</h2><p class="sub">${safe(sub)} · ${safe(dateText(record.updatedAt || record.createdAt))}</p>`;
      const open = document.createElement('button'); open.className = 'btn'; open.textContent = 'Open'; open.onclick = () => showRecord(record.id);
      top.append(meta, open); card.append(top);
      if (record.wines?.length) { const wineList = document.createElement('div'); wineList.className = 'record-wines'; record.wines.forEach((wine, i) => { const row = document.createElement('div'); row.className = 'record-wine'; const n = document.createElement('span'); n.textContent = wine.name || `Wine ${i + 1}`; const editBtn = document.createElement('button'); editBtn.className = 'text-button'; editBtn.textContent = 'Edit note'; editBtn.onclick = () => editWine(record.id, i); row.append(n, editBtn); wineList.append(row); }); card.append(wineList); }
      view.append(card);
    });
  }
  async function showRecord(id) {
    const record = (await allRecords()).find(x => x.id === id); if (!record) return showLibrary('notes');
    $('#dashboard').style.display = 'none'; $('#setupCard').style.display = 'none'; $('.heading h1').textContent = record.type === 'session' ? 'Tasting session' : 'Tasting note'; $('.heading .sub').textContent = 'Your notes, kept private on this device.'; const view = getLibraryView(); view.replaceChildren(); view.style.display = 'block';
    const back = document.createElement('button'); back.className = 'btn'; back.textContent = '← Back to notes'; back.onclick = () => showLibrary(record.type === 'session' ? 'sessions' : 'notes'); view.append(back);
    const heading = document.createElement('div'); heading.className = 'library-head'; heading.innerHTML = `<div><div class="eyebrow">${record.type === 'session' ? 'Tasting session' : 'Wine tasting note'}</div><h1>${safe(record.type === 'session' ? record.name : record.wines?.[0]?.name || record.name)}</h1><p class="sub">${safe(dateText(record.updatedAt || record.createdAt))} · private to you</p></div>`; view.append(heading);
    (record.wines || []).forEach((wine, i) => {
      const card = document.createElement('article'); card.className = 'card detail-card'; const h = document.createElement('h2'); h.textContent = wine.name || `Wine ${i + 1}`; card.append(h);
      if (wine.appearance?.photo) { const image = document.createElement('img'); image.src = wine.appearance.photo; image.alt = 'Bottle or label'; image.className = 'bottle-preview'; card.append(image); }
      STAGES.forEach(id => { const stageData = wine[id]; if (!stageData) return; const rows = [...Object.entries(stageData.fields || {}).filter(([, v]) => v), ...Object.entries(stageData.choices || {}).map(([k, v]) => [k, v.join(', ')])]; if (id === 'appearance' && stageData.color) rows.push(['Colour', stageData.color]); if (!rows.length) return; const block = document.createElement('div'); block.className = 'detail-stage'; const label = document.createElement('h3'); label.textContent = LABELS[id]; block.append(label); rows.forEach(([key, value]) => { const p = document.createElement('p'); p.innerHTML = `<b>${safe(key)}</b> ${safe(value)}`; block.append(p); }); card.append(block); });
      const e = document.createElement('button'); e.className = 'btn'; e.textContent = 'Edit this wine note'; e.onclick = () => editWine(record.id, i); card.append(e); view.append(card);
    });
  }
  async function editWine(recordId, wineIndex) {
    const record = (await allRecords()).find(x => x.id === recordId); if (!record) return;
    mode = 'single'; timing = 'before'; edit = { recordId, wineIndex }; currentSession = null; restoreWine(record.wines[wineIndex]);
    order = [...STAGES]; sessionBadge(`Editing · ${record.wines[wineIndex].name || 'Wine note'}`); $('#libraryView').style.display = 'none'; showStage(0);
  }
  function createPhotoControl() {
    const photo = $('.photo'); if (!photo) return;
    photo.setAttribute('role', 'button'); photo.setAttribute('tabindex', '0'); photo.setAttribute('aria-label', 'Add bottle label photo');
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.hidden = true; input.id = 'photoInput'; photo.after(input);
    photo.onclick = () => input.click(); photo.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
    input.onchange = async () => { const file = input.files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) return toast('Choose an image file.');
      try { const source = await createImageBitmap(file); const scale = Math.min(1, 1000 / Math.max(source.width, source.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(source.width * scale); canvas.height = Math.round(source.height * scale); canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height); photoData = canvas.toDataURL('image/jpeg', .78); refreshPhoto(); saveDraft(); } catch { toast('Could not read that image. Please try another one.'); }
    };
  }
  function refreshPhoto() { const photo = $('.photo'); if (!photo) return; if (photoData) { photo.innerHTML = `<img src="${photoData}" alt="Bottle label preview" style="width:64px;height:82px;object-fit:cover;border-radius:7px"><div><strong>Change label photo</strong><small>Stored on this device</small></div>`; } else { photo.innerHTML = '<div class="photoicon">＋</div><div><strong>Add a label photo</strong><small>Take a photo or choose from library</small></div>'; } }
  function setupLibrary() {
    $$('.rail .nav').forEach(item => item.addEventListener('click', () => { const view = item.dataset.view; if (view === 'overview') showDashboard(); else if (view === 'new') resetToSetup(); else showLibrary(view); }));
    $$('.mobilebar > div').forEach((item, i) => item.addEventListener('click', () => { $$('.mobilebar > div').forEach(x => x.classList.remove('on')); item.classList.add('on'); if (i === 0) resetToSetup(); else showLibrary(i === 2 ? 'sessions' : 'notes'); }));
    $$('.rail .wineitem').forEach(item => item.remove());
  }
  function bindPills() {
    // Selection behavior belongs to the app, so the prototype script is not required.
    $$('button').forEach(b => { if (!b.hasAttribute('type')) b.type = 'button'; });
    document.addEventListener('click', event => {
      const pill = event.target.closest('.pill');
      if (!pill) return;
      const group = pill.closest('.selects');
      if (group && !group.hasAttribute('data-multi')) {
        $$('.pill', group).forEach(item => item.classList.toggle('selected', item === pill));
      } else pill.classList.toggle('selected');
    });
    $$('#modeChoices .pill').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; $('#sessionNameRow').style.display = mode === 'session' ? 'grid' : 'none'; }));
    $$('#identityTiming .pill').forEach(b => b.addEventListener('click', () => { timing = b.dataset.timing; }));
    $('#begin').onclick = begin;
    $$('.stage-card input,.stage-card textarea').forEach(el => el.addEventListener('input', saveDraft));
    document.addEventListener('click', e => { if (e.target.closest('.stage-card .pill,.stage-card .swatch')) setTimeout(saveDraft, 0); });
    const toggle = $('#toggle'); toggle.setAttribute('role', 'switch'); toggle.setAttribute('tabindex', '0'); toggle.setAttribute('aria-checked', 'true');
    const toggleGuidance = () => { toggle.classList.toggle('off'); const on = !toggle.classList.contains('off'); toggle.setAttribute('aria-checked', String(on)); $$('.tip,#aside').forEach(el => el.style.display = on ? '' : 'none'); };
    toggle.onclick = toggleGuidance; toggle.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGuidance(); } };
    const current = $('#hint'); if (current) current.style.display = '';
  }
  function setupInstall() {
    let installEvent = null;
    const button = $('#installApp');
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installEvent = event; });
    button?.addEventListener('click', async () => {
      if (installEvent) {
        installEvent.prompt();
        await installEvent.userChoice;
        installEvent = null;
        return;
      }
      const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      toast(isAppleMobile ? 'In Safari, tap Share, then Add to Home Screen.' : 'Open your browser menu and choose Install app or Add to Home screen.');
    });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('service-worker.js').catch(() => toast('Offline setup could not start. Notes still save on this device.'));
    }
  }
  async function init() {
    window.stillnoteFamily = 'white';
    // Track the wine colour family selected by the visual swatches.
    $$('#wineTypes .pill').forEach(b => b.addEventListener('click', () => { window.stillnoteFamily = b.dataset.family; }));
    createPhotoControl(); setupColorPalette(); setupLibrary(); bindPills(); setupVocabulary(); setupInstall();
    try {
      await openDB();
      const draft = localStorage.getItem('stillnote-draft');
      if (draft) {
        const d = JSON.parse(draft);
        if (d.wine && d.savedAt && Date.now() - d.savedAt < 30 * 86400000) {
          const resume = document.createElement('button'); resume.className = 'btn'; resume.textContent = `Resume unsaved tasting · ${LABELS[d.order?.[d.stage] || 'appearance'] || 'tasting'}`; resume.style.marginTop = '10px'; $('#setupCard').append(resume);
          resume.onclick = () => { mode = d.mode || 'single'; timing = d.timing || 'before'; order = d.order?.length ? d.order : makeOrder(); stage = d.stage || 0; currentSession = d.currentSession || null; edit = d.edit || null; restoreWine(d.wine); showStage(stage); };
        }
      }
      const records = await allRecords(); const recent = records.sort((a,b) => b.updatedAt-a.updatedAt).slice(0,3); const rail = $('.recent');
      recent.forEach(record => { const item = document.createElement('div'); item.className = 'wineitem'; const wine = record.wines?.[0]; item.innerHTML = `<strong>${safe(record.type === 'session' ? record.name : wine?.name || record.name)}</strong>${safe(dateText(record.updatedAt || record.createdAt))}`; item.onclick = () => showRecord(record.id); item.style.cursor = 'pointer'; rail?.after(item); }); await showDashboard();
    } catch { toast('Device storage is unavailable in this browser.'); }
  }
  init();
})();

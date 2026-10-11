// Health OS PWA - Main App Logic
(function() {
  'use strict';
  
  localStorage.clear();  // Clear stale cache before ANY async work
  
  // Configuration
  const CONFIG = {
    privateRepo: 'RohitKankhedia/rohit-health-os',
    publicRepo: 'RohitKankhedia/rohitkankhediya.web',
    dataPaths: {
      schedule: 'data/schedule/current.json',
      analytics: 'data/analytics/latest.json',
      publicMetrics: 'data/public_metrics.json',
      profile: 'data/health/profile.json',
      exercises: 'data/library/exercises.json'
    },
    cacheKeys: {
      schedule: 'healthos_schedule',
      analytics: 'healthos_analytics',
      publicMetrics: 'healthos_public_metrics',
      profile: 'healthos_profile',
      exercises: 'healthos_exercises'
    }
  };

  // Cache buster to force fresh fetches (bypasses localStorage cache)
  const CACHE_BUSTER = '?v=' + Date.now();

  // Debug logging
  function debugLog(...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const timestamp = new Date().toISOString().substr(11, 12);
    state.debugLog.push(`[${timestamp}] ${msg}`);
    if (state.debugLog.length > 50) state.debugLog.shift();
    console.log(msg);
    if (els.debugPanel) {
      els.debugPanel.innerHTML = state.debugLog.join('<br>');
    }
  }

  // Force SW update on load
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
  }

  // State
  let state = {
    schedule: null,
    analytics: null,
    publicMetrics: null,
    profile: null,
    exercises: null,
    lastFetch: null,
    online: false,
    debugLog: []
  };

  // DOM Elements (queried in init, after DOM ready)
  let els = {};

  const MUSCLE_GROUPS = {
    neck: { label: 'Neck', paths: ['neck'] },
    left_shoulder: { label: 'Left Shoulder', paths: ['left_shoulder'] },
    right_shoulder: { label: 'Right Shoulder', paths: ['right_shoulder'] },
    front_delt: { label: 'Front Delts', paths: ['front_delt'] },
    side_delt: { label: 'Side Delts', paths: ['side_delt'] },
    rear_delt: { label: 'Rear Delts', paths: ['rear_delt'] },
    chest: { label: 'Chest', paths: ['chest'] },
    lats: { label: 'Lats', paths: ['lats'] },
    upper_back: { label: 'Upper Back', paths: ['upper_back'] },
    lower_back: { label: 'Lower Back', paths: ['lower_back'] },
    left_bicep: { label: 'Left Bicep', paths: ['left_bicep'] },
    left_forearm: { label: 'Left Forearm', paths: ['left_forearm'] },
    right_bicep: { label: 'Right Bicep', paths: ['right_bicep'] },
    right_forearm: { label: 'Right Forearm', paths: ['right_forearm'] },
    triceps: { label: 'Triceps', paths: ['triceps'] },
    abs: { label: 'Abs', paths: ['abs'] },
    left_oblique: { label: 'Left Oblique', paths: ['left_oblique'] },
    right_oblique: { label: 'Right Oblique', paths: ['right_oblique'] },
    glutes: { label: 'Glutes', paths: ['glutes'] },
    left_quad: { label: 'Left Quad', paths: ['left_quad'] },
    right_quad: { label: 'Right Quad', paths: ['right_quad'] },
    left_hamstring: { label: 'Left Hamstring', paths: ['left_hamstring'] },
    right_hamstring: { label: 'Right Hamstring', paths: ['right_hamstring'] },
    left_calf: { label: 'Left Calf', paths: ['left_calf'] },
    right_calf: { label: 'Right Calf', paths: ['right_calf'] },
    left_shin: { label: 'Left Shin', paths: ['left_shin'] },
    right_shin: { label: 'Right Shin', paths: ['right_shin'] },
    left_foot: { label: 'Left Foot', paths: ['left_foot'] },
    right_foot: { label: 'Right Foot', paths: ['right_foot'] }
  };

  const BODY_MAP_PATHS = {
    neck: 'M185,80 C175,85 170,95 172,110 C174,125 180,135 190,138 L210,138 C220,135 226,125 228,110 C230,95 225,85 215,80 Z',
    left_shoulder: 'M140,140 C125,138 110,145 100,160 C92,175 88,195 92,215 C96,235 108,250 125,255 C140,258 155,250 162,235 C168,218 165,195 158,175 C152,158 148,145 140,140 Z',
    right_shoulder: 'M260,140 C275,138 290,145 300,160 C308,175 312,195 308,215 C304,235 292,250 275,255 C260,258 245,250 238,235 C232,218 235,195 242,175 C248,158 252,145 260,140 Z',
    chest: 'M145,175 C160,160 185,150 200,148 C215,150 240,160 255,175 L258,260 C255,285 240,300 220,305 C200,308 180,305 160,300 C145,295 142,280 145,260 Z',
    left_bicep: 'M95,220 C85,235 78,260 80,290 C82,320 90,345 105,355 C118,362 132,355 138,340 C142,325 140,300 135,275 C130,250 125,230 115,220 C108,215 100,215 95,220 Z',
    right_bicep: 'M305,220 C315,235 322,260 320,290 C318,320 310,345 295,355 C282,362 268,355 262,340 C258,325 260,300 265,275 C270,250 275,230 285,220 C292,215 300,215 305,220 Z',
    left_forearm: 'M80,355 C72,375 68,405 72,435 C76,465 88,490 105,498 C120,504 135,498 142,485 C148,470 148,445 145,420 C142,395 138,370 132,355 C125,345 110,345 95,348 C88,350 82,352 80,355 Z',
    right_forearm: 'M320,355 C328,375 332,405 328,435 C324,465 312,490 295,498 C280,504 265,498 258,485 C252,470 252,445 255,420 C258,395 262,370 268,355 C275,345 290,345 305,348 C312,350 318,352 320,355 Z',
    abs: 'M155,310 C170,300 190,295 200,295 C210,295 230,300 245,310 L248,420 C245,445 230,460 210,465 C190,468 170,465 155,460 L152,420 C150,395 150,370 152,345 C153,330 154,318 155,310 Z',
    left_oblique: 'M148,310 C135,320 125,340 122,365 C120,390 125,415 135,435 C145,452 160,460 175,458 C188,455 195,445 195,430 C195,415 190,395 185,375 C180,355 175,335 168,320 C162,312 155,308 148,310 Z',
    right_oblique: 'M252,310 C265,320 275,340 278,365 C280,390 275,415 265,435 C255,452 240,460 225,458 C212,455 205,445 205,430 C205,415 210,395 215,375 C220,355 225,335 232,320 C238,312 245,308 252,310 Z',
    glutes: 'M140,470 C155,460 175,455 200,455 C225,455 245,460 260,470 L265,540 C262,565 250,580 235,588 C220,595 200,598 180,595 C165,590 155,580 150,565 C145,550 142,535 140,520 Z',
    left_quad: 'M135,540 C125,560 118,590 120,625 C122,660 130,690 145,710 C158,728 175,735 190,730 C202,725 210,712 212,695 C214,675 210,650 205,625 C200,600 195,575 188,555 C182,540 170,532 155,532 C148,532 140,535 135,540 Z',
    right_quad: 'M265,540 C275,560 282,590 280,625 C278,660 270,690 255,710 C242,728 225,735 210,730 C198,725 190,712 188,695 C186,675 190,650 195,625 C200,600 205,575 212,555 C218,540 230,532 245,532 C252,532 260,535 265,540 Z',
    left_hamstring: 'M130,600 C122,625 118,655 122,685 C126,715 138,740 155,752 C170,762 188,765 202,758 C214,750 220,735 220,718 C220,700 215,675 210,650 C205,625 200,605 192,590 C185,578 175,572 162,575 C150,578 138,585 130,600 Z',
    right_hamstring: 'M270,600 C278,625 282,655 278,685 C274,715 262,740 245,752 C230,762 212,765 198,758 C186,750 180,735 180,718 C180,700 185,675 190,650 C195,625 200,605 208,590 C215,578 225,572 238,575 C250,578 262,585 270,600 Z',
    left_calf: 'M140,720 C132,740 128,765 132,790 C136,815 148,835 165,842 C180,848 195,845 205,835 C212,825 215,810 212,792 C209,772 205,750 200,730 C195,712 188,698 178,692 C168,688 155,692 148,700 C144,706 141,712 140,720 Z',
    right_calf: 'M260,720 C268,740 272,765 268,790 C264,815 252,835 235,842 C220,848 205,845 195,835 C188,825 185,810 188,792 C191,772 195,750 200,730 C205,712 212,698 222,692 C232,688 245,692 252,700 C256,706 259,712 260,720 Z',
    left_shin: 'M145,790 C140,805 138,825 140,845 C142,865 150,880 162,885 C172,888 182,885 188,875 C192,865 192,848 188,830 C184,812 178,795 172,782 C166,772 158,768 152,772 C148,776 145,782 145,790 Z',
    right_shin: 'M255,790 C260,805 262,825 260,845 C258,865 250,880 238,885 C228,888 218,885 212,875 C208,865 208,848 212,830 C216,812 222,795 228,782 C234,772 242,768 248,772 C252,776 255,782 255,790 Z',
    left_foot: 'M148,845 C142,858 138,875 140,892 C142,908 150,920 165,925 C178,928 192,925 200,915 C206,905 208,890 205,875 C202,860 195,848 185,842 C175,838 162,838 155,840 C152,842 149,843 148,845 Z',
    right_foot: 'M252,845 C258,858 262,875 260,892 C258,908 250,920 235,925 C222,928 208,925 200,915 C194,905 192,890 195,875 C198,860 205,848 215,842 C225,838 238,838 245,840 C248,842 251,843 252,845 Z',
    lower_back: 'M155,440 C170,430 190,425 200,425 C210,425 230,430 245,440 L248,480 C245,500 230,512 210,518 C190,522 170,520 155,515 L152,480 C150,465 150,452 152,445 Z',
    front_delt: 'M148,148 C160,135 180,128 200,126 C220,128 240,135 252,148 L255,175 C250,190 235,200 215,205 C195,208 175,205 158,198 C148,192 145,180 148,168 Z',
    side_delt: 'M108,165 C95,172 85,188 82,208 C80,228 85,248 98,262 C110,274 125,280 140,278 C152,275 160,265 162,252 C164,238 160,222 152,208 C145,195 138,182 128,172 C120,165 112,162 108,165 Z',
    rear_delt: 'M292,165 C305,172 315,188 318,208 C320,228 315,248 302,262 C290,274 275,280 260,278 C248,275 240,265 238,252 C236,238 240,222 248,208 C255,195 262,182 272,172 C280,165 288,162 292,165 Z',
    lats: 'M105,220 C88,240 78,270 80,305 C82,340 95,370 118,390 C138,406 160,412 180,408 C195,404 205,395 208,380 C210,365 205,345 198,325 C191,305 185,285 178,265 C172,248 165,232 155,222 C145,214 130,212 118,215 C112,216 108,218 105,220 Z',
    upper_back: 'M155,155 C175,142 195,138 200,138 C205,138 225,142 245,155 L248,200 C245,218 230,230 210,235 C190,238 170,235 155,228 L152,200 C150,185 150,168 152,160 Z',
    triceps: 'M255,220 C265,240 272,270 270,300 C268,330 258,355 242,365 C228,372 212,368 205,355 C200,342 200,320 205,295 C210,270 215,245 222,225 C228,210 240,212 248,215 C252,217 254,218 255,220 Z',
    biceps: 'M95,220 C85,240 78,270 80,300 C82,330 92,355 108,365 C122,372 138,368 145,355 C150,342 150,320 145,295 C140,270 135,245 128,225 C122,210 110,212 102,215 C98,217 96,218 95,220 Z',
    forearms: 'M75,365 C68,385 65,415 70,445 C75,475 88,500 108,508 C125,514 142,508 148,492 C152,475 150,448 145,422 C140,396 135,372 128,358 C120,348 105,345 92,348 C84,350 78,355 75,365 Z'
  };

  // Recovery state colors
  const RECOVERY_COLORS = {
    trained_today: '#ef4444',      // Red - trained today
    recovering: '#f97316',         // Orange - recovering
    almost_ready: '#eab308',       // Yellow - almost ready
    ready: '#22c55e',              // Green - ready
    rested: '#38bdf8',             // Cyan - fully rested
    caution: '#ef4444'             // Red - medical caution
  };

  const RECOVERY_LABELS = {
    trained_today: 'Trained Today',
    recovering: 'Recovering',
    almost_ready: 'Almost Ready',
    ready: 'Ready',
    rested: 'Rested',
    caution: '⚠️ Caution'
  };

  // Initialize
  async function init() {
    localStorage.clear();  // Force fresh fetch since data is now available
    
    // Query DOM elements (DOM is now ready)
    els = {
      dataStatus: document.getElementById('dataStatus'),
      todayDate: document.getElementById('todayDate'),
      todayWorkout: document.getElementById('todayWorkout'),
      weekWorkouts: document.getElementById('weekWorkouts'),
      streakDays: document.getElementById('streakDays'),
      runningKm: document.getElementById('runningKm'),
      avgRPE: document.getElementById('avgRPE'),
      ytSubs: document.getElementById('ytSubs'),
      liFollowers: document.getElementById('liFollowers'),
      body3dMini: document.getElementById('body3dMini'),
      body3dFull: document.getElementById('body3dFull'),
      bodyMapLegend: document.getElementById('bodyMapLegend'),
      scheduleGrid: document.getElementById('scheduleGrid'),
      healthGrid: document.getElementById('healthGrid'),
      medicalNotes: document.getElementById('medicalNotes'),
      refreshBtn: document.getElementById('refreshBtn'),
      openBodyMap: document.getElementById('openBodyMap'),
      closeBodyMap: document.getElementById('closeBodyMap'),
      navItems: document.querySelectorAll('.nav-item'),
      views: document.querySelectorAll('.view'),
      debugPanel: null
    };
    
    // Create debug panel
    createDebugPanel();
    
    debugLog('App initialized');
    
    // Set initial online status immediately
    updateOnlineStatus(navigator.onLine);
    debugLog('Initial online status:', navigator.onLine);
    
    try { setupEventListeners(); } catch (e) { debugLog('setupEventListeners error:', e.message); }
    try { updateDate(); } catch (e) { debugLog('updateDate error:', e.message); }
    debugLog('About to loadAllData');
    await loadAllData();
    debugLog('loadAllData returned, calling renderAll');
    renderAll();
    debugLog('renderAll returned');
    startAutoRefresh();
  }

  function createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'debugPanel';
    panel.style.cssText = `
      position: fixed; bottom: 80px; left: 10px; right: 10px;
      max-height: 200px; overflow-y: auto;
      background: rgba(0,0,0,0.9); color: #0f0;
      padding: 10px; font-family: monospace; font-size: 11px;
      z-index: 9999; border-radius: 8px; border: 1px solid #0f0;
    `;
    panel.innerHTML = '<b>Debug Log:</b><br>App initialized...';
    document.body.appendChild(panel);
    els.debugPanel = panel;
  }

  function setupEventListeners() {
    els.refreshBtn.addEventListener('click', refreshData);
    els.openBodyMap.addEventListener('click', () => showView('bodymap'));
    els.closeBodyMap.addEventListener('click', () => showView('dashboard'));
    
    els.navItems.forEach(item => {
      item.addEventListener('click', () => showView(item.dataset.view));
    });

    // Handle URL params for shortcuts
    const params = new URLSearchParams(window.location.search);
    if (params.get('view')) showView(params.get('view'));
    if (params.get('action') === 'log') alert('Open Shortcuts app to log workout');
  }

  function showView(viewName) {
    els.views.forEach(v => v.classList.toggle('active', v.dataset.view === viewName));
    els.navItems.forEach(n => n.classList.toggle('active', n.dataset.view === viewName));
    
    if (viewName === 'bodymap' && state.analytics) {
      renderBodyMapFull();
    }
  }

  function updateDate() {
    const now = new Date();
    els.todayDate.textContent = now.toLocaleDateString('en-US', { 
      weekday: 'long', month: 'short', day: 'numeric' 
    });
  }

  // Data Loading
  async function loadAllData() {
    debugLog('Starting loadAllData');
    const loads = [
      loadSchedule().catch(e => { debugLog(`loadSchedule failed: ${e.message}`); return null; }),
      loadAnalytics().catch(e => { debugLog(`loadAnalytics failed: ${e.message}`); return null; }),
      loadPublicMetrics().catch(e => { debugLog(`loadPublicMetrics failed: ${e.message}`); return null; }),
      loadProfile().catch(e => { debugLog(`loadProfile failed: ${e.message}`); return null; }),
      loadExercises().catch(e => { debugLog(`loadExercises failed: ${e.message}`); return null; })
    ];
    await Promise.all(loads);
    state.lastFetch = Date.now();
    updateOnlineStatus(true);
    debugLog('loadAllData completed, state:', {
      schedule: state.schedule ? 'SET' : 'NULL',
      analytics: state.analytics ? 'SET' : 'NULL',
      publicMetrics: state.publicMetrics ? 'SET' : 'NULL',
      profile: state.profile ? 'SET' : 'NULL',
      exercises: state.exercises ? 'SET' : 'NULL'
    });
  }

  async function fetchWithCache(key, url, cacheTime = 5 * 60 * 1000) {
    // Add cache buster to URL to bypass localStorage cache
    const bustedUrl = url + CACHE_BUSTER;
    
    // Try cache first (but don't use if data is null)
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheTime && data !== null) {
        debugLog(`[Cache HIT] ${key}: using cached data`);
        return data;
      }
    }
    // Fetch fresh with cache buster
    try {
      debugLog(`[Fetch] ${key}: ${bustedUrl}`);
      const response = await fetch(bustedUrl);
      debugLog(`[Fetch] ${key}: status ${response.status}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      debugLog(`[Fetch] ${key}: data received ${data ? 'OK' : 'NULL'}`);
      // Only cache non-null data
      if (data !== null) {
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
      }
      return data;
    } catch (err) {
      debugLog(`[Fetch ERROR] ${key}: ${err.message}`);
      if (cached) return JSON.parse(cached).data;
      return null;
    }
  }

  async function loadSchedule() {
    const url = `https://raw.githubusercontent.com/${CONFIG.privateRepo}/main/${CONFIG.dataPaths.schedule}`;
    state.schedule = await fetchWithCache(CONFIG.cacheKeys.schedule, url);
  }

  async function loadAnalytics() {
    const url = `https://raw.githubusercontent.com/${CONFIG.privateRepo}/main/${CONFIG.dataPaths.analytics}`;
    state.analytics = await fetchWithCache(CONFIG.cacheKeys.analytics, url);
  }

  async function loadPublicMetrics() {
    const url = `https://raw.githubusercontent.com/${CONFIG.publicRepo}/main/${CONFIG.dataPaths.publicMetrics}`;
    state.publicMetrics = await fetchWithCache(CONFIG.cacheKeys.publicMetrics, url);
  }

  async function loadProfile() {
    const url = `https://raw.githubusercontent.com/${CONFIG.privateRepo}/main/${CONFIG.dataPaths.profile}`;
    state.profile = await fetchWithCache(CONFIG.cacheKeys.profile, url);
  }

  async function loadExercises() {
    const url = `https://raw.githubusercontent.com/${CONFIG.privateRepo}/main/${CONFIG.dataPaths.exercises}`;
    state.exercises = await fetchWithCache(CONFIG.cacheKeys.exercises, url);
  }

  async function refreshData() {
    els.refreshBtn.style.opacity = '0.5';
    els.refreshBtn.style.pointerEvents = 'none';
    localStorage.clear();
    await loadAllData();
    renderAll();
    els.refreshBtn.style.opacity = '1';
    els.refreshBtn.style.pointerEvents = 'auto';
  }

  function startAutoRefresh() {
    setInterval(async () => {
      if (document.visibilityState === 'visible') {
        await loadAllData();
        renderAll();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  function updateOnlineStatus(online) {
    state.online = online;
    els.dataStatus.textContent = online ? 'Online' : 'Offline';
    els.dataStatus.classList.toggle('online', online);
  }

  // Rendering
  function renderAll() {
    debugLog('renderAll called');
    try { renderTodayWorkout(); } catch (e) { debugLog('renderTodayWorkout error:', e.message); }
    try { renderMetrics(); } catch (e) { debugLog('renderMetrics error:', e.message); }
    try { renderBodyMapMini(); } catch (e) { debugLog('renderBodyMapMini error:', e.message); }
    try { renderContentMetrics(); } catch (e) { debugLog('renderContentMetrics error:', e.message); }
    try { renderSchedule(); } catch (e) { debugLog('renderSchedule error:', e.message); }
    try { renderHealth(); } catch (e) { debugLog('renderHealth error:', e.message); }
    try { renderMedicalNotes(); } catch (e) { debugLog('renderMedicalNotes error:', e.message); }
    debugLog('renderAll completed');
  }

  function renderTodayWorkout() {
    debugLog('renderTodayWorkout called, state.schedule:', state.schedule ? 'SET' : 'NULL');
    if (!state.schedule) {
      // Debug: show fetch status instead of generic loading
      const debugInfo = state.debugLog.slice(-5).join('<br>') || 'No debug logs';
      els.todayWorkout.innerHTML = `
        <div class="loading">
          Loading schedule... (check debug panel below)
          <details style="margin-top:10px;font-size:11px;color:#888;">
            <summary>Recent debug logs</summary>
            ${debugInfo}
          </details>
        </div>
      `;
      return;
    }

    debugLog('renderTodayWorkout: getting today');
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    debugLog('renderTodayWorkout: today:', today);
    const dayData = state.schedule.days[today];
    debugLog('renderTodayWorkout: dayData:', dayData ? 'SET' : 'NULL');
    
    if (!dayData) {
      els.todayWorkout.innerHTML = '<div class="loading">No data for today</div>';
      return;
    }

    debugLog('renderTodayWorkout: dayData.focus:', dayData.focus);
    if (dayData.focus === 'rest') {
      els.todayWorkout.innerHTML = `
        <div class="workout-day rest">
          <div class="workout-day-header">
            <span class="workout-day-name">${today}</span>
            <span class="workout-day-focus">Rest Day</span>
          </div>
          <div class="exercise-list">
            <div class="exercise-item">
              <div class="exercise-icon">🧘</div>
              <div class="exercise-info">
                <div class="exercise-name">Active Recovery</div>
                <div class="exercise-muscle">Mobility, Walking, Meditation</div>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    debugLog('renderTodayWorkout: building exercisesHtml');
    const exercisesHtml = (dayData.exercises || []).map(exKey => {
      const ex = state.exercises?.[exKey];
      const icon = getExerciseIcon(ex?.category);
      const muscle = ex?.primary_muscle || exKey;
      return `
        <div class="exercise-item">
          <div class="exercise-icon">${icon}</div>
          <div class="exercise-info">
            <div class="exercise-name">${ex?.name || exKey}</div>
            <div class="exercise-muscle">${muscle.replace('_', ' ')}</div>
          </div>
        </div>
      `;
    }).join('');

    debugLog('renderTodayWorkout: setting innerHTML');
    els.todayWorkout.innerHTML = `
      <div class="workout-day ${dayData.focus}">
        <div class="workout-day-header">
          <span class="workout-day-name">${today}</span>
          <span class="workout-day-focus">${dayData.focus.replace('_', ' ').toUpperCase()}</span>
        </div>
        <div class="exercise-list">${exercisesHtml}</div>
      </div>
    `;
    debugLog('renderTodayWorkout: completed');
  }

  function getExerciseIcon(category) {
    const icons = {
      push: '🏋️',
      pull: '🏋️',
      legs: '🦵',
      legs_hip: '🦵',
      legs_knee_friendly: '🦵',
      core: '🧘',
      cardio: '🏃'
    };
    return icons[category] || '💪';
  }

  function renderMetrics() {
    const fitness = state.publicMetrics?.fitness || state.analytics?.fitness || {};
    els.weekWorkouts.textContent = fitness.workouts_this_week || 0;
    els.streakDays.textContent = fitness.streak_days || 0;
    els.runningKm.textContent = fitness.running_km_week || 0;
    els.avgRPE.textContent = fitness.avg_rpe || 0;
  }

  function renderContentMetrics() {
    const yt = state.publicMetrics?.youtube || state.analytics?.youtube || {};
    const li = state.publicMetrics?.linkedin || state.analytics?.linkedin || {};
    els.ytSubs.textContent = formatNumber(yt.subscribers || 0);
    els.liFollowers.textContent = formatNumber(li.followers || 0);
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n/1000).toFixed(1) + 'K';
    return String(n);
  }

  function computeMuscleStatus() {
    if (!state.analytics || !state.profile) return {};

    const workouts = []; // Would need workout history for full computation
    // Simplified: use analytics fitness data
    const status = {};
    
    Object.keys(MUSCLE_GROUPS).forEach(muscle => {
      // Simple heuristic based on schedule
      let muscleState = 'rested';
      if (state.schedule) {
const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const dayData = state.schedule.days[today];
        if (dayData && dayData.target_muscles?.includes(muscle)) {
          muscleState = 'trained_today';
        }
      }
      
      // Medical override
      if (state.profile.medical_history?.knee_issues && 
          ['quads', 'hamstrings', 'calves', 'glutes'].includes(muscle)) {
        muscleState = 'caution';
      }
      
      status[muscle] = muscleState;
    });
    
    return status;
  }

  function renderBodyMapMini() {
    render3DBodyMap('body3dModelMini', true);
  }

  function renderBodyMapFull() {
    render3DBodyMap('body3dModelFull', false);
    renderBodyMapLegend();
  }

  // 3D Body Map Generation
  function render3DBodyMap(containerId, isMini) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const status = computeMuscleStatus();
    const figure = generateHumanFigure(status);

    const html = `
      <div class="rotation-hint">Drag to rotate • Double-tap to reset</div>
      <div class="body-3d-model" id="${containerId}-model">${figure}</div>
      <div class="rotation-controls">
        <button class="rotation-btn" data-action="rotate-left" aria-label="Rotate left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <button class="rotation-btn" data-action="rotate-right" aria-label="Rotate right">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M19 12l-7-7-7 7"/></svg>
        </button>
        <button class="rotation-btn" data-action="rotate-up" aria-label="Tilt up">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
        <button class="rotation-btn" data-action="rotate-down" aria-label="Tilt down">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <button class="rotation-btn" data-action="reset-view" aria-label="Reset view">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
      </div>
    `;

    container.innerHTML = html;

    container.addEventListener('click', (e) => {
      const part = e.target.closest('[data-muscle]');
      if (part) showMuscleInfo(part.dataset.muscle, part.dataset.state);
    });

    init3DRotation(containerId);
  }

  function generateBodyLayers(status) {
    // Define which muscles go in which layer (front/middle/back)
    const frontMuscles = ['chest', 'abs', 'left_quad', 'right_quad', 'left_bicep', 'right_bicep', 
                          'left_forearm', 'right_forearm', 'left_shoulder', 'right_shoulder',
                          'front_delt', 'side_delt', 'neck', 'left_calf', 'right_calf',
                          'left_shin', 'right_shin', 'left_foot', 'right_foot'];
    
    const middleMuscles = ['lats', 'left_oblique', 'right_oblique', 'left_quad', 'right_quad',
                          'left_hamstring', 'right_hamstring', 'glutes', 'left_calf', 'right_calf'];
    
    const backMuscles = ['lats', 'upper_back', 'lower_back', 'rear_delt', 'left_shoulder', 'right_shoulder',
                        'left_hamstring', 'right_hamstring', 'glutes', 'left_calf', 'right_calf'];
    
    const layers = { front: '', middle: '', back: '' };
    
    // Generate SVG for each layer
    layers.front = generateLayerSVG(frontMuscles, status, 50);
    layers.middle = generateLayerSVG(middleMuscles, status, 0);
    layers.back = generateLayerSVG(backMuscles, status, -50);
    
    return layers;
  }

  function generateLayerSVG(muscles, status, zOffset) {
    let muscleContent = '';
    muscles.forEach(muscle => {
      const path = BODY_MAP_PATHS[muscle];
      if (!path) return;
      const muscleState = status[muscle] || 'rested';
      const color = RECOVERY_COLORS[muscleState] || RECOVERY_COLORS.rested;
      muscleContent += `<path d="${path}" fill="${color}" opacity="0.55" stroke="${color}" stroke-width="1.5" style="cursor: pointer; filter: drop-shadow(0 0 6px ${color}); transition: fill 0.3s, opacity 0.3s;" data-muscle="${muscle}" data-state="${muscleState}"/>`;
    });
    return `<svg viewBox="0 0 400 800" style="width: 100%; height: 100%; display: block;">${muscleContent}</svg>`;
  }

  function generateHumanFigure(status) {
    const c = (state) => RECOVERY_COLORS[state] || RECOVERY_COLORS.rested;
    const op = (state) => state === 'trained_today' ? '0.6' : state === 'rested' ? '0.25' : '0.45';

    const headState = 'rested';
    const bodyOutline = `<path d="M175,15 C175,8 185,2 200,2 C215,2 225,8 225,15 L228,40 C230,55 228,70 225,85 C222,100 218,115 215,130 L212,135 L188,135 L185,130 C182,115 178,100 175,85 C172,70 170,55 172,40 Z" fill="${c('rested')}" opacity="0.18" stroke="${c('rested')}" stroke-width="2" stroke-opacity="0.6" style="cursor: default;"/>`;

    const torso = `<path d="M165,145 C160,170 158,200 160,230 C162,260 168,290 175,320 C180,345 185,370 190,395 L210,395 C215,370 220,345 225,320 C232,290 238,260 240,230 C242,200 240,170 235,145 C225,138 212,135 200,135 C188,135 175,138 165,145 Z" fill="${c('rested')}" opacity="0.15" stroke="${c('rested')}" stroke-width="2" stroke-opacity="0.5" style="cursor: default;"/>`;

    const neck = `<path d="M185,105 L185,140 C185,148 192,152 200,152 C208,152 215,148 215,140 L215,105 C210,100 190,100 185,105 Z" fill="${c(status['neck'] || 'rested')}" opacity="${op(status['neck'])}" stroke="${c(status['neck'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="neck" data-state="${status['neck'] || 'rested'}"/>`;

    const leftArm = `<path d="M160,150 C148,155 138,168 132,185 L125,210 C120,230 115,255 112,280 L108,310 C105,335 102,365 100,395 C99,415 102,430 108,440 C112,448 120,450 128,448 C135,445 140,438 142,428 C145,410 148,385 150,360 L152,330 C155,300 158,270 160,240 L162,210 C165,190 168,170 170,158 Z" fill="${c('rested')}" opacity="0.12" stroke="${c('rested')}" stroke-width="2" stroke-opacity="0.4" style="cursor: default;"/>`;

    const rightArm = `<path d="M240,150 C252,155 262,168 268,185 L275,210 C280,230 285,255 288,280 L292,310 C295,335 298,365 300,395 C301,415 298,430 292,440 C288,448 280,450 272,448 C265,445 260,438 258,428 C255,410 252,385 250,360 L248,330 C245,300 242,270 240,240 L238,210 C235,190 232,170 230,158 Z" fill="${c('rested')}" opacity="0.12" stroke="${c('rested')}" stroke-width="2" stroke-opacity="0.4" style="cursor: default;"/>`;

    const leftLeg = `<path d="M175,420 L172,460 C170,500 168,540 168,580 L168,620 C168,650 168,680 170,710 C171,730 175,745 182,752 C188,758 198,760 208,758 C215,755 220,748 222,738 C225,720 225,690 222,660 L220,620 C218,580 218,540 218,500 L215,460 L210,420 Z" fill="${c('rested')}" opacity="0.12" stroke="${c('rested')}" stroke-width="2" stroke-opacity="0.4" style="cursor: default;"/>`;

    const rightLeg = `<path d="M225,420 L228,460 C230,500 232,540 232,580 L232,620 C232,650 232,680 230,710 C229,730 225,745 218,752 C212,758 202,760 192,758 C185,755 180,748 178,738 C175,720 175,690 178,660 L180,620 C182,580 182,540 182,500 L185,460 L190,420 Z" fill="${c('rested')}" opacity="0.12" stroke="${c('rested')}" stroke-width="2" stroke-opacity="0.4" style="cursor: default;"/>`;

    const joints = `
      <circle cx="128" cy="440" r="8" fill="${c('rested')}" opacity="0.3" stroke="${c('rested')}" stroke-width="1.5" style="cursor: default;"/>
      <circle cx="272" cy="440" r="8" fill="${c('rested')}" opacity="0.3" stroke="${c('rested')}" stroke-width="1.5" style="cursor: default;"/>
      <circle cx="200" cy="152" r="6" fill="${c('rested')}" opacity="0.3" stroke="${c('rested')}" stroke-width="1.5" style="cursor: default;"/>
      <circle cx="200" cy="410" r="7" fill="${c('rested')}" opacity="0.3" stroke="${c('rested')}" stroke-width="1.5" style="cursor: default;"/>
      <circle cx="193" cy="755" r="6" fill="${c('rested')}" opacity="0.3" stroke="${c('rested')}" stroke-width="1.5" style="cursor: default;"/>
      <circle cx="207" cy="755" r="6" fill="${c('rested')}" opacity="0.3" stroke="${c('rested')}" stroke-width="1.5" style="cursor: default;"/>
    `;

    const bicepL = `<path d="M128,175 C118,185 110,205 108,225 C106,245 108,265 112,280 C116,292 125,300 135,295 C142,290 145,278 145,262 L145,235 C145,215 142,195 135,182 C133,178 130,175 128,175 Z" fill="${c(status['left_bicep'] || 'rested')}" opacity="${op(status['left_bicep'])}" stroke="${c(status['left_bicep'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="left_bicep" data-state="${status['left_bicep'] || 'rested'}"/>`;
    const bicepR = `<path d="M272,175 C282,185 290,205 292,225 C294,245 292,265 288,280 C284,292 275,300 265,295 C258,290 255,278 255,262 L255,235 C255,215 258,195 265,182 C267,178 270,175 272,175 Z" fill="${c(status['right_bicep'] || 'rested')}" opacity="${op(status['right_bicep'])}" stroke="${c(status['right_bicep'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="right_bicep" data-state="${status['right_bicep'] || 'rested'}"/>`;
    const foreL = `<path d="M110,280 C105,295 102,320 102,345 L102,375 C102,395 105,415 112,430 C118,442 130,445 138,438 C144,432 145,420 145,405 L145,370 C145,345 142,318 138,295 C132,282 120,275 110,280 Z" fill="${c(status['left_forearm'] || 'rested')}" opacity="${op(status['left_forearm'])}" stroke="${c(status['left_forearm'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="left_forearm" data-state="${status['left_forearm'] || 'rested'}"/>`;
    const foreR = `<path d="M290,280 C295,295 298,320 298,345 L298,375 C298,395 295,415 288,430 C282,442 270,445 262,438 C256,432 255,420 255,405 L255,370 C255,345 258,318 262,295 C268,282 280,275 290,280 Z" fill="${c(status['right_forearm'] || 'rested')}" opacity="${op(status['right_forearm'])}" stroke="${c(status['right_forearm'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="right_forearm" data-state="${status['right_forearm'] || 'rested'}"/>`;

    const deltL = `<path d="M158,148 C145,145 132,150 122,162 C115,172 110,188 110,205 C110,222 115,238 125,248 C135,256 150,258 162,252 C172,246 178,235 178,220 L178,195 C178,178 172,158 158,148 Z" fill="${c(status['left_shoulder'] || 'rested')}" opacity="${op(status['left_shoulder'])}" stroke="${c(status['left_shoulder'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="left_shoulder" data-state="${status['left_shoulder'] || 'rested'}"/>`;
    const deltR = `<path d="M242,148 C255,145 268,150 278,162 C285,172 290,188 290,205 C290,222 285,238 275,248 C265,256 250,258 238,252 C228,246 222,235 222,220 L222,195 C222,178 228,158 242,148 Z" fill="${c(status['right_shoulder'] || 'rested')}" opacity="${op(status['right_shoulder'])}" stroke="${c(status['right_shoulder'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="right_shoulder" data-state="${status['right_shoulder'] || 'rested'}"/>`;

    const chest = `<path d="M165,165 C180,155 200,152 220,155 C235,160 245,172 248,190 C250,210 248,235 242,260 C236,282 225,295 210,298 C195,300 175,295 162,285 C152,272 148,255 148,235 C148,215 155,185 165,165 Z" fill="${c(status['chest'] || 'rested')}" opacity="${op(status['chest'])}" stroke="${c(status['chest'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="chest" data-state="${status['chest'] || 'rested'}"/>`;

    const abs = `<path d="M170,305 C185,298 200,296 215,298 C228,302 238,312 240,328 L238,365 C236,390 230,408 218,415 C205,420 190,418 178,410 C168,402 162,390 162,372 L162,345 C162,328 165,315 170,305 Z" fill="${c(status['abs'] || 'rested')}" opacity="${op(status['abs'])}" stroke="${c(status['abs'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="abs" data-state="${status['abs'] || 'rested'}"/>`;

    const obliqueL = `<path d="M158,310 C150,325 145,350 148,378 C150,405 158,425 172,438 C182,445 192,440 195,428 C197,415 192,395 185,375 C178,355 172,332 165,318 Z" fill="${c(status['left_oblique'] || 'rested')}" opacity="${op(status['left_oblique'])}" stroke="${c(status['left_oblique'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="left_oblique" data-state="${status['left_oblique'] || 'rested'}"/>`;
    const obliqueR = `<path d="M242,310 C250,325 255,350 252,378 C250,405 242,425 228,438 C218,445 208,440 205,428 C203,415 208,395 215,375 C222,355 228,332 235,318 Z" fill="${c(status['right_oblique'] || 'rested')}" opacity="${op(status['right_oblique'])}" stroke="${c(status['right_oblique'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="right_oblique" data-state="${status['right_oblique'] || 'rested'}"/>`;

    const quadL = `<path d="M165,430 C155,455 150,490 152,530 C154,570 158,605 165,635 C172,662 182,685 192,698 C200,708 210,710 218,705 C225,698 228,682 228,660 L225,620 C222,580 220,535 218,490 C216,455 212,430 205,420 C192,415 175,418 165,430 Z" fill="${c(status['left_quad'] || 'rested')}" opacity="${op(status['left_quad'])}" stroke="${c(status['left_quad'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="left_quad" data-state="${status['left_quad'] || 'rested'}"/>`;
    const quadR = `<path d="M235,430 C245,455 250,490 248,530 C246,570 242,605 235,635 C228,662 218,685 208,698 C200,708 190,710 182,705 C175,698 172,682 172,660 L175,620 C178,580 180,535 182,490 C184,455 188,430 195,420 C208,415 225,418 235,430 Z" fill="${c(status['right_quad'] || 'rested')}" opacity="${op(status['right_quad'])}" stroke="${c(status['right_quad'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="right_quad" data-state="${status['right_quad'] || 'rested'}"/>`;

    const hamL = `<path d="M172,580 C165,610 162,645 168,675 C172,700 182,718 195,725 C205,730 215,725 220,715 C225,702 225,680 222,655 C218,628 212,600 205,578 C195,565 182,568 172,580 Z" fill="${c(status['left_hamstring'] || 'rested')}" opacity="${op(status['left_hamstring'])}" stroke="${c(status['left_hamstring'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="left_hamstring" data-state="${status['left_hamstring'] || 'rested'}"/>`;
    const hamR = `<path d="M228,580 C235,610 238,645 232,675 C228,700 218,718 205,725 C195,730 185,725 180,715 C175,702 175,680 178,655 C182,628 188,600 195,578 C205,565 218,568 228,580 Z" fill="${c(status['right_hamstring'] || 'rested')}" opacity="${op(status['right_hamstring'])}" stroke="${c(status['right_hamstring'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="right_hamstring" data-state="${status['right_hamstring'] || 'rested'}"/>`;

    const calfL = `<path d="M172,690 C168,705 165,725 168,745 C170,762 178,775 188,780 C196,784 205,780 210,770 C214,758 215,742 212,725 C208,708 202,692 195,685 C188,678 178,680 172,690 Z" fill="${c(status['left_calf'] || 'rested')}" opacity="${op(status['left_calf'])}" stroke="${c(status['left_calf'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="left_calf" data-state="${status['left_calf'] || 'rested'}"/>`;
    const calfR = `<path d="M228,690 C232,705 235,725 232,745 C230,762 222,775 212,780 C204,784 195,780 190,770 C186,758 185,742 188,725 C192,708 198,692 205,685 C212,678 222,680 228,690 Z" fill="${c(status['right_calf'] || 'rested')}" opacity="${op(status['right_calf'])}" stroke="${c(status['right_calf'] || 'rested')}" stroke-width="1.5" style="cursor: pointer;" data-muscle="right_calf" data-state="${status['right_calf'] || 'rested'}"/>`;

    return `<svg viewBox="0 0 400 800" style="width: 100%; height: 100%; display: block;">
      ${bodyOutline}
      ${leftArm}
      ${rightArm}
      ${leftLeg}
      ${rightLeg}
      ${torso}
      ${neck}
      ${joints}
      ${deltL}
      ${deltR}
      ${chest}
      ${bicepL}
      ${bicepR}
      ${foreL}
      ${foreR}
      ${abs}
      ${obliqueL}
      ${obliqueR}
      ${quadL}
      ${quadR}
      ${hamL}
      ${hamR}
      ${calfL}
      ${calfR}
    </svg>`;
  }

  function renderBodyMapLegend() {
    const legend = document.getElementById('bodyMapLegend');
    if (!legend) return;
    
    const states = [
      { key: 'trained_today', label: 'Trained Today' },
      { key: 'recovering', label: 'Recovering' },
      { key: 'almost_ready', label: 'Almost Ready' },
      { key: 'ready', label: 'Ready' },
      { key: 'rested', label: 'Rested' },
      { key: 'caution', label: '⚠️ Medical Caution' }
    ];

    legend.innerHTML = states.map(s => `
      <div class="legend-item">
        <span class="legend-color" style="background: ${RECOVERY_COLORS[s.key]}"></span>
        <span>${s.label}</span>
      </div>
    `).join('');
  }

  // 3D Rotation Logic
  function init3DRotation(containerId) {
    const container = document.getElementById(containerId);
    const model = document.getElementById(`${containerId}-model`);
    if (!container || !model) return;
    
    let rotateX = -15;
    let rotateY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startRotateX = rotateX;
    let startRotateY = rotateY;
    let animationFrame = null;
    
    function updateTransform() {
      const modelEl = document.getElementById(`${containerId}-model`);
      if (modelEl) {
        modelEl.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }
    }
    
    function animate() {
      updateTransform();
      animationFrame = requestAnimationFrame(animate);
    }
    animate();
    
    // Touch/mouse events
    function startDrag(e) {
      isDragging = true;
      const touch = e.touches ? e.touches[0] : e;
      startX = touch.clientX;
      startY = touch.clientY;
      startRotateX = rotateX;
      startRotateY = rotateY;
      document.body.style.userSelect = 'none';
    }
    
    function drag(e) {
      if (!isDragging) return;
      e.preventDefault();
      const touch = e.touches ? e.touches[0] : e;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      
      rotateY = startRotateY + deltaX * 0.5;
      rotateX = Math.max(-60, Math.min(60, startRotateX - deltaY * 0.5));
      updateTransform();
    }
    
    function endDrag() {
      isDragging = false;
      document.body.style.userSelect = '';
    }
    
    // Touch events
    document.getElementById(containerId).addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', endDrag);
    
    // Mouse events
    document.getElementById(containerId).addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mouseleave', endDrag);
    
    // Rotation control buttons
    const buttons = container.querySelectorAll('.rotation-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        switch (action) {
          case 'rotate-left': rotateY -= 30; break;
          case 'rotate-right': rotateY += 30; break;
          case 'rotate-up': rotateX = Math.max(-60, rotateX - 15); break;
          case 'rotate-down': rotateX = Math.min(60, rotateX + 15); break;
          case 'reset-view':
            rotateX = -15;
            rotateY = 0;
            break;
        }
        updateTransform();
      });
    });
    
    // Double tap to reset
    let lastTap = 0;
    document.getElementById(containerId).addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        rotateX = -15;
        rotateY = 0;
        updateTransform();
      }
      lastTap = now;
    });
  }

  function showMuscleInfo(muscle, state) {
    const info = MUSCLE_GROUPS[muscle];
    const exercises = state.exercises ? 
      Object.values(state.exercises).filter(e => 
        e.primary_muscle === muscle || e.secondary_muscles?.includes(muscle)
      ).slice(0, 3).map(e => e.name).join(', ') : '—';
    
    alert(`${info.label} — ${RECOVERY_LABELS[state]}\n\nCommon exercises: ${exercises}`);
  }

  function renderSchedule() {
    if (!state.schedule) {
      els.scheduleGrid.innerHTML = '<div class="loading">Loading schedule...</div>';
      return;
    }

    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    els.scheduleGrid.innerHTML = dayOrder.map(day => {
      const dayData = state.schedule.days[day];
      if (!dayData) return '';
      
      const isToday = day === today;
      const isRest = dayData.focus === 'rest';
      
      return `
        <div class="workout-day ${dayData.focus} ${isToday ? 'today' : ''} ${isRest ? 'rest' : ''}">
          <div class="workout-day-header">
            <span class="workout-day-name">${day}${isToday ? ' (Today)' : ''}</span>
            ${!isRest ? `<span class="workout-day-focus">${dayData.focus.replace('_', ' ').toUpperCase()}</span>` : '<span class="workout-day-focus" style="background:rgba(139,148,158,0.15);color:var(--text-muted)">Rest</span>'}
          </div>
          <div class="exercise-list">
            ${isRest ? `
              <div class="exercise-item">
                <div class="exercise-icon">🧘</div>
                <div class="exercise-info">
                  <div class="exercise-name">Rest & Recovery</div>
                  <div class="exercise-muscle">Mobility, Walking, Meditation</div>
                </div>
              </div>
            ` : (dayData.exercises || []).map(exKey => {
              const ex = state.exercises?.[exKey];
              const icon = getExerciseIcon(ex?.category);
              return `
                <div class="exercise-item">
                  <div class="exercise-icon">${icon}</div>
                  <div class="exercise-info">
                    <div class="exercise-name">${ex?.name || exKey}</div>
                    <div class="exercise-muscle">${ex?.primary_muscle || exKey}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderHealth() {
    if (!state.profile) {
      els.healthGrid.innerHTML = '<div class="loading">Loading profile...</div>';
      return;
    }

    const basics = state.profile.basics || {};
    const items = [
      { label: 'Age', value: basics.age + ' yrs' },
      { label: 'Height', value: basics.height_cm + ' cm' },
      { label: 'Weight', value: basics.weight_kg + ' kg' },
      { label: 'Body Fat', value: basics.body_fat_pct + '%' },
      { label: 'Goal', value: state.profile.goals?.primary?.replace('_', ' ') || '—' },
      { label: 'Target Weight', value: state.profile.goals?.target_weight_kg + ' kg' }
    ];

    els.healthGrid.innerHTML = items.map(item => `
      <div class="health-item">
        <div class="health-label">${item.label}</div>
        <div class="health-value">${item.value}</div>
      </div>
    `).join('');
  }

  function renderMedicalNotes() {
    if (!state.profile?.medical_history) {
      els.medicalNotes.innerHTML = '<div class="loading">No medical data</div>';
      return;
    }

    const notes = [];
    const knee = state.profile.medical_history.knee_issues;
    if (knee) {
      notes.push({
        title: `⚠️ ${knee.condition} (${knee.severity}, ${knee.affected_side} knee)`,
        items: knee.contraindicated_exercises.map(e => `• ${e.replace('_', ' ')}`),
        warning: true
      });
    }

    if (notes.length === 0) {
      els.medicalNotes.innerHTML = '<div class="medical-note">No medical restrictions recorded</div>';
      return;
    }

    els.medicalNotes.innerHTML = notes.map(note => `
      <div class="medical-note ${note.warning ? 'warning' : ''}">
        <div class="medical-note-title">${note.title}</div>
        <div class="medical-note-list">
          <strong>Avoid:</strong><br>${note.items.join('<br>')}
        </div>
        ${knee?.notes ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">${knee.notes}</div>` : ''}
      </div>
    `).join('');
  }

  // Start
  document.addEventListener('DOMContentLoaded', init);
})();
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
    neck: 'M170,55 Q200,45 230,55 Q230,95 200,105 Q170,115 170,75 Z',
    left_shoulder: 'M110,100 Q90,100 80,135 Q100,150 135,115 Q125,100 110,100 Z',
    right_shoulder: 'M290,100 Q310,100 320,135 Q300,150 265,115 Q275,100 290,100 Z',
    chest: 'M135,135 Q160,115 200,125 Q240,115 265,135 L265,225 Q240,250 200,235 Q160,250 135,225 Z',
    left_bicep: 'M70,140 Q60,165 70,210 Q85,235 100,210 Q110,185 95,140 Z',
    right_bicep: 'M330,140 Q340,165 330,210 Q315,235 300,210 Q290,185 305,140 Z',
    left_forearm: 'M65,210 Q55,235 65,280 Q80,305 95,280 Q105,255 90,210 Z',
    right_forearm: 'M335,210 Q345,235 335,280 Q320,305 305,280 Q295,255 310,210 Z',
    abs: 'M155,235 Q170,220 195,235 Q215,250 200,275 Q180,290 165,275 Q145,290 135,250 Q120,240 135,235 Z',
    left_oblique: 'M115,235 Q95,250 105,295 Q125,315 150,280 Q140,255 115,235 Z',
    right_oblique: 'M285,235 Q305,250 295,295 Q275,315 250,280 Q260,255 285,235 Z',
    glutes: 'M135,305 Q110,320 125,365 Q150,390 185,365 Q210,380 200,320 Q190,295 165,305 Z',
    left_quad: 'M120,320 Q100,345 110,420 Q135,470 165,445 Q180,410 160,320 Z',
    right_quad: 'M280,320 Q300,345 290,420 Q265,470 235,445 Q220,410 240,320 Z',
    left_hamstring: 'M115,420 Q95,455 105,530 Q130,580 160,550 Q175,510 155,420 Z',
    right_hamstring: 'M285,420 Q305,455 295,530 Q270,580 240,550 Q225,510 245,420 Z',
    left_calf: 'M110,530 Q90,565 100,620 Q125,665 155,635 Q170,595 150,530 Z',
    right_calf: 'M290,530 Q310,565 300,620 Q275,665 245,635 Q230,595 250,530 Z',
    left_shin: 'M100,620 Q85,650 95,700 Q115,740 140,710 Q150,675 135,620 Z',
    right_shin: 'M300,620 Q315,650 305,700 Q285,740 260,710 Q250,675 265,620 Z',
    left_foot: 'M90,700 Q75,725 85,760 Q110,790 145,765 Q155,740 140,700 Z',
    right_foot: 'M310,700 Q325,725 315,760 Q290,790 255,765 Q245,740 260,700 Z',
    lower_back: 'M155,285 Q170,270 195,285 Q215,300 200,330 Q180,345 165,330 Q145,345 135,300 Q120,290 135,285 Z',
    front_delt: 'M130,115 Q155,95 200,105 Q245,95 270,115 L270,155 Q245,170 200,160 Q155,170 130,155 Z',
    side_delt: 'M85,135 Q65,140 75,175 Q95,195 120,170 Q110,150 100,135 Z',
    rear_delt: 'M315,135 Q335,140 325,175 Q305,195 280,170 Q290,150 300,135 Z',
    lats: 'M70,165 Q45,210 55,320 Q90,365 140,340 Q165,315 160,250 Q150,205 125,180 Q95,170 70,165 Z',
    upper_back: 'M155,145 Q180,130 200,145 Q220,130 245,145 L245,190 Q220,205 200,195 Q180,205 155,190 Z',
    triceps: 'M255,185 Q265,230 250,295 Q230,340 205,295 Q200,250 220,200 Z',
    biceps: 'M65,185 Q55,230 70,295 Q90,340 115,295 Q120,250 100,200 Z',
    forearms: 'M60,295 Q50,340 70,405 Q95,455 125,410 Q130,365 110,315 Z'
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
    
    setupEventListeners();
    updateDate();
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
    const layers = generateBodyLayers(status);
    
    let html = `
      <div class="rotation-hint">Drag to rotate • Double-tap to reset</div>
      <div class="body-3d-model" id="${containerId}-model">`;
    
    // Front layer (closest to viewer)
    html += `<div class="body-layer" style="transform: translateZ(50px);">${layers.front}</div>`;
    // Middle layer
    html += `<div class="body-layer" style="transform: translateZ(0px);">${layers.middle}</div>`;
    // Back layer (farthest from viewer)
    html += `<div class="body-layer" style="transform: translateZ(-50px);">${layers.back}</div>`;
    
    html += `</div>`;
    
    // Rotation controls
    html += `
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
    
    document.getElementById(containerId).innerHTML = html;
    
    document.getElementById(containerId).addEventListener('click', (e) => {
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
    let svgContent = '';
    
    muscles.forEach(muscle => {
      const path = BODY_MAP_PATHS[muscle];
      if (!path) return;
      
      const muscleState = status[muscle] || 'rested';
      const color = RECOVERY_COLORS[muscleState] || RECOVERY_COLORS.rested;
      
      svgContent += `
        <g class="body-part ${muscleState}" data-muscle="${muscle}" data-state="${muscleState}" 
           style="transform: translateZ(0);">
          <path d="${path}" fill="${color}" opacity="0.7" stroke="${color}" stroke-width="1.5" 
                style="filter: drop-shadow(0 0 8px ${color}); transition: fill 0.3s ease, opacity 0.3s ease;"
                data-muscle="${muscle}" data-state="${muscleState}"/>
        </g>
      `;
    });
    
    return `
      <svg viewBox="0 0 400 800" class="body-layer-svg" style="width: 100%; height: 100%; display: block;">
        ${svgContent}
      </svg>
    `;
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
    const container = document.getElementById(containerId);
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
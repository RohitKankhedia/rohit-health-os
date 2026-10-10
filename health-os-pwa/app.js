// Health OS PWA - Main App Logic
(function() {
  'use strict';

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

  // State
  let state = {
    schedule: null,
    analytics: null,
    publicMetrics: null,
    profile: null,
    exercises: null,
    lastFetch: null,
    online: false
  };

  // DOM Elements
  const els = {
    dataStatus: document.getElementById('dataStatus'),
    todayDate: document.getElementById('todayDate'),
    todayWorkout: document.getElementById('todayWorkout'),
    weekWorkouts: document.getElementById('weekWorkouts'),
    streakDays: document.getElementById('streakDays'),
    runningKm: document.getElementById('runningKm'),
    avgRPE: document.getElementById('avgRPE'),
    ytSubs: document.getElementById('ytSubs'),
    liFollowers: document.getElementById('liFollowers'),
    bodyMapSVG: document.getElementById('bodyMapSVG'),
    bodyMapFull: document.getElementById('bodyMapFull'),
    bodyMapLegend: document.getElementById('bodyMapLegend'),
    scheduleGrid: document.getElementById('scheduleGrid'),
    healthGrid: document.getElementById('healthGrid'),
    medicalNotes: document.getElementById('medicalNotes'),
    refreshBtn: document.getElementById('refreshBtn'),
    openBodyMap: document.getElementById('openBodyMap'),
    closeBodyMap: document.getElementById('closeBodyMap'),
    navItems: document.querySelectorAll('.nav-item'),
    views: document.querySelectorAll('.view')
  };

  // Muscle group mapping for body map
  const MUSCLE_GROUPS = {
    chest: { label: 'Chest', paths: ['chest'] },
    upper_chest: { label: 'Upper Chest', paths: ['chest'] },
    lower_chest: { label: 'Lower Chest', paths: ['chest'] },
    front_delt: { label: 'Front Delts', paths: ['front_delt'] },
    side_delt: { label: 'Side Delts', paths: ['side_delt'] },
    rear_delt: { label: 'Rear Delts', paths: ['rear_delt'] },
    lats: { label: 'Lats', paths: ['lats'] },
    upper_back: { label: 'Upper Back', paths: ['upper_back'] },
    biceps: { label: 'Biceps', paths: ['biceps'] },
    triceps: { label: 'Triceps', paths: ['triceps'] },
    forearms: { label: 'Forearms', paths: ['forearms'] },
    glutes: { label: 'Glutes', paths: ['glutes'] },
    hamstrings: { label: 'Hamstrings', paths: ['hamstrings'] },
    quads: { label: 'Quads', paths: ['quads'] },
    calves: { label: 'Calves', paths: ['calves'] },
    abs: { label: 'Abs', paths: ['abs'] },
    obliques: { label: 'Obliques', paths: ['obliques'] },
    lower_back: { label: 'Lower Back', paths: ['lower_back'] }
  };

  // Body map SVG paths (simplified anatomical shapes)
  const BODY_MAP_PATHS = {
    chest: 'M120,180 Q160,160 200,180 Q240,160 280,180 L280,240 Q240,260 200,240 Q160,260 120,240 Z',
    front_delt: 'M100,170 Q120,150 160,170 Q180,150 200,170 L200,200 Q180,210 160,200 Q140,210 120,200 Q100,210 100,170 Z',
    side_delt: 'M80,190 Q60,200 70,240 Q80,260 100,240 Q110,260 120,240 Q130,200 100,190 Z',
    rear_delt: 'M190,190 Q210,200 200,240 Q190,260 170,240 Q160,260 170,240 Q180,200 200,190 Z',
    lats: 'M60,220 Q40,280 60,420 Q90,460 130,430 Q150,380 150,300 Q150,260 130,240 Q90,220 60,220 Z',
    upper_back: 'M140,200 Q160,180 200,200 Q220,180 240,200 L240,240 Q220,250 200,240 Q180,250 160,240 Q140,250 140,200 Z',
    biceps: 'M60,260 Q50,300 70,350 Q90,380 90,350 Q90,300 70,260 Z',
    triceps: 'M240,260 Q250,300 230,350 Q210,380 210,350 Q210,300 230,260 Z',
    forearms: 'M50,350 Q40,400 60,450 Q80,480 80,450 Q80,400 60,350 Z',
    glutes: 'M110,420 Q80,440 100,520 Q130,540 160,520 Q180,540 200,440 Q170,420 140,400 Q110,400 110,420 Z',
    hamstrings: 'M120,480 Q100,560 130,680 Q160,720 180,680 Q200,560 180,480 Z',
    quads: 'M110,480 Q80,520 110,640 Q140,680 180,640 Q210,600 180,520 Q150,480 110,480 Z',
    calves: 'M130,640 Q110,700 140,780 Q160,820 170,780 Q200,720 170,640 Z',
    abs: 'M130,280 Q150,260 180,280 Q200,300 180,340 Q150,360 130,340 Q110,360 110,300 Q110,260 130,280 Z',
    obliques: 'M110,300 Q80,320 100,380 Q120,420 140,380 Q160,320 140,300 Z',
    lower_back: 'M140,340 Q160,360 180,340 Q200,360 180,380 Q160,400 140,380 Q120,400 120,360 Q120,340 140,340 Z'
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
    setupEventListeners();
    updateDate();
    await loadAllData();
    renderAll();
    startAutoRefresh();
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
    await Promise.all([
      loadSchedule(),
      loadAnalytics(),
      loadPublicMetrics(),
      loadProfile(),
      loadExercises()
    ]);
    state.lastFetch = Date.now();
    updateOnlineStatus(true);
  }

  async function fetchWithCache(key, url, cacheTime = 5 * 60 * 1000) {
    // Try cache first
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheTime) {
        return data;
      }
    }
    // Fetch fresh
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
      return data;
    } catch (err) {
      console.warn(`Fetch failed for ${url}:`, err);
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
    renderTodayWorkout();
    renderMetrics();
    renderBodyMapMini();
    renderContentMetrics();
    renderSchedule();
    renderHealth();
    renderMedicalNotes();
  }

  function renderTodayWorkout() {
    if (!state.schedule) {
      els.todayWorkout.innerHTML = '<div class="loading">No schedule data</div>';
      return;
    }

    const today = new Date().toLocaleLowerCase();
    const dayData = state.schedule.days[today];
    
    if (!dayData) {
      els.todayWorkout.innerHTML = '<div class="loading">No data for today</div>';
      return;
    }

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

    els.todayWorkout.innerHTML = `
      <div class="workout-day ${dayData.focus}">
        <div class="workout-day-header">
          <span class="workout-day-name">${today}</span>
          <span class="workout-day-focus">${dayData.focus.replace('_', ' ').toUpperCase()}</span>
        </div>
        <div class="exercise-list">${exercisesHtml}</div>
      </div>
    `;
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
        const today = new Date().toLocaleLowerCase();
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
    const status = computeMuscleStatus();
    const svg = els.bodyMapSVG;
    svg.innerHTML = '';
    
    Object.entries(BODY_MAP_PATHS).forEach(([muscle, path]) => {
      const muscleState = status[muscle] || 'rested';
      const color = RECOVERY_COLORS[muscleState] || RECOVERY_COLORS.rested;
      
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', path);
      pathEl.setAttribute('fill', color);
      pathEl.setAttribute('opacity', '0.6');
      pathEl.setAttribute('stroke', color);
      pathEl.setAttribute('stroke-width', '1');
      pathEl.style.filter = `drop-shadow(0 0 8px ${color})`;
      pathEl.dataset.muscle = muscle;
      pathEl.dataset.state = muscleState;
      svg.appendChild(pathEl);
    });
  }

  function renderBodyMapFull() {
    const status = computeMuscleStatus();
    const svg = els.bodyMapFull;
    const legend = els.bodyMapLegend;
    
    svg.innerHTML = '';
    legend.innerHTML = '';
    
    // Render paths
    Object.entries(BODY_MAP_PATHS).forEach(([muscle, path]) => {
      const muscleState = status[muscle] || 'rested';
      const color = RECOVERY_COLORS[muscleState] || RECOVERY_COLORS.rested;
      
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', path);
      pathEl.setAttribute('fill', color);
      pathEl.setAttribute('opacity', '0.7');
      pathEl.setAttribute('stroke', color);
      pathEl.setAttribute('stroke-width', '1.5');
      pathEl.style.filter = `drop-shadow(0 0 12px ${color})`;
      pathEl.dataset.muscle = muscle;
      pathEl.dataset.state = muscleState;
      
      // Click handler
      pathEl.addEventListener('click', () => showMuscleInfo(muscle, muscleState));
      
      svg.appendChild(pathEl);
    });

    // Render legend
    const states = [
      { key: 'trained_today', label: 'Trained Today' },
      { key: 'recovering', label: 'Recovering' },
      { key: 'almost_ready', label: 'Almost Ready' },
      { key: 'ready', label: 'Ready' },
      { key: 'rested', label: 'Rested' },
      { key: 'caution', label: '⚠️ Medical Caution' }
    ];

    states.forEach(s => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-color" style="background: ${RECOVERY_COLORS[s.key]}"></span>
        <span>${s.label}</span>
      `;
      legend.appendChild(item);
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
    const today = new Date().toLocaleLowerCase();

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
# Health OS - Setup Complete

## ✅ Files Created

### Private Repo (`rohit-health-os`)
```
.github/workflows/sync.yml          # Daily automation
scripts/
  ├── generate_schedule.py          # AI schedule generator
  ├── aggregate_analytics.py        # Fitness + YT + LI metrics
  ├── compute_public_metrics.py     # Safe public data
  └── requirements.txt
data/
  ├── health/profile.json           # YOUR medical/goals data
  ├── library/exercises.json        # 80+ exercises with knee flags
  ├── workouts/                     # Daily JSON logs (auto-created)
  ├── schedule/current.json         # Weekly plan (auto-generated)
  └── analytics/latest.json         # Full analytics (auto-generated)
health-os-pwa/                      # PWA (deploy to Vercel)
```

### Public Repo (`rohitkankhediya.web`)
```
data/public_metrics.json            # Safe metrics for website
```

---

## 🔧 Remaining Setup (You Do)

### 1. Add Secrets to Private Repo
Go to: `https://github.com/RohitKankhedia/rohit-health-os/settings/secrets/actions`

Add:
- `PAT` = Your **new** private PAT (repo + workflow scopes)
- `PUBLIC_REPO_PAT` = Your **new** public PAT (public_repo scope)
- `YT_API_KEY` = YouTube Data API v3 key (optional, from Google Cloud Console)

### 2. Enable GitHub Actions
- Private repo: Actions tab → "I understand..."
- Public repo: Actions tab → "I understand..."

### 3. Trigger First Run
Private repo → Actions → "Aggregate & Push Public Metrics" → "Run workflow"

### 4. Verify
Check these files appear:
- Private: `data/schedule/current.json`, `data/analytics/latest.json`
- Public: `data/public_metrics.json`

---

## 📱 iPhone Shortcut Setup

### Option A: Build Manually (5 min)
Open Shortcuts app → Create Shortcut → Add these actions:

1. **Choose from Menu** → "Select Workout Type" → [Push, Pull, Legs (Hip), Legs (Knee-Friendly), Cardio, Rest] → Set Variable `workoutType`
2. **Date** → Format: YYYY-MM-DD → Set Variable `workoutDate`
3. **Ask for Input** → Number → "Duration (min)" → Set Variable `duration`
4. **Ask for Input** → Number → "Overall RPE (1-10)" → Set Variable `overallRPE`
5. **Choose from Menu** → "How many exercises?" → [1-6] → Set Variable `exerciseCount`
6. **Repeat** `exerciseCount` times:
   - Ask for Input → Text → "Exercise Name" → Set Variable `exerciseName`
   - Ask for Input → Number → "Sets" → Set Variable `setCount`
   - **Repeat** `setCount` times:
     - Ask for Input → Number → "Reps" → Set Variable `reps`
     - Ask for Input → Number → "Weight (kg)" → Set Variable `weight`
     - Ask for Input → Number → "RPE" → Set Variable `rpe`
     - Ask for Input → Number → "Rest (sec)" → Set Variable `rest`
     - **Set Dictionary Value** → Add to `exerciseData.sets`
   - **Set Dictionary Value** → Add `exerciseData` to `workoutData.exercises`
7. **Ask for Input** → Boolean → "Add Cardio?"
8. **If** Cardio = true:
   - Choose from Menu → Cardio Type → [Running, Cycling, Walking]
   - Ask for Input → Number → Distance (km)
   - Ask for Input → Number → Duration (min)
   - Set Dictionary Value → Add to `workoutData.cardio`
9. **Set Dictionary Values** for date, day, duration, RPE, completed=true
10. **Get Contents of URL**:
    - URL: `https://api.github.com/repos/RohitKankhedia/rohit-health-os/contents/data/workouts/{{workoutDate}}.json`
    - Method: PUT
    - Headers: `Authorization: Bearer YOUR_PRIVATE_PAT`, `Accept: application/vnd.github.v3+json`
    - Request Body (JSON):
      ```json
      {
        "message": "🏋️ Workout: {{workoutType}} - {{workoutDate}}",
        "content": "{{workoutData | base64_encode}}",
        "branch": "main"
      }
      ```
11. **Show Result** → "✅ Workout logged & synced!"

### Option B: Use iCloud Link
I'll provide a shareable iCloud link after you test Option A.

---

## 🌐 PWA Deployment (Vercel)

1. Go to **vercel.com** → Sign up with GitHub
2. **Add New Project** → Import `rohit-health-os` (private repo visible)
3. **Root Directory**: `health-os-pwa`
4. **Framework**: Other
5. **Deploy** → Get URL like `https://health-os-rohit.vercel.app`

### Install on iPhone:
1. Open URL in **Safari**
2. Share → **Add to Home Screen**
3. Name: "Health OS"

### Install on Realme:
1. Open URL in **Chrome**
2. Menu → **Install app** / **Add to Home Screen**

---

## 🌍 Website Integration

Add to your existing `index.html` (in `rohitkankhediya.web`):

```html
<!-- Add these IDs to your snapshot cards -->
<div class="s-item"><div class="n" id="snapWorkouts">0</div><div class="l">Workouts This Week</div></div>
<div class="s-item"><div class="n" id="snapStreak">0</div><div class="l">Streak Days</div></div>
<div class="s-item"><div class="n" id="snapRunning">0</div><div class="l">Running (km)</div></div>
<div class="s-item"><div class="n" id="ytSubsLive">0</div><div class="l">YouTube Subs</div></div>
<div class="s-item"><div class="n" id="liFollowersLive">0</div><div class="l">LinkedIn Followers</div></div>

<!-- Add before </body> -->
<script>
async function loadPublicMetrics() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/RohitKankhedia/rohitkankhediya.web/main/data/public_metrics.json');
    const data = await res.json();
    document.getElementById('snapWorkouts').textContent = data.fitness?.workouts_this_week || 0;
    document.getElementById('snapStreak').textContent = data.fitness?.streak_days || 0;
    document.getElementById('snapRunning').textContent = (data.fitness?.running_km_week || 0) + ' km';
    document.getElementById('ytSubsLive').textContent = data.youtube?.subscribers || 0;
    document.getElementById('liFollowersLive').textContent = data.linkedin?.followers?.toLocaleString() || 0;
  } catch (e) { console.log('Metrics load failed', e); }
}
loadPublicMetrics();
setInterval(loadPublicMetrics, 5 * 60 * 1000);
</script>
```

Commit & push → Website updates automatically.

---

## 🏃 Daily Usage

| Device | Action |
|--------|--------|
| **iPhone** | Shortcuts → "Log Workout" → 30 sec → Auto-sync |
| **PWA** | Home screen icon → Body map, schedule, recovery, YT/LI stats |
| **Website** | Auto-shows public metrics cards |
| **Laptop** | `git pull` → Run scripts manually for deep analysis |

---

## 🔒 Privacy

| Data | Location |
|------|----------|
| Medical history, exact workouts, weight | **Private repo only** |
| Aggregate fitness (counts, streak, km) | Public repo → Website + PWA |
| YouTube/LinkedIn counts | Public repo → Website + PWA |

---

## 🛠 Troubleshooting

| Issue | Fix |
|-------|-----|
| Shortcut fails | Check PAT in Shortcut Authorization header |
| Action fails | Verify Secrets names: `PAT`, `PUBLIC_REPO_PAT`, `YT_API_KEY` |
| PWA not installing | Must use HTTPS (Vercel provides) + valid manifest.json |
| Website not updating | Hard refresh (Cmd+Shift+R) + check `public_metrics.json` |
| Schedule not generating | Check `data/health/profile.json` valid JSON |

---

## 📞 Next Steps

1. **Add Secrets** → Enable Actions → Run workflow
2. **Test Shortcut** → Log a dummy workout
3. **Deploy PWA** → Install on both phones
4. **Update Website** → Add dashboard code
5. **Customize** → Edit `profile.json` with your real data

---

**All code is in your local folder:** `/Users/rohit/Documents/VS project/rohit-health-os`

**Commit & push when ready:**
```bash
cd "/Users/rohit/Documents/VS project/rohit-health-os"
git add .
git commit -m "🏗️ Complete Health OS scaffold"
git push origin main
```
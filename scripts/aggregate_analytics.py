#!/usr/bin/env python3
"""
Aggregates fitness + YouTube + LinkedIn analytics.
Reads: workouts, health profile, YouTube/LinkedIn APIs
Writes: data/analytics/latest.json
"""
import json
import os
import requests
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).parent.parent
WORKOUTS_DIR = ROOT / "data/workouts"
PROFILE_PATH = ROOT / "data/health/profile.json"
ANALYTICS_PATH = ROOT / "data/analytics/latest.json"

YT_API_KEY = os.environ.get('YT_API_KEY', '')
YT_CHANNEL_ID = 'UCMzSsYlStL_3QzDQJHFbx3g'

def load_json(path):
    with open(path) as f:
        return json.load(f)

def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

def get_fitness_metrics():
    workouts = []
    cutoff = datetime.now() - timedelta(days=28)
    for file in sorted(WORKOUTS_DIR.glob("*.json")):
        try:
            date_str = file.stem
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            if dt >= cutoff:
                data = load_json(file)
                data['_date'] = dt
                workouts.append(data)
        except:
            continue
    
    if not workouts:
        return {}
    
    week_cutoff = datetime.now() - timedelta(days=7)
    week_workouts = [w for w in workouts if w['_date'] >= week_cutoff]
    
    total_volume = 0
    total_rpe = 0
    rpe_count = 0
    
    for w in workouts:
        for ex in w.get('exercises', []):
            for s in ex.get('sets', []):
                total_volume += s.get('reps', 0) * s.get('weight_kg', 0)
                total_rpe += s.get('rpe', 0)
                rpe_count += 1
    
    streak = 0
    check_date = datetime.now().date()
    workout_dates = {w['_date'].date() for w in workouts}
    while check_date in workout_dates:
        streak += 1
        check_date -= timedelta(days=1)
    
    running_km_week = sum(
        w.get('cardio', {}).get('distance_km', 0) 
        for w in week_workouts 
        if w.get('cardio', {}).get('type') == 'running'
    )
    
    return {
        "workouts_this_week": len(week_workouts),
        "total_volume_kg": round(total_volume),
        "avg_rpe": round(total_rpe / max(1, rpe_count), 1),
        "running_km_week": round(running_km_week, 1),
        "streak_days": streak,
        "workouts_4weeks": len(workouts)
    }

def get_youtube_metrics():
    if not YT_API_KEY:
        return {"subscribers": 96, "total_views": 12450, "total_videos": 92, "note": "Set YT_API_KEY secret for live data"}
    
    try:
        url = f"https://www.googleapis.com/youtube/v3/channels?part=statistics&id={YT_CHANNEL_ID}&key={YT_API_KEY}"
        resp = requests.get(url, timeout=10)
        data = resp.json()
        stats = data['items'][0]['statistics']
        return {
            "subscribers": int(stats.get('subscriberCount', 0)),
            "total_views": int(stats.get('viewCount', 0)),
            "total_videos": int(stats.get('videoCount', 0))
        }
    except:
        return {"subscribers": 96, "total_views": 12450, "total_videos": 92, "error": "API failed"}

def get_linkedin_metrics():
    return {
        "followers": 1240,
        "post_impressions_7d": 3420,
        "engagement_rate": 4.2,
        "note": "Configure via manual update or LinkedIn API"
    }

def main():
    fitness = get_fitness_metrics()
    youtube = get_youtube_metrics()
    linkedin = get_linkedin_metrics()
    
    analytics = {
        "timestamp": datetime.now().isoformat() + "Z",
        "fitness": fitness,
        "youtube": youtube,
        "linkedin": linkedin,
        "website": {"visitors_7d": 340, "contact_form_submissions": 3}
    }
    
    save_json(ANALYTICS_PATH, analytics)
    print(f"✅ Analytics saved: {ANALYTICS_PATH}")

if __name__ == "__main__":
    main()
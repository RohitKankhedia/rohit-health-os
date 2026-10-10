#!/usr/bin/env python3
"""
Creates SAFE public metrics from private analytics.
Reads: data/analytics/latest.json
Writes: data/public_metrics.json (pushed to public repo)
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
ANALYTICS_PATH = ROOT / "data/analytics/latest.json"
PUBLIC_PATH = ROOT / "data/public_metrics.json"

def main():
    with open(ANALYTICS_PATH) as f:
        a = json.load(f)
    
    fitness = a.get('fitness', {})
    youtube = a.get('youtube', {})
    linkedin = a.get('linkedin', {})
    
    public = {
        "timestamp": a.get('timestamp'),
        "fitness": {
            "workouts_this_week": fitness.get('workouts_this_week', 0),
            "streak_days": fitness.get('streak_days', 0),
            "running_km_week": fitness.get('running_km_week', 0),
            "avg_rpe": fitness.get('avg_rpe', 0)
        },
        "youtube": {
            "subscribers": youtube.get('subscribers', 0),
            "total_views": youtube.get('total_views', 0),
            "total_videos": youtube.get('total_videos', 0)
        },
        "linkedin": {
            "followers": linkedin.get('followers', 0)
        }
    }
    
    with open(PUBLIC_PATH, 'w') as f:
        json.dump(public, f, indent=2)
    
    print(f"✅ Public metrics: {PUBLIC_PATH}")
    print(json.dumps(public, indent=2))

if __name__ == "__main__":
    main()
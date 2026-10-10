#!/usr/bin/env python3
"""
Generates weekly workout schedule respecting medical constraints.
Reads: data/health/profile.json, data/library/exercises.json, recent workouts
Writes: data/schedule/current.json
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).parent.parent
PROFILE_PATH = ROOT / "data/health/profile.json"
EXERCISE_LIB_PATH = ROOT / "data/library/exercises.json"
WORKOUTS_DIR = ROOT / "data/workouts"
SCHEDULE_PATH = ROOT / "data/schedule/current.json"

# 6-day split template
SPLIT_TEMPLATE = [
    {"day": "monday", "focus": "push", "target_muscles": ["chest", "front_delt", "triceps", "side_delt"]},
    {"day": "tuesday", "focus": "pull", "target_muscles": ["lats", "upper_back", "rear_delt", "biceps"]},
    {"day": "wednesday", "focus": "legs_hip", "target_muscles": ["glutes", "hamstrings", "calves", "abs"]},
    {"day": "thursday", "focus": "push", "target_muscles": ["upper_chest", "front_delt", "triceps", "side_delt"]},
    {"day": "friday", "focus": "pull", "target_muscles": ["lats", "upper_back", "rear_delt", "biceps"]},
    {"day": "saturday", "focus": "legs_knee_friendly", "target_muscles": ["glutes", "hamstrings", "calves", "abs"]},
    {"day": "sunday", "focus": "rest", "target_muscles": []},
]

KNEE_CONTRAINDICATED = {
    "deep_squats", "lunges", "leg_press_heavy", "box_jumps",
    "running_downhill", "knee_extension_machine", "bulgarian_split_squat",
    "walking_lunge", "reverse_lunge", "step_up", "leg_extension_heavy"
}

def load_json(path):
    with open(path) as f:
        return json.load(f)

def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

def get_recent_workouts(days=14):
    workouts = []
    cutoff = datetime.now() - timedelta(days=days)
    for file in sorted(WORKOUTS_DIR.glob("*.json")):
        try:
            date_str = file.stem
            workout_date = datetime.strptime(date_str, "%Y-%m-%d")
            if workout_date >= cutoff:
                data = load_json(file)
                data['_date'] = workout_date
                workouts.append(data)
        except:
            continue
    return workouts

def calculate_muscle_fatigue(workouts):
    fatigue = {}
    now = datetime.now()
    
    for w in workouts:
        hours_ago = (now - w['_date']).total_seconds() / 3600
        decay = max(0, 1 - hours_ago / 168)
        
        for ex in w.get('exercises', []):
            muscle = ex.get('muscle_group', '')
            if not muscle:
                continue
            volume = sum(s.get('reps', 0) * s.get('weight_kg', 0) for s in ex.get('sets', []))
            avg_rpe = sum(s.get('rpe', 5) for s in ex.get('sets', [])) / max(1, len(ex.get('sets', [])))
            intensity_factor = avg_rpe / 10
            
            score = (volume / 1000) * intensity_factor * decay * 100
            fatigue[muscle] = fatigue.get(muscle, 0) + score
    
    return {k: min(100, v) for k, v in fatigue.items()}

def filter_exercises(exercises, profile):
    safe = {}
    contraindicated = set()
    
    for condition, details in profile.get('medical_history', {}).items():
        if 'contraindicated_exercises' in details:
            contraindicated.update(details['contraindicated_exercises'])
    
    for key, ex in exercises.items():
        ex_id = key.lower()
        if any(c in ex_id for c in contraindicated):
            continue
        if ex.get('contraindications') and any(c in contraindicated for c in ex.get('contraindications', [])):
            continue
        if not ex.get('knee_friendly', True) and 'knee_issues' in profile.get('medical_history', {}):
            continue
        safe[key] = ex
    return safe

def select_exercises_for_day(target_muscles, safe_exercises, fatigue, count=5):
    candidates = []
    for key, ex in safe_exercises.items():
        primary = ex.get('primary_muscle', '')
        secondary = ex.get('secondary_muscles', [])
        all_muscles = [primary] + secondary
        
        if any(m in target_muscles for m in all_muscles):
            muscle_fatigue = max((fatigue.get(m, 0) for m in all_muscles), default=0)
            candidates.append((key, ex, muscle_fatigue))
    
    candidates.sort(key=lambda x: x[2])
    return [c[0] for c in candidates[:count]]

def main():
    profile = load_json(PROFILE_PATH)
    exercises = load_json(EXERCISE_LIB_PATH)
    workouts = get_recent_workouts()
    
    fatigue = calculate_muscle_fatigue(workouts)
    safe_exercises = filter_exercises(exercises, profile)
    
    schedule = {
        "generated_at": datetime.now().isoformat() + "Z",
        "valid_until": (datetime.now() + timedelta(days=7)).isoformat() + "Z",
        "split": "PPL_PPL_rest",
        "days": {},
        "notes": []
    }
    
    if 'knee_issues' in profile.get('medical_history', {}):
        knee = profile['medical_history']['knee_issues']
        schedule["notes"].append(f"⚠️ {knee['condition'].title()} ({knee['severity']}, {knee['affected_side']} knee)")
        schedule["notes"].append(f"🚫 Avoid: {', '.join(knee['contraindicated_exercises'])}")
        schedule["notes"].append("✅ Leg days: hip-dominant focus, limited knee flexion")
    
    for day_template in SPLIT_TEMPLATE:
        day = day_template["day"]
        focus = day_template["focus"]
        targets = day_template["target_muscles"]
        
        if focus == "rest":
            schedule["days"][day] = {"focus": "rest", "exercises": ["mobility", "walking", "meditation"]}
            continue
        
        selected = select_exercises_for_day(targets, safe_exercises, fatigue, count=5)
        schedule["days"][day] = {
            "focus": focus,
            "exercises": selected,
            "target_muscles": targets
        }
    
    save_json(SCHEDULE_PATH, schedule)
    print(f"✅ Schedule generated: {SCHEDULE_PATH}")

if __name__ == "__main__":
    main()
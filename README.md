# Legio Flow — Modular Execution & Review OS

A modular software system built for disciplined daily execution, deep work sprints (GWS), weekly goal crushing with tiered reward ladders, and retrospective course correction.

## Key Features

1. **Modular Template Engine**:
   - Customize the number, size, and shape of every card and review template.
   - Adjust grid widths (Full width `12`, Two-Thirds `8`, Half `6`, One-Third `4`, Quarter `3`).
   - Customize card styles (`standard`, `compact`, `highlight`, `bordered`, `minimal`).
   - Add custom metrics, checklists, ratings (1–5 or 1–10), timers, and prompts.

2. **Daily Command Center**:
   - Day-by-day navigation with interactive calendar ribbon (e.g. 25th, 26th, 27th, 28th Oct pre-seeded).
   - Main Tasks completed counter (e.g. `3 / 3`) with quick adjustments.
   - Daily Execution Score (`1–10`) with color feedback.
   - Automatic Tasks / Routine toggle (Yes/No) with expandable checklist.
   - Numbered daily mission plan (e.g. Discord test run, Miro trading roadmap, systems assessment).

3. **GWS (Goal Work Session) Studio**:
   - Interactive deep work stopwatch/timer with Planned vs. Actual duration.
   - 1–5 Performance Scorecard (Focus, Execution, Output → Total `/ 15`) with tier badges (*Elite*, *Strong*, *Calibration Needed*).
   - 3 Actionable Reflexion Prompts:
     1. *What did I accomplish?*
     2. *What held me back?*
     3. *What will I improve next session?*

4. **Weekly Goal Crusher & Reward Ladder (Google Sheets Enhanced)**:
   - Faithful interactive reproduction of the weekly Google Sheet.
   - Task breakdown with point values summing to 10.
   - Live progress bar towards the 10-point milestone.
   - Dynamic Reward Ladder (`6+`, `7+`, `8+`, `9+`, `10`) that unlocks and lights up as points are earned.
   - Strategy note and weekly retrospective review.

5. **Course Correction & Retrospective Hub**:
   - Aggregated telemetry: Average execution score, GWS score distributions, total sprint hours.
   - **Recurring Bottleneck Aggregator**: Extracts all *"What held me back?"* responses to expose systemic friction.
   - **Actionable Commitment Tracker**: Gathers all *"What will I improve next session?"* promises.
   - Split-screen review writer for end-of-week course corrections.

6. **Local-First & Data Ownership**:
   - Instant autosave to browser LocalStorage.
   - One-click JSON backup export & restore.
   - Reset to sample data button to experiment freely.

## Running the Application

In terminal:
```bash
npm run dev
```
or run:
```bash
./start.sh
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

import cv2
import numpy as np
import base64
import os


class ReportGenerator:
    FIELD_WIDTH = 68.0
    FIELD_DEPTH = 23.32
    HEATMAP_W   = 700
    HEATMAP_H   = int(700 * 23.32 / 68)  # ~240 px, proportional to field

    # ──────────────────────────────────────────────────────────────────────────
    # Data collection
    # ──────────────────────────────────────────────────────────────────────────

    def _collect_player_stats(self, tracks):
        """
        Returns {player_id: {team, distance, max_speed, avg_speed}}
        """
        data = {}
        for player_track in tracks['players']:
            for pid, info in player_track.items():
                if pid not in data:
                    data[pid] = {'team': None, 'distance': 0.0,
                                 'max_speed': 0.0, '_speed_samples': []}
                if info.get('team') is not None:
                    data[pid]['team'] = info['team']
                speed = info.get('speed')
                if speed:
                    data[pid]['_speed_samples'].append(float(speed))
                    if speed > data[pid]['max_speed']:
                        data[pid]['max_speed'] = float(speed)
                dist = info.get('distance', 0)
                if dist and dist > data[pid]['distance']:
                    data[pid]['distance'] = float(dist)

        for pid in data:
            samples = data[pid].pop('_speed_samples')
            data[pid]['avg_speed'] = round(sum(samples) / len(samples), 1) if samples else 0.0
            data[pid]['max_speed'] = round(data[pid]['max_speed'], 1)
            data[pid]['distance']  = round(data[pid]['distance'],  1)

        return data

    def _build_team_aggregates(self, player_stats, passes):
        teams = {
            1: {'players': [], 'total_dist': 0.0, 'max_speed': 0.0,
                '_avg_speeds': [], 'passes': passes.get(1, 0)},
            2: {'players': [], 'total_dist': 0.0, 'max_speed': 0.0,
                '_avg_speeds': [], 'passes': passes.get(2, 0)},
        }
        for pid, s in player_stats.items():
            t = s['team']
            if t not in teams:
                continue
            teams[t]['players'].append((pid, s))
            teams[t]['total_dist'] += s['distance']
            if s['max_speed'] > teams[t]['max_speed']:
                teams[t]['max_speed'] = s['max_speed']
            if s['avg_speed'] > 0:
                teams[t]['_avg_speeds'].append(s['avg_speed'])

        for t in teams:
            avgs = teams[t].pop('_avg_speeds')
            teams[t]['avg_speed']   = round(sum(avgs) / len(avgs), 1) if avgs else 0.0
            teams[t]['max_speed']   = round(teams[t]['max_speed'], 1)
            teams[t]['total_dist']  = round(teams[t]['total_dist'], 1)
            teams[t]['players'].sort(key=lambda x: x[1]['distance'], reverse=True)

        return teams

    # ──────────────────────────────────────────────────────────────────────────
    # Heatmap image (base64 PNG)
    # ──────────────────────────────────────────────────────────────────────────

    # px/m scale: HEATMAP_W/FIELD_WIDTH ≈ 10.3  →  sigma=25 ≈ 2.4 m zone radius
    _BLUR_SIGMA   = 25
    _SAMPLE_EVERY = 3          # use every Nth frame to suppress movement trails
    _FIELD_GREEN  = (34, 139, 34)   # BGR green pitch colour

    def _heatmap_b64(self, tracks, team_id):
        density = np.zeros((self.HEATMAP_H, self.HEATMAP_W), dtype=np.float32)

        for frame_num, player_track in enumerate(tracks['players']):
            # Downsample frames so smooth movement leaves zones, not trails
            if frame_num % self._SAMPLE_EVERY != 0:
                continue
            for _, info in player_track.items():
                if info.get('team') != team_id:
                    continue
                pos = info.get('position_transformed')
                if pos is None:
                    continue
                rx = int(pos[1] / self.FIELD_WIDTH  * self.HEATMAP_W)
                ry = int(pos[0] / self.FIELD_DEPTH  * self.HEATMAP_H)
                if 0 <= rx < self.HEATMAP_W and 0 <= ry < self.HEATMAP_H:
                    density[ry, rx] += 1

        # Large sigma turns each point into a smooth ~2.4 m zone
        cv2.GaussianBlur(density, (0, 0), self._BLUR_SIGMA, density)

        if density.max() > 0:
            cv2.normalize(density, density, 0, 255, cv2.NORM_MINMAX)

        heatmap_colored = cv2.applyColorMap(density.astype(np.uint8), cv2.COLORMAP_JET)

        # Blend heatmap over a green pitch: zero-density areas stay green,
        # high-density areas show full JET colour
        field = np.full((self.HEATMAP_H, self.HEATMAP_W, 3),
                        self._FIELD_GREEN, dtype=np.uint8)
        alpha = np.clip(density / 80.0, 0.0, 1.0)[..., np.newaxis]   # (H,W,1)
        img = (alpha * heatmap_colored + (1 - alpha) * field).astype(np.uint8)

        cv2.rectangle(img, (2, 2), (self.HEATMAP_W - 3, self.HEATMAP_H - 3), (255, 255, 255), 2)
        cv2.line(img, (self.HEATMAP_W // 2, 2),
                 (self.HEATMAP_W // 2, self.HEATMAP_H - 3), (255, 255, 255), 1)
        cv2.circle(img, (self.HEATMAP_W // 2, self.HEATMAP_H // 2), 4, (255, 255, 255), -1)

        _, buf = cv2.imencode('.png', img)
        return base64.b64encode(buf).decode()

    # ──────────────────────────────────────────────────────────────────────────
    # Public entry point
    # ──────────────────────────────────────────────────────────────────────────

    def generate(self, tracks, team_ball_control,
                 passes_per_frame, output_path='output_videos/report.html'):

        player_stats = self._collect_player_stats(tracks)
        final_passes = passes_per_frame[-1] if passes_per_frame else {1: 0, 2: 0}
        teams        = self._build_team_aggregates(player_stats, final_passes)

        # Ball control percentages
        tbc       = np.array(team_ball_control)
        total_ctrl = int(np.sum(tbc > 0))
        t1_pct = round(int(np.sum(tbc == 1)) / total_ctrl * 100, 1) if total_ctrl else 0.0
        t2_pct = round(int(np.sum(tbc == 2)) / total_ctrl * 100, 1) if total_ctrl else 0.0

        hm1 = self._heatmap_b64(tracks, 1)
        hm2 = self._heatmap_b64(tracks, 2)

        html = self._render_html(teams, t1_pct, t2_pct, hm1, hm2)

        out_dir = os.path.dirname(output_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)

        print(f"\n  Report saved → {output_path}\n")

    # ──────────────────────────────────────────────────────────────────────────
    # HTML rendering
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _player_rows_html(players):
        medals = {0: ('gold',   '🥇'),
                  1: ('silver', '🥈'),
                  2: ('bronze', '🥉')}
        rows = ''
        for i, (pid, s) in enumerate(players):
            cls, badge = medals.get(i, ('', f'#{i + 1}'))
            rows += (
                f'<tr>'
                f'<td class="{cls}">{badge}</td>'
                f'<td class="{cls}">Player {pid}</td>'
                f'<td>{s["distance"]:.1f} m</td>'
                f'<td>{s["avg_speed"]:.1f} km/h</td>'
                f'<td>{s["max_speed"]:.1f} km/h</td>'
                f'</tr>\n'
            )
        return rows

    def _render_html(self, teams, t1_pct, t2_pct, hm1, hm2):
        rows1 = self._player_rows_html(teams[1]['players'])
        rows2 = self._player_rows_html(teams[2]['players'])

        # Unpack team stats into plain variables to keep the f-string readable
        t1d, t1a, t1m, t1p = (teams[1]['total_dist'], teams[1]['avg_speed'],
                               teams[1]['max_speed'],  teams[1]['passes'])
        t2d, t2a, t2m, t2p = (teams[2]['total_dist'], teams[2]['avg_speed'],
                               teams[2]['max_speed'],  teams[2]['passes'])

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Football Analysis Report</title>
<style>
  *,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
  body{{background:#0d0d0d;color:#ddd;font-family:'Segoe UI',Arial,sans-serif;padding:36px 48px;line-height:1.5}}
  h1{{text-align:center;font-size:2.2em;color:#fff;padding-bottom:18px;border-bottom:1px solid #2a2a2a;margin-bottom:36px;letter-spacing:1px}}
  h2{{font-size:1.0em;color:#888;text-transform:uppercase;letter-spacing:2px;margin:44px 0 18px;padding-left:14px;border-left:4px solid #4caf50}}
  .grid2{{display:grid;grid-template-columns:1fr 1fr;gap:22px}}
  /* Summary cards */
  .summary-card{{background:#161616;border:1px solid #222;border-radius:10px;padding:26px 24px}}
  .team-name{{font-size:1.4em;font-weight:700;color:#fff;margin-bottom:18px;text-align:center}}
  .metrics{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}
  .metric{{background:#1c1c1c;border-radius:8px;padding:14px;text-align:center}}
  .metric .val{{font-size:1.6em;font-weight:700;color:#4caf50}}
  .metric .lbl{{font-size:0.70em;color:#555;margin-top:5px;text-transform:uppercase;letter-spacing:1px}}
  /* Heatmaps */
  .heatmap-box{{text-align:center}}
  .heatmap-box img{{width:100%;max-width:700px;border:1px solid #2a2a2a;border-radius:6px}}
  .heatmap-title{{font-size:1.0em;color:#888;margin-bottom:8px}}
  .legend{{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:8px;font-size:0.75em;color:#555}}
  .legend-bar{{width:130px;height:9px;border-radius:3px;background:linear-gradient(to right,#00008b,#0000ff,#00ffff,#00ff00,#ffff00,#ff0000)}}
  /* Team sections */
  .team-box{{background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:24px}}
  .kpi-row{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}}
  .kpi{{background:#181818;border-radius:8px;padding:14px;text-align:center}}
  .kpi .kv{{font-size:1.45em;font-weight:700;color:#4caf50}}
  .kpi .kl{{font-size:0.68em;color:#555;margin-top:5px;text-transform:uppercase;letter-spacing:0.8px}}
  /* Tables */
  table{{width:100%;border-collapse:collapse;font-size:0.88em}}
  thead th{{background:#1a1a1a;color:#555;padding:10px 14px;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #222}}
  tbody td{{padding:9px 14px;border-bottom:1px solid #191919}}
  tbody tr:last-child td{{border-bottom:none}}
  tbody tr:hover td{{background:#161616}}
  .gold{{color:#FFD700;font-weight:700}}
  .silver{{color:#C0C0C0;font-weight:700}}
  .bronze{{color:#CD7F32;font-weight:700}}
  footer{{text-align:center;margin-top:52px;color:#2a2a2a;font-size:0.78em;border-top:1px solid #1a1a1a;padding-top:18px}}
</style>
</head>
<body>

<h1>⚽ Football Match Analysis Report</h1>

<!-- ── MATCH SUMMARY ─────────────────────────────────────── -->
<h2>Match Summary</h2>
<div class="grid2">

  <div class="summary-card">
    <div class="team-name">Team 1</div>
    <div class="metrics">
      <div class="metric"><div class="val">{t1_pct}%</div><div class="lbl">Ball Control</div></div>
      <div class="metric"><div class="val">{t1p}</div><div class="lbl">Passes</div></div>
      <div class="metric"><div class="val">{t1d} m</div><div class="lbl">Total Distance</div></div>
      <div class="metric"><div class="val">{t1m} km/h</div><div class="lbl">Top Speed</div></div>
    </div>
  </div>

  <div class="summary-card">
    <div class="team-name">Team 2</div>
    <div class="metrics">
      <div class="metric"><div class="val">{t2_pct}%</div><div class="lbl">Ball Control</div></div>
      <div class="metric"><div class="val">{t2p}</div><div class="lbl">Passes</div></div>
      <div class="metric"><div class="val">{t2d} m</div><div class="lbl">Total Distance</div></div>
      <div class="metric"><div class="val">{t2m} km/h</div><div class="lbl">Top Speed</div></div>
    </div>
  </div>

</div>

<!-- ── HEATMAPS ───────────────────────────────────────────── -->
<h2>Player Heatmaps</h2>
<div class="grid2">
  <div class="heatmap-box">
    <div class="heatmap-title">Team 1</div>
    <img src="data:image/png;base64,{hm1}" alt="Team 1 Heatmap">
    <div class="legend"><span>cold</span><div class="legend-bar"></div><span>hot</span></div>
  </div>
  <div class="heatmap-box">
    <div class="heatmap-title">Team 2</div>
    <img src="data:image/png;base64,{hm2}" alt="Team 2 Heatmap">
    <div class="legend"><span>cold</span><div class="legend-bar"></div><span>hot</span></div>
  </div>
</div>

<!-- ── TEAM 1 PLAYER STATS ───────────────────────────────── -->
<h2>Team 1 — Player Statistics</h2>
<div class="team-box">
  <div class="kpi-row">
    <div class="kpi"><div class="kv">{t1d} m</div><div class="kl">Total Distance</div></div>
    <div class="kpi"><div class="kv">{t1a} km/h</div><div class="kl">Avg Speed</div></div>
    <div class="kpi"><div class="kv">{t1m} km/h</div><div class="kl">Top Speed</div></div>
    <div class="kpi"><div class="kv">{t1p}</div><div class="kl">Passes</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Player</th><th>Distance</th><th>Avg Speed</th><th>Max Speed</th></tr></thead>
    <tbody>{rows1}</tbody>
  </table>
</div>

<!-- ── TEAM 2 PLAYER STATS ───────────────────────────────── -->
<h2>Team 2 — Player Statistics</h2>
<div class="team-box">
  <div class="kpi-row">
    <div class="kpi"><div class="kv">{t2d} m</div><div class="kl">Total Distance</div></div>
    <div class="kpi"><div class="kv">{t2a} km/h</div><div class="kl">Avg Speed</div></div>
    <div class="kpi"><div class="kv">{t2m} km/h</div><div class="kl">Top Speed</div></div>
    <div class="kpi"><div class="kv">{t2p}</div><div class="kl">Passes</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Player</th><th>Distance</th><th>Avg Speed</th><th>Max Speed</th></tr></thead>
    <tbody>{rows2}</tbody>
  </table>
</div>

<footer>Generated by Football Analysis System</footer>
</body>
</html>"""

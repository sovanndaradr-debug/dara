"""
================================================================================
VO5 STUDIO PRO — MASTER SYNCHRONICITY PIPELINE + LIVE SUNO MP3 GENERATOR
Lead Architect : Sovanndara Diep (ឌៀប សុវណ្ណតារា)
Core Mantra    : "Ink is Value. Story is Soul. Culture is Identity."

Two parts (decision 2026-11-23, see lyric-engine/PRODUCT.md):
  1. ទំនុកច្រៀង (lyrics): script scene -> Box 1 style + Box 2 lyrics.  Free.
     Both boxes stay editable: paste lyrics finished in Lyric Engine here.
  2. តន្ត្រី (music): Box 1 + Box 2 -> Suno MP3 (vocal song and/or score).
     Spends credits, so it only runs on its own button.
Other features are kept but hidden until the two parts are polished. Turn one on
for testing with VO5_FEATURES, e.g. VO5_FEATURES=budget (production budget and
schedule from the scene).

Suno routes used (configure SUNO_API_BASE_URL; check them against the API docs
you have access to):
  POST /audio                 create
  GET  /audio/{id}            status (poll)
Secrets stay on the server: SUNO_API_KEY is read from the environment and is
never sent to the browser.
================================================================================
"""

import hashlib
import json
import os
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import gradio as gr

from vo5_master_synchronicity_pipeline import (
    ERA_INSTRUMENT_DNA,
    BEAT_EMOTION_MAP,
    VO5MasterSynchronicityPipeline,
)

# Optional SaaS quota engine (50% API cap & 40% profit vault)
try:
    from vo5_billing_quota_engine import QuotaEnforcerProxy
    HAS_QUOTA_ENGINE = True
except ImportError:
    QuotaEnforcerProxy = None
    HAS_QUOTA_ENGINE = False


# ==============================================================================
# 0. CONFIGURATION (server side only)
# ==============================================================================
SUNO_API_BASE_URL = os.getenv("SUNO_API_BASE_URL", "https://api.suno.com/v0")
BOX1_MAX = 120            # Box 1 Golden Formula
BOX2_MAX = 5000           # lyrics limit sent to Suno
MP3_MAX_BYTES = 40 * 1024 * 1024
LOCAL_HOSTS = ("127.0.0.1", "localhost", "::1")

MODE_BOTH, MODE_SCORE, MODE_VOCAL = "both", "score", "vocal"
MODE_CHOICES = [
    ("ផលិតទាំងពីរ (ភ្លេង Score + បទចម្រៀង)", MODE_BOTH),
    ("ផលិតតែភ្លេង Score (Instrumental)", MODE_SCORE),
    ("ផលិតតែបទចម្រៀង (Vocal)", MODE_VOCAL),
]


def feature_on(name: str) -> bool:
    """Hidden features: kept in the code, off for users unless VO5_FEATURES lists them."""
    return name in [f.strip() for f in os.getenv("VO5_FEATURES", "").split(",") if f.strip()]


def server_api_key() -> str:
    """Read at call time, so a key set after start-up is used and never cached in the UI."""
    return os.getenv("SUNO_API_KEY", "").strip()


# ==============================================================================
# 1. SUNO CLIENT
# ==============================================================================
class SunoV6LiveEngine:
    """Create, poll and download Suno clips. Every method returns data; none raises."""

    @staticmethod
    def _http_request(method: str, endpoint: str, api_key: str,
                      payload: Optional[Dict[str, Any]] = None,
                      extra_headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        url = f"{SUNO_API_BASE_URL.rstrip('/')}/{endpoint.lstrip('/')}"
        headers = {
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if extra_headers:
            headers.update(extra_headers)
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            return {"error": True, "status_code": e.code,
                    "message": e.read().decode("utf-8", errors="ignore")[:500]}
        except Exception as e:  # network, timeout, bad JSON
            return {"error": True, "status_code": 0, "message": str(e)[:500]}

    @staticmethod
    def idempotency_key(payload: Dict[str, Any]) -> str:
        """Same request -> same key, so a retry never creates (and bills) a second song."""
        canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:32]

    @staticmethod
    def build_payload(title: str, style: str, lyrics: str = "", instrumental: bool = False,
                      duration: Optional[int] = None, model: str = "v6",
                      vocal_gender: Optional[str] = None) -> Tuple[Dict[str, Any], List[str]]:
        """Returns the payload and a list of warnings (never cut text silently)."""
        warnings = []
        if len(style) > BOX1_MAX:
            warnings.append(f"Box 1 មាន {len(style)} តួអក្សរ (លើស {BOX1_MAX})៖ ត្រូវបានកាត់។")
        payload: Dict[str, Any] = {
            "title": title[:256],
            "style": style[:BOX1_MAX],
            "instrumental": bool(instrumental),
            "model": model,
        }
        if not instrumental and lyrics:
            if len(lyrics) > BOX2_MAX:
                warnings.append(f"Box 2 មាន {len(lyrics)} តួអក្សរ (លើស {BOX2_MAX})៖ ត្រូវបានកាត់។")
            payload["lyrics"] = lyrics[:BOX2_MAX]
        if duration and 15 <= int(duration) <= 360:
            payload["duration"] = int(duration)
        if vocal_gender in ("male", "female") and not instrumental:
            payload["vocal_gender"] = vocal_gender
        return payload, warnings

    @classmethod
    def audio_create(cls, api_key: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        return cls._http_request("POST", "/audio", api_key, payload,
                                 {"Idempotency-Key": cls.idempotency_key(payload)})

    @staticmethod
    def clip_ids(resp: Dict[str, Any]) -> List[str]:
        ids = resp.get("clip_ids") or ([resp["id"]] if resp.get("id") else [])
        return [str(i) for i in ids][:2]

    @classmethod
    def audio_wait(cls, api_key: str, clip_ids: List[str], max_wait_sec: int = 120,
                   poll_interval_sec: int = 4) -> List[Dict[str, Any]]:
        """Poll until each clip is 'complete' or 'error'. A clip still 'streaming' at the
        deadline is returned as is: it can be previewed, but is not downloaded."""
        deadline = time.time() + max_wait_sec
        last: Dict[str, Dict[str, Any]] = {}
        while True:
            pending = [c for c in clip_ids if str(last.get(c, {}).get("status", "")).lower() not in ("complete", "error")]
            for cid in pending:
                res = cls._http_request("GET", f"/audio/{urllib.parse.quote(cid, safe='')}", api_key)
                if not res.get("error"):
                    last[cid] = res
            pending = [c for c in clip_ids if str(last.get(c, {}).get("status", "")).lower() not in ("complete", "error")]
            if not pending or time.time() + poll_interval_sec > deadline:
                break
            time.sleep(poll_interval_sec)
        return [last.get(cid, {"id": cid, "status": "timeout"}) for cid in clip_ids]

    @staticmethod
    def download_mp3_to_local(audio_url: str, prefix: str = "vo5_suno") -> Optional[str]:
        """Download a finished clip to a temp file. Returns the path, or None on any failure
        (and removes the partial file). Only https URLs (or http on this machine, for tests)."""
        if not audio_url:
            return None
        parsed = urllib.parse.urlparse(audio_url)
        if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in LOCAL_HOSTS):
            return None
        fd, temp_path = tempfile.mkstemp(suffix=".mp3", prefix=f"{prefix}_")
        try:
            req = urllib.request.Request(audio_url, headers={"User-Agent": "VO5-Studio-Pro"})
            with urllib.request.urlopen(req, timeout=60) as resp, os.fdopen(fd, "wb") as out_f:
                total = 0
                while True:
                    chunk = resp.read(64 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > MP3_MAX_BYTES:
                        raise ValueError("file too large")
                    out_f.write(chunk)
            if total == 0:
                raise ValueError("empty file")
            return temp_path
        except Exception as err:
            print(f"[SUNO MP3 DOWNLOAD WARNING]: {err}")
            try:
                os.remove(temp_path)
            except OSError:
                pass
            return None


# ==============================================================================
# 2. STEP 1 — SCRIPT SCENE -> BLUEPRINT (free)
# ==============================================================================
def anchor_in_lyrics(anchor: str, lyrics: str) -> bool:
    """Meaning-first check: does the song actually mention the scene's anchor object?"""
    core = (anchor or "").split("(")[0].strip()
    return not core or core.replace(" ", "") in (lyrics or "").replace(" ", "")


def build_blueprint(scene_script: str, era_choice: str, beat_choice: str, char_name: str,
                    char_want: str, char_ghost: str, anchor_object: str):
    if not (scene_script or "").strip():
        return ("⚠️ សូមបញ្ចូលស្គ្រីប ១ ឈុតជាមុនសិន។", "", "", "", "", {})

    dna = VO5MasterSynchronicityPipeline.extract_scene_dna(
        scene_script, era_choice, beat_choice, char_name, char_want, char_ghost, anchor_object)
    song_title, box1_style, box2_lyrics = VO5MasterSynchronicityPipeline.build_lyric_blueprint(dna)
    score = VO5MasterSynchronicityPipeline.build_soundtrack_score_cues(dna)

    notes = [f"✅ ទំនុកច្រៀងរួចរាល់ · Box 1 {len(box1_style)}/{BOX1_MAX} តួអក្សរ"]
    if len(box1_style) > BOX1_MAX:
        notes.append(f"⚠️ Box 1 វែងជាង {BOX1_MAX} តួអក្សរ៖ សូមកាត់ឲ្យខ្លី មុនផលិតសំឡេង។")
    if not anchor_in_lyrics(anchor_object, box2_lyrics):
        notes.append(f"⚠️ ទំនុកច្រៀងមិនបាននិយាយពីវត្ថុតំណាង «{anchor_object}» ទេ៖ តើវាគួរមាននៅក្នុងបន្ទរទេ?")

    score_md = (
        f"### 🎼 {score.get('cue_title', '')}\n"
        f"- **ភ្លេងប្រចាំតួអង្គ (Leitmotif)៖** `{score.get('character_leitmotif', '')}`\n"
        f"- **Tempo & Key៖** `{score.get('bpm', '')} BPM` | `{score.get('key_signature', '')}` | "
        f"**កម្រិតអារម្មណ៍៖** `{score.get('emotional_intensity', '')}`\n"
        f"- **Box 1 ភ្លេងសុទ្ធ៖**\n```text\n{score.get('suno_instrumental_box1', '')}\n```\n"
        f"- **សំឡេងបរិយាកាស (sounds-create)៖**\n```text\n{score.get('suno_sounds_loop_prompt', '')}\n```"
    )

    state = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "scene_dna": dna,
        "lyric_blueprint": {"title": song_title, "box1": box1_style, "box2": box2_lyrics},
        "soundtrack_score": score,
        "suno_live_tracks": [],
    }
    return ("\n".join(notes), song_title, box1_style, box2_lyrics, score_md, state)


# ------------------------------------------------------------------------------
# Hidden feature "budget": production budget and schedule (off by default)
# ------------------------------------------------------------------------------
def budget_from_state(state: Dict[str, Any]):
    if not feature_on("budget"):
        return [], "មុខងារនេះត្រូវបានលាក់។"
    dna = (state or {}).get("scene_dna")
    if not dna:
        return [], "⚠️ សូមបង្កើតទំនុកច្រៀងពីស្គ្រីបជាមុនសិន។"
    rows, summary = VO5MasterSynchronicityPipeline.calculate_budget_and_schedule(dna)
    note = (f"ថ្ងៃថត {summary.get('shoot_days', '?')} · ថវិកា "
            f"${float(summary.get('total_physical_usd', 0) or 0):,.2f} (ប៉ាន់ស្មាន៖ ផ្ទៀងផ្ទាត់តម្លៃមុនប្រើ)")
    return rows, note


# ==============================================================================
# 3. STEP 2 — BLUEPRINT -> SUNO AUDIO (spends credits)
# ==============================================================================
def resolve_user(typed_user_id: str, request: Optional[gr.Request]) -> str:
    """A signed-in user (launch with auth) wins over a typed ID, which anyone could fake."""
    signed_in = getattr(request, "username", None) if request is not None else None
    return (signed_in or typed_user_id or "").strip()


def _make_track(api_key: str, payload: Dict[str, Any], kind: str, icon: str, prefix: str,
                lines: List[str], state: Dict[str, Any]) -> Optional[str]:
    resp = SunoV6LiveEngine.audio_create(api_key, payload)
    ids = SunoV6LiveEngine.clip_ids(resp)
    if not ids:
        lines.append(f"- ❌ **{kind}:** `{resp.get('message', 'Suno មិនបានផ្តល់ clip id')}`")
        return None
    mp3 = None
    for idx, clip in enumerate(SunoV6LiveEngine.audio_wait(api_key, ids), start=1):
        cid = str(clip.get("id", ""))
        status = str(clip.get("status", "")).lower()
        song_url = clip.get("song_url") or f"https://suno.com/song/{urllib.parse.quote(cid, safe='')}"
        lines.append(f"- {icon} **{kind} {idx} ({status or 'unknown'})**: [ស្តាប់លើ Suno]({song_url})")
        state["suno_live_tracks"].append({"type": kind, "id": cid, "status": status, "url": song_url,
                                          "audio_url": clip.get("audio_url")})
        if not mp3 and status == "complete" and clip.get("audio_url"):
            mp3 = SunoV6LiveEngine.download_mp3_to_local(clip["audio_url"], prefix=prefix)
    return mp3


def generate_audio(state: Dict[str, Any], title: str, box1: str, box2: str, mode: str, model: str,
                   vocal_gender: str, typed_user_id: str, request: gr.Request = None):
    """Part 2 (music). Uses what is in Box 1 / Box 2 now, so edited or pasted lyrics are sung."""
    state = dict(state or {})
    title, box1, box2 = (title or "").strip(), (box1 or "").strip(), (box2 or "").strip()
    if not box1 or (mode in (MODE_BOTH, MODE_VOCAL) and not box2):
        return ("⚠️ សូមបំពេញ Box 1 (រចនាបថភ្លេង) និង Box 2 (ទំនុកច្រៀង) ជាមុនសិន។", None, None, "", state)
    state["lyric_blueprint"] = {"title": title or "Untitled", "box1": box1, "box2": box2}

    api_key = server_api_key()
    if not api_key:
        return ("⚠️ ម៉ាស៊ីនមេមិនទាន់មាន SUNO_API_KEY ទេ។ ទំនុកច្រៀង និងកូដភ្លេងរួចរាល់ហើយ៖ "
                "អ្នកគ្រប់គ្រងត្រូវកំណត់ SUNO_API_KEY នៅលើម៉ាស៊ីនមេ ទើបអាចផលិត MP3 បាន។",
                None, None, "", state)

    user_id = resolve_user(typed_user_id, request)
    if HAS_QUOTA_ENGINE:
        if not user_id:
            return ("⛔ សូមចូលគណនី (ឬបញ្ចូលលេខសម្គាល់សមាជិក) មុនផលិតសំឡេង។", None, None, "", state)
        allowed, reason, _ = QuotaEnforcerProxy.check_user_eligibility(user_id, action_type="SONG")
        if not allowed:
            return (f"⛔ {reason}\nសូមបញ្ចូលកូតាតាម ABA KHQR ជាមុនសិន។", None, None, "", state)

    state = json.loads(json.dumps(state, default=str))   # work on a copy
    state["suno_live_tracks"] = []
    bp, score, dna = state["lyric_blueprint"], state.get("soundtrack_score", {}), state.get("scene_dna", {})
    lines: List[str] = []
    warnings: List[str] = []
    score_mp3 = vocal_mp3 = None

    if mode in (MODE_BOTH, MODE_SCORE):
        duration = min(360, max(30, int(float(dna.get("screen_time_sec", 60) or 60))))
        payload, w = SunoV6LiveEngine.build_payload(
            f"OST Score - {str(dna.get('scene_heading', ''))[:24]}",
            score.get("suno_instrumental_box1") or bp["box1"], instrumental=True, duration=duration, model=model)
        warnings += w
        score_mp3 = _make_track(api_key, payload, "Soundtrack Score", "🎼", "vo5_ost_score", lines, state)

    if mode in (MODE_BOTH, MODE_VOCAL):
        payload, w = SunoV6LiveEngine.build_payload(
            bp["title"], bp["box1"], lyrics=bp["box2"], instrumental=False, model=model,
            vocal_gender=vocal_gender)
        warnings += w
        vocal_mp3 = _make_track(api_key, payload, "Vocal Theme Song", "🎤", "vo5_vocal_theme", lines, state)

    made = len(state["suno_live_tracks"])
    if HAS_QUOTA_ENGINE and made:   # bill only what was actually produced
        QuotaEnforcerProxy.deduct_usage_after_generation(
            user_id=user_id, input_tokens=7500, output_tokens=3500, cached_tokens=5500, action_type="SONG")

    status = (f"🎵 Suno បានបង្កើត {made} track។" if made else "❌ មិនមាន track ត្រូវបានបង្កើតទេ (មិនបានកាត់កូតា)។")
    if warnings:
        status += "\n" + "\n".join("⚠️ " + w for w in warnings)
    links = "### 🎧 លទ្ធផលពី Suno\n" + ("\n".join(lines) if lines else "មិនមាន track។")
    return (status, score_mp3, vocal_mp3, links, state)


# ==============================================================================
# 4. UI — simple by default (lyric-engine/PRODUCT.md)
# ==============================================================================
DEFAULT_SCENE = (
    "EXT. PREAH VIHEAR BORDER CLIFF (ភ្នំខ្មោច) - NIGHT\n"
    "ភ្លៀងធ្លាក់ខ្លាំងលាយផ្សែងគ្រាប់មីន។ ជនភៀសខ្លួនខ្មែររាប់រយនាក់កំពុងរត់គេចពីសង្គ្រាមទាំងយប់ងងឹត។\n"
    "តារា (៣០ឆ្នាំ) លុតជង្គង់លើថ្មភ្នំ ឱបរូបថតចាស់ប្រឡាក់ឈាមរបស់ឪពុកជាប់ទ្រូង ទឹកភ្នែកស្រក់ហូរលាយទឹកភ្លៀង។\n"
    "តារា (និយាយក្នុងចិត្ត)៖ «ពុកអើយ... តើសន្តិភាពនៅទីណា? ទោះខ្ញុំស្លាប់នៅភ្នំខ្មោចនេះ ក៏ខ្ញុំមិនឱ្យប្រវត្តិសាស្ត្រយើងរលត់ដែរ!»"
)


def build_vo5_synchronicity_live_suno_ui():
    eras, beats = list(ERA_INSTRUMENT_DNA.keys()), list(BEAT_EMOTION_MAP.keys())
    pick = lambda options, wanted: wanted if wanted in options else (options[0] if options else None)

    with gr.Blocks(title="VO5 Studio Pro") as app:
        gr.Markdown("## VO5 Studio Pro\nអត្ថន័យ និងអារម្មណ៍មកមុន។")
        blueprint_state = gr.State({})

        # ---- Part 1: ទំនុកច្រៀង (free) ----
        gr.Markdown("### ១. ទំនុកច្រៀង")
        scene_input = gr.Textbox(label="ស្គ្រីប ១ ឈុត ឬសាច់រឿង", lines=6, value=DEFAULT_SCENE)
        with gr.Row():
            char_name_in = gr.Textbox(label="តួអង្គឯក", value="តារា (Dara)")
            anchor_obj_in = gr.Textbox(label="វត្ថុតំណាងក្នុងឈុត (Anchor Object)", value="រូបថតចាស់ប្រឡាក់ឈាម")
        with gr.Accordion("ព័ត៌មានរឿងបន្ថែម", open=False):
            era_dropdown = gr.Dropdown(label="សម័យកាល", choices=eras,
                                       value=pick(eras, "សម័យព្រំដែន ១៩៧៩ / ភ្នំខ្មោច (1979 Border Crisis)"))
            beat_dropdown = gr.Dropdown(label="ចង្វាក់រឿង (15-Beat Sheet)", choices=beats,
                                        value=pick(beats, "Beat 12: All Is Lost (បាត់បង់អ្វីៗទាំងអស់)"))
            char_want_in = gr.Textbox(label="គោលដៅតួអង្គ (Want)", value="នាំគ្រួសារឆ្លងដែនទៅរកសុវត្ថិភាព")
            char_ghost_in = gr.Textbox(label="ដំបៅអតីតកាល (Ghost/Lie)", value="ការបាត់បង់ឪពុកក្នុងវាលពិឃាត")
        btn_blueprint = gr.Button("បង្កើតទំនុកច្រៀង", variant="primary")
        status_out = gr.Textbox(label="ស្ថានភាព", lines=2, interactive=False)
        title_out = gr.Textbox(label="ចំណងជើងបទ")
        box1_out = gr.Textbox(label=f"BOX 1: រចនាបថភ្លេង (≤ {BOX1_MAX} តួអក្សរ)")
        box2_out = gr.Textbox(label="BOX 2: ទំនុកច្រៀង (កែបាន ឬបិទភ្ជាប់ពី Lyric Engine)", lines=12)

        # ---- Part 2: តន្ត្រី (spends credits, own button) ----
        gr.Markdown("### ២. តន្ត្រី")
        with gr.Row():
            mode_in = gr.Dropdown(label="ផលិតអ្វី", choices=MODE_CHOICES, value=MODE_VOCAL)
            gender_in = gr.Dropdown(label="សំឡេងអ្នកច្រៀង", choices=[("ប្រុស", "male"), ("ស្រី", "female")], value="male")
        with gr.Accordion("ការកំណត់ និងព័ត៌មានភ្លេង", open=False):
            model_in = gr.Dropdown(label="ម៉ូដែល Suno", choices=["v6"], value="v6", allow_custom_value=True)
            user_id_in = gr.Textbox(label="លេខសម្គាល់សមាជិក (បើមិនបានចូលគណនី)", value="")
            score_md_out = gr.Markdown()
        btn_audio = gr.Button("ផលិតតន្ត្រី (ចំណាយ Suno credit)")
        audio_status = gr.Textbox(label="ស្ថានភាព Suno", lines=2, interactive=False)
        with gr.Row():
            vocal_audio_player = gr.Audio(label="បទចម្រៀង", type="filepath", interactive=False)
            score_audio_player = gr.Audio(label="ភ្លេង Score", type="filepath", interactive=False)
        suno_links_md = gr.Markdown()

        # ---- Hidden features (VO5_FEATURES) ----
        if feature_on("budget"):
            with gr.Accordion("[លាក់] ថវិកា និងពេលវេលាផលិត", open=False):
                btn_budget = gr.Button("គណនាថវិកា")
                budget_note = gr.Markdown()
                budget_table = gr.Dataframe(
                    headers=["ផ្នែកចំណាយ", "បរិមាណ / រយៈពេល", "ទឹកប្រាក់ប៉ាន់ស្មាន (USD)", "កំណត់សម្គាល់"],
                    interactive=False, wrap=True)
            btn_budget.click(fn=budget_from_state, inputs=[blueprint_state], outputs=[budget_table, budget_note])

        btn_blueprint.click(
            fn=build_blueprint,
            inputs=[scene_input, era_dropdown, beat_dropdown, char_name_in, char_want_in, char_ghost_in, anchor_obj_in],
            outputs=[status_out, title_out, box1_out, box2_out, score_md_out, blueprint_state],
        )
        btn_audio.click(
            fn=generate_audio,
            inputs=[blueprint_state, title_out, box1_out, box2_out, mode_in, model_in, gender_in, user_id_in],
            outputs=[audio_status, score_audio_player, vocal_audio_player, suno_links_md, blueprint_state],
        )
    return app


if __name__ == "__main__":
    # Local only by default. To serve others, set VO5_HOST=0.0.0.0 AND protect the app
    # (VO5_AUTH="user:password"), since it spends Suno credits.
    host = os.getenv("VO5_HOST", "127.0.0.1")
    auth = os.getenv("VO5_AUTH", "")
    auth_pair = tuple(auth.split(":", 1)) if ":" in auth else None
    if host not in LOCAL_HOSTS and not auth_pair:
        raise SystemExit("Refusing to serve on a public address without VO5_AUTH=user:password.")
    build_vo5_synchronicity_live_suno_ui().queue().launch(
        server_name=host, server_port=int(os.getenv("VO5_PORT", "7860")), auth=auth_pair)

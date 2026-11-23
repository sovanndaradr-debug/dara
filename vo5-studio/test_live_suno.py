"""Tests for live_suno.py with a stand-in pipeline and a fake Suno server on 127.0.0.1.
Run: python -m unittest vo5-studio/test_live_suno.py   (needs gradio installed)"""
import json
import os
import sys
import threading
import types
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ---- stand-in for the real pipeline module (not in this repo) ----
pipe = types.ModuleType("vo5_master_synchronicity_pipeline")
pipe.ERA_INSTRUMENT_DNA = {"សម័យព្រំដែន ១៩៧៩ / ភ្នំខ្មោច (1979 Border Crisis)": {}}
pipe.BEAT_EMOTION_MAP = {"Beat 12: All Is Lost (បាត់បង់អ្វីៗទាំងអស់)": {}}


class _Pipeline:
    lyrics = "ពុកអើយ រូបថតចាស់ប្រឡាក់ឈាម នៅលើភ្នំខ្មោច"
    style = "Khmer folk ballad, tro so, slow, grief"

    @staticmethod
    def extract_scene_dna(scene, era, beat, name, want, ghost, anchor):
        return {"beat_choice": beat, "char_name": name, "scene_heading": "EXT. BORDER CLIFF", "screen_time_sec": 90}

    @staticmethod
    def calculate_budget_and_schedule(dna):
        return [["Crew", "3 days", "1000", ""]], {"shoot_days": 3, "total_physical_usd": 1000}

    @classmethod
    def build_lyric_blueprint(cls, dna):
        return "ភ្នំខ្មោច", cls.style, cls.lyrics

    @staticmethod
    def build_soundtrack_score_cues(dna):
        return {"cue_title": "Cue 1", "character_leitmotif": "tro so", "bpm": 68, "key_signature": "D minor",
                "emotional_intensity": "9.5/10", "suno_instrumental_box1": "ambient tro so drone, 68 BPM",
                "suno_sounds_loop_prompt": "rain on rocks"}



pipe.VO5MasterSynchronicityPipeline = _Pipeline
sys.modules["vo5_master_synchronicity_pipeline"] = pipe
sys.path.insert(0, os.path.dirname(__file__))

# ---- fake Suno server ----
CALLS = []


class FakeSuno(BaseHTTPRequestHandler):
    """Behaves like AceData Cloud: POST /suno/audios -> task_id, POST /suno/tasks -> response.data[]."""
    fail_create = False
    pending = False
    null_task = False

    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        CALLS.append(("POST", self.path, payload, None, self.headers.get("Authorization")))
        if self.path.endswith("/suno/audios"):
            if FakeSuno.fail_create:
                return self._json(401, {"error": {"code": "invalid_token", "message": "The token is invalid"}})
            return self._json(200, {"task_id": "t-" + ("s" if payload["instrumental"] else "v")})
        if self.path.endswith("/suno/tasks"):
            if FakeSuno.null_task:
                return self._json(200, None)
            tid = payload["id"]
            state = "pending" if FakeSuno.pending else "succeeded"
            songs = [{"id": f"{tid}-{i}", "state": state,
                      "audio_url": "" if FakeSuno.pending else f"http://127.0.0.1:{PORT}/files/{tid}-{i}.mp3"}
                     for i in (1, 2)]
            return self._json(200, {"id": tid, "response": {"success": True, "task_id": tid, "data": songs}})
        self._json(404, {"error": {"message": "not found"}})

    def do_GET(self):
        CALLS.append(("GET", self.path))
        if self.path.startswith("/files/"):
            body = b"ID3" + b"\x00" * 100
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)


def creates():
    return [c for c in CALLS if c[0] == "POST" and c[1].endswith("/suno/audios")]


server = ThreadingHTTPServer(("127.0.0.1", 0), FakeSuno)
PORT = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
os.environ["SUNO_API_BASE_URL"] = f"http://127.0.0.1:{PORT}"

import live_suno  # noqa: E402

live_suno.SunoV6LiveEngine.task_wait.__func__.__defaults__ = (1, 0)   # fast polling in tests


class FakeQuota:
    log = []

    @classmethod
    def check_user_eligibility(cls, uid, action_type):
        return (uid != "broke@x", "អស់កូតា", None)

    @classmethod
    def deduct_usage_after_generation(cls, **kw):
        cls.log.append(kw)


def blueprint():
    return live_suno.build_blueprint("INT. ROOM - NIGHT", "", "", "តារា", "", "", "រូបថតចាស់ប្រឡាក់ឈាម")


def music(mode="both", gender="male", user="", box2=None, state=None):
    out = blueprint()
    st = out[-1] if state is None else state
    return live_suno.generate_audio(st, out[1], out[2], out[3] if box2 is None else box2, mode, "chirp-v6", gender, user)


class Tests(unittest.TestCase):
    def setUp(self):
        CALLS.clear(); FakeQuota.log.clear(); FakeSuno.fail_create = False; FakeSuno.pending = False
        os.environ["SUNO_API_KEY"] = "secret-key-123"
        live_suno.HAS_QUOTA_ENGINE, live_suno.QuotaEnforcerProxy = False, None

    def test_key_never_reaches_the_browser(self):
        app = live_suno.build_vo5_synchronicity_live_suno_ui()
        self.assertNotIn("secret-key-123", json.dumps(app.config, default=str))

    def test_blueprint_is_free(self):
        out = blueprint()
        self.assertIn("✅", out[0]); self.assertEqual(out[2], _Pipeline.style)
        self.assertEqual(CALLS, [])                     # no Suno call in step 1

    def test_anchor_missing_warns(self):
        old = _Pipeline.lyrics; _Pipeline.lyrics = "ភ្លៀងធ្លាក់ខ្លាំង"
        try:
            self.assertIn("វត្ថុតំណាង", blueprint()[0])
        finally:
            _Pipeline.lyrics = old

    def test_both_tracks_and_mp3(self):
        state = blueprint()[-1]
        status, score_mp3, vocal_mp3, links, new_state = music("both", "female", state=state)
        self.assertIn("4", status)
        self.assertTrue(score_mp3 and os.path.getsize(score_mp3) > 0)
        self.assertTrue(vocal_mp3 and os.path.getsize(vocal_mp3) > 0)
        posts = creates()
        self.assertEqual([p[2]["instrumental"] for p in posts], [True, False])
        self.assertEqual(posts[1][2]["vocal_gender"], "f")
        self.assertEqual(posts[1][2]["action"], "generate"); self.assertTrue(posts[1][2]["custom"])
        self.assertEqual(posts[1][2]["model"], "chirp-v6"); self.assertIn("lyric", posts[1][2])
        self.assertEqual(posts[0][4], "Bearer secret-key-123")
        self.assertEqual(state["suno_live_tracks"], [])  # caller's state not mutated

    def test_unfinished_task_is_not_resubmitted(self):
        FakeSuno.pending = True
        out = music("vocal")
        self.assertEqual(len(creates()), 1)              # one create, then only look-ups
        self.assertIn("t-v", out[3]); self.assertIn("មិនទាន់ចប់", out[3])
        self.assertIn("មិនមាន track", out[0])            # nothing finished, nothing billed

    def test_null_task_answer_does_not_crash(self):
        FakeSuno.null_task = True
        try:
            out = music("vocal")
            self.assertIn("មិនទាន់ចប់", out[3])
        finally:
            FakeSuno.null_task = False

    def test_khmer_diction_defaults(self):
        payload, w = live_suno.SunoV6LiveEngine.build_payload("t", "slow ballad", lyrics="ក", vocal_gender="male")
        self.assertIn("Thai accent", payload["negative_tags"])
        self.assertTrue(any("Khmer" in x for x in w))       # Box 1 should say Khmer
        payload, w = live_suno.SunoV6LiveEngine.build_payload("t", "sung in Khmer, ballad", lyrics="ក")
        self.assertFalse(any("Khmer" in x for x in w))
        payload, w = live_suno.SunoV6LiveEngine.build_payload("t", "ambient", instrumental=True)
        self.assertNotIn("negative_tags", payload)

    def test_invalid_token_is_explained(self):
        FakeSuno.fail_create = True
        out = music("vocal")
        self.assertIn("SUNO_API_KEY មិនត្រឹមត្រូវ", out[3])

    def test_no_server_key(self):
        os.environ["SUNO_API_KEY"] = ""
        out = music()
        self.assertIn("SUNO_API_KEY", out[0]); self.assertEqual(CALLS, [])

    def test_quota_needs_a_user(self):
        live_suno.HAS_QUOTA_ENGINE, live_suno.QuotaEnforcerProxy = True, FakeQuota
        out = music()
        self.assertIn("⛔", out[0]); self.assertEqual(CALLS, [])

    def test_quota_refused(self):
        live_suno.HAS_QUOTA_ENGINE, live_suno.QuotaEnforcerProxy = True, FakeQuota
        out = music(user="broke@x")
        self.assertIn("អស់កូតា", out[0]); self.assertEqual(CALLS, [])

    def test_failed_create_is_not_billed(self):
        live_suno.HAS_QUOTA_ENGINE, live_suno.QuotaEnforcerProxy = True, FakeQuota
        FakeSuno.fail_create = True
        out = music(user="a@x")
        self.assertIn("មិនបានកាត់កូតា", out[0]); self.assertEqual(FakeQuota.log, [])

    def test_success_is_billed_once(self):
        live_suno.HAS_QUOTA_ENGINE, live_suno.QuotaEnforcerProxy = True, FakeQuota
        music(user="a@x")
        self.assertEqual(len(FakeQuota.log), 1); self.assertEqual(FakeQuota.log[0]["user_id"], "a@x")

    def test_pasted_lyrics_are_sung(self):
        music("vocal", box2="បទដែលខ្ញុំសរសេរក្នុង Lyric Engine")
        sent = creates()[0][2]
        self.assertEqual(sent["lyric"], "[Verse]\nបទដែលខ្ញុំសរសេរក្នុង Lyric Engine")

    def test_music_works_without_step_one(self):
        out = live_suno.generate_audio({}, "បទ", "Khmer ballad", "ទំនុកច្រៀង", "vocal", "v6", "male", "")
        self.assertIn("🎵", out[0])

    def test_empty_lyrics_blocked(self):
        out = music("vocal", box2="  ")
        self.assertIn("Box 2", out[0]); self.assertEqual(CALLS, [])

    def test_budget_hidden_by_default(self):
        os.environ.pop("VO5_FEATURES", None)
        app = live_suno.build_vo5_synchronicity_live_suno_ui()
        self.assertNotIn("ថវិកា", json.dumps(app.config, ensure_ascii=False, default=str))
        self.assertEqual(live_suno.budget_from_state(blueprint()[-1])[0], [])

    def test_budget_when_enabled(self):
        os.environ["VO5_FEATURES"] = "budget"
        try:
            app = live_suno.build_vo5_synchronicity_live_suno_ui()
            self.assertIn("ថវិកា", json.dumps(app.config, ensure_ascii=False, default=str))
            rows, note = live_suno.budget_from_state(blueprint()[-1])
            self.assertEqual(len(rows), 1); self.assertIn("1,000", note)
        finally:
            os.environ.pop("VO5_FEATURES", None)

    def test_song_sheet_matches_lyric_engine(self):
        sheet = live_suno.song_sheet("ក ខ\nគ ឃ\n\nបន្ទរ មួយ\nបន្ទរ ពីរ\n\nង ច\n\nបន្ទរ  មួយ\nបន្ទរ ពីរ")
        self.assertEqual([l for l in sheet.split("\n") if l.startswith("[")], ["[Verse 1]", "[Chorus]", "[Verse 2]", "[Chorus]"])
        self.assertEqual(live_suno.song_sheet("[Intro]\nអូន"), "[Intro]\nអូន")
        self.assertEqual(live_suno.song_sheet("មួយឃ្លា"), "[Verse]\nមួយឃ្លា")

    def test_untagged_box2_is_labelled_before_sending(self):
        out = music("vocal", box2="ក\n\nបន្ទរ\n\nខ\n\nបន្ទរ")
        sent = creates()[0][2]["lyric"]
        self.assertTrue(sent.startswith("[Verse 1]")); self.assertIn("[Chorus]", sent); self.assertIn("ស្លាក", out[0])

    def test_signed_in_user_wins(self):
        req = types.SimpleNamespace(username="real@x")
        self.assertEqual(live_suno.resolve_user("someone-else@x", req), "real@x")

    def test_long_box1_warns(self):
        payload, warnings = live_suno.SunoV6LiveEngine.build_payload("t", "x" * 130)
        self.assertEqual(len(payload["style"]), 120); self.assertTrue(warnings)

    def test_download_rejects_remote_http_and_cleans_up(self):
        self.assertIsNone(live_suno.SunoV6LiveEngine.download_mp3_to_local("http://example.com/a.mp3"))
        self.assertIsNone(live_suno.SunoV6LiveEngine.download_mp3_to_local(f"http://127.0.0.1:{PORT}/missing"))


if __name__ == "__main__":
    unittest.main()

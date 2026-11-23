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
    fail_create = False

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
        CALLS.append(("POST", self.path, payload, self.headers.get("Idempotency-Key"), self.headers.get("Authorization")))
        if FakeSuno.fail_create:
            return self._json(402, {"message": "out of credits"})
        kind = "s" if payload["instrumental"] else "v"
        self._json(200, {"clip_ids": [kind + "1", kind + "2"]})

    def do_GET(self):
        CALLS.append(("GET", self.path))
        if self.path.startswith("/v0/audio/"):
            cid = self.path.rsplit("/", 1)[1]
            return self._json(200, {"id": cid, "status": "complete",
                                    "audio_url": f"http://127.0.0.1:{PORT}/files/{cid}.mp3"})
        if self.path.startswith("/files/"):
            body = b"ID3" + b"\x00" * 100
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)


server = ThreadingHTTPServer(("127.0.0.1", 0), FakeSuno)
PORT = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
os.environ["SUNO_API_BASE_URL"] = f"http://127.0.0.1:{PORT}/v0"

import live_suno  # noqa: E402

live_suno.SunoV6LiveEngine.audio_wait.__func__.__defaults__ = (5, 0)   # fast polling in tests


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
    return live_suno.generate_audio(st, out[1], out[2], out[3] if box2 is None else box2, mode, "v6", gender, user)


class Tests(unittest.TestCase):
    def setUp(self):
        CALLS.clear(); FakeQuota.log.clear(); FakeSuno.fail_create = False
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
        posts = [c for c in CALLS if c[0] == "POST"]
        self.assertEqual([p[2]["instrumental"] for p in posts], [True, False])
        self.assertEqual(posts[1][2]["vocal_gender"], "female")
        self.assertEqual(posts[0][4], "Bearer secret-key-123")
        self.assertEqual(state["suno_live_tracks"], [])  # caller's state not mutated

    def test_retry_uses_same_idempotency_key(self):
        music("vocal"); music("vocal")
        keys = [c[3] for c in CALLS if c[0] == "POST"]
        self.assertEqual(len(keys), 2); self.assertEqual(keys[0], keys[1])

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
        sent = [c[2] for c in CALLS if c[0] == "POST"][0]
        self.assertEqual(sent["lyrics"], "បទដែលខ្ញុំសរសេរក្នុង Lyric Engine")

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

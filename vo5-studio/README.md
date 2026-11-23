# VO5 Studio Pro: script scene to song

Two parts (see `lyric-engine/PRODUCT.md`):

1. **ទំនុកច្រៀង (lyrics):** a script scene or story becomes Box 1 (style) and Box 2 (lyrics). This step is free. Both boxes can be edited, so you can paste lyrics you finished in Lyric Engine.
2. **តន្ត្រី (music):** Suno sings what is in Box 1 and Box 2, or makes a score. This step spends credits, so it only runs when you press its own button.

Other features are kept but hidden from users until these two parts are polished. To try the production budget, set `VO5_FEATURES=budget` on the server.

It needs `vo5_master_synchronicity_pipeline.py` (and optionally `vo5_billing_quota_engine.py`) next to it. Those modules are not in this repository.

```bash
pip install gradio
export SUNO_API_KEY=...                 # AceData Cloud token; server side only, never typed into the page
# Suno through AceData Cloud (default base URL https://api.acedata.cloud):
# POST /suno/audios to create, POST /suno/tasks {"action":"retrieve"} to poll.
# Models: chirp-v6, chirp-v6-wild, chirp-v6-mini.
python vo5-studio/live_suno.py          # serves on 127.0.0.1:7860
```

To serve other people, set `VO5_HOST=0.0.0.0` **and** `VO5_AUTH=user:password`. The app refuses a public address without a login, because every press of «ផលិតសំឡេង» spends credits.

Tests (fake Suno server, stand-in pipeline): `python -m unittest vo5-studio/test_live_suno.py`

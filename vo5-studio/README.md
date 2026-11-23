# VO5 Studio Pro: script scene to song

`live_suno.py` turns one script scene into a lyric blueprint (Box 1 / Box 2), score cues and a budget, then, **only on its own button**, asks Suno to make the MP3s.

It needs `vo5_master_synchronicity_pipeline.py` (and optionally `vo5_billing_quota_engine.py`) next to it. Those modules are not in this repository.

```bash
pip install gradio
export SUNO_API_KEY=...                 # server side only; never typed into the page
export SUNO_API_BASE_URL=https://...    # check the routes against the Suno API docs you use
python vo5-studio/live_suno.py          # serves on 127.0.0.1:7860
```

To serve other people, set `VO5_HOST=0.0.0.0` **and** `VO5_AUTH=user:password`. The app refuses a public address without a login, because every press of «ផលិតសំឡេង» spends credits.

Tests (fake Suno server, stand-in pipeline): `python -m unittest vo5-studio/test_live_suno.py`

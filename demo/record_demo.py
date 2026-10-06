"""Record the client demo walkthrough as video + scene timestamps.

Usage: python record_demo.py [base_url]
Produces demo/out/raw.webm and demo/out/scenes.json.
Requires the full stack running (backend serving frontend dist) and a
user_question.wav fake-mic file (made by make_video.py --prep).
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
OUT = Path(__file__).parent / "out"
MIC_WAV = Path(__file__).parent / "user_question.wav"
VIEW = {"width": 1920, "height": 1080}  # full HD

scenes: list[dict] = []
t0 = 0.0


def mark(name: str):
    scenes.append({"name": name, "t": round(time.time() - t0, 2)})
    print(f"[{scenes[-1]['t']:7.2f}s] {name}", flush=True)


IS_READY = "() => [...document.querySelectorAll('div')].some(d => d.textContent === 'Ready')"


def wait_idle(page, timeout=300_000):
    """Wait for busy state to begin, then for the chip to return to Ready."""
    try:
        page.wait_for_function(f"!({IS_READY})()", timeout=10_000)
    except Exception:
        pass  # response was instant
    page.wait_for_function(IS_READY, timeout=timeout)


def run():
    global t0
    OUT.mkdir(exist_ok=True)
    # the backend (started with TTS_CAPTURE_DIR=demo/out/tts_capture) logs every
    # spoken clip; start from a clean capture dir so the mix matches this take
    cap = OUT / "tts_capture"
    cap.mkdir(exist_ok=True)
    for f in cap.iterdir():
        f.unlink()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            channel="chrome", headless=True,
            args=[
                "--use-fake-device-for-media-stream",
                "--use-fake-ui-for-media-stream",
                f"--use-file-for-fake-audio-capture={MIC_WAV}",
                "--autoplay-policy=no-user-gesture-required",
            ],
        )
        ctx = browser.new_context(viewport=VIEW, record_video_dir=str(OUT),
                                  record_video_size=VIEW)
        page = ctx.new_page()
        t0 = time.time()

        # ---- Scene 1: Home
        mark("home")
        page.goto(BASE, wait_until="networkidle", timeout=90_000)
        page.wait_for_timeout(2500)
        for title in ["Assistant", "Debate Arena", "Advisor Studio"]:
            page.hover(f"main >> a:has-text('{title}')", timeout=5000)
            page.wait_for_timeout(900)

        # ---- Scene 2: Assistant with RAG
        mark("assistant")
        page.click("main >> a:has-text('Assistant')", timeout=5000)
        page.wait_for_timeout(1800)
        q = "What undergraduate programmes does SIT offer?"
        page.fill("input[placeholder*='Ask about SIT']", q)
        page.wait_for_timeout(600)
        mark("assistant_question")
        page.click("button:has-text('Send')")
        wait_idle(page)
        page.wait_for_timeout(1500)

        # second question typed via mic is skipped — text flow shows RAG + sources
        mark("assistant_done")
        page.wait_for_timeout(1000)

        # ---- Scene 3: Debate Arena
        mark("debate_setup")
        page.click("nav >> text=Debate Arena")
        page.wait_for_timeout(1500)
        page.click("text=Singapore Uncle")
        page.wait_for_timeout(800)
        mark("debate_start")
        page.click("button:has-text('Start debate')")
        wait_idle(page)  # kickoff argument spoken
        page.wait_for_timeout(800)

        mark("debate_user_turn")  # fake mic: wav file feeds the question
        page.click("button[aria-label='Start speaking']")
        page.wait_for_timeout(11000)
        page.click("button[aria-label='Stop and send']")
        wait_idle(page)
        page.wait_for_timeout(800)

        mark("debate_summary")
        page.click("button:has-text('Summarize')")
        wait_idle(page)
        page.wait_for_timeout(1000)
        page.click("button:has-text('End session')")
        page.wait_for_timeout(1000)

        # ---- Scene 4: Advisor Studio
        mark("advisor")
        page.click("nav >> text=Advisor Studio")
        page.wait_for_timeout(1500)
        page.click("button:has-text('CPF & Retirement')")
        page.wait_for_timeout(700)
        mark("advisor_start")
        page.click("button:has-text('Start session')")
        wait_idle(page)
        page.wait_for_timeout(1200)
        page.click("button:has-text('End session')")

        # ---- Scene 5: closing
        mark("closing")
        page.click("nav >> text=Home")
        page.wait_for_timeout(3000)
        mark("end")

        video = page.video
        ctx.close()
        browser.close()
        path = video.path()
        Path(path).rename(OUT / "raw.webm")
        (OUT / "scenes.json").write_text(json.dumps({"t0": t0, "scenes": scenes}, indent=2))
        print(f"video: {OUT / 'raw.webm'}\nscenes: {len(scenes)}")


if __name__ == "__main__":
    run()

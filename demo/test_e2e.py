"""End-to-end UI tests: drives the real app in Chrome with a fake microphone.

Usage: python test_e2e.py [base_url]
Needs the full stack running and demo/user_question.wav present.
"""
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
MIC_WAV = Path(__file__).parent / "user_question.wav"
IS_READY = "() => [...document.querySelectorAll('div')].some(d => d.textContent === 'Ready')"

passed, failed = [], []


def check(name: str, cond: bool, detail: str = ""):
    (passed if cond else failed).append(name)
    print(f"{'PASS' if cond else 'FAIL'}  {name}" + (f" — {detail}" if detail and not cond else ""))


def wait_idle(page, timeout=300_000):
    try:
        page.wait_for_function(f"!({IS_READY})()", timeout=15_000)
    except Exception:
        pass
    page.wait_for_function(IS_READY, timeout=timeout)


def transcript_text(page) -> str:
    return page.inner_text("main")


def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            channel="chrome", headless=True,
            args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
                  f"--use-file-for-fake-audio-capture={MIC_WAV}",
                  "--autoplay-policy=no-user-gesture-required"])
        page = browser.new_context(viewport={"width": 1920, "height": 1080}).new_page()
        console_errors: list[str] = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        # 1. home
        page.goto(BASE, wait_until="networkidle", timeout=90_000)
        check("home renders 3 module cards", page.locator("main a:has-text('Open')").count() == 3)

        # 2. assistant: text question with RAG + spoken reply
        page.click("nav >> text=Assistant")
        page.fill("input[placeholder*='Ask about SIT']", "What is IWSP at SIT?")
        t_send = time.time()
        page.click("button:has-text('Send')")
        try:
            page.wait_for_function(
                "() => [...document.querySelectorAll('div')].some(d => d.textContent === 'Speaking')",
                timeout=120_000)
            first_audio = time.time() - t_send
            check("assistant speaks (sentence-streamed)", True)
            check("first audio within 25s", first_audio < 25, f"{first_audio:.1f}s")
        except Exception:
            check("assistant speaks (sentence-streamed)", False, "never reached Speaking")
        wait_idle(page)
        body = transcript_text(page)
        check("assistant answered", len(body) > 200)
        check("assistant cites sources", page.locator("a[href*='singaporetech']").count() > 0)

        # 3. debate: full voice loop
        page.click("nav >> text=Debate Arena")
        page.click("text=Singapore Uncle")
        page.click("button:has-text('Start debate')")
        wait_idle(page)
        check("debate kickoff reply", "Singapore Uncle:" in transcript_text(page))
        page.click("button[aria-label='Start speaking']")
        page.wait_for_timeout(11_000)
        page.click("button[aria-label='Stop and send']")
        wait_idle(page)
        t = transcript_text(page)
        check("voice turn transcribed", "artificial intelligence" in t.lower())
        check("debate reply to voice turn", t.count("Singapore Uncle:") >= 2)
        page.click("button:has-text('Summarize')")
        wait_idle(page)
        check("debate summary", t != transcript_text(page))
        page.click("button:has-text('End session')")
        check("debate session ends", page.locator("button:has-text('Start debate')").count() == 1)

        # 4. advisor
        page.click("nav >> text=Advisor Studio")
        page.click("button:has-text('CPF & Retirement')")
        page.click("button:has-text('Start session')")
        wait_idle(page)
        check("advisor kickoff reply", "Arjun" in transcript_text(page))
        page.click("button:has-text('End session')")

        # 5. console hygiene
        real = [e for e in console_errors if "favicon" not in e and "AudioContext" not in e]
        check("no console errors", not real, "; ".join(real[:3]))

        browser.close()

    print(f"\n{len(passed)} passed, {len(failed)} failed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    run()

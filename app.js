"use strict";

// STEP 1 of the landing page: is this browser ready for the lab, and do the headphones work?
// Nothing is sent anywhere; the only sound is the short test tone, on request.

// ── Browser check: the features the lab actually uses ──
const checkButton = document.getElementById("check-button");
const checkResults = document.getElementById("check-results");

function capability(label, available) {
  const item = document.createElement("li");
  const name = document.createElement("span");
  const value = document.createElement("strong");
  name.textContent = label;
  value.textContent = available ? "AVAILABLE" : "NOT DETECTED";
  value.className = available ? "test-pass" : "test-fail";
  item.append(name, value);
  return item;
}

checkButton.addEventListener("click", () => {
  const checks = [
    ["Web Audio API", typeof (window.AudioContext || window.webkitAudioContext) === "function"],
    ["AudioWorklet (the lab's audio engine)", typeof window.AudioWorkletNode === "function"],
    ["JavaScript modules", "noModule" in HTMLScriptElement.prototype],
    ["Saved settings (local storage)", (() => { try { localStorage.setItem("rungler-check", "1"); localStorage.removeItem("rungler-check"); return true; } catch (_) { return false; } })()]
  ];
  const list = document.createElement("ul");
  checks.forEach(([label, available]) => list.appendChild(capability(label, available)));
  const essential = checks.slice(0, 3).every(([, available]) => available);
  const note = document.createElement("p");
  note.className = "test-note";
  note.textContent = essential
    ? "This browser is ready for the lab. Now try the test tone with your headphones."
    : "This browser is missing something the lab needs. Please use an up-to-date Chrome, Edge, Firefox, Safari or Brave.";
  checkResults.replaceChildren(list, note);
});

// ── Test tone: a soft 440 Hz sine, about one second, with gentle fades ──
const toneButton = document.getElementById("tone-button");
const toneStatus = document.getElementById("tone-status");
let toneContext = null;

toneButton.addEventListener("click", async () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) { toneStatus.textContent = "This browser has no Web Audio API."; return; }
  try {
    toneContext = toneContext || new AudioContextClass();
    await toneContext.resume();
    const now = toneContext.currentTime;
    const oscillator = toneContext.createOscillator();
    const level = toneContext.createGain();
    oscillator.frequency.value = 440;
    level.gain.setValueAtTime(0, now);
    level.gain.linearRampToValueAtTime(0.08, now + 0.05);   // soft: about −22 dB
    level.gain.setValueAtTime(0.08, now + 0.95);
    level.gain.linearRampToValueAtTime(0, now + 1.05);
    oscillator.connect(level).connect(toneContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 1.1);
    toneButton.disabled = true;
    toneStatus.textContent = "Playing… you should hear a soft tone in both ears.";
    oscillator.onended = () => {
      toneButton.disabled = false;
      toneStatus.textContent = "Did you hear it in both ears? If not, check the headphones and the system volume, then try again.";
    };
  } catch (_) {
    toneStatus.textContent = "The browser did not allow sound. Check that the tab is not muted and try again.";
  }
});

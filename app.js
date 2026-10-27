"use strict";

// This is a static, non-audio compatibility check, not an RNBO/Max runtime.
// No audio is played and no requests are made to third-party services.
const button = document.getElementById("check-button");
const results = document.getElementById("check-results");

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

button.addEventListener("click", () => {
  const wasmSupported = (() => {
    try {
      return typeof WebAssembly === "object" &&
        WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
    } catch (_) {
      return false;
    }
  })();

  const checks = [
    ["Secure context (HTTPS or localhost)", window.isSecureContext === true],
    ["Web Audio API", typeof (window.AudioContext || window.webkitAudioContext) === "function"],
    ["WebAssembly", wasmSupported],
    ["AudioWorklet interface", typeof window.AudioWorkletNode === "function"]
  ];
  const list = document.createElement("ul");
  checks.forEach(([label, available]) => list.appendChild(capability(label, available)));
  const note = document.createElement("p");
  note.className = "test-note";
  note.textContent = checks.every(([, available]) => available)
    ? "All preliminary capabilities were detected. The final synthesis engine has not yet been tested."
    : "One or more capabilities were not detected. Try an updated Chrome, Firefox, Safari, or Edge browser; the complete workshop engine is not yet available for testing.";
  results.replaceChildren(list, note);
});

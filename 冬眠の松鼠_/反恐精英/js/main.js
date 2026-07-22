// ============================================================
//  main.js  -  boot: start screen, settings, launch Game.
// ============================================================
import { Game } from "./game.js";

const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");
const sensSlider = document.getElementById("sens-slider");
const sensValue = document.getElementById("sens-value");
const difficultySelect = document.getElementById("difficulty-select");
const botCountSelect = document.getElementById("botcount-select");

sensSlider.addEventListener("input", () => {
  sensValue.textContent = parseFloat(sensSlider.value).toFixed(1);
});

let game = null;

function launch() {
  if (game) return;
  const opts = {
    sensitivity: parseFloat(sensSlider.value),
    difficulty: difficultySelect.value,
    botCount: parseInt(botCountSelect.value, 10),
    team: document.getElementById("team-select").value,
  };
  startScreen.classList.add("hidden");
  try {
    game = new Game(opts);
    game.start();
  } catch (err) {
    console.error(err);
    startScreen.classList.remove("hidden");
    alert("Failed to start: " + err.message);
  }
}

startBtn.addEventListener("click", launch);

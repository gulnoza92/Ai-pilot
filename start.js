const { spawn } = require("child_process");

const PORT = process.env.PORT || 3000;

const server = spawn(process.execPath, ["server.js"], {
  cwd: __dirname,
  stdio: "inherit",
  // AIPILOT_DEMO=1: this launcher also starts the simulator below, so the trackers are not real.
  env: { ...process.env, PORT, AIPILOT_DEMO: "1" },
});

let sim = null;
setTimeout(() => {
  sim = spawn(process.execPath, ["simulate.js"], {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env, SIM_TARGET: `http://127.0.0.1:${PORT}` },
  });
}, 2000);

function stop(code) {
  if (sim) sim.kill();
  server.kill();
  process.exit(code);
}
server.on("exit", (c) => stop(c ?? 0));
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));

const [secondsText, ...command] = process.argv.slice(2);
const seconds = Number(secondsText);
if (!Number.isFinite(seconds) || seconds <= 0 || command.length === 0) {
  console.error("usage: run-with-watchdog <seconds> <command> [args...]");
  process.exit(2);
}
const child = Bun.spawn(command, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
const timer = setTimeout(() => {
  console.error(`watchdog: command exceeded ${seconds}s: ${command.join(" ")}`);
  child.kill("SIGKILL");
}, seconds * 1_000);
const code = await child.exited;
clearTimeout(timer);
process.exit(code);

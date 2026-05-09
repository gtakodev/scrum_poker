const checks = [
  { name: "server typecheck", command: ["bun", "run", "--cwd", "server", "typecheck"] },
  { name: "server tests", command: ["bun", "run", "--cwd", "server", "test"] },
  { name: "client build", command: ["bun", "run", "--cwd", "client", "build"] },
];

async function runCheck(name: string, command: string[]): Promise<void> {
  console.log(`\n== ${name} ==`);
  const proc = Bun.spawn(command, {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${name} failed with exit code ${exitCode}`);
  }
}

async function waitForServer(port: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/rooms/missing`);
      if (response.status === 404) {
        return;
      }
    } catch {
      await Bun.sleep(150);
    }
  }

  throw new Error("server did not become ready in time");
}

async function runE2E(): Promise<void> {
  console.log("\n== e2e tests ==");
  const port = process.env.PORT ?? "3000";
  const server = Bun.spawn(["bun", "run", "--cwd", "server", "start"], {
    env: { ...process.env, PORT: port },
    stdout: "inherit",
    stderr: "inherit",
  });

  try {
    await waitForServer(port);
    await runCheck("test-e2e.ts", ["bun", "run", "test-e2e.ts"]);
  } finally {
    server.kill();
    await server.exited.catch(() => undefined);
  }
}

for (const check of checks) {
  await runCheck(check.name, check.command);
}

await runE2E();

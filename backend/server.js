const fs = require("node:fs");
const path = require("node:path");
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
const { createApp } = require("./app");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const server = createApp();
server.listen(port, host, () =>
  console.log(`SkillBridge is ready at http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));

const { createApp } = require("./app");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const server = createApp();
server.listen(port, host, () =>
  console.log(`SkillBridge is ready at http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));

import { buildApp } from "./app.js";
import { loadApiConfig } from "./config.js";

const config = loadApiConfig();
const app = buildApp(config);

app
  .listen({ port: config.port, host: "0.0.0.0" })
  .then(() => {
    console.log(`ContentHub API listening on :${config.port}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

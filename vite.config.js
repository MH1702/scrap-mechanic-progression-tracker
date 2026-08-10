import { spawnSync } from "node:child_process";
import { createReadStream, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const repository = path.dirname(fileURLToPath(import.meta.url));
const browserModules = [
  ...["__init__.py", "bitreader.py", "lz4.py", "savefile.py", "smlua.py"]
    .map(name => path.join(repository, "vendor", "scrapmap", "smmap", name)),
  ...["__init__.py", "locations.py", "save_reader.py", "web_model.py"]
    .map(name => path.join(repository, "progression_tracker", name)),
];
const browserModuleSet = new Set(browserModules.map(path.normalize));
const parserBundle = path.join(repository, "web", "public", "python", "progression-tracker.zip");
const devSaveRoute = "/__smpt/dev-save";

function rebuildParser() {
  const command = process.env.SMPT_PYTHON || "python";
  const result = spawnSync(command,
    ["-m", "progression_tracker.web_bundle", "--out", parserBundle], {
      cwd: repository,
      encoding: "utf8",
    });
  if (result.status !== 0) {
    throw new Error(`Could not rebuild the Pyodide parser with ${command}:\n${result.stderr || result.stdout}`);
  }
}

function pyodideParserPlugin() {
  return {
    name: "smpt-pyodide-parser",
    buildStart() {
      rebuildParser();
    },
    configureServer(server) {
      server.watcher.add(browserModules);
      server.watcher.on("change", changed => {
        if (!browserModuleSet.has(path.normalize(changed))) return;
        try {
          rebuildParser();
          server.config.logger.info("Pyodide parser rebuilt; reloading browser");
          server.ws.send({ type: "full-reload" });
        } catch (error) {
          server.config.logger.error(error.message);
        }
      });
    },
  };
}

function localDevSavePlugin(savePath) {
  return {
    name: "smpt-local-dev-save",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(devSaveRoute, (request, response) => {
        if ((request.method !== "GET" && request.method !== "HEAD") || !savePath) {
          response.statusCode = 404;
          response.end();
          return;
        }
        try {
          const info = statSync(savePath);
          if (!info.isFile()) throw new Error("not a file");
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/x-sqlite3");
          response.setHeader("Content-Length", String(info.size));
          response.setHeader("Cache-Control", "no-store");
          response.setHeader("X-SMPT-Filename",
            encodeURIComponent(path.basename(savePath)));
          if (request.method === "HEAD") {
            response.end();
            return;
          }
          const stream = createReadStream(savePath);
          stream.on("error", error => {
            server.config.logger.error(`Could not read local dev save: ${error.message}`);
            response.destroy(error);
          });
          stream.pipe(response);
        } catch (error) {
          server.config.logger.warn(`Local dev save is unavailable: ${error.message}`);
          response.statusCode = 404;
          response.end();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const webRoot = path.join(repository, "web");
  const env = loadEnv(mode, webRoot, "SMPT_");
  const devSave = env.SMPT_DEV_SAVE
    ? path.resolve(webRoot, env.SMPT_DEV_SAVE)
    : undefined;
  return {
    root: webRoot,
    base: "./",
    publicDir: "public",
    plugins: [react(), tailwindcss(), pyodideParserPlugin(),
      localDevSavePlugin(devSave)],
    resolve: {
      alias: {
        "@": path.join(repository, "web", "src"),
      },
    },
    worker: {
      format: "es",
    },
    build: {
      outDir: path.join(repository, "dist-web"),
      emptyOutDir: true,
    },
  };
});

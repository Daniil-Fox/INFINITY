import gulp from "gulp";
import browserSync from "browser-sync";
import https from "https";
import { URL } from "url";

import { paths } from "./gulp/config/paths.js";
import { clean } from "./gulp/tasks/clean.js";
import { svgSprites } from "./gulp/tasks/sprite.js";
import { styles } from "./gulp/tasks/styles.js";
import { stylesBackend } from "./gulp/tasks/styles-backend.js";
import { scripts } from "./gulp/tasks/scripts.js";
import { scriptsBackend } from "./gulp/tasks/scripts-backend.js";
import { resources } from "./gulp/tasks/resources.js";
import { images } from "./gulp/tasks/images.js";
import { webpImages } from "./gulp/tasks/webp.js";
import { htmlInclude } from "./gulp/tasks/html-include.js";
import { cacheTask } from "./gulp/tasks/cache.js";
import { rewrite } from "./gulp/tasks/rewrite.js";
import { htmlMinify } from "./gulp/tasks/html-minify.js";
import { zipFiles } from "./gulp/tasks/zip.js";

global.app = {
  gulp,
  isProd: process.argv.includes("--build"),
  paths,
};

const watcher = () => {
  // Функция прокси для API запросов
  const proxyMiddleware = function (req, res, next) {
    // Проверяем, что это запрос к API
    if (req.url.startsWith("/api")) {
      console.log(`[PROXY] Proxying request: ${req.method} ${req.url}`);

      const targetUrl = new URL(`https://ourpool.io${req.url}`);

      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
          "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
          accept: req.headers["accept"] || "*/*",
          "accept-language": req.headers["accept-language"] || "en-US,en;q=0.9",
        },
      };

      // Копируем только нужные заголовки
      if (req.headers["content-type"]) {
        options.headers["content-type"] = req.headers["content-type"];
      }
      if (req.headers["authorization"]) {
        options.headers["authorization"] = req.headers["authorization"];
      }

      const proxyReq = https.request(options, (proxyRes) => {
        console.log(`[PROXY] Response: ${proxyRes.statusCode} for ${req.url}`);

        // Добавляем CORS заголовки
        const responseHeaders = {
          ...proxyRes.headers,
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        // Удаляем проблемные заголовки
        delete responseHeaders["content-encoding"];
        delete responseHeaders["content-length"];
        delete responseHeaders["transfer-encoding"];
        delete responseHeaders["connection"];

        res.writeHead(proxyRes.statusCode, responseHeaders);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on("error", (err) => {
        console.error("[PROXY] Error:", err.message);
        if (!res.headersSent) {
          res.writeHead(500, {
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*",
          });
          res.end("Proxy error: " + err.message);
        }
      });

      // Обработка OPTIONS запросов (preflight)
      if (req.method === "OPTIONS") {
        res.writeHead(200, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        });
        res.end();
        return;
      }

      // Для GET запросов сразу завершаем запрос
      if (req.method === "GET" || req.method === "HEAD") {
        proxyReq.end();
      } else {
        // Для POST/PUT передаем тело запроса
        req.pipe(proxyReq, { end: true });
      }
    } else {
      // Если это не API запрос, передаем дальше
      next();
    }
  };

  browserSync.init({
    server: {
      baseDir: `${app.paths.base.build}`,
      middleware: [proxyMiddleware],
    },
    notify: false,
    port: 3000,
  });

  gulp.watch(app.paths.srcScss, styles);
  gulp.watch(app.paths.srcFullJs, scripts);
  gulp.watch(`${app.paths.srcPartialsFolder}/*.html`, htmlInclude);
  gulp.watch(`${app.paths.base.src}/*.html`, htmlInclude);
  gulp.watch(`${app.paths.resourcesFolder}/**`, resources);
  gulp.watch(`${app.paths.srcImgFolder}/**/**.{jpg,jpeg,png,svg}`, images);
  gulp.watch(`${app.paths.srcImgFolder}/**/**.{jpg,jpeg,png}`, webpImages);
  gulp.watch(app.paths.srcSvg, svgSprites);
};

const dev = gulp.series(
  clean,
  htmlInclude,
  scripts,
  styles,
  resources,
  images,
  webpImages,
  svgSprites,
  watcher
);
const backend = gulp.series(
  clean,
  htmlInclude,
  scriptsBackend,
  stylesBackend,
  resources,
  images,
  webpImages,
  svgSprites
);
const build = gulp.series(
  clean,
  htmlInclude,
  scripts,
  styles,
  resources,
  images,
  webpImages,
  svgSprites,
  htmlMinify
);
const cache = gulp.series(cacheTask, rewrite);
const zip = zipFiles;

export { dev };
export { build };
export { backend };
export { cache };
export { zip };

gulp.task("default", dev);

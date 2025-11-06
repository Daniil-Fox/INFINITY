import browserSync from "browser-sync";
import webpackStream from "webpack-stream";
import plumber from "gulp-plumber";
import notify from "gulp-notify";
import path from "path";
import fs from "fs";

export const scripts = () => {
  // Находим все файлы main*.js
  const jsDir = path.resolve(`${app.paths.base.src}/js`);
  const files = fs.readdirSync(jsDir);
  const mainFiles = files
    .filter((file) => file.startsWith("main") && file.endsWith(".js"))
    .map((file) => path.join(jsDir, file));

  // Создаем entry points для webpack
  const entry = {};
  mainFiles.forEach((file) => {
    const name = path.basename(file, path.extname(file));
    entry[name] = file;
  });

  return app.gulp
    .src(`${app.paths.base.src}/js/main*.js`)
    .pipe(
      plumber(
        notify.onError({
          title: "JS",
          message: "Error: <%= error.message %>",
        })
      )
    )
    .pipe(
      webpackStream({
        mode: app.isProd ? "production" : "development",
        entry: entry,
        output: {
          filename: "[name].js",
        },
        module: {
          rules: [
            {
              test: /\.m?js$/,
              exclude: /node_modules/,
              use: {
                loader: "babel-loader",
                options: {
                  presets: [
                    [
                      "@babel/preset-env",
                      {
                        targets: "defaults",
                      },
                    ],
                  ],
                },
              },
            },
          ],
        },
        devtool: !app.isProd ? "source-map" : false,
      })
    )
    .on("error", function (err) {
      console.error("WEBPACK ERROR", err);
      this.emit("end");
    })
    .pipe(app.gulp.dest(app.paths.buildJsFolder))
    .pipe(browserSync.stream());
};

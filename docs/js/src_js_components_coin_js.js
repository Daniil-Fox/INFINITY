"use strict";
(self["webpackChunkgulp_builder"] = self["webpackChunkgulp_builder"] || []).push([["src_js_components_coin_js"],{

/***/ "./src/js/components/coin.js":
/*!***********************************!*\
  !*** ./src/js/components/coin.js ***!
  \***********************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var three__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! three */ "./node_modules/three/build/three.core.js");
/* harmony import */ var three__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! three */ "./node_modules/three/build/three.module.js");
/* harmony import */ var three_addons_loaders_GLTFLoader_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! three/addons/loaders/GLTFLoader.js */ "./node_modules/three/examples/jsm/loaders/GLTFLoader.js");
/* harmony import */ var lil_gui__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lil-gui */ "./node_modules/lil-gui/dist/lil-gui.esm.js");



(function initCoinScene() {
  const canvas = document.getElementById("scene");
  if (!canvas) return;

  // GUI setup - показываем только если в URL есть #debug
  const isDebugMode = typeof window !== "undefined" && window.location.hash === "#debug";
  const gui = typeof window !== "undefined" && window.__infinityDebugGui || new lil_gui__WEBPACK_IMPORTED_MODULE_3__.GUI();
  if (typeof window !== "undefined" && !window.__infinityDebugGui) {
    window.__infinityDebugGui = gui;
  }
  if (!isDebugMode && gui.hide) {
    gui.hide();
  } else if (isDebugMode && gui.show) {
    gui.show();
  }
  let coinModel = null;
  let currentIntersect = null;
  let spinYRemaining = 0; // радианы, оставшиеся для докручивания по Y
  let clickCounter = 0; // счетчик кликов подряд
  const MAX_CLICKS = 5; // максимум кликов подряд

  // Параметры монетки (Desktop/Mobile)
  const coinParamsDesktop = {
    positionX: 2,
    positionY: 0,
    positionZ: -0.8,
    rotationX: -0.353,
    rotationY: -0.62,
    rotationZ: -0.29,
    scale: 2.1
  };

  // Значения по умолчанию для мобильной версии можно будет подправить в процессе
  const coinParamsMobile = {
    positionX: 0,
    positionY: -1.3,
    positionZ: -0.8,
    rotationX: -0.353,
    rotationY: -0.62,
    rotationZ: -0.1,
    scale: 1.4
  };
  const BREAKPOINT_MOBILE = 576;
  const isMobileViewport = () => sizes.width <= BREAKPOINT_MOBILE;
  const getCurrentCoinParams = () => isMobileViewport() ? coinParamsMobile : coinParamsDesktop;
  const applyCoinParams = params => {
    if (!coinModel) return;
    coinModel.scale.set(params.scale, params.scale, params.scale);
    coinModel.position.set(params.positionX, params.positionY, params.positionZ);
    coinModel.rotation.set(params.rotationX, params.rotationY, params.rotationZ);
  };

  // Троттлинг для частых событий resize
  const throttle = (fn, wait) => {
    let last = 0;
    let timeoutId = null;
    let lastArgs = null;
    return function throttled(...args) {
      const now = Date.now();
      const remaining = wait - (now - last);
      lastArgs = args;
      if (remaining <= 0) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        last = now;
        fn.apply(this, lastArgs);
        lastArgs = null;
      } else if (!timeoutId) {
        timeoutId = setTimeout(() => {
          last = Date.now();
          timeoutId = null;
          fn.apply(this, lastArgs);
          lastArgs = null;
        }, remaining);
      }
    };
  };

  // Параметры для освещения
  const lightParams = {
    ambientIntensity: 0.6,
    ambientColor: "#ffffff",
    directional1Intensity: 1,
    directional1Color: "#ffffff",
    directional1X: -10,
    directional1Y: 1.1,
    directional1Z: 3.7,
    directional2Intensity: 6,
    directional2Color: "#ffffff",
    directional2X: -1,
    directional2Y: -1.5,
    directional2Z: 0.6
  };
  const mouse = new three__WEBPACK_IMPORTED_MODULE_0__.Vector2();
  const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  const scene = new three__WEBPACK_IMPORTED_MODULE_0__.Scene();

  // Camera
  const camera = new three__WEBPACK_IMPORTED_MODULE_0__.PerspectiveCamera(30, sizes.width / sizes.height, 0.1, 100);
  camera.position.set(0, 0, 12);
  const cameraGroup = new three__WEBPACK_IMPORTED_MODULE_0__.Group();
  scene.add(cameraGroup);
  cameraGroup.add(camera);
  const renderer = new three__WEBPACK_IMPORTED_MODULE_1__.WebGLRenderer({
    canvas: canvas,
    alpha: true
  });
  const getMaxPixelRatio = () => window.innerWidth <= BREAKPOINT_MOBILE ? 1.25 : 1.5;
  const updateRendererPixelRatio = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, getMaxPixelRatio()));
  };

  // Controls
  // const controls = new OrbitControls( camera, renderer.domElement );

  // Lights

  const ambientLight = new three__WEBPACK_IMPORTED_MODULE_0__.AmbientLight(lightParams.ambientColor, lightParams.ambientIntensity);
  scene.add(ambientLight);
  const directionLightBottomLeft = new three__WEBPACK_IMPORTED_MODULE_0__.DirectionalLight(lightParams.directional1Color, lightParams.directional1Intensity);
  directionLightBottomLeft.position.set(lightParams.directional1X, lightParams.directional1Y, lightParams.directional1Z);
  scene.add(directionLightBottomLeft);
  const directionLightTopRight = new three__WEBPACK_IMPORTED_MODULE_0__.DirectionalLight(lightParams.directional2Color, lightParams.directional2Intensity);
  directionLightTopRight.position.set(lightParams.directional2X, lightParams.directional2Y, lightParams.directional2Z);
  scene.add(directionLightTopRight);

  // LOADER
  const loader = new three_addons_loaders_GLTFLoader_js__WEBPACK_IMPORTED_MODULE_2__.GLTFLoader();
  // Получаем путь к теме из локализации WordPress или используем относительный путь
  const themeUrl = typeof infinityData !== "undefined" && infinityData.themeUrl ? infinityData.themeUrl : "";
  const modelPath = themeUrl ? themeUrl + "/assets/models/gltf/bitcoin7/bitcoin.gltf" : "../models/gltf/bitcoin7/bitcoin.gltf";
  loader.load(modelPath, function (gltf) {
    coinModel = gltf.scene;

    // Применяем параметры в зависимости от вьюпорта
    applyCoinParams(getCurrentCoinParams());
    scene.add(coinModel);
  },
  // called while loading is progressing
  function (xhr) {
    if (isDebugMode) {
      console.log(xhr.loaded / xhr.total * 100 + "% loaded");
    }
  },
  // called when loading has errors
  function (error) {
    console.log("Bitcoin loading error: " + error);
  });

  // Создаем GUI контролы для монетки
  const coinFolder = gui.addFolder("Монетка (Desktop)");

  // Позиция
  const positionFolder = coinFolder.addFolder("Позиция");
  positionFolder.add(coinParamsDesktop, "positionX", -10, 10, 0.1).onChange(value => {
    coinModel.position.x = value;
  });
  positionFolder.add(coinParamsDesktop, "positionY", -10, 10, 0.1).onChange(value => {
    coinModel.position.y = value;
  });
  positionFolder.add(coinParamsDesktop, "positionZ", -10, 10, 0.1).onChange(value => {
    coinModel.position.z = value;
  });

  // Поворот
  const rotationFolder = coinFolder.addFolder("Поворот");
  rotationFolder.add(coinParamsDesktop, "rotationX", -Math.PI * 2, Math.PI * 2, 0.01).onChange(value => {
    coinModel.rotation.x = value;
  });
  rotationFolder.add(coinParamsDesktop, "rotationY", -Math.PI * 2, Math.PI * 2, 0.01).onChange(value => {
    coinModel.rotation.y = value;
  });
  rotationFolder.add(coinParamsDesktop, "rotationZ", -Math.PI * 2, Math.PI * 2, 0.01).onChange(value => {
    coinModel.rotation.z = value;
  });

  // Масштаб
  coinFolder.add(coinParamsDesktop, "scale", 0.1, 5, 0.1).onChange(value => {
    coinModel.scale.set(value, value, value);
  });
  coinFolder.open();

  // Создаем GUI контролы для освещения
  const lightFolder = gui.addFolder("Освещение");

  // Ambient Light
  const ambientFolder = lightFolder.addFolder("Рассеянный свет");
  ambientFolder.add(lightParams, "ambientIntensity", 0, 5, 0.1).onChange(value => {
    ambientLight.intensity = value;
  });
  ambientFolder.addColor(lightParams, "ambientColor").onChange(value => {
    ambientLight.color.setHex(value.replace("#", "0x"));
  });

  // Directional Light 1
  const directional1Folder = lightFolder.addFolder("Направленный свет 1");
  directional1Folder.add(lightParams, "directional1Intensity", 0, 10, 0.1).onChange(value => {
    directionLightBottomLeft.intensity = value;
  });
  directional1Folder.addColor(lightParams, "directional1Color").onChange(value => {
    directionLightBottomLeft.color.setHex(value.replace("#", "0x"));
  });
  directional1Folder.add(lightParams, "directional1X", -10, 10, 0.1).onChange(value => {
    directionLightBottomLeft.position.x = value;
  });
  directional1Folder.add(lightParams, "directional1Y", -10, 10, 0.1).onChange(value => {
    directionLightBottomLeft.position.y = value;
  });
  directional1Folder.add(lightParams, "directional1Z", -10, 10, 0.1).onChange(value => {
    directionLightBottomLeft.position.z = value;
  });

  // Directional Light 2
  const directional2Folder = lightFolder.addFolder("Направленный свет 2");
  directional2Folder.add(lightParams, "directional2Intensity", 0, 10, 0.1).onChange(value => {
    directionLightTopRight.intensity = value;
  });
  directional2Folder.addColor(lightParams, "directional2Color").onChange(value => {
    directionLightTopRight.color.setHex(value.replace("#", "0x"));
  });
  directional2Folder.add(lightParams, "directional2X", -10, 10, 0.1).onChange(value => {
    directionLightTopRight.position.x = value;
  });
  directional2Folder.add(lightParams, "directional2Y", -10, 10, 0.1).onChange(value => {
    directionLightTopRight.position.y = value;
  });
  directional2Folder.add(lightParams, "directional2Z", -10, 10, 0.1).onChange(value => {
    directionLightTopRight.position.z = value;
  });
  lightFolder.open();
  renderer.setSize(sizes.width, sizes.height);
  updateRendererPixelRatio();

  // Подготовка троттлинга для responsive-параметров
  const applyResponsiveParamsThrottled = throttle(() => {
    applyCoinParams(getCurrentCoinParams());
  }, 200);

  // Resize
  window.addEventListener("resize", () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.updateProjectionMatrix();
    camera.aspect = sizes.width / sizes.height;
    renderer.setSize(sizes.width, sizes.height);
    updateRendererPixelRatio();

    // Применяем подходящие параметры монетки c троттлингом
    applyResponsiveParamsThrottled();
  });
  canvas.addEventListener("mousemove", e => {
    const mouseX = e.clientX / sizes.width * 2 - 1;
    const mouseY = -(e.clientY / sizes.height) * 2 + 1;
    mouse.x = mouseX;
    mouse.y = mouseY;
  });
  canvas.addEventListener("click", e => {
    if (currentIntersect && clickCounter < MAX_CLICKS) {
      spinYRemaining += Math.PI * 2;
      clickCounter++;
    }
  });

  // Сброс счетчика когда анимация завершилась
  // Это будет внутри tick функции
  // Raycaster
  const raycaster = new three__WEBPACK_IMPORTED_MODULE_0__.Raycaster();

  // Animation

  const clock = new three__WEBPACK_IMPORTED_MODULE_0__.Clock();
  let previousTime = 0;
  let animationFrameId = null;
  let isDocumentVisible = !document.hidden;
  let isInViewport = true;
  const tick = () => {
    raycaster.setFromCamera(mouse, camera);
    const elapsedTime = clock.getElapsedTime();
    let delta = elapsedTime - previousTime;
    previousTime = elapsedTime;
    delta = Math.min(delta, 0.1);
    if (coinModel) {
      const targetX = mouse.x * 0.5;
      const targetY = mouse.y * 0.5;
      cameraGroup.position.x += (targetX - cameraGroup.position.x) * 0.5 * delta;
      cameraGroup.position.y += (targetY - cameraGroup.position.y) * 0.5 * delta;
      coinModel.rotation.x += Math.sin(elapsedTime) * 0.001;
      coinModel.rotation.y += Math.cos(elapsedTime) * 0.001;

      // Плавное докручивание по клику (экспоненциальное сглаживание)
      if (spinYRemaining > 0) {
        const responsiveness = 2; // чем больше, тем быстрее догоняет цель
        const factor = Math.min(1, responsiveness * delta);
        const step = spinYRemaining * factor;
        coinModel.rotation.y += step;
        spinYRemaining -= step;
        // защита от бесконечного малого остатка
        if (spinYRemaining < 1e-5) spinYRemaining = 0;
      } else if (clickCounter > 0) {
        // Сброс счетчика когда анимация завершилась
        clickCounter = 0;
      }
      const intersects = raycaster.intersectObject(coinModel, true);
      if (intersects.length) {
        if (!currentIntersect) {
          document.body.style.cursor = "pointer";
        }
        currentIntersect = intersects[0];
      } else {
        if (currentIntersect) {
          document.body.style.cursor = null;
        }
        currentIntersect = null;
      }
    }
    renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(tick);
  };
  const stopLoop = () => {
    if (!animationFrameId) return;
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  };
  const startLoop = () => {
    if (!(isDocumentVisible && isInViewport) || animationFrameId) return;
    previousTime = clock.getElapsedTime();
    animationFrameId = requestAnimationFrame(tick);
  };
  const handleVisibility = () => {
    if (isDocumentVisible && isInViewport) {
      startLoop();
      return;
    }
    stopLoop();
  };
  document.addEventListener("visibilitychange", () => {
    isDocumentVisible = !document.hidden;
    handleVisibility();
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      isInViewport = entries.some(entry => entry.isIntersecting);
      handleVisibility();
    }, {
      rootMargin: "200px 0px",
      threshold: 0
    });
    observer.observe(canvas);
  } else {
    startLoop();
  }

  // Запускаем рендер-цикл только после начального вызова
  startLoop();
})();

/***/ })

}]);
//# sourceMappingURL=src_js_components_coin_js.js.map
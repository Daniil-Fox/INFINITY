import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GUI } from "lil-gui";

/**
 * Рендерим 3D модель карты и повторяем hover-эффект из старой реализации.
 */
(function initMasterCard() {
  const canvas = document.getElementById("master-card");
  const cardWrapper = document.querySelector(".master__card");
  const container = document.querySelector(".master__container");

  if (!canvas || !cardWrapper) return;

  const isDebugMode =
    typeof window !== "undefined" && window.location.hash === "#debug";
  const gui =
    typeof window !== "undefined"
      ? window.__infinityDebugGui ||
        (window.__infinityDebugGui = new GUI({ title: "Infinity Debug" }))
      : null;

  if (gui) {
    if (!isDebugMode && gui.hide) {
      gui.hide();
    } else if (isDebugMode && gui.show) {
      gui.show();
    }
  }

  const hoverPadding = 80;
  const maxRotation = THREE.MathUtils.degToRad(8);
  const maxTranslation = 0.25;

  const sizes = {
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  };

  const getMaxPixelRatio = () => (window.innerWidth <= 576 ? 1.25 : 1.5);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, getMaxPixelRatio()));
  renderer.setSize(sizes.width, sizes.height);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    28,
    sizes.width / sizes.height,
    0.1,
    100
  );
  const mobileZ = window.innerWidth <= 576 ? 6.3 : 8;
  camera.position.set(0, 0, mobileZ);
  scene.add(camera);

  const cardGroup = new THREE.Group();
  scene.add(cardGroup);

  const cardLightParams = {
    ambientIntensity: 0.9,
    ambientColor: "#ffffff",

    keyIntensity: 0.3,
    keyColor: "#fff0fe",
    keyX: 0,
    keyY: 0.2,
    keyZ: 10,

    rimIntensity: 1.2,
    rimColor: "#ff50d4",
    rimX: -4,
    rimY: 3,
    rimZ: 2,

    fillIntensity: 0.8,
    fillColor: "#7bc5ff",
    fillX: 2,
    fillY: -3,
    fillZ: 1,
  };

  const ambientLight = new THREE.AmbientLight(
    cardLightParams.ambientColor,
    cardLightParams.ambientIntensity
  );
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(
    cardLightParams.keyColor,
    cardLightParams.keyIntensity
  );
  keyLight.position.set(
    cardLightParams.keyX,
    cardLightParams.keyY,
    cardLightParams.keyZ
  );
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(
    cardLightParams.rimColor,
    cardLightParams.rimIntensity
  );
  rimLight.position.set(
    cardLightParams.rimX,
    cardLightParams.rimY,
    cardLightParams.rimZ
  );
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(
    cardLightParams.fillColor,
    cardLightParams.fillIntensity
  );
  fillLight.position.set(
    cardLightParams.fillX,
    cardLightParams.fillY,
    cardLightParams.fillZ
  );
  scene.add(fillLight);

  let cardModel;
  const cardParams = {
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationX: Math.PI * 0.5,
    rotationY: 0,
    rotationZ: 0,
    scale: 1,
  };

  const applyCardParams = () => {
    if (!cardModel) return;
    cardModel.position.set(
      cardParams.positionX,
      cardParams.positionY,
      cardParams.positionZ
    );
    cardModel.rotation.set(
      cardParams.rotationX,
      cardParams.rotationY,
      cardParams.rotationZ
    );
    cardModel.scale.setScalar(cardParams.scale);
  };

  let cardGuiInitialized = false;
  const setupCardGui = () => {
    if (!gui || cardGuiInitialized) return;
    cardGuiInitialized = true;

    const cardFolder = gui.addFolder("Карта (Master)");
    const positionFolder = cardFolder.addFolder("Позиция");
    positionFolder
      .add(cardParams, "positionX", -5, 5, 0.01)
      .name("X")
      .onChange(applyCardParams);
    positionFolder
      .add(cardParams, "positionY", -5, 5, 0.01)
      .name("Y")
      .onChange(applyCardParams);
    positionFolder
      .add(cardParams, "positionZ", -5, 5, 0.01)
      .name("Z")
      .onChange(applyCardParams);

    const rotationFolder = cardFolder.addFolder("Поворот");
    rotationFolder
      .add(cardParams, "rotationX", -Math.PI * 2, Math.PI * 2, 0.01)
      .name("X (рад)")
      .onChange(applyCardParams);
    rotationFolder
      .add(cardParams, "rotationY", -Math.PI * 2, Math.PI * 2, 0.01)
      .name("Y (рад)")
      .onChange(applyCardParams);
    rotationFolder
      .add(cardParams, "rotationZ", -Math.PI * 2, Math.PI * 2, 0.01)
      .name("Z (рад)")
      .onChange(applyCardParams);

    cardFolder
      .add(cardParams, "scale", 0.1, 3, 0.01)
      .name("Масштаб")
      .onChange(applyCardParams);

    cardFolder.open();
    positionFolder.open();
    rotationFolder.open();

    const lightsFolder = gui.addFolder("Освещение (Master)");

    const ambientFolder = lightsFolder.addFolder("Рассеянный свет");
    ambientFolder
      .add(cardLightParams, "ambientIntensity", 0, 5, 0.05)
      .onChange((value) => {
        ambientLight.intensity = value;
      });
    ambientFolder
      .addColor(cardLightParams, "ambientColor")
      .onChange((value) => {
        ambientLight.color.set(value);
      });

    const keyFolder = lightsFolder.addFolder("Ключевой свет");
    keyFolder
      .add(cardLightParams, "keyIntensity", 0, 5, 0.05)
      .onChange((value) => {
        keyLight.intensity = value;
      });
    keyFolder.addColor(cardLightParams, "keyColor").onChange((value) => {
      keyLight.color.set(value);
    });
    keyFolder
      .add(cardLightParams, "keyX", -10, 10, 0.1)
      .name("X")
      .onChange((value) => {
        keyLight.position.x = value;
      });
    keyFolder
      .add(cardLightParams, "keyY", -10, 10, 0.1)
      .name("Y")
      .onChange((value) => {
        keyLight.position.y = value;
      });
    keyFolder
      .add(cardLightParams, "keyZ", -10, 10, 0.1)
      .name("Z")
      .onChange((value) => {
        keyLight.position.z = value;
      });

    const rimFolder = lightsFolder.addFolder("Контровой свет");
    rimFolder
      .add(cardLightParams, "rimIntensity", 0, 5, 0.05)
      .onChange((value) => {
        rimLight.intensity = value;
      });
    rimFolder.addColor(cardLightParams, "rimColor").onChange((value) => {
      rimLight.color.set(value);
    });
    rimFolder
      .add(cardLightParams, "rimX", -10, 10, 0.1)
      .name("X")
      .onChange((value) => {
        rimLight.position.x = value;
      });
    rimFolder
      .add(cardLightParams, "rimY", -10, 10, 0.1)
      .name("Y")
      .onChange((value) => {
        rimLight.position.y = value;
      });
    rimFolder
      .add(cardLightParams, "rimZ", -10, 10, 0.1)
      .name("Z")
      .onChange((value) => {
        rimLight.position.z = value;
      });

    const fillFolder = lightsFolder.addFolder("Заполняющий свет");
    fillFolder
      .add(cardLightParams, "fillIntensity", 0, 5, 0.05)
      .onChange((value) => {
        fillLight.intensity = value;
      });
    fillFolder.addColor(cardLightParams, "fillColor").onChange((value) => {
      fillLight.color.set(value);
    });
    fillFolder
      .add(cardLightParams, "fillX", -10, 10, 0.1)
      .name("X")
      .onChange((value) => {
        fillLight.position.x = value;
      });
    fillFolder
      .add(cardLightParams, "fillY", -10, 10, 0.1)
      .name("Y")
      .onChange((value) => {
        fillLight.position.y = value;
      });
    fillFolder
      .add(cardLightParams, "fillZ", -10, 10, 0.1)
      .name("Z")
      .onChange((value) => {
        fillLight.position.z = value;
      });

    lightsFolder.open();
  };

  const loader = new GLTFLoader();
  const themeUrl =
    typeof infinityData !== "undefined" && infinityData.themeUrl
      ? infinityData.themeUrl
      : "";
  const modelPath = themeUrl
    ? `${themeUrl}/assets/models/gltf/card/Card.gltf`
    : "../models/gltf/card/Card.gltf";

  loader.load(
    modelPath,
    (gltf) => {
      cardModel = gltf.scene;

      cardModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });

      cardGroup.add(cardModel);
      applyCardParams();
      setupCardGui();
    },
    undefined,
    (error) => {
      console.warn("Card loading error:", error);
    }
  );

  let isHovered = false;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  const clamp = (value) => Math.max(-1, Math.min(1, value));

  const isInHoverZone = (x, y) => {
    const rect = cardWrapper.getBoundingClientRect();
    const expandedLeft = rect.left - hoverPadding;
    const expandedRight = rect.right + hoverPadding;
    const expandedTop = rect.top - hoverPadding;
    const expandedBottom = rect.bottom + hoverPadding;

    return (
      x >= expandedLeft &&
      x <= expandedRight &&
      y >= expandedTop &&
      y <= expandedBottom
    );
  };

  const updateTargets = (event) => {
    const rect = cardWrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    targetX = clamp((event.clientX - centerX) / (rect.width / 2));
    targetY = clamp((event.clientY - centerY) / (rect.height / 2));
  };

  const setHovered = (nextState) => {
    if (isHovered === nextState) return;
    isHovered = nextState;
    if (isHovered) {
      cardWrapper.classList.add("is-hovered");
      document.body.style.cursor = "pointer";
    } else {
      cardWrapper.classList.remove("is-hovered");
      document.body.style.cursor = "";
      targetX = 0;
      targetY = 0;
    }
  };

  const hoverZoneElement = container || cardWrapper;

  const handlePointerMove = (event) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    const inHoverZone = isInHoverZone(event.clientX, event.clientY);
    setHovered(inHoverZone);
    if (inHoverZone) {
      updateTargets(event);
    }
  };

  const handlePointerLeave = () => {
    setHovered(false);
  };

  hoverZoneElement.addEventListener("pointermove", handlePointerMove);
  hoverZoneElement.addEventListener("pointerleave", handlePointerLeave);

  const resizeRenderer = () => {
    sizes.width = canvas.clientWidth;
    sizes.height = canvas.clientHeight;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, getMaxPixelRatio())
    );
  };

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(resizeRenderer);
    resizeObserver.observe(cardWrapper);
  } else {
    window.addEventListener("resize", resizeRenderer);
  }

  const clock = new THREE.Clock();
  let animationFrameId = null;
  let isDocumentVisible = !document.hidden;
  let isInViewport = true;

  const tick = () => {
    const delta = clock.getDelta();
    const elapsedTime = clock.elapsedTime;

    const followSpeed = isHovered ? 6 : 8;
    currentX += (targetX - currentX) * Math.min(1, followSpeed * delta);
    currentY += (targetY - currentY) * Math.min(1, followSpeed * delta);

    cardGroup.rotation.y = currentX * maxRotation;
    cardGroup.rotation.x = -currentY * maxRotation;

    cardGroup.position.x +=
      (currentX * maxTranslation - cardGroup.position.x) * 0.1;
    cardGroup.position.y +=
      (-currentY * maxTranslation - cardGroup.position.y) * 0.1;

    const idleOffset = Math.sin(elapsedTime * 0.6) * 0.05;
    cardGroup.position.z = idleOffset;

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
    const observer = new IntersectionObserver(
      (entries) => {
        isInViewport = entries.some((entry) => entry.isIntersecting);
        handleVisibility();
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(canvas);
  }

  startLoop();
})();

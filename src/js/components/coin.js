import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'lil-gui';
const canvas = document.getElementById('scene')

// GUI setup - показываем только если в URL есть #debug
const isDebugMode = window.location.hash === '#debug';
const gui = new GUI();

if (!isDebugMode) {
  gui.hide();
}

let coinModel = null;

// Параметры для GUI
const coinParams = {
  positionX: 2.1,
  positionY: 0.5,
  positionZ: -0.8,

  rotationX: -0.353,
  rotationY: -0.62,
  rotationZ: -0.29,
  scale: 2.1
};

// Параметры для освещения
const lightParams = {
  ambientIntensity: 1,
  ambientColor: '#ffffff',

  directional1Intensity: 2.7,
  directional1Color: '#ffffff',
  directional1X: 1.4,
  directional1Y: -1,
  directional1Z: 3.7,

  directional2Intensity: 4,
  directional2Color: '#ffffff',
  directional2X: -1,
  directional2Y: -1.5,
  directional2Z: -0.2
};

const mouse = {
  x: 0,
  y: 0
}

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera( 30, sizes.width / sizes.height, 0.1, 100 );
camera.position.set( 0, 0, 12 );

const cameraGroup = new THREE.Group()
scene.add(cameraGroup)

cameraGroup.add(camera)

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  alpha: true
});

// Controls
// const controls = new OrbitControls( camera, renderer.domElement );

// Lights

const ambientLight = new THREE.AmbientLight(lightParams.ambientColor, lightParams.ambientIntensity);
scene.add(ambientLight)


const directionLightBottomLeft = new THREE.DirectionalLight(lightParams.directional1Color, lightParams.directional1Intensity)
directionLightBottomLeft.position.set(lightParams.directional1X, lightParams.directional1Y, lightParams.directional1Z)
scene.add(directionLightBottomLeft)

const directionLightTopRight = new THREE.DirectionalLight(lightParams.directional2Color, lightParams.directional2Intensity)
directionLightTopRight.position.set(lightParams.directional2X, lightParams.directional2Y, lightParams.directional2Z)
scene.add(directionLightTopRight)


// LOADER
const loader = new GLTFLoader();
loader.load(
	'./models/gltf/bitcoin3/bitcoin.gltf',
	function ( gltf ) {

    coinModel = gltf.scene;

    // Применяем параметры из GUI
    coinModel.scale.set(coinParams.scale, coinParams.scale, coinParams.scale);
    coinModel.position.set(coinParams.positionX, coinParams.positionY, coinParams.positionZ);
    coinModel.rotation.set(coinParams.rotationX, coinParams.rotationY, coinParams.rotationZ);

		scene.add( coinModel );

	},
	// called while loading is progressing
	function ( xhr ) {
		console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
	},
	// called when loading has errors
	function ( error ) {
		console.log( 'Bitcoin loading error: ' + error );
	}
);


    // Создаем GUI контролы для монетки
    const coinFolder = gui.addFolder('Монетка');

    // Позиция
    const positionFolder = coinFolder.addFolder('Позиция');
    positionFolder.add(coinParams, 'positionX', -10, 10, 0.1).onChange((value) => {
      coinModel.position.x = value;
    });
    positionFolder.add(coinParams, 'positionY', -10, 10, 0.1).onChange((value) => {
      coinModel.position.y = value;
    });
    positionFolder.add(coinParams, 'positionZ', -10, 10, 0.1).onChange((value) => {
      coinModel.position.z = value;
    });

    // Поворот
    const rotationFolder = coinFolder.addFolder('Поворот');
    rotationFolder.add(coinParams, 'rotationX', -Math.PI * 2, Math.PI * 2, 0.01).onChange((value) => {
      coinModel.rotation.x = value;
    });
    rotationFolder.add(coinParams, 'rotationY', -Math.PI * 2, Math.PI * 2, 0.01).onChange((value) => {
      coinModel.rotation.y = value;
    });
    rotationFolder.add(coinParams, 'rotationZ', -Math.PI * 2, Math.PI * 2, 0.01).onChange((value) => {
      coinModel.rotation.z = value;
    });

    // Масштаб
    coinFolder.add(coinParams, 'scale', 0.1, 5, 0.1).onChange((value) => {
      coinModel.scale.set(value, value, value);
    });

    coinFolder.open();

    // Создаем GUI контролы для освещения
    const lightFolder = gui.addFolder('Освещение');

    // Ambient Light
    const ambientFolder = lightFolder.addFolder('Рассеянный свет');
    ambientFolder.add(lightParams, 'ambientIntensity', 0, 5, 0.1).onChange((value) => {
      ambientLight.intensity = value;
    });
    ambientFolder.addColor(lightParams, 'ambientColor').onChange((value) => {
      ambientLight.color.setHex(value.replace('#', '0x'));
    });

    // Directional Light 1
    const directional1Folder = lightFolder.addFolder('Направленный свет 1');
    directional1Folder.add(lightParams, 'directional1Intensity', 0, 10, 0.1).onChange((value) => {
      directionLightBottomLeft.intensity = value;
    });
    directional1Folder.addColor(lightParams, 'directional1Color').onChange((value) => {
      directionLightBottomLeft.color.setHex(value.replace('#', '0x'));
    });
    directional1Folder.add(lightParams, 'directional1X', -10, 10, 0.1).onChange((value) => {
      directionLightBottomLeft.position.x = value;
    });
    directional1Folder.add(lightParams, 'directional1Y', -10, 10, 0.1).onChange((value) => {
      directionLightBottomLeft.position.y = value;
    });
    directional1Folder.add(lightParams, 'directional1Z', -10, 10, 0.1).onChange((value) => {
      directionLightBottomLeft.position.z = value;
    });

    // Directional Light 2
    const directional2Folder = lightFolder.addFolder('Направленный свет 2');
    directional2Folder.add(lightParams, 'directional2Intensity', 0, 10, 0.1).onChange((value) => {
      directionLightTopRight.intensity = value;
    });
    directional2Folder.addColor(lightParams, 'directional2Color').onChange((value) => {
      directionLightTopRight.color.setHex(value.replace('#', '0x'));
    });
    directional2Folder.add(lightParams, 'directional2X', -10, 10, 0.1).onChange((value) => {
      directionLightTopRight.position.x = value;
    });
    directional2Folder.add(lightParams, 'directional2Y', -10, 10, 0.1).onChange((value) => {
      directionLightTopRight.position.y = value;
    });
    directional2Folder.add(lightParams, 'directional2Z', -10, 10, 0.1).onChange((value) => {
      directionLightTopRight.position.z = value;
    });

    lightFolder.open();

renderer.setSize( sizes.width, sizes.height );
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Resize
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  camera.updateProjectionMatrix()
  camera.aspect = sizes.width / sizes.height

  renderer.setSize( sizes.width, sizes.height );
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
})

window.addEventListener('mousemove', e => {
  const mouseX = e.clientX / sizes.width * 2 - 1
  const mouseY = -(e.clientY / sizes.height) * 2 + 1

  mouse.x = mouseX
  mouse.y = mouseY

})

// Animation

const clock = new THREE.Clock()
let previousTime = 0;

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  const delta = elapsedTime - previousTime
  previousTime = elapsedTime
  // controls.update();
  if(coinModel) {
    const targetX = mouse.x * 0.5
    const targetY = mouse.y * 0.5

    cameraGroup.position.x += (targetX - cameraGroup.position.x) * 0.5 * delta;
    cameraGroup.position.y += (targetY - cameraGroup.position.y) * 0.5 * delta;

    console.log(targetX)
    coinModel.rotation.x += Math.sin(elapsedTime) * 0.001;
    coinModel.rotation.y += Math.cos(elapsedTime) * 0.001;



  }

  renderer.render( scene, camera );
  requestAnimationFrame(tick)
}

tick();

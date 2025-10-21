import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'lil-gui';
import { degToRad } from 'three/src/math/MathUtils.js';
const canvas = document.getElementById('scene')
const gui = new GUI();


let coinModel = null;

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera( 30, sizes.width / sizes.height, 0.1, 100 );
camera.position.set( 0, 0, 12 );


const renderer = new THREE.WebGLRenderer({
  canvas: canvas
});

// Controls
// const controls = new OrbitControls( camera, renderer.domElement );

const ambientLight = new THREE.AmbientLight("#fff", 1);
scene.add(ambientLight)


// const pointLightBottomLeft = new THREE.PointLight( 0xffffff, 100 );
// pointLightBottomLeft.position.set(-3, -2, 1)
// scene.add(pointLightBottomLeft)

// const pointLightTopRight = new THREE.PointLight( 0xffffff, 100 );
// pointLightTopRight.position.set(3, 2, 1)
// scene.add(pointLightTopRight)

const directionLightBottomLeft = new THREE.DirectionalLight('#fff', 5)
directionLightBottomLeft.position.set(-3, -4, 2)
scene.add(directionLightBottomLeft)

const directionLightTopRight = new THREE.DirectionalLight('#fff', 5)
directionLightTopRight.position.set(3, 4, 2)
scene.add(directionLightTopRight)
// LOADER
const loader = new GLTFLoader();
loader.load(
	'./models/gltf/bitcoin/bitcoin.gltf',
	function ( gltf ) {

    coinModel = gltf.scene;
    coinModel.scale.set(2,2,2)
    coinModel.position.x = 2
    coinModel.position.z = -2

    coinModel.rotation.y = -degToRad(45)
    coinModel.rotation.x = -degToRad(20)
    coinModel.rotation.z = -degToRad(20)

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

// Animation

const clock = new THREE.Clock()
const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  renderer.render( scene, camera );
  // controls.update();
  if(coinModel) {
    coinModel.rotation.y = elapsedTime * 0.5;
  }

  requestAnimationFrame(tick)
}

tick();

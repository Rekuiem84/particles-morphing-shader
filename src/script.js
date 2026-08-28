import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import GUI from "lil-gui";
import gsap from "gsap";
import particlesVertexShader from "./shaders/particles/vertex.glsl";
import particlesFragmentShader from "./shaders/particles/fragment.glsl";

/**
 * Base
 */
// Debug
const gui = new GUI({ width: 340 });
const debugObject = {};

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

// Loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./draco/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * Sizes
 */
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
	pixelRatio: Math.min(window.devicePixelRatio, 2),
};

window.addEventListener("resize", () => {
	// Update sizes
	sizes.width = window.innerWidth;
	sizes.height = window.innerHeight;
	sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);

	// Materials
	if (particles) {
		particles.material.uniforms.uResolution.value.set(
			sizes.width * sizes.pixelRatio,
			sizes.height * sizes.pixelRatio,
		);
	}

	// Update camera
	camera.aspect = sizes.width / sizes.height;
	camera.updateProjectionMatrix();

	// Update renderer
	renderer.setSize(sizes.width, sizes.height);
	renderer.setPixelRatio(sizes.pixelRatio);
});

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
	35,
	sizes.width / sizes.height,
	0.1,
	100,
);
camera.position.set(0, 0, 8 * 2);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
	canvas: canvas,
	antialias: true,
});

renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(sizes.pixelRatio);

debugObject.clearColor = "#160920";
gui.addColor(debugObject, "clearColor").onChange(() => {
	renderer.setClearColor(debugObject.clearColor);
});
renderer.setClearColor(debugObject.clearColor);

/**
 * Particles
 */
// Load models
// Tout ce qui concerne les particules doit être fait après que les modèles soient chargés
// Donc on initialise les particules à null
let particles = null;

gltfLoader.load("./models.glb", (gltf) => {
	particles = {};
	particles.modelIndex = 0; // Index du model dans le fichier glb

	// Positions
	const positions = gltf.scene.children.map((child) => {
		return child.geometry.attributes.position; // Array d'objets, avec les positions des vertices
	});
	particles.maxCount = 0;
	for (const position of positions) {
		if (position.count > particles.maxCount) {
			// Obtenir le nombre max de vertices parmi les modèles
			particles.maxCount = position.count;
		}
	}

	particles.positions = [];

	for (const position of positions) {
		const originalArray = position.array; // Positions du modèle de départ (taille d'origine)
		const newArray = new Float32Array(particles.maxCount * 3); // Version du modèle actuel, complétée pour atteindre maxCount vertices

		for (let i = 0; i < particles.maxCount; i++) {
			const i3 = i * 3;

			if (i3 < originalArray.length) {
				// Remplir le nouvel array avec les positions des vertices
				newArray[i3 + 0] = originalArray[i3 + 0];
				newArray[i3 + 1] = originalArray[i3 + 1];
				newArray[i3 + 2] = originalArray[i3 + 2];
			} else {
				// Pour les vertices en plus, on va leur assigner la position d'un vertex random
				const randomIndex = Math.floor(position.count * Math.random()) * 3;
				newArray[i3 + 0] = originalArray[randomIndex + 0];
				newArray[i3 + 1] = originalArray[randomIndex + 1];
				newArray[i3 + 2] = originalArray[randomIndex + 2];
			}
		}
		// On stocke ce nouvel array dans la liste des positions disponibles pour chaque modèle
		particles.positions.push(new THREE.Float32BufferAttribute(newArray, 3));
	}

	// Geometry
	const sizesArray = new Float32Array(particles.maxCount);

	for (let i = 0; i < particles.maxCount; i++) {
		sizesArray[i] = Math.random();
	}

	particles.geometry = new THREE.BufferGeometry();
	particles.geometry.setAttribute(
		"position",
		particles.positions[particles.modelIndex],
	);
	particles.geometry.setAttribute("aPositionTarget", particles.positions[3]);
	particles.geometry.setAttribute(
		"aSize",
		new THREE.BufferAttribute(sizesArray, 1),
	);

	// Material
	particles.color1 = "#ff7300";
	particles.color2 = "#0091ff";

	particles.material = new THREE.ShaderMaterial({
		vertexShader: particlesVertexShader,
		fragmentShader: particlesFragmentShader,
		uniforms: {
			uSize: new THREE.Uniform(0.4),
			uResolution: new THREE.Uniform(
				new THREE.Vector2(
					sizes.width * sizes.pixelRatio,
					sizes.height * sizes.pixelRatio,
				),
			),
			uProgress: new THREE.Uniform(0),
			uColor1: new THREE.Uniform(new THREE.Color(particles.color1)),
			uColor2: new THREE.Uniform(new THREE.Color(particles.color2)),
		},
		blending: THREE.AdditiveBlending,
		depthWrite: false,
	});

	// Points
	particles.points = new THREE.Points(particles.geometry, particles.material);
	// Le frustum culling permet de ne pas render ce qui n'est pas dans le FOV de la camera, pour gagner en performances
	// Ici, on le désactive car la taille de l'objet change entre 2 morph, et on ne veut pas re-calculer la bounding area de l'objet
	particles.points.frustumCulled = false;
	scene.add(particles.points);

	// Methods
	particles.morph = (index) => {
		// Réassigne la position des vertices pour le morph avant / après
		particles.geometry.attributes.position =
			particles.positions[particles.modelIndex];
		particles.geometry.attributes.aPositionTarget = particles.positions[index];

		// Animate uProgress
		gsap.fromTo(
			particles.material.uniforms.uProgress,
			{ value: 0 },
			{ value: 1, duration: 2, ease: "linear" },
		);

		// Save index
		particles.modelIndex = index;
	};

	particles.morph0 = () => {
		particles.morph(0);
	};
	particles.morph1 = () => {
		particles.morph(1);
	};
	particles.morph2 = () => {
		particles.morph(2);
	};
	particles.morph3 = () => {
		particles.morph(3);
	};

	// Tweaks
	gui.addColor(particles, "color1").onChange(() => {
		particles.material.uniforms.uColor1.value.set(particles.color1);
	});
	gui.addColor(particles, "color2").onChange(() => {
		particles.material.uniforms.uColor2.value.set(particles.color2);
	});

	gui
		.add(particles.material.uniforms.uProgress, "value")
		.min(0)
		.max(1)
		.step(0.01)
		.name("uProgress")
		.listen();

	gui.add(particles, "morph0").name("Tore");
	gui.add(particles, "morph1").name("Suzanne");
	gui.add(particles, "morph2").name("Sphere");
	gui.add(particles, "morph3").name("ThreeJS");
});

/**
 * Animate
 */
const tick = () => {
	// Update controls
	controls.update();

	// Render normal scene
	renderer.render(scene, camera);

	// Call tick again on the next frame
	window.requestAnimationFrame(tick);
};

tick();

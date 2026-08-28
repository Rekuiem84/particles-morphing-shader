uniform vec2 uResolution;
uniform float uSize;
uniform float uProgress;

uniform vec3 uColor1;
uniform vec3 uColor2;

attribute vec3 aPositionTarget;
attribute float aSize;

varying vec3 vColor;

#include ../includes/simplexNoise3d.glsl

void main()
{
    // Mix positions
    // On créé du bruit avec la fonction simplex (~perlin) pour chaque vertex de départ et d'arrivée
    float noiseOrigin = simplexNoise3d(position * 0.5);
    float noiseTarget = simplexNoise3d(aPositionTarget * 0.2);
    // Mélanger la position de départ et d'arrivée en fonction de la progression
    float noise = mix(noiseOrigin, noiseTarget, uProgress);
    noise = smoothstep(-1.0, 1.0, noise);

    float duration = 0.2; // Durée de morph d'une particule
    float delay = (1.0 - duration) * noise; // Délai de départ de la particule en fonction de son noise
    float end = delay + duration;

    float progress = smoothstep(delay, end, uProgress);
    vec3 mixedPosition = mix(position, aPositionTarget, progress);

    // Final position
    vec4 modelPosition = modelMatrix * vec4(mixedPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;

    // Point size
    gl_PointSize = uSize * uResolution.y * aSize;
    gl_PointSize *= (1.0 / - viewPosition.z);

    // Varyings
    vColor = mix(uColor1, uColor2, noise);
}
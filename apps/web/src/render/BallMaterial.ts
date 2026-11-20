import { ShaderMaterial, type Texture } from 'three';

/** Acabamento de resina para a câmera de jogo: volume suave e reflexo de uma softbox. */
export function createBallMaterial(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ballMap: { value: map } },
    // O acabamento já define sua exposição; as luzes da mesa não lavam as cores.
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 ballUv;
      varying vec3 ballNormal;

      void main() {
        ballUv = uv;
        ballNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D ballMap;
      varying vec2 ballUv;
      varying vec3 ballNormal;

      void main() {
        vec3 n = normalize(ballNormal);
        vec3 pigment = texture2D(ballMap, ballUv).rgb;

        // Luz em espaço de câmera: o acabamento permanece legível em paisagem e retrato,
        // enquanto as coordenadas da textura giram com a malha da bola.
        float key = max(dot(n, normalize(vec3(-0.45, 0.6, 0.8))), 0.0);
        float contour = mix(0.18, 1.0, smoothstep(0.1, 0.5, n.z));
        vec3 color = pigment * (0.34 + 0.76 * pow(key, 0.8)) * contour;

        // Um reflexo amplo com borda macia, em vez de vários pontos de luz.
        vec2 glossOffset = n.xy - vec2(-0.3, 0.43);
        vec2 gloss = glossOffset / vec2(0.4, 0.22);
        vec2 halo = glossOffset / vec2(0.68, 0.52);
        float highlight = 0.8 * (1.0 - smoothstep(0.35, 1.1, length(gloss)));
        highlight += 0.15 * exp(-2.0 * dot(halo, halo));
        color = mix(color, vec3(1.0, 0.99, 0.96), highlight);

        vec2 glint = (n.xy - vec2(0.46, -0.3)) / vec2(0.085, 0.065);
        color = mix(color, vec3(0.9, 0.96, 1.0), 0.38 * exp(-2.0 * dot(glint, glint)));

        // Reflexo discreto do feltro na parte inferior, sem iluminar todo o contorno.
        float bounce = pow(max(dot(n, normalize(vec3(0.35, -0.8, 0.4))), 0.0), 12.0);
        color += vec3(0.01, 0.02, 0.015) * bounce;

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Sombra curta e suave, independente das duas luminárias que iluminam a mesa. */
export function createBallShadowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 shadowUv;
      void main() {
        shadowUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 shadowUv;
      void main() {
        float radius = length(shadowUv * 2.0 - 1.0);
        float opacity = 0.5 * (1.0 - smoothstep(0.4, 1.0, radius));
        gl_FragColor = vec4(0.0, 0.0, 0.0, opacity);
      }
    `,
  });
}

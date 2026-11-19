import { BoxGeometry, Color, Mesh, MeshBasicMaterial, Scene, type PMREMGenerator } from 'three';

/** Reflexos exclusivos das bolas: sala escura e uma luminária larga acima da mesa. */
export function createBallEnvironment(pmrem: PMREMGenerator) {
  const scene = new Scene();
  scene.background = new Color().setRGB(0.08, 0.09, 0.085);
  const geometry = new BoxGeometry(1, 1, 1);
  const keyMaterial = new MeshBasicMaterial({ color: new Color().setRGB(7, 6.7, 6.1) });
  const fillMaterial = new MeshBasicMaterial({ color: new Color().setRGB(0.7, 0.8, 0.85) });

  const key = new Mesh(geometry, keyMaterial);
  key.position.set(-3, 5, -4);
  key.scale.set(4, 0.15, 2.5);
  const fill = new Mesh(geometry, fillMaterial);
  fill.position.set(4, 2, 3);
  fill.scale.set(2, 3, 0.15);
  scene.add(key, fill);

  const environment = pmrem.fromScene(scene, 0.04);
  geometry.dispose();
  keyMaterial.dispose();
  fillMaterial.dispose();
  return environment;
}

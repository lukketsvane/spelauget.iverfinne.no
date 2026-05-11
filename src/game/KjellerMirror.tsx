'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

type Props = {
  id: string;
  position: [number, number, number];
  // Half-extent along each axis (so width=80 means the mirror plane is
  // 80 m across). Defaults sized to roughly fill the Kjellerverden
  // walkable area.
  width?: number;
  depth?: number;
  // Optional faint tint on top of the reflection — mirrors the SENTER
  // palette. 0xffffff = pure silver.
  color?: string;
  // Render-target resolution. Bigger = sharper reflection.
  resolution?: number;
};

// Mirror floor that works with the game's orthographic iso camera.
//
// Why a custom implementation instead of `three/examples/jsm/objects/
// Reflector`? Reflector applies an oblique near-clipping-plane to its
// virtual camera so geometry behind the mirror plane gets clipped.
// That math assumes a perspective projection matrix — when we apply
// it to an OrthographicCamera matrix it scrambles the projection and
// the character (along with everything else above the mirror) ends up
// invisible in the reflection. Skipping the oblique-plane math and
// relying on the user keeping geometry above the mirror plane works
// fine for our flat world, and the resulting reflection actually
// includes the character.

// Vertex/fragment for the textured plane that samples the reflection
// render-target via a clip-space texture matrix (the same trick
// upstream Reflector uses to project the rendered scene back onto the
// plane's screen footprint).
const VERTEX_SHADER = /* glsl */ `
  uniform mat4 textureMatrix;
  varying vec4 vUv;
  void main() {
    vUv = textureMatrix * vec4( position, 1.0 );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;
const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec3 color;
  varying vec4 vUv;
  void main() {
    vec4 base = texture2DProj( tDiffuse, vUv );
    gl_FragColor = vec4( base.rgb * color, 1.0 );
  }
`;

export default function KjellerMirror({
  id: _id,
  position,
  width = 220,
  depth = 220,
  color = '#ffffff',
  resolution = 1024,
}: Props) {
  const { gl, scene } = useThree();
  const pixelRatio = Math.min(gl.getPixelRatio(), 2);
  const meshRef = useRef<THREE.Mesh>(null);
  const dprResolution = resolution * pixelRatio;

  const { material, virtualCamera, renderTarget, textureMatrix } = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(dprResolution, dprResolution, {
      samples: 4,
      type: THREE.HalfFloatType,
    });
    const texMatrix = new THREE.Matrix4();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rt.texture },
        color: { value: new THREE.Color(color) },
        textureMatrix: { value: texMatrix },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    // We mirror an orthographic camera, so the virtual camera is also
    // ortho. Its projection matrix is copied each frame from the
    // current main camera.
    const vCam = new THREE.OrthographicCamera();
    return {
      material: mat,
      virtualCamera: vCam,
      renderTarget: rt,
      textureMatrix: texMatrix,
    };
  }, [dprResolution, color]);

  // Update the color uniform without rebuilding the material when the
  // tint prop changes alone.
  useEffect(() => {
    (material.uniforms.color.value as THREE.Color).set(color);
  }, [material, color]);

  // Dispose render target + material when the mirror unmounts.
  useEffect(() => {
    return () => {
      renderTarget.dispose();
      material.dispose();
    };
  }, [renderTarget, material]);

  // Scratch vectors reused each frame.
  const scratch = useMemo(
    () => ({
      reflectorPos: new THREE.Vector3(),
      camPos: new THREE.Vector3(),
      rot: new THREE.Matrix4(),
      normal: new THREE.Vector3(),
      view: new THREE.Vector3(),
      lookAt: new THREE.Vector3(),
      target: new THREE.Vector3(),
    }),
    [],
  );

  useFrame(({ camera, gl }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const {
      reflectorPos,
      camPos,
      rot,
      normal,
      view,
      lookAt,
      target,
    } = scratch;

    reflectorPos.setFromMatrixPosition(mesh.matrixWorld);
    camPos.setFromMatrixPosition(camera.matrixWorld);
    rot.extractRotation(mesh.matrixWorld);

    // Plane normal in world space. PlaneGeometry default normal is +Z;
    // after our -90° X rotation below it becomes +Y (up).
    normal.set(0, 0, 1).applyMatrix4(rot);

    // Camera is below the mirror surface — skip the render this frame.
    view.subVectors(reflectorPos, camPos);
    if (view.dot(normal) > 0) return;

    // Mirror the camera position across the mirror plane.
    view.reflect(normal).negate();
    view.add(reflectorPos);

    // Mirror the camera's look-at target across the plane.
    rot.extractRotation(camera.matrixWorld);
    lookAt.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    target.subVectors(reflectorPos, lookAt).reflect(normal).negate().add(reflectorPos);

    virtualCamera.position.copy(view);
    virtualCamera.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    virtualCamera.lookAt(target);
    virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
    virtualCamera.updateMatrixWorld();

    // Build the texture matrix that maps clip-space coords back onto
    // the mirror plane's UV — same trick the upstream Reflector uses.
    textureMatrix.set(
      0.5,
      0.0,
      0.0,
      0.5,
      0.0,
      0.5,
      0.0,
      0.5,
      0.0,
      0.0,
      0.5,
      0.5,
      0.0,
      0.0,
      0.0,
      1.0,
    );
    textureMatrix.multiply(virtualCamera.projectionMatrix);
    textureMatrix.multiply(virtualCamera.matrixWorldInverse);
    textureMatrix.multiply(mesh.matrixWorld);

    // Render the scene from the mirror's viewpoint into the target.
    // We hide the mirror itself so it doesn't infinitely reflect.
    mesh.visible = false;
    const prevTarget = gl.getRenderTarget();
    const prevAutoUpdate = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(renderTarget);
    gl.state.buffers.depth.setMask(true);
    if (gl.autoClear === false) gl.clear();
    gl.render(scene, virtualCamera);
    gl.setRenderTarget(prevTarget);
    gl.shadowMap.autoUpdate = prevAutoUpdate;
    mesh.visible = true;
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
    >
      <planeGeometry args={[width, depth]} />
    </mesh>
  );
}

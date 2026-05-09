import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();
const doc = await io.read('./public/sligo.glb');
const root = doc.getRoot();

console.log('=== ANIMATIONS ===');
for (const anim of root.listAnimations()) {
  let duration = 0;
  for (const s of anim.listSamplers()) {
    const arr = s.getInput()?.getArray();
    if (arr && arr.length) duration = Math.max(duration, arr[arr.length - 1]);
  }
  console.log(`- "${anim.getName()}"  channels=${anim.listChannels().length}  duration=${duration.toFixed(2)}s`);
}

console.log('\n=== SCENES / NODES ===');
for (const scene of root.listScenes()) {
  console.log(`Scene: "${scene.getName()}"`);
  for (const node of scene.listChildren()) {
    console.log(`  Node: "${node.getName()}"  mesh=${node.getMesh()?.getName() ?? '-'}`);
  }
}

console.log('\n=== MESHES ===');
for (const mesh of root.listMeshes()) {
  console.log(`- "${mesh.getName()}"  primitives=${mesh.listPrimitives().length}`);
}

console.log('\n=== SKINS ===');
for (const skin of root.listSkins()) {
  console.log(`- "${skin.getName()}"  joints=${skin.listJoints().length}`);
}

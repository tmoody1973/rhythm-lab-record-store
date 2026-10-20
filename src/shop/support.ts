// Can this browser draw the 3D shop? Only if it can actually create a WebGL context (a blocklisted GPU or
// acceleration turned off still has the constructor) and the GPU hasn't given up earlier this session.
const GAVE_UP = 'rl-no-3d';
let probed: boolean | null = null;

function canMakeContext(): boolean {
  if (probed !== null) return probed;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext(); // free it straight away
    probed = !!gl;
  } catch {
    probed = false;
  }
  return probed;
}

export function has3D(): boolean {
  if (typeof window === 'undefined' || !('WebGLRenderingContext' in window)) return false;
  try {
    if (window.sessionStorage.getItem(GAVE_UP) !== null) return false;
  } catch {
    // Storage blocked: fall through to the probe.
  }
  return canMakeContext();
}

export function give3DUp(): void {
  try {
    window.sessionStorage.setItem(GAVE_UP, '1');
  } catch {
    // Storage blocked: the grid still shows this time; 3D may be retried on reload.
  }
}

/** Test helper: forget the cached probe. */
export function resetSupportProbe(): void {
  probed = null;
}

// Can this browser draw the 3D shop? No when WebGL is missing, or when the GPU gave up earlier this session
// (a lost context), in which case the grid stays the front door until the tab is closed.
const GAVE_UP = 'rl-no-3d';

export function has3D(): boolean {
  if (typeof window === 'undefined' || !('WebGLRenderingContext' in window)) return false;
  try {
    return window.sessionStorage.getItem(GAVE_UP) === null;
  } catch {
    return true;
  }
}

export function give3DUp(): void {
  try {
    window.sessionStorage.setItem(GAVE_UP, '1');
  } catch {
    // Storage blocked: the grid still shows this time; 3D may be retried on reload.
  }
}

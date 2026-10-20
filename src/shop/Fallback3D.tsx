// If the 3D code fails — the WebGL context can't be created, the lazy chunk won't load (e.g. after a deploy) — give
// 3D up for this visit and let the caller fall back to the grid or the flat crates, instead of a blank page.
import { Component, type ReactNode } from 'react';
import { give3DUp } from './support.ts';

type Props = { onFail: () => void; children: ReactNode };

export class Fallback3D extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    give3DUp();
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

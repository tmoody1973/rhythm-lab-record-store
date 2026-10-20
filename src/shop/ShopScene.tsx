// The 3D record shop (lazy-loaded front door). Placeholder until the scene lands (plan Task 6).
import type { PublicAlbum } from '../catalog/schema.ts';
import type { UrlState } from '../state/url.ts';

export type ShopSceneProps = {
  albums: PublicAlbum[];
  state: UrlState;
  patch: (p: Partial<UrlState>, opts?: { push?: boolean }) => void;
  onOpenRecord: (r: PublicAlbum) => void;
  onNotice: (text: string) => void;
  staffPicks: PublicAlbum[];
};

export default function ShopScene(_: ShopSceneProps) {
  return <div data-testid="shop" />;
}

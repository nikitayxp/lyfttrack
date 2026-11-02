import { PHONE_OVERLAY_ATTRIBUTE } from '@/constants/deviceFrame';

export function createWebOverlayNode(zIndex: number): HTMLDivElement {
  const node = document.createElement('div');
  node.setAttribute(PHONE_OVERLAY_ATTRIBUTE, '');
  node.style.position = 'fixed';
  node.style.inset = '0';
  node.style.zIndex = String(zIndex);
  node.style.pointerEvents = 'none';
  return node;
}

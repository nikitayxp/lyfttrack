export const DEVICE_FRAME = {
  width: 393,
  height: 852,
  maxHeightVh: 95,
  border: 8,
  radius: 40,
  minWindowWidth: 768,
} as const;

export const DEVICE_SCREEN = {
  width: DEVICE_FRAME.width - DEVICE_FRAME.border * 2,
  height: DEVICE_FRAME.height - DEVICE_FRAME.border * 2,
  maxHeightCss: `calc(${DEVICE_FRAME.maxHeightVh}vh - ${DEVICE_FRAME.border * 2}px)`,
  radius: DEVICE_FRAME.radius - DEVICE_FRAME.border,
} as const;

export const PHONE_OVERLAY_ATTRIBUTE = 'data-phone-overlay';

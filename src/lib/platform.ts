export type ClientPlatform = "ios" | "macos" | "android" | "other";

export interface PlatformHint {
  platform: ClientPlatform;
  primaryWallet: "apple" | "google";
  isAppleDevice: boolean;
  isAndroid: boolean;
  isSafari: boolean;
}

export function detectPlatform(userAgent: string | null | undefined): PlatformHint {
  const ua = userAgent ?? "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/i.test(ua);

  let platform: ClientPlatform = "other";
  if (isIOS) platform = "ios";
  else if (isMac) platform = "macos";
  else if (isAndroid) platform = "android";

  const isAppleDevice = platform === "ios" || platform === "macos";

  return {
    platform,
    primaryWallet: isAppleDevice || (isSafari && !isAndroid) ? "apple" : isAndroid ? "google" : "apple",
    isAppleDevice,
    isAndroid,
    isSafari,
  };
}

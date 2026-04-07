function parseBrowser(userAgent: string): string {
  if (/Firefox\/([\d.]+)/i.test(userAgent)) {
    return `firefox-${RegExp.$1.split(".")[0]}`;
  }
  if (/Edg\/([\d.]+)/i.test(userAgent)) {
    return `edge-${RegExp.$1.split(".")[0]}`;
  }
  if (/Chrome\/([\d.]+)/i.test(userAgent) && !/Edg\//i.test(userAgent)) {
    return `chrome-${RegExp.$1.split(".")[0]}`;
  }
  if (/Version\/([\d.]+).*Safari/i.test(userAgent) && !/Chrome\//i.test(userAgent)) {
    return `safari-${RegExp.$1.split(".")[0]}`;
  }
  return "browser-unknown";
}

function parseOs(userAgent: string): string {
  if (/Windows NT ([\d.]+)/i.test(userAgent)) {
    return `windows-${RegExp.$1.replace(/\./g, "_")}`;
  }
  if (/Mac OS X ([\d_]+)/i.test(userAgent)) {
    return `macos-${RegExp.$1}`;
  }
  if (/Android ([\d.]+)/i.test(userAgent)) {
    return `android-${RegExp.$1.replace(/\./g, "_")}`;
  }
  if (/iPhone OS ([\d_]+)/i.test(userAgent) || /CPU OS ([\d_]+)/i.test(userAgent)) {
    return `ios-${RegExp.$1}`;
  }
  if (/Linux/i.test(userAgent)) {
    return "linux";
  }
  return "os-unknown";
}

export function getBrowserPlatformBucket(): string {
  if (typeof navigator === "undefined") {
    return "platform-unknown";
  }
  const userAgent = navigator.userAgent || "";
  return `${parseBrowser(userAgent)}__${parseOs(userAgent)}`;
}

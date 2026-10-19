/// <reference types="vite/client" />

declare module "*.jsx";
declare module "html2pdf.js";

interface NotificationOptions {
  renotify?: boolean;
  vibrate?: number | number[];
}

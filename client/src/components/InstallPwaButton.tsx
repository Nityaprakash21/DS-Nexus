import React, { useEffect, useState } from "react";
import {
  Download,
  Smartphone,
  X,
  Share,
  MoreVertical,
  PlusSquare,
  CheckCircle2,
  Zap,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import logo from "../assets/favicon.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallPwaButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"android" | "ios">("android");

  useEffect(() => {
    // Detect iOS
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOSDevice) {
      setActiveTab("ios");
    }

    // Check if already launched as standalone installed PWA
    const isRunningStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isRunningStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // If already running inside installed standalone app, don't show the install button
  if (isStandalone || isDismissed) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setDeferredPrompt(null);
          setIsDismissed(true);
          toast.success("DS Nexus app installed successfully!");
          return;
        }
      } catch {
        // fallback to modal guide
      }
    }
    // Show beautiful light-blue guide popup
    setIsModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="w-full flex items-center justify-between px-3 py-2.5 mb-2 rounded-xl text-xs font-semibold bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:text-white hover:bg-indigo-600/30 hover:border-indigo-400/50 transition-all group"
        title="Install DS Nexus as a mobile app"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
            <Smartphone className="w-3.5 h-3.5" />
          </div>
          <span>Install Mobile App</span>
        </div>
        <Download className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Light Blue Professional Installation Guide Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div
            className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-sky-50 via-blue-50/80 to-slate-50 border border-sky-200/90 shadow-2xl shadow-sky-500/10 overflow-hidden text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Soft decorative background glow */}
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-sky-200/50 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="relative p-5 sm:p-6 pb-4 border-b border-sky-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-sky-100/80 transition-all"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white border border-sky-200/90 p-2 shadow-sm flex items-center justify-center shrink-0">
                  <img src={logo} alt="DS Nexus" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-extrabold uppercase tracking-wide border border-sky-200 mb-1">
                    <Smartphone className="w-3 h-3" />
                    Mobile Web App
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Install DS Nexus
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add to home screen for a full-screen, native experience
                  </p>
                </div>
              </div>
            </div>

            {/* Device Selector Tabs */}
            <div className="relative px-5 sm:px-6 pt-4">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-sky-100/70 border border-sky-200/70 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("android")}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    activeTab === "android"
                      ? "bg-white text-sky-800 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>Android (Chrome)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ios")}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    activeTab === "ios"
                      ? "bg-white text-sky-800 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>Apple (Safari)</span>
                </button>
              </div>
            </div>

            {/* Steps Content */}
            <div className="relative p-5 sm:p-6 space-y-3">
              {activeTab === "android" ? (
                <>
                  <div className="flex items-start gap-3 p-3 bg-white/90 border border-sky-100 rounded-xl shadow-2xs">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                        Tap the Chrome menu
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px]">
                          <MoreVertical className="w-3 h-3" />
                        </span>
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Look for the 3 vertical dots in the top-right corner of Google Chrome.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-white/90 border border-sky-100 rounded-xl shadow-2xs">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        Select <span className="text-sky-700 font-bold">"Install app"</span> or <span className="text-sky-700 font-bold">"Add to Home screen"</span>
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Scroll down the menu list and tap the install option.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-white/90 border border-sky-100 rounded-xl shadow-2xs">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        Confirm Installation
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Tap <span className="font-semibold text-slate-700">"Install"</span>. DS Nexus will appear on your phone screen as an app.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 p-3 bg-white/90 border border-sky-100 rounded-xl shadow-2xs">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                        Tap the Share button
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                          <Share className="w-3 h-3" />
                        </span>
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Located at the bottom toolbar in Safari on iPhone.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-white/90 border border-sky-100 rounded-xl shadow-2xs">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                        Tap <span className="text-sky-700 font-bold">"Add to Home Screen"</span>
                        <PlusSquare className="w-3.5 h-3.5 text-slate-500" />
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Scroll down the share sheet until you see the plus icon.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-white/90 border border-sky-100 rounded-xl shadow-2xs">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        Tap <span className="font-semibold text-slate-700">"Add"</span> (Top Right)
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        The DS Nexus icon is added to your iPhone home screen!
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Feature Highlights */}
              <div className="pt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 border-t border-sky-100">
                <span className="flex items-center gap-1 text-sky-700">
                  <Zap className="w-3.5 h-3.5" /> Instant Launch
                </span>
                <span className="flex items-center gap-1 text-sky-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Full Screen
                </span>
                <span className="flex items-center gap-1 text-sky-700">
                  <ShieldCheck className="w-3.5 h-3.5" /> Zero Storage Waste
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-sky-100/50 border-t border-sky-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-bold text-xs shadow-sm shadow-sky-600/30 transition-all flex items-center justify-center gap-2"
              >
                <span>Got it, Understood</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallPwaButton;

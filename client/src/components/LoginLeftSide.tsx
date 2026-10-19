import React from "react";
import logo from "../assets/favicon.png";
import { ShieldCheck, Award, Clock } from "lucide-react";

const LoginLeftSide: React.FC = () => {
  return (
    <div className="hidden md:flex w-1/2 bg-slate-950 relative overflow-hidden border-r border-slate-800/80 select-none">
      {/* Subtle Ambient Background Gradients */}
      <div className="absolute -top-28 -left-28 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -right-28 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Decorative Grid Pattern (very subtle) */}
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      <div className="relative z-10 flex flex-col justify-between p-10 lg:p-16 w-full h-full min-h-screen">
        {/* Top Brand Identity Badge */}
        <div className="flex items-center gap-4 bg-white/[0.07] border border-white/15 px-5 py-3 rounded-2xl backdrop-blur-md shadow-lg shadow-black/20 max-w-fit hover:border-white/25 transition-all">
          <img
            src={logo}
            alt="D&S Investment Logo"
            className="w-12 h-12 rounded-xl object-contain bg-white/10 p-1.5 border border-white/20 shrink-0 shadow-inner"
          />
          <div className="flex items-center gap-2.5">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
              D&S Investment
            </span>
            <span className="text-sm text-indigo-400 font-light">•</span>
            <span className="text-sm sm:text-base font-bold text-indigo-400 tracking-wider uppercase">
              DS Nexus
            </span>
          </div>
        </div>

        {/* Center Hero Content */}
        <div className="my-auto py-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Internal Portal Access
          </div>

          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Employee <br />
            <span className="bg-linear-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
              Management System
            </span>
          </h1>

          <p className="text-slate-400 text-base lg:text-lg max-w-md leading-relaxed">
            Streamline your investment workforce operations, track attendance punches, calibrate KPAs, and manage payroll securely.
          </p>

          {/* Micro Trust Indicators */}
          <div className="pt-4 grid grid-cols-3 gap-3 max-w-md border-t border-white/10 text-slate-400 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Smart Punches</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>KPA Appraisals</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Role Protected</span>
            </div>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="text-xs text-slate-400 flex items-center justify-between border-t border-white/10 pt-4">
          <span>
            Developed by{" "}
            <a
              href="https://nitya-devs.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
            >
              Nitya Prakash Pattanaik
            </a>
          </span>
          <span className="text-slate-600 text-[11px]">DS-Nexus v2.4</span>
        </div>
      </div>
    </div>
  );
};

export default LoginLeftSide;
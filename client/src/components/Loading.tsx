interface LoadingProps {
  fullScreen?: boolean;
}

const Loading = ({ fullScreen = false }: LoadingProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 transition-opacity duration-300 ${
        fullScreen
          ? "fixed inset-0 z-50 bg-white/80 backdrop-blur-xs min-h-screen"
          : "w-full py-24 min-h-[50vh]"
      }`}
    >
      <div className="relative flex items-center justify-center">
        <div className="animate-spin w-9 h-9 border-3 border-indigo-600/20 border-t-indigo-600 rounded-full" />
        <div className="absolute w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
      </div>
      <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase animate-pulse">
        Loading...
      </span>
    </div>
  );
};

export default Loading;
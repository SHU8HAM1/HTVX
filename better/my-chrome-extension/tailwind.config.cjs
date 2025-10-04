module.exports = {
  darkMode: 'media',
  content: [
    './index.html',
    './public/**/*.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './build/**/*.html'
  ],
  safelist: [
    'fixed','top-3','left-1/2','-translate-x-1/2','z-[2147483647]','flex','items-center','gap-3','px-4','py-2','backdrop-blur-md','bg-white/20','dark:bg-neutral-800/40','border','border-white/30','dark:border-neutral-700/50','rounded-2xl','shadow-lg','shadow-black/20','text-sm','font-medium','text-neutral-900','dark:text-neutral-100','w-2.5','h-2.5','rounded-full','bg-rose-500','animate-pulse','bg-emerald-500','inline-flex','gap-1.5','px-3','py-1.5','rounded-xl','bg-emerald-500/90','hover:bg-emerald-500','text-white','font-semibold','shadow-sm','focus:outline-none','focus:ring-2','focus:ring-emerald-400','focus:ring-offset-1','focus:ring-offset-white','dark:focus:ring-offset-neutral-800','hidden','bg-rose-500/90','hover:bg-rose-500','px-2.5','rounded-lg','bg-neutral-500/30','hover:bg-neutral-500/40','text-neutral-50','focus:ring-neutral-300/50','dark:focus:ring-neutral-600/60','cursor-move','w-3','h-6','bg-neutral-500/30','hover:bg-neutral-400/40','transition-colors'
  ],
  theme: { extend: {} },
  plugins: []
};

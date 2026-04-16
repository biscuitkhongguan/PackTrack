@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

@layer base {
  body {
    @apply bg-slate-50 text-slate-900;
  }
}

@layer utilities {
  .animate-in {
    animation-duration: 300ms;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    animation-fill-mode: both;
  }

  .fade-in {
    animation-name: fadeIn;
  }

  .zoom-in {
    animation-name: zoomIn;
  }

  .slide-in-from-top {
    animation-name: slideInFromTop;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes zoomIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes slideInFromTop {
    from { transform: translateY(-100%); }
    to { transform: translateY(0); }
  }
}

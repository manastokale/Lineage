/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF9E6",
        ink: "#000000",
        primary: "#FFD600",
        accent: "#F472B6",
        highlight: "#22D3EE",
        "sitcom-purple": "#8a2ce2",
        "sitcom-muted": "#FF6B6B",
        "sitcom-gold": "#FFD700",
        // Character palette
        "c-chandler": "#6C5CE7",
        "c-monica": "#00B894",
        "c-ross": "#E17055",
        "c-rachel": "#E84393",
        "c-joey": "#00CEC9",
        "c-phoebe": "#A29BFE",
      },
      fontFamily: {
        headline: ["Fredoka One", "Public Sans", "sans-serif"],
        body: ["Public Sans", "sans-serif"],
        label: ["Public Sans", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0px",
        lg: "0px",
        xl: "0px",
        full: "9999px",
      },
      boxShadow: {
        hard: "6px 6px 0px 0px rgba(0,0,0,1)",
        "hard-hover": "8px 8px 0px 0px rgba(0,0,0,1)",
        "hard-sm": "4px 4px 0px 0px rgba(0,0,0,1)",
        "hard-xs": "2px 2px 0px 0px rgba(0,0,0,1)",
      },
      borderWidth: {
        heavy: "4px",
      },
    },
  },
  plugins: [],
}

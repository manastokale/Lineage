# Design System Strategy: The Narrative Cartographer

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Narrative Cartographer."** 

This system rejects the clinical, "spreadsheet-style" layout of traditional data visualization. Instead, it treats character relationships as a living, breathing editorial map. We achieve a premium feel through **intentional asymmetry**—where the relationship graph occupies the fluid "canvas" while information panels act as anchored, sophisticated overlays. By utilizing overlapping elements, deep tonal layering, and high-contrast typography, we transform a complex network into an immersive story.

## 2. Colors & Surface Architecture
The palette is rooted in a soft, neutral foundation to ensure character-specific colors act as the primary narrative drivers.

### The "No-Line" Rule
To maintain an high-end editorial aesthetic, **1px solid borders are strictly prohibited for sectioning.** Structural boundaries must be defined solely through background color shifts or subtle tonal transitions.
*   **The Main Canvas:** Uses the `surface` token (`#f5f6f8`).
*   **Interactive Overlays:** Use `surface-container-low` (`#eff1f3`) to distinguish panels from the background.

### Surface Hierarchy & Nesting
Depth is created by stacking surface-container tiers (Lowest to Highest). Treat the UI as a series of physical layers:
*   **Base Layer:** `surface` (The Graph).
*   **Mid Layer:** `surface-container` (The Legend or Navigation).
*   **Top Layer:** `surface-container-lowest` (`#ffffff`) for active Tooltips or Modals to create a "lifted" effect against the neutral background.

### The "Glass & Gradient" Rule
Standard flat colors feel "out-of-the-box." To elevate the experience:
*   **Floating Panels:** Use `surface-container-lowest` with a 12px `backdrop-blur` and 85% opacity to create a frosted glass effect.
*   **Hero Nodes:** Apply a subtle linear gradient from `primary` (`#4640e3`) to `primary-container` (`#9695ff`) to provide visual "soul" to central characters.

## 3. Typography: Editorial Precision
We use **Plus Jakarta Sans** to balance professional clarity with modern personality.

*   **Display & Headline:** Use `display-sm` for character names in hero panels. The generous tracking and scale convey authority.
*   **Titles:** `title-md` and `title-sm` are used for relationship categories (e.g., "Allies," "Antagonists").
*   **Labels:** Use `label-sm` in all-caps with 0.05em letter spacing for metadata (e.g., "LAST SEEN," "FACTION"). This creates an archival, curated look.
*   **Body:** `body-md` is the workhorse for relationship summaries, providing high legibility against `on-surface-variant`.

## 4. Elevation & Depth
We convey hierarchy through **Tonal Layering** rather than traditional structural lines.

*   **The Layering Principle:** Place a `surface-container-lowest` card on top of a `surface-container-low` section. The subtle shift in hex value creates a soft, natural lift.
*   **Ambient Shadows:** For floating relationship summaries, use a shadow with a 32px blur and 6% opacity, tinted with the `on-surface` color. This mimics natural light rather than digital "drop shadows."
*   **The Ghost Border Fallback:** If a node requires an active state highlight, use the `outline-variant` token at **20% opacity**. Never use 100% opaque borders.
*   **Connector Lines:** Relationship lines should use `outline-variant` with a `0.5px` width. For "vibrant" relationships, use a 40% opacity version of the character’s specific color (`primary`, `secondary`, or `tertiary`).

## 5. Components

### Interactive Nodes (Character Points)
*   **Default:** 48px circle using character-specific tokens (e.g., `secondary`).
*   **Hover State:** Expand to 56px with a `surface-tint` outer glow (8px blur, 15% opacity).
*   **Active State:** Use a `0.5rem` (`DEFAULT`) roundedness for the label container that appears alongside the node.

### Relationship Tooltips
*   **Background:** `surface-container-lowest` with glassmorphism.
*   **Content:** No dividers. Use `1.5rem` (`xl`) vertical spacing to separate the character name (`title-lg`) from the relationship description (`body-sm`).

### Sidebar Summaries (Side Panels)
*   **Structure:** Anchored to the right. Use `surface-container-low` to distinguish from the graph.
*   **Character Header:** Overlap a large `display-md` name slightly over a character portrait to break the "grid" and create a bespoke editorial feel.

### Action Chips
*   **Style:** `full` roundedness. 
*   **Color:** `surface-container-high` with `on-surface-variant` text.
*   **Interaction:** On tap, shift to `primary-container` with `on-primary-container` text.

### Character Input Fields
*   **Visuals:** Forgo the box. Use a `surface-variant` bottom-only highlight (2px) that expands to `primary` on focus.
*   **Typography:** Labels use `label-md` in `outline` color, shifting to `primary` when active.

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts where the sidebar and the graph overlap slightly to create depth.
*   **Do** use `secondary-container` and `tertiary-container` for background washes behind text to categorize character types.
*   **Do** allow the `background` (`#f5f6f8`) to breathe; negative space is a premium asset.

### Don't:
*   **Don't** use 1px solid borders to separate the graph from the controls.
*   **Don't** use pure black (#000000) for text; always use the `on-surface` (`#2c2f31`) or `on-surface-variant` (`#595c5e`) for a softer, high-end feel.
*   **Don't** use "default" drop shadows. If it looks like a standard UI element, it needs more diffusion and less opacity.
*   **Don't** use divider lines in lists. Use the `0.75rem` (`md`) spacing scale to create separation through "white space" instead.
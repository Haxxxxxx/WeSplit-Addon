# WeSplit Addon Styles

This folder contains the organized CSS styles for the WeSplit browser addon.

## Structure

```
styles/
├── index.css       # Main entry - imports all style files
├── base.css        # Fonts, CSS variables, reset, base element styles
├── components.css  # Reusable component classes (buttons, cards, inputs)
├── utilities.css   # Animations, scrollbar, text utilities, helpers
└── README.md       # This file
```

## Usage

All styles are imported via `main.tsx`:

```tsx
import './styles/index.css'
```

## Customization Guide

### Colors (Brand)

Colors are defined in two places for compatibility:
1. **CSS Variables** in `base.css` - For CSS-only usage
2. **Tailwind Config** in `tailwind.config.js` - For utility classes

Primary colors:
- `--green` / `text-green` / `bg-green`: `#A5EA15`
- `--greenBlue` / `text-greenBlue`: `#53EF97`
- `--bg-color` / `bg-bg`: `#020300`

### Fonts

Two font families are used:
- **Satoshi** - Body text, UI elements (`font-satoshi`)
- **Archivo SemiExpanded** - Headings, buttons, numbers (`font-archivo`)

Font files are in `src/assets/fonts/`.

### Components

Key CSS classes in `components.css`:

| Class | Description |
|-------|-------------|
| `.btn-primary` | Green gradient button with glow |
| `.btn-secondary` | Transparent button with border |
| `.glass-card` | Frosted glass card with hover effect |
| `.icon-container` | Circular icon background |
| `.gradient-text` | Green gradient text |
| `.input-field` | Styled input with focus state |

### Tailwind Classes

Most styling uses Tailwind utilities. Custom colors:

```
bg-white5, bg-white10, bg-white20, bg-white30
text-white50, text-white60, text-white70, text-white80
bg-green, text-green, bg-green10
bg-error, text-error
```

### Animations

Available animation classes in `utilities.css`:

- `.animate-fadeIn` - Fade in with slide up
- `.animate-pulse` - Pulsing opacity
- `.animate-slideUp` / `.animate-slideDown` - Slide animations
- `.animate-scaleIn` - Scale with fade
- `.skeleton` - Loading skeleton shimmer

### Adding New Styles

1. **Component-specific**: Add to `components.css`
2. **Utility/helper**: Add to `utilities.css`
3. **Base/global**: Add to `base.css`
4. **Tailwind extend**: Modify `tailwind.config.js`

### Best Practices

1. Prefer Tailwind utility classes over custom CSS
2. Use CSS variables for colors to ensure consistency
3. Keep component classes reusable and generic
4. Document any new CSS classes in this README

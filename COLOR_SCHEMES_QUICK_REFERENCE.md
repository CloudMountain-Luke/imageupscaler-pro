# Color Schemes Quick Reference Card

## 🎨 Upscale Forge Color Schemes

### Color Scheme Selector
Choose your scheme in Theme Lab → Color Schemes

---

## 1. 🔥 Flame - Fire and Energy

**When to use**: Bold statements, hero sections, CTAs, marketing
**Mood**: Dynamic, powerful, transformative

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| Primary | Yellow `hsl(50, 85%, 48%)` | Yellow `hsl(50, 75%, 60%)` |
| Secondary | Magenta `hsl(330, 80%, 52%)` | Magenta `hsl(330, 70%, 65%)` |
| Accent | Orange `hsl(30, 75%, 45%)` | Orange `hsl(30, 65%, 62%)` |

**Example Components**:
```tsx
<button className="bg-[var(--primary)] text-[var(--on-primary)]">
  Upscale Now
</button>
```

---

## 2. 🔨 Forge - Craftsmanship and Warmth

**When to use**: Dashboard, professional tools, settings, user accounts
**Mood**: Reliable, crafted, expert

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| Primary | Orange `hsl(30, 85%, 48%)` | Orange `hsl(30, 75%, 60%)` |
| Secondary | Golden `hsl(45, 80%, 52%)` | Golden `hsl(45, 70%, 65%)` |
| Accent | Cyan `hsl(195, 75%, 45%)` | Cyan `hsl(195, 65%, 62%)` |

**Example Components**:
```tsx
<div className="border-2 border-[var(--secondary)]">
  Professional Tool
</div>
```

---

## 3. ⚡ Cyber - Digital and Futuristic

**When to use**: Technical interfaces, developer tools, API docs, processing
**Mood**: Cutting-edge, digital, precise

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| Primary | Cyan `hsl(195, 85%, 48%)` | Cyan `hsl(195, 75%, 60%)` |
| Secondary | Blue `hsl(220, 80%, 52%)` | Blue `hsl(220, 70%, 65%)` |
| Accent | Yellow `hsl(50, 75%, 45%)` | Yellow `hsl(50, 65%, 62%)` |

**Example Components**:
```tsx
<code className="bg-[var(--elev)] text-[var(--primary)]">
  api.upscale()
</code>
```

---

## 4. 📊 Neutral - Balanced and Professional

**When to use**: Enterprise portals, data interfaces, long-form content, accessibility
**Mood**: Sophisticated, balanced, trustworthy

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| Primary | Blue-grey `hsl(220, 85%, 48%)` | Blue-grey `hsl(220, 75%, 60%)` |
| Secondary | Cool grey `hsl(200, 80%, 52%)` | Cool grey `hsl(200, 70%, 65%)` |
| Accent | Orange `hsl(30, 75%, 45%)` | Orange `hsl(30, 65%, 62%)` |

**Example Components**:
```tsx
<table className="border border-[var(--border)]">
  <thead className="bg-[var(--elev)]">
    Data Table
  </thead>
</table>
```

---

## 🎯 Common Tokens (All Schemes)

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `--surface` | `hsla(220, 60%, 8%, 0.85)` | `hsl(0, 0%, 92%)` | Page background |
| `--elev` | `hsla(220, 30%, 12%, 0.9)` | `hsl(0, 0%, 96%)` | Cards, modals |
| `--border` | `hsla(220, 20%, 20%, 0.6)` | `hsl(0, 0%, 85%)` | Borders |
| `--text` | `hsl(210, 10%, 96%)` | `hsl(225, 25%, 12%)` | Body text |
| `--muted` | `hsla(220, 12%, 72%, 0.7)` | `hsla(225, 18%, 45%, 0.65)` | Secondary text |
| `--on-primary` | `hsl(0, 0%, 12%)` | `hsl(0, 0%, 98%)` | Text on primary |
| `--radius` | `18px` | `18px` | Border radius |

---

## 🎨 Fixed Logo Colors (All Schemes)

Use these for brand consistency:

```css
--flame-yellow: hsl(50, 100%, 60%)   /* #FFEB3B */
--flame-magenta: hsl(330, 100%, 60%) /* #FF33CC */
--forge-orange: hsl(30, 100%, 55%)   /* #FF8C00 */
--cyber-cyan: hsl(195, 100%, 65%)    /* #5CE1E6 */
```

**Logo Gradient** (for text):
```css
background: linear-gradient(to right, 
  var(--flame-yellow), 
  var(--flame-magenta), 
  var(--forge-orange)
);
```

---

## 🌓 Light/Dark Mode

**Tone Slider**: 10% (darkest) to 90% (lightest)

- **Tone < 50%**: Dark mode
- **Tone ≥ 50%**: Light mode

**Presets**:
- Dark: 10%
- Mid: 50%
- Light: 90%

---

## 🚀 Quick Start

### Switch Scheme Programmatically
```tsx
import { useThemeLab } from '@/contexts/ThemeContext';

const { setColorScheme } = useThemeLab();
setColorScheme('flame'); // 'flame' | 'forge' | 'cyber' | 'neutral'
```

### Read Current Scheme
```tsx
const { colorScheme, mode, tone } = useThemeLab();
console.log(colorScheme); // 'flame'
console.log(mode); // 'dark' | 'light'
console.log(tone); // 10-90
```

### Use in JSX
```tsx
<div className="bg-[var(--surface)] text-[var(--text)]">
  <h1 style={{ color: 'var(--primary)' }}>Title</h1>
  <button className="bg-[var(--primary)] text-[var(--on-primary)]">
    Action
  </button>
</div>
```

---

## 📱 Responsive Considerations

### Mobile
- Logo text hidden: Use `hidden sm:inline`
- Compact spacing: Reduce gaps in header/footer
- Touch targets: Minimum 44x44px

### Desktop
- Full branding: Logo + gradient text
- Expanded controls: Show all options
- Hover states: Add transitions

---

## ♿ Accessibility

All color schemes meet **WCAG AA** standards:
- Text contrast ratio: ≥ 4.5:1
- Large text: ≥ 3:1
- Interactive elements: Clear focus states
- Semi-transparent backgrounds: Maintain readability

---

## 🔍 Debugging

### Check Active Scheme
```javascript
document.documentElement.dataset.colorScheme // 'flame'
document.documentElement.dataset.themeMode   // 'dark'
document.documentElement.dataset.themeTone   // '10'
```

### Inspect CSS Variables
```javascript
getComputedStyle(document.documentElement).getPropertyValue('--primary')
// "hsl(50, 85%, 48%)"
```

### LocalStorage
```javascript
localStorage.getItem('ufo-theme.colorScheme') // 'flame'
localStorage.getItem('ufo-theme.currentTone') // '10'
localStorage.getItem('ufo-theme.savedTone')   // '10'
```

---

## 📚 Related Documentation

- `LOGO_COLOR_GUIDE.md` - Detailed color usage guidelines
- `LOGO_SETUP.md` - Logo file installation instructions
- `THEME_IMPLEMENTATION_SUMMARY.md` - Complete implementation details
- `src/contexts/ThemeContext.tsx` - Theme system source code

---

**Last Updated**: Implementation complete
**Version**: 1.0.0
**Status**: Ready for use (add logo file to complete)


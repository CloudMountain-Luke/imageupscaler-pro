# Upscale Forge - Logo Color Guide

## Logo Color Analysis

The Upscale Forge logo contains vibrant, energetic colors that create a powerful visual identity:

### Primary Colors

1. **Flame Yellow** - `hsl(50, 100%, 60%)` / `#FFEB3B`
   - Bright, energetic yellow from the flame
   - Represents heat, energy, and transformation

2. **Flame Magenta** - `hsl(330, 100%, 60%)` / `#FF33CC`
   - Vibrant magenta/pink in the flame gradient
   - Adds drama and intensity

3. **Forge Orange** - `hsl(30, 100%, 55%)` / `#FF8C00`
   - Warm orange from the cloud/badge outline
   - Represents forge fire and craftsmanship

4. **Cyber Cyan** - `hsl(195, 100%, 65%)` / `#5CE1E6`
   - Cool cyan/blue from the pixelated text
   - Digital, technological aesthetic

5. **Dark Navy** - `hsla(220, 60%, 8%, 0.85)` / Semi-transparent dark
   - Deep navy from the circular background
   - Provides depth and grounding

## Four Color Scheme Variations

### 1. Flame (Default)
**Theme**: Fire and Energy
- **Primary**: Yellow `hsl(50, 85-75%, lightness)`
- **Secondary**: Magenta `hsl(330, 80-70%, lightness)`
- **Accent**: Orange `hsl(30, 75-65%, lightness)`
- **Best for**: Bold, energetic UI with high contrast
- **Mood**: Dynamic, powerful, transformative

### 2. Forge
**Theme**: Craftsmanship and Warmth
- **Primary**: Orange `hsl(30, 85-75%, lightness)`
- **Secondary**: Golden Yellow `hsl(45, 80-70%, lightness)`
- **Accent**: Cyan `hsl(195, 75-65%, lightness)`
- **Best for**: Professional, warm interface
- **Mood**: Reliable, crafted, expert

### 3. Cyber
**Theme**: Digital and Futuristic
- **Primary**: Cyan `hsl(195, 85-75%, lightness)`
- **Secondary**: Blue `hsl(220, 80-70%, lightness)`
- **Accent**: Yellow `hsl(50, 75-65%, lightness)`
- **Best for**: Modern, tech-focused design
- **Mood**: Cutting-edge, digital, precise

### 4. Neutral
**Theme**: Balanced and Professional
- **Primary**: Blue-grey `hsl(220, 85-75%, lightness)`
- **Secondary**: Cool grey `hsl(200, 80-70%, lightness)`
- **Accent**: Warm orange `hsl(30, 75-65%, lightness)`
- **Best for**: Professional, enterprise applications
- **Mood**: Sophisticated, balanced, trustworthy

## Light vs Dark Mode Implementation

### Light Mode
- **Surface**: Light greys (88-96% lightness)
- **Background**: `hsl(0, 0%, 92%)` - Very light grey
- **Elevated surfaces**: `hsl(0, 0%, 96%)` - Nearly white
- **Borders**: `hsl(0, 0%, 85%)` - Medium-light grey
- **Text**: `hsl(225, 25%, 12%)` - Very dark, almost black

### Dark Mode
- **Surface**: Semi-transparent navy `hsla(220, 60%, 8-12%, 0.85)`
  - Retains color tint while adapting to different backgrounds
  - Creates depth without being pure black
- **Elevated surfaces**: `hsla(220, 30%, 12-16%, 0.9)`
- **Borders**: `hsla(220, 20%, 20-25%, 0.6)` - Subtle, semi-transparent
- **Text**: `hsl(210, 10%, 96%)` - Off-white

## Usage Guidelines

### When to Use Each Scheme

1. **Flame**: 
   - Hero sections
   - Call-to-action buttons
   - High-impact areas
   - Marketing pages

2. **Forge**:
   - Dashboard interfaces
   - Professional tools
   - User account areas
   - Settings pages

3. **Cyber**:
   - Technical interfaces
   - Developer tools
   - API documentation
   - Processing visualizations

4. **Neutral**:
   - Enterprise portals
   - Data-heavy interfaces
   - Long-form content
   - Accessibility-focused designs

### Logo Placement

- **Header**: Logo at 48px height with optional gradient text
- **Footer**: Logo at 64px height with full branding
- **Favicon**: Use the flame icon isolated
- **Loading states**: Animated flame with gradient

### Accessibility Notes

- All color combinations meet WCAG AA standards
- Text on primary colors uses high-contrast on-primary token
- Focus rings adapt to the current color scheme
- Semi-transparent backgrounds ensure readability over any content

## CSS Custom Properties

The theme system provides these CSS variables:

```css
--primary          /* Main brand color based on scheme */
--secondary        /* Supporting brand color */
--accent          /* Accent/highlight color */
--surface         /* Main background */
--elev            /* Elevated surface (cards, modals) */
--border          /* Border color */
--text            /* Body text */
--muted           /* Secondary text */
--on-primary      /* Text color on primary backgrounds */
--focus-ring      /* Focus outline */
--shadow-1        /* Main shadow */
--shadow-2        /* Colored shadow */
--radius          /* Border radius (18px) */

/* Logo-specific colors (fixed) */
--flame-yellow    /* hsl(50, 100%, 60%) */
--flame-magenta   /* hsl(330, 100%, 60%) */
--forge-orange    /* hsl(30, 100%, 55%) */
--cyber-cyan      /* hsl(195, 100%, 65%) */
```

## Implementation

Users can switch between the four color schemes using the Theme Lab controls. The tone slider (10-90%) adjusts lightness while maintaining the hue relationships defined by each scheme.

**Dark mode**: tone < 50%
**Light mode**: tone ≥ 50%


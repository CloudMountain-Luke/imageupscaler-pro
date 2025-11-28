# Logo Setup Instructions

## Required Logo File

The application is now configured to use the Upscale Forge logo. You need to add the logo file to complete the setup.

### Steps to Add Logo

1. **Prepare the logo file**:
   - Use the PNG version of the Upscale Forge logo (the one with the flame on light background works best)
   - Recommended: Use a transparent background version if available
   - The logo should show the flame and optional text

2. **Add to the project**:
   ```bash
   # Copy your logo file to the public directory
   cp path/to/your/upscale-forge-logo.png public/upscale-forge-logo.png
   ```

3. **File specifications**:
   - **Filename**: `upscale-forge-logo.png`
   - **Location**: `/public/upscale-forge-logo.png`
   - **Recommended dimensions**: At least 200px height for quality
   - **Format**: PNG with transparent background (preferred)
   - **File size**: Optimize to under 100KB

### Logo Variations (Optional)

For better dark/light mode support, you can provide two versions:

```bash
# Light background version (dark logo)
public/upscale-forge-logo-light.png

# Dark background version (light/colored logo)
public/upscale-forge-logo-dark.png
```

If you provide both, update the Header and Footer components to use theme-aware logo switching:

```tsx
// In Header.tsx and Footer.tsx
const logoSrc = mode === 'dark' 
  ? '/upscale-forge-logo-dark.png' 
  : '/upscale-forge-logo-light.png';
```

## Current Logo Usage

The logo appears in two places:

1. **Header** (`src/components/Header.tsx`):
   - Height: 48px (h-12)
   - Displays with gradient text "Upscale Forge" on larger screens
   - Clickable - navigates to home/upscaler

2. **Footer** (`src/components/Footer.tsx`):
   - Height: 64px (h-16)
   - Displays with gradient text and tagline
   - Part of the branding section

## Gradient Text Styling

The "Upscale Forge" text uses a gradient based on logo colors:

```css
bg-gradient-to-r from-[hsl(50,100%,60%)] via-[hsl(330,100%,60%)] to-[hsl(30,100%,55%)]
```

This creates a yellow → magenta → orange gradient matching the flame colors.

## Fallback

If the logo file is not found, browsers will show:
- The alt text: "Upscale Forge Logo"
- A broken image icon
- The gradient text will still display

To avoid this, ensure the logo file exists before running the application.

## Testing

After adding the logo:

```bash
# Build the application
npm run build

# Or run in development
npm run dev

# Check that logo loads in browser
# Open DevTools → Network tab → Look for upscale-forge-logo.png
# Should return 200 status, not 404
```

## Logo Colors Reference

The logo uses these primary colors:
- **Yellow**: `hsl(50, 100%, 60%)` - #FFEB3B
- **Magenta**: `hsl(330, 100%, 60%)` - #FF33CC
- **Orange**: `hsl(30, 100%, 55%)` - #FF8C00
- **Cyan**: `hsl(195, 100%, 65%)` - #5CE1E6

These colors are now integrated into the theme system as the 4 color scheme variations (Flame, Forge, Cyber, Neutral).


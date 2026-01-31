# Logo Assets

The following logo assets need to be added for proper SEO and social sharing.

## Required Files (Critical for SEO)

| File | Dimensions | Purpose | Priority |
|------|------------|---------|----------|
| **og-image.png** | 1200x630 | Social media previews (Twitter, Facebook, Discord) | Critical |
| **hodl-logo.png** | 180x180 | Apple touch icon, app icons | High |

## Current Status

- `favicon.ico` - Multi-size favicon (16x16, 32x32, 48x48)
- `favicon.svg` - Vector favicon (modern browsers, scalable)
- `hodl-logo.svg` - Vector logo for Apple touch icon (SVG fallback)

## Design Specifications

### og-image.png (1200x630)
Content should include:
- "Hodl.fun" logo/text prominently displayed
- Tagline: "Token Launchpad on Push Chain"
- Background: Dark (#080808)
- Accent: Push Purple (#D946EF)
- Consider including: bonding curve visualization, token icons

### hodl-logo.png (180x180)
- Simple "H" or Hodl.fun logo
- Works on light and dark backgrounds
- High contrast for visibility

### favicon.ico
- Convert from favicon.svg using favicon.io
- Include 16x16 and 32x32 sizes

## Design Guidelines

- Primary color: hsl(292, 84%, 61%) - #D946EF (Push Purple)
- Background: Dark (#080808 or transparent)
- Font: System font stack or bold sans-serif
- Keep it simple and recognizable at small sizes

## Generating Assets

### Quick: Convert existing SVGs to PNG

```bash
# Using ImageMagick (install with: brew install imagemagick)
convert -background none -resize 180x180 hodl-logo.svg hodl-logo.png

# Or use CloudConvert, Convertio, or any online SVG to PNG converter
```

### Design og-image.png

Recommended tools:
- [Figma](https://figma.com) / [Canva](https://canva.com) - Design og-image.png (1200x630)
- [RealFaviconGenerator](https://realfavicongenerator.net/) - Generate all platform icons from logo

## Verification

After adding images, verify:
1. Social preview: https://www.opengraph.xyz/
2. Twitter card: https://cards-dev.twitter.com/validator
3. Favicon: Check in multiple browsers

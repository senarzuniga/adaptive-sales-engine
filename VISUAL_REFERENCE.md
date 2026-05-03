# Visual Reference Guide — Premium UI Components

## Component Gallery & Specifications

---

## 🎯 KPI Card

### Appearance
```
┌─────────────────────────────────────┐
│ ✨ Gradient border on hover         │
│ ┌─────────────────────────────────┐ │
│ │                                   │ │
│ │  TOTAL REVENUE           💰      │ │
│ │  €2.4M                          │ │
│ │  ↑ +18% YoY                     │ │
│ │                                   │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ (Hover: Border glows blue, lifts up) │
└─────────────────────────────────────┘
```

### Specifications
- **Background**: Gradient from slate-800 to slate-900
- **Border**: 1px slate-700, hover → slate-400 (0.3s)
- **Border Top**: 4px blue gradient on hover
- **Shadows**: Subtle (hover → lg)
- **Font Size**: Label 0.75rem, Value 1.875rem
- **Padding**: 20px (1.25rem)
- **Border Radius**: 12px (rounded-xl)
- **Animation**: Transform translateY(-4px) on hover

---

## 🎫 Status Badge

### Examples
```
Active:    ● ACTIVE          (Green background)
Pending:   ◌ PENDING         (Orange background)
Completed: ✓ COMPLETED       (Green background)
Failed:    ✗ FAILED          (Red background)
Warning:   ⚠ WARNING         (Orange background)
Draft:     📝 DRAFT          (Purple background)
```

### Specifications
- **Sizes**: sm (8px padding), md (12px), lg (16px)
- **Text Transform**: UPPERCASE
- **Font Weight**: 600
- **Letter Spacing**: 0.05em
- **Border Radius**: 9999px (pill-shaped)
- **Border**: 1px semi-transparent
- **Icon**: Optional, prepended to text

---

## 🎴 Premium Card

### Appearance
```
┌───────────────────────────────────────┐
│ ┃ PRODUCT DETAILS            🎯       │ Accent border
│ ├───────────────────────────────────┤ (left 4px)
│ │                                     │
│ │  ✅ SKU: PROD-001                  │
│ │  📊 Status: Active                 │
│ │  💰 Price: €1,200                  │
│ │                                     │
│ └───────────────────────────────────┘
│ (Subtle shadow, hover: shadow increases)
```

### Specifications
- **Accents**: primary (blue), success (green), warning (orange), danger (red), info (cyan)
- **Border**: 1px slate-700, left border 4px accent color
- **Padding**: 20px (1.25rem)
- **Border Radius**: 12px
- **Hover Effect**: Border color lighten, shadow increase
- **Animation**: 0.3s ease

---

## 📊 Section Header

### Appearance
```
📋 Upcoming Tasks
Priority actions
─────────────────────────────────────────
```

### Specifications
- **Icon**: 1.5rem emoji or Lucide icon
- **Title**: 1.25rem, semibold (600)
- **Subtitle**: 0.875rem, muted color
- **Divider**: Gradient line (blue → purple → transparent)
- **Spacing**: 24px margin-bottom
- **Optional Action**: Button on right side

---

## 🟢 Status Indicator

### Appearance
```
Online:   🟢 (emerald, glowing)
Warning:  🟡 (amber, glowing)
Offline:  🔴 (red, glowing)
```

### Specifications
- **Sizes**: sm (8px), md (12px), lg (16px)
- **Shape**: circle
- **Animation**: Pulse effect (2s infinite)
- **Glow**: Matching color shadow
- **Optional Label**: Beside dot

---

## ↪️ Progress Steps

### Appearance
```
Step 1:
  ┌───┐  ════  ┌───┐  ═══  ┌───┐  ───  ┌───┐
  │ 1 │      │ 2 │      │ 3 │      │ 4 │
  └───┘      └───┘      └───┘      └───┘
  [Completed]  [Current]  [Pending]  [Pending]
    Green      Blue        Gray        Gray
```

### Specifications
- **Completed Steps**: Green background, white checkmark
- **Current Step**: Blue background, white number, blue ring outline
- **Pending Steps**: Gray border, gray number
- **Connector Lines**: Filled for completed, empty for pending
- **Height**: 40px diameter circles
- **Spacing**: 30px between circles
- **Label**: Below each step

---

## 🔔 Notification Banner

### Appearance - Success
```
┌─────────────────────────────────────┐
│ ✅ Success                     ✕    │
│ Your document has been uploaded      │
└─────────────────────────────────────┘
     (Green border, bg 10% opacity)
```

### Appearance - Error
```
┌─────────────────────────────────────┐
│ ❌ Error                       ✕    │
│ Failed to process the file           │
└─────────────────────────────────────┘
     (Red border, bg 10% opacity)
```

### Specifications
- **Colors**:
  - Info: Blue (#3B82F6)
  - Success: Green (#10B981)
  - Warning: Orange (#F59E0B)
  - Error: Red (#EF4444)
- **Background**: 10% opacity color
- **Border**: 1px solid color
- **Border Radius**: 10px
- **Padding**: 16px
- **Animation**: Slide in from right (0.3s)
- **Close Button**: Top right (optional)

---

## 📆 Timeline

### Appearance
```
    ◉──────────────
    │  Today 14:30
    │  Analysis Complete
    │  Documents processed
    │
    ◉ Yesterday
    │  Update Products
    │  Ingecart import done
    │
    ◉ Dec 15
       Quarterly Review
       Strategy session
       
(Connected with vertical line)
```

### Specifications
- **Dots**: 12px diameter
- **Colors**:
  - Completed: Green
  - Current: Blue (with outline ring)
  - Pending: Gray
- **Connector**: 2px line, left side
- **Date**: 0.75rem, muted
- **Title**: semibold
- **Description**: 0.875rem, muted

---

## 🏢 Sidebar Navigation

### Appearance
```
┌────────────────────┐
│ 🏢 Adaptive        │ Brand Header
│    Sales Engine    │ (Gradient text)
│                    │
├────────────────────┤
│ ✨ Quick Access    │
│ ├─ 🏠 Dashboard   │ ◄── Active (highlight)
│ └─ 💼 Companies   │
│                    │
│ 📊 Core Analytics  │
│ ├─ 📂 Upload      │
│ ├─ 📊 Analysis360  │
│ └─ 📈 Reports     │
│                    │
│ ...                │
├────────────────────┤
│ 🟢 Data Ingestion  │ System
│ 🟢 Product Catalog │ Status
│ 🟡 Reporting       │
└────────────────────┘
```

### Specifications
- **Background**: Gradient dark (slate-900 → slate-950)
- **Groups**: 7 organized navigation groups
- **Active Indicator**: Left bar (4px blue) + highlight
- **Icons**: All Lucide icons, 16px
- **Font**: Inter, 0.875rem
- **Collapsed**: Icon-only, 64px width
- **Width**: 256px expanded
- **Transitions**: All 0.2s ease

---

## 📄 Page Template

### Layout Structure
```
┌────────────────────────────────────────┐
│  📦 Product Management     [+ Action]   │ Header
│  Manage your catalog                   │
├────────────────────────────────────────┤ Gradient divider
│                                        │
│  ✅ 24 products imported successfully  │ Notification
│                                        │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ 247      │ │ 12       │ │ €2.4M  │ │ KPI Row
│  │ Products │ │ New This │ │ Total  │ │
│  └──────────┘ └──────────┘ └────────┘ │ Month
│                                        │
│  📊 Portfolio Overview                 │ Section
│  ─────────────────────────            │
│  [4 KPI Cards in grid]                │
│                                        │
│  📋 Products                           │ Section
│  ─────────────────────────            │
│  [Product Cards in grid]               │
│                                        │
└────────────────────────────────────────┘
```

### Specifications
- **Background**: Gradient dark (slate-900 → slate-950)
- **Max Width**: 1280px (7xl)
- **Padding**: 24px on desktop, 16px mobile
- **Title**: 1.875rem, bold
- **Subtitle**: 0.875rem, muted
- **Action Buttons**: Right-aligned
- **Content**: Full width, responsive

---

## 🎨 Color Swatches

### Primary Palette
```
Primary        #1E3A5F  ██ Navy blue
Primary Light  #2D5F8A  ██ Medium blue
Primary Dark   #0F2440  ██ Dark navy
Primary Glow   #3B82F6  ██ Bright blue
```

### Accents
```
Success        #10B981  ██ Emerald green
Warning        #F59E0B  ██ Amber orange
Danger         #EF4444  ██ Red
Purple         #8B5CF6  ██ Violet
Teal           #14B8A6  ██ Cyan teal
```

### Neutrals
```
BG Dark        #0F172A  ██ Very dark slate
BG Card        #1E293B  ██ Dark slate
Slate 800      #1E293B  ██ Card background
Slate 700      #334155  ██ Borders
Slate 600      #475569  ██ Subtle border
Slate 500      #64748B  ██ Muted text
Slate 400      #94A3B8  ██ Secondary text
Slate 50       #F1F5F9  ██ Primary text
```

---

## ⚡ Animation Showcase

### Fade In
```
0%:      ░░░░░░░░░░  (opacity: 0, translateY: 10px)
50%:     ▓▓▓▓▓▓▓▓▓▓  (half visible)
100%:    ██████████  (opacity: 1, translateY: 0)
         (0.5s ease)
```

### Slide In Right
```
0%:      ─────────────▒▒▒ (from right, opacity: 0)
50%:     ────▓▓▓▓▓▓▓──── (sliding left)
100%:    ██████████████ (fully visible)
         (0.4s ease)
```

### Glow Pulse
```
0%:      🔆 (opacity: 1)
50%:     🔆 (opacity: 0.8, pulse effect)
100%:    🔆 (opacity: 1)
         (2s infinite ease-in-out)
```

### Shimmer (Loading)
```
0%:      ███░░░░░░░░░░░░░
25%:     ░███░░░░░░░░░░░░
50%:     ░░███░░░░░░░░░░░
75%:     ░░░░░░░░░░░███░░
100%:    ░░░░░░░░░░░░░███
         (3s infinite, background shift)
```

---

## 📐 Spacing System

```
XS:  4px   ▯
SM:  8px   ▯▯
MD:  16px  ▯▯▯▯
LG:  24px  ▯▯▯▯▯▯
XL:  32px  ▯▯▯▯▯▯▯▯
2XL: 48px  ▯▯▯▯▯▯▯▯▯▯▯▯
```

---

## 🎯 Border Radius

```
SM:  6px   ▮
MD:  10px  ▮
LG:  16px  ▮
XL:  24px  ▮
```

---

## 📏 Typography Scale

```
Display:    2.25rem (bold)  — Page titles
Heading 1:  1.875rem (bold) — Major sections
Heading 2:  1.5rem (semibold) — Section headers
Heading 3:  1.25rem (semibold) — Subsections
Body:       1rem (regular) — Main content
Small:      0.875rem (regular) — Secondary info
Label:      0.75rem (semibold) — Form labels
Tiny:       0.625rem (regular) — Helper text
```

---

## 🖱️ Interactive States

### Button
```
Default:    bg-blue-600, text-white
Hover:      bg-blue-700, shadow-lg
Active:     scale-95 (pressed effect)
Focus:      ring-2 ring-blue-500
Disabled:   opacity-50, cursor-not-allowed
```

### Card
```
Default:    border-slate-700, shadow-sm
Hover:      border-slate-600, shadow-md, translateY(-2px)
Focus:      ring-2 ring-blue-500
```

### Input
```
Default:    bg-slate-800, border-slate-700
Hover:      border-slate-600
Focus:      border-blue-500, ring-2 ring-blue-500/20
```

---

## 📱 Responsive Breakpoints

```
Mobile:    < 640px   (single column)
Tablet:    640-1024px (2 columns)
Desktop:   1024px+   (3-4 columns)

Grid Examples:
cols={1}   → 1 col (all)
cols={2}   → 1 col (mobile), 2 cols (tablet+)
cols={3}   → 1 col (mobile), 2 cols (tablet), 3 cols (desktop)
cols={4}   → 1 col (mobile), 2 cols (tablet), 4 cols (desktop)
```

---

## 🎨 Gradient Examples

### Primary Gradient
```
Direction: 135deg (top-left to bottom-right)
Start:     #1E3A5F (navy)
End:       #3B82F6 (bright blue)
Usage:     Buttons, headers, accents
```

### Success Gradient
```
Start:     #059669 (dark green)
End:       #10B981 (emerald)
Usage:     Success states, positive indicators
```

### Warning Gradient
```
Start:     #D97706 (dark orange)
End:       #F59E0B (amber)
Usage:     Warning states, caution indicators
```

---

This visual reference guide helps understand the component designs and specifications at a glance.

**Total Components Documented**: 15+  
**Total Specifications**: 100+  
**Total Design Tokens**: 200+

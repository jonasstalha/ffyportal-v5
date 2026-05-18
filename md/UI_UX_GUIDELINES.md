# 🌟 UI/UX Guidelines — FruitsForYou Agro-Avocado Platform

## Purpose & Context

Our platform serves three primary user groups with distinct needs:
- 🌱 **Farm Managers:** Mobile-friendly data entry for harvest logs and chemical applications
- 🚚 **Logistics Coordinators:** Real-time shipment tracking and documentation
- 🔍 **QA/QC Teams:** Complex quality control forms and lab result management

### Core Objectives
- Standardize the user experience across all platform modules
- Ensure critical information is accessible within three clicks
- Optimize complex workflows for mobile and desktop use
- Maintain clear data visualization for traceability records

### Content Contract (Inputs/Outputs)

#### Inputs
- User actions and permissions based on role
- Real-time data states (temperature logs, QC results)
- Document uploads (certificates, lab reports)
- Form submissions (harvest data, quality checks)

#### Outputs
- Role-specific dashboards with prioritized information
- Clear status indicators for lot tracking
- Accessible error messages and validation feedback
- Export-ready reports and documentation

## 🎨 Design System

### Color Tokens

#### Base Colors
- Primary: `--color-primary` (Tailwind: bg-emerald-600) - Brand identity
- Secondary: `--color-accent` (Tailwind: bg-amber-400) - Interactive elements
- Neutral: Grays for surfaces (Tailwind: gray-50..900)

#### Status Colors (Industry-Specific)
- `--status-optimal` (Tailwind: bg-green-500) - Perfect quality, compliant
- `--status-acceptable` (Tailwind: bg-blue-500) - Within tolerance
- `--status-warning` (Tailwind: bg-amber-500) - Requires attention
- `--status-critical` (Tailwind: bg-red-500) - Quality issue, non-compliant
- `--temp-alert` (Tailwind: bg-rose-600) - Temperature breach

### Typography System

#### Fonts
- Headers: Inter Semi-bold (Clear hierarchy for dashboards)
- Body: Inter Regular (Optimal readability for forms)
- Data/Metrics: Roboto Mono (Clear number display)

#### Size Scale (rem, base: 16px)
- Micro (tooltips): 0.75rem
- Body: 1rem
- Section headers: 1.25rem
- Page titles: 1.5rem
- Dashboard numbers: 2rem

### Spacing & Layout
- Grid: 4px base unit
- Spacing scale: 4px * [1,2,3,4,6,8]
- Form field spacing: 16px (4 * 4px)
- Section padding: 24px (6 * 4px)
- Card radius: 6px (Tailwind: rounded-md)

Accessibility (A11y)

- All interactive controls must be reachable via keyboard and have visible focus states (outline or ring).
- Use semantic HTML: buttons, labels, nav, main, header, footer, table where appropriate.
- Provide aria-labels and roles where semantics are not enough.
- Color contrast: text must meet WCAG AA (4.5:1 for normal text). Use bold text or larger sizes to improve contrast when needed.
- Alt text for images and descriptive labels for icons.

Layout & spacing

- Use a clear visual hierarchy: headers > subheaders > body.
- Keep content width comfortable for reading: 680–880px for text-heavy pages.
- Consistent padding on containers: typically p-4 / p-6 depending on density.
- Group related actions together and separate destructive actions from primary actions.

## 📝 Forms & Data Entry

### Form Organization
- Group related fields logically (e.g., all temperature readings together)
- Use progressive disclosure for complex QC forms
- Implement smart defaults based on lot type
- Enable bulk data entry for batch processing

### Field Types & Validation
- **Required Fields:** Mark clearly with red asterisk (*)
- **Numeric Inputs:** 
  - Show valid ranges (e.g., "Temperature: 0-30°C")
  - Implement unit conversion where needed
  - Use steppers for precise adjustments
- **Date/Time Fields:**
  - Default to current date/time for logs
  - Validate against lot timeline (e.g., harvest date)
- **Dropdown Menus:**
  - Include search for long lists
  - Group related options (e.g., by certification type)

### Mobile Optimization
- Touch-friendly input sizes (min 44px height)
- Simplified forms for field use
- Offline data entry capability
- Camera integration for documentation

### Validation Rules
- Immediate feedback for critical fields
- Batch validation for complex forms
- Clear error messages with resolution steps
- Warning indicators for unusual values

Buttons & Actions

- Primary button: solid primary color, white text, prominent.
- Secondary: outline or neutral background.
- Disabled state: reduced opacity and non-interactive.
- Always include an icon only when it adds meaning; use accessible labels for icon-only buttons.

## ⚙️ States & Feedback

### Critical Alerts
- **Temperature Breaches:**
  - Modal overlay with sound
  - Immediate notification to QC team
  - Clear action steps
- **Quality Control Failures:**
  - Red banner with details
  - Required acknowledgment
  - Automated escalation

### Status Indicators
- **Lot Status:**
  - 🟢 Compliant
  - 🟡 Pending Review
  - 🔴 Non-compliant
- **Document Status:**
  - 📋 Draft
  - ✅ Verified
  - ❌ Rejected

### Progress Feedback
- **Loading States:**
  - Skeleton layouts for data tables
  - Progress bars for uploads
  - Background sync indicators
- **Success States:**
  - Clear confirmation messages
  - Next step suggestions
  - Undo options where applicable

### Error Handling
- **Validation Errors:**
  - Inline field feedback
  - Form-level summaries
  - Quick-fix suggestions
- **System Errors:**
  - Offline mode activation
  - Auto-retry options
  - Support contact info

Navigation

- Keep global navigation simple and predictable.
- Use breadcrumbs for deep flows (multi-step processes) and clearly indicate current step.
- Mobile: use bottom navigation or hamburger depending on available top-level sections.

## 📊 Data Visualization & Lists

### Traceability Tables
- **Quick Filters:**
  - Lot status (Processing, In Transit, Completed)
  - Date ranges (Last 24h, Week, Month)
  - Quality grade (Premium, Standard, Processing)
- **Column Configuration:**
  - Pin critical columns (Lot ID, Status)
  - Allow custom column arrangements
  - Export view configurations

### Quality Control Dashboards
- **Summary Cards:**
  - Current lot status
  - Recent quality scores
  - Temperature compliance
- **Interactive Charts:**
  - Temperature over time (line charts)
  - Defect distribution (bar charts)
  - Quality trends (radar charts)

### Mobile Views
- Prioritize key metrics
- Swipe actions for common tasks
- Collapse detailed data into expandable sections

### Performance Optimization
- Progressive loading for large datasets
- Server-side filtering and sorting
- Cached recent searches
- Optimized for slow connections

Dialogs & Modals

- Only use modals for focused tasks; avoid stacking modals.
- Focus trap inside modal, return focus to the originating control when closed.
- Provide clear cancel/confirm actions; mark destructive actions clearly.

Microcopy & Tone

- Keep labels and messages short, direct, and action-oriented.
- Use plain language; avoid jargon.
- Use consistent verbs for actions (Create, Save, Upload, Delete).

Do's and Don'ts

- Do: keep primary actions consistent across screens.
- Do: prioritize clarity over cleverness.
- Don't: overload pages with too many actions.
- Don't: rely solely on color to convey meaning (add icons/labels).

Examples / Patterns

- Empty state: show illustrative icon, brief explanation, and one clear action (e.g., "Upload your first lot").
- Error state: show helpful next steps and contact/support link.
- Confirmation: brief summary of what changed and an undo option when possible.

Implementation checklist

- [ ] Use semantic HTML and accessible attributes.
- [ ] Confirm color contrast with a tool (axe, Lighthouse).
- [ ] Keyboard navigation test (tab order, focus states).
- [ ] Mobile responsive check at common breakpoints (320px, 375px, 768px, 1024px).
- [ ] Add unit/storybook examples for patterns when appropriate.

Where to add this file

- Place this file at the repository root as a quick reference, and import the `client/src/components/ui-ux/UiUxGuidelines.tsx` component into `client/src/App.tsx` or an internal documentation route to view it in-app.

Contact

- If you want, I can also add a route and link to the component inside `client/src/App.tsx` or create a Storybook story.


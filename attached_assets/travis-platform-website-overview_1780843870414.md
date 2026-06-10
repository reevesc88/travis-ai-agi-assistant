# Travis Platform — Product Requirements & Website Overview

> **Document status:** Consolidated and improved from source notes (June 2026)  
> **Primary product name:** Travis  
> **Legacy / modular concept:** MyBusinessBlox (modular “blox” architecture)  
> **Industry showcase:** CT Installs Smart Sparky Suite

---

## Table of contents

1. [Executive summary](#executive-summary)
2. [Product evolution](#product-evolution)
3. [Core concept & positioning](#core-concept--positioning)
4. [Target users & problems](#target-users--problems)
5. [Business model](#business-model)
6. [Product architecture](#product-architecture)
7. [Module catalog](#module-catalog)
8. [End-to-end workflow](#end-to-end-workflow)
9. [Landing page specification](#landing-page-specification)
10. [Demo app specification](#demo-app-specification)
11. [Quoting engine (technical design)](#quoting-engine-technical-design)
12. [CT Installs Smart Sparky Suite](#ct-installs-smart-sparky-suite)
13. [Supplier intelligence & take-offs](#supplier-intelligence--take-offs)
14. [Technical stack & architecture](#technical-stack--architecture)
15. [Data model](#data-model)
16. [API requirements](#api-requirements)
17. [AI provider requirements](#ai-provider-requirements)
18. [Implementation roadmap](#implementation-roadmap)
19. [Honesty & placeholder requirements](#honesty--placeholder-requirements)
20. [Success criteria](#success-criteria)

---

## Executive summary

**In one line:** Travis is an AI-assisted **quote-to-cash command centre** that helps a trades business answer enquiries, quote jobs, schedule work, invoice, and follow up — all from a single dashboard.

**Primary audience (v1):** trades owner-operators and small field-service teams (electrical, HVAC, plumbing, and similar) who lack full-time office staff. Larger industrial plant work (the CT Installs lineage — 3D models, P&ID, clash detection) is preserved as a **future showcase**, not a v1 build target.

**Travis** is an AI-powered business command centre for trades and field-service businesses, from solo owner-operators to small contractors and growing service companies. It combines calls, email, calendar, quotes, jobs, invoices, customers, staff, materials, supplier pricing, and reports into one dashboard.

The product should feel like a **practical AI co-worker**, not a generic chatbot — a modular business operating system where each function connects to the next.

**Positioning statement:**

> Travis is your AI business co-worker. It answers, organises, quotes, schedules, follows up, and keeps the business moving.

Deliverables for the first version:

- A premium, responsive **marketing landing page**
- A **working demo app** with seeded data and local persistence
- Clear labeling of placeholder vs. production-ready features

**The wedge:** win the quote-to-cash loop for trades first. Prioritise a **complete working local demo** of that loop over unfinished advanced features.

---

## Riskiest assumptions & how the demo proves them

The demo exists to de-risk the core bets *before* investing in live integrations and advanced industrial modules.

| # | Riskiest assumption | How the v1 demo tests it |
|---|---------------------|--------------------------|
| 1 | Trades owners will trust an AI co-worker that touches quoting and customer comms | Every AI output (quotes, take-offs, replies) is review-gated; nothing is sent or finalised without explicit approval |
| 2 | The connected quote-to-cash loop saves real admin time vs. scattered tools | The demo proves one unbroken flow — contact, customer, job, quote, schedule, invoice, follow-up — sharing context end to end |
| 3 | Risk-adjusted quoting produces prices owners actually trust | The multi-step quote builder shows base vs. risk-adjusted totals with visible clarity/confidence multipliers and locked historical pricing |
| 4 | Owners will pay for premium comms add-ons (receptionist, inbox, SMS) | These surfaces ship as honestly-labeled premium demos so we can gauge pull before building live phone/SMS/email |
| 5 | AI features can degrade gracefully without a paid model | The provider abstraction returns clear mock responses when no API key is set and surfaces errors instead of faking success |

**What would falsify the direction:** if the connected loop feels no faster than today’s tools, or owners distrust review-gated AI output, the wedge needs rethinking before scaling to industrial modules.

---

## Product evolution

The source material evolved through three phases. This document treats **Travis** as the current product direction while preserving useful concepts from earlier drafts.

| Phase | Name | Focus |
|-------|------|--------|
| 1 | MyBusinessBlox | Modular SaaS marketing site; generic business modules (CRM, invoicing, etc.) |
| 2 | CT Installs Smart Sparky Suite | Industrial plant-facility case study; advanced quoting & supplier scraping |
| 3 | **Travis** | AI command centre for trades; receptionist, inbox, quoting, scheduling, supplier intelligence |

**Design direction shift:** Early drafts used a bright blue/green/orange SaaS palette. Travis uses a **dark, premium, industrial** aesthetic — black, graphite, white, with electric blue or lime accent.

---

## Core concept & positioning

### What Travis is

- A modular dashboard where each system (“blox”) connects to the others
- An AI layer that reduces admin work across the business lifecycle
- A quote-to-cash platform with resource-based costing and risk adjustment
- A field-service operations hub (jobs, schedule, technicians, materials, invoices)

### What Travis is not

- A one-size-fits-all ERP replacement on day one
- A chatbot bolted onto disconnected tools
- A system that silently finalises AI-generated quotes, take-offs, or prices without user approval

### Key messaging

- Build your business system block by block
- Start with the tools you need; add modules as you grow
- No vendor lock-in; transparent pricing
- AI-assisted, owner-controlled

---

## v1 scope vs. placeholders

To keep the build achievable, v1 ships a focused quote-to-cash core and treats everything else as an honestly-labeled demo, premium preview, or coming-soon shell.

### Ships working in v1 (real data, local persistence)

- Dashboard, Customers, Jobs, Quotes (risk-adjusted builder), Invoices
- Calendar / schedule with technician assignment
- Materials, Staff / technicians, Reports, Settings
- AI Assistant (mock responses by default; OpenRouter when a key is configured)

### Demo / simulated in v1 (seeded data, clearly labeled)

- AI Receptionist call logs (Premium)
- AI Inbox email summaries & suggested replies (Add-on)
- Supplier price monitor with simulated refresh
- Material take-offs with review gate
- Business memory (templates + basic retrieval)

### Placeholder / Coming Soon (visible shell only)

- Drawing review & OCR / symbol detection
- Industrial 3D plant view, P&ID annotation, auto-routing
- Live phone / SMS / email / calendar sync
- PDF / Excel export, accounting / payroll / HR sync
- Custom model training / fine-tuning

**Rule:** placeholder surfaces must carry a badge (Demo / Premium / Coming Soon) and never be presented as production-ready. See [Honesty & placeholder requirements](#honesty--placeholder-requirements) for the full matrix.

---

## Target users & problems

### Target users

- Electricians, HVAC, plumbers, marine and industrial technicians
- Small contractors and field-service companies
- Owner-operators and small teams without full-time office staff

### Problems Travis solves

| Pain | Impact |
|------|--------|
| Missed calls | Lost revenue, poor customer experience |
| Unanswered emails | Delayed quotes and follow-ups |
| Messy calendars | Double-bookings, missed jobs |
| Manual quoting | Slow turnaround, inconsistent pricing |
| Supplier price checks | Outdated material costs, margin erosion |
| Invoice follow-ups | Cash-flow gaps |
| Scattered customer records | Duplicate data, no single view |
| Poor job visibility | Reactive instead of proactive management |

---

## Business model

### Base subscription

Includes core dashboard, customer management, job management, quote tracking, invoice tracking, calendar view, basic AI assistant, basic reports, and app access (local or hosted depending on deployment).

### AI model layer

- First version: **OpenRouter** free API models where possible
- Provider abstraction required (OpenRouter, OpenAI, Anthropic, local models, etc.)
- Graceful degradation when free models are unavailable, slow, or rate-limited

### Paid add-ons

| Add-on | Description |
|--------|-------------|
| Personal AI receptionist | Answers calls, captures details, books appointments |
| Phone call answering | Voice provider integration |
| Email inbox assistant | Categorises, drafts replies, extracts actions |
| SMS follow-up | Confirmations and reminders |
| Supplier price monitoring | Approved-source price intelligence |
| Advanced quoting | Risk models, templates, document generation |
| Document automation | Quotes, invoices, job sheets, reports |
| Payroll & HR | Future module |
| Advanced reporting & analytics | Business health, conversion, margins |
| Industry-specific modules | e.g. industrial plant workflows |
| Multi-user team access | Role-based permissions |
| Premium model access | Higher-quality AI models |

**Important:** Some services require third-party subscriptions (phone, SMS, email, voice, premium AI, storage). Make this explicit in pricing copy.

### Pricing tiers (landing page)

| Plan | Audience | Includes |
|------|----------|----------|
| **Starter** | Owner-operators | Dashboard, customers, jobs, quotes, invoices, basic AI, basic reports |
| **Operator** | Small teams | Starter + calendar, staff, materials, email assistant, advanced reports, more automations |
| **Command Centre** | Automation-focused | Operator + AI receptionist, phone/SMS, supplier monitoring, document automation, premium AI, priority support |

### Tier × feature matrix

Each feature maps to the first tier that includes it (✓), or is sold as a metered add-on (+). Add-ons require their own third-party subscription where noted.

| Feature | Starter | Operator | Command Centre |
|---------|:------:|:------:|:------:|
| Dashboard & KPIs | ✓ | ✓ | ✓ |
| Customers (CRM) | ✓ | ✓ | ✓ |
| Jobs & checklists | ✓ | ✓ | ✓ |
| Quotes (risk-adjusted builder) | ✓ | ✓ | ✓ |
| Invoices & tracking | ✓ | ✓ | ✓ |
| Basic AI assistant | ✓ | ✓ | ✓ |
| Basic reports | ✓ | ✓ | ✓ |
| Calendar & scheduling | — | ✓ | ✓ |
| Staff / technicians | — | ✓ | ✓ |
| Materials & reorder | — | ✓ | ✓ |
| AI inbox assistant | — | ✓ | ✓ |
| Advanced reports & analytics | — | ✓ | ✓ |
| AI receptionist (calls, booking) | + | + | ✓ |
| Phone answering / SMS follow-up | + | + | ✓† |
| Supplier price monitoring | + | + | ✓ |
| Document automation (PDF) | + | + | ✓ |
| Premium AI models | + | + | ✓ |
| Multi-user / role-based access | — | + | ✓ |
| Industrial / take-off modules | — | — | + (showcase) |

✓ included · + paid add-on · — not in tier · † requires a third-party phone/SMS provider

**Third-party costs (state plainly in pricing copy):** phone answering, SMS, email sending, voice, premium AI models, and external storage require separate provider subscriptions billed on usage. Travis does not hide these behind the plan price.

Copy should emphasise: transparent pricing, no hidden fees, upgrade/downgrade/cancel anytime, predictable monthly costs, optional demo or trial.

---

## Product architecture

### Core app areas

```
Dashboard → AI Assistant → Receptionist → Inbox → Calendar
    ↓
Jobs → Customers → Quotes → Invoices → Materials → Suppliers
    ↓
Staff → Reports → Settings
```

Advanced areas (demo or placeholder in v1):

- Take-offs
- Drawing review
- Business memory
- Supplier monitor

### Modular design principles

- Each module is a connected “system card” or “blox”
- Modules share customer, job, and quote context
- Placeholder modules are visibly marked (Available, Demo, Premium, Coming Soon)
- Historical quote pricing is **locked** after approval — supplier price changes must not silently alter sent quotes

---

## Module catalog

### Core modules

| Module | Status | Summary |
|--------|--------|---------|
| AI Assistant | Core | Chat-style command panel for drafts, summaries, lookups |
| Dashboard | Core | KPIs, schedule, pipeline, alerts |
| CRM / Customers | Core | Profiles, history, notes |
| Jobs | Core | Lifecycle, checklist, materials, activity log |
| Quotes | Core | Multi-step builder with risk adjustment |
| Invoices | Core | Status tracking, overdue reminders |
| Calendar & scheduling | Core / Operator | Weekly view, technician assignment |
| Materials | Operator | Inventory, reorder thresholds |
| Staff / Technicians | Operator | Workload, availability, calendar colours |
| Reports | Core+ | Revenue, conversion, supplier movement |
| Settings | Core | Business profile, AI config, integrations |

### Premium / add-on modules

| Module | Badge | Summary |
|--------|-------|---------|
| Personal AI receptionist | Premium | Call answering, intake, booking, escalation |
| AI Inbox Manager | Add-on | Email categorisation, drafts, action extraction |
| Quote Builder Agent | Add-on | Job notes → draft quotes |
| Supplier Price Agent | Add-on | Price monitoring, change alerts |
| Job Scheduler Agent | Add-on | Availability matching, conflict flags |
| Invoice Follow-Up Agent | Add-on | Reminders, overdue tracking |
| Business Health Agent | Add-on | Weekly owner summaries |
| Document Generator | Add-on | Quotes, invoices, job sheets, reports |
| Compliance & Audit | Coming Soon | Activity logs, change tracking |

### Industrial / advanced modules (CT Installs lineage)

| Module | Status | Summary |
|--------|--------|---------|
| Supplier Price Intelligence | Demo | Crawl/API/import with approval queue |
| Material Take-Off | Demo | Scope/drawing → material list |
| Drawing Take-Off | Placeholder | PDF review, markup, extraction |
| AI Take-Off Agent | Demo | Suggested quantities with review gate |
| AI Quote Improvement Agent | Demo | Compare draft vs. business history |
| Tender Memory / Business Knowledge Base | Demo | Templates, past jobs, learned corrections |
| 3D Plant View | Placeholder | Industrial showcase |
| P&ID Annotation | Placeholder | Diagram linking |
| Auto-Routing | Placeholder | Pipeline/cable routing |
| Workflow Automation | Placeholder | Approval routing |

---

## End-to-end workflow

The demo should prove this connected flow:

```mermaid
flowchart LR
  A[Customer contact] --> B[Receptionist / Inbox]
  B --> C[Customer record]
  C --> D[Draft job]
  D --> E[Calendar check]
  E --> F[Quote creation]
  F --> G[Supplier prices]
  G --> H[Take-off / memory]
  H --> I[User review]
  I --> J[Quote sent]
  J --> K[Job scheduled]
  K --> L[Job completed]
  L --> M[Invoice generated]
  M --> N[Follow-up]
  N --> O[Business memory]
```

1. Customer request arrives (call, email, or manual entry)
2. Travis creates or matches the customer
3. Draft job is created
4. Calendar availability is checked
5. Quote is built with resources, assumptions, and risk multipliers
6. Supplier prices and business memory inform material costs
7. User reviews and approves take-offs and low-confidence items
8. Quote is finalised and sent
9. Job is scheduled and completed
10. Invoice is generated; result feeds future business memory

---

## Landing page specification

### Visual style

- Dark, premium, professional — **not** generic startup gradients
- Palette: black, graphite, white, electric blue or lime accent
- Clean industrial SaaS feel; strong headlines; generous spacing
- Sharp dashboard mockups; system cards; subtle grid lines and glass panels
- Modern sans-serif typography; one consistent accent colour
- Responsive: desktop, tablet, mobile (hamburger nav on small screens)

### Page structure (top to bottom)

#### Header

- Travis logo + tagline: **“AI Business Command Centre”**
- Nav: Features, How It Works, Modules, Pricing, Demo
- CTAs: **View Demo** | **Start Building**

#### Hero

- **Headline:** Your AI co-worker for calls, quotes, jobs, invoices, and follow-ups.
- **Subheadline:** Travis connects your business systems into one command centre, so you spend less time chasing admin and more time running the work.
- **Buttons:** Launch the Demo (primary) | See How Travis Works (secondary)
- Dashboard mockup: today’s jobs, call summary, open quotes, calendar, overdue invoices, AI panel, supplier alert
- Trust strip: Built for trades · Built for field service · Built for small teams · AI-assisted, owner-controlled

#### Problem

- **Headline:** Your business is not broken. Your systems are scattered.
- Four cards: Missed calls · Quotes stuck in drafts · Jobs spread across tools · Invoices forgotten until cash gets tight

#### Solution

- **Headline:** Travis brings the work into one dashboard.
- Connected workflow: Call answered → Customer captured → Job scheduled → Quote drafted → Materials checked → Invoice sent → Follow-up tracked

#### AI Receptionist (premium highlight)

- **Headline:** A receptionist that answers, books, and briefs you.
- Feature bullets: answers calls, captures job details, checks calendar, books appointments, sends confirmations, creates drafts, escalates urgent calls, summarises conversations
- Call summary mockup example
- Note: phone/SMS/voice services require separate provider subscriptions

#### AI Inbox

- **Headline:** Turn emails into actions.
- Mockup: quote requests, draft replies, tasks, calendar reminders, customer linking, urgency flags

#### Quote & job workflow

- **Headline:** From first contact to paid invoice.
- Three columns: Quote (AI drafts, labour/materials, assumptions, margin, risk) | Schedule (calendar, technicians, status) | Invoice (generate, track, reminders, revenue)

#### Supplier pricing & take-off intelligence

- **Headline:** Quote faster with supplier prices, drawing take-offs, and your own business memory.
- Four cards: Supplier Price Monitor · Material Take-Offs · Drawing Review · Tender Memory
- Mockup widgets: price changes, items awaiting review, similar past tender, margin alert

#### Modules

- **Headline:** Add the systems you need. Leave the rest.
- Module cards with icon, description, badge (Core / Add-on / Premium / Coming Soon)

#### Integrations

- **Headline:** Connect the tools you already use.
- Cards: Google/Outlook Calendar, Gmail/Outlook Email, OpenRouter, SMS/voice/accounting/supplier placeholders
- Wording: first version may use placeholders; architecture ready for real integrations

#### Pricing preview

- Three plan cards (Starter, Operator, Command Centre) — see [Business model](#business-model)
- Usage and add-ons note for third-party costs

#### Demo section

- **Headline:** Open the Travis demo workspace.
- CTA: **Open Demo Dashboard**

#### Final CTA

- **Headline:** Stop running the business from your phone notes, inbox, and memory.
- **Subheadline:** Build your business command centre with Travis.
- Buttons: Start Building | View Demo

### Legacy MyBusinessBlox public pages (optional / alternate marketing)

If maintaining a modular marketing narrative alongside Travis:

| Page | Key content |
|------|-------------|
| Home | Hero, modular blocks visual, how-it-works strip, module previews, case study, testimonials |
| About | Mission, values (flexibility, simplicity, scalability, transparency), team |
| Modules | Searchable/filterable library by category |
| Pricing | Starter / Growth / Enterprise tiers |
| Client success | Testimonials + metric cards (e.g. 35% faster quoting) |
| Contact | Validated form, demo CTA, contact details, social links |

---

## Demo app specification

### General requirements

- Seeded realistic field-service data on first load
- Local SQLite persistence; no cloud dependency required for demo
- Loading skeletons, toast confirmations, delete confirmations
- Works on desktop, tablet, and phone
- Optional **agent-friendly mode** (`?agent`): larger targets, always-visible actions, no hover-only controls

### Demo seed data (minimum)

| Entity | Count |
|--------|-------|
| Customers | 10 |
| Staff / technicians | 6 |
| Jobs | 20 |
| Quotes | 8 |
| Invoices | 10 |
| Material records | 30 |
| Supplier price records | 8 |
| AI activity logs | 10 |
| Receptionist call summaries | 5 |
| Email summaries | 5 |
| Service types | 8 |

**Example service types:** panel upgrade, lighting installation, cable tray installation, instrument termination, motor control fault finding, preventive maintenance, switchboard inspection, emergency callout, plant room installation, sensor calibration.

**Example materials:** junction box, cable gland, cable tray, 3-core flexible cable, MCB, RCBO, contactor, terminal block, stainless fixings, conduit, industrial socket outlet, isolation switch.

### App pages

#### Dashboard

KPI cards: today’s jobs, open quotes, revenue this month, overdue invoices, active staff, materials below reorder, AI actions completed, supplier price changes.

Panels: today’s schedule, recent activity, quote pipeline, invoice status, receptionist summaries, revenue trend (SVG or lightweight chart library).

#### AI Assistant

Chat-style panel with example prompts:

- “Draft a quote from this job note.”
- “Summarise today’s jobs.”
- “Find overdue invoices.”
- “Create a follow-up message.”
- “Check supplier price changes.”

Responses: simulated by default; OpenRouter when API key configured.

#### Receptionist

Call logs with caller, phone, job type, urgency, summary, booking status, linked customer/job, escalation flag. **Premium Add-on** badge.

#### Inbox

Email summaries, action items, suggested replies, linked customers/jobs, priority flags.

#### Calendar

Weekly view with technician colour-coding, job cards, status/priority badges, mobile list fallback.

**Job statuses:** Scheduled, In progress, Completed, Cancelled, Needs parts, Awaiting approval  
**Priorities:** Low, Normal, High, Urgent

#### Jobs

List with search/filter; detail page with checklist, materials, notes, activity log, generate-invoice action.

#### Customers

CRM with profile, service history, open quotes/invoices, notes.

#### Quotes

Multi-step builder:

1. Project information
2. Tasks and sub-tasks
3. Resource costing
4. Risk and confidence adjustment
5. Review and finalise

**Quote structure:** Project → Tasks → Sub-tasks → Resource line items → Assumptions → Risk settings → Totals

**Statuses:** Draft, Sent, Viewed, Approved, Rejected, Expired

**Clarity / confidence:** Low, Medium, High — with configurable multiplier matrix.

Example multipliers:

| Clarity | Confidence | Multiplier |
|---------|------------|------------|
| High | High | 1.0 |
| Medium | Medium | 1.15 |
| Low | Low | 1.5 |

Show base cost and risk-adjusted cost. Include assumptions/exclusions. Quote preview UI (PDF generation may be placeholder).

#### Invoices

List, detail, line items, due/paid dates, mark sent/paid, generate from completed job.

**Statuses:** Draft, Sent, Paid, Overdue, Cancelled

#### Materials

Search, category filter, unit cost, stock, reorder threshold, supplier, inline edit, low-stock warnings.

#### Suppliers / Supplier Monitor

Trusted supplier list, last checked, price history, change alerts, error log, approval queue, manual import, crawl schedule (demo/simulated).

#### Take-offs (advanced)

List with source, status, confidence, linked quote, material/labour totals, review action.

**Statuses:** Draft, Needs review, Approved, Sent to quote, Archived

#### Drawing review (placeholder shell)

Drawing preview, thumbnails, zoom, scale setting, markup/count/measurement placeholders, extracted item panel, approve → push to quote.

#### Business memory

Templates, common materials, preferred suppliers, labour rates, assumptions, exclusions, learned corrections, similar tender search.

#### Reports

Revenue summary, quote conversion, jobs completed, outstanding invoices, supplier price movement, business health summary. PDF/Excel export buttons may be placeholders.

#### Settings

Business profile, tax rate, default labour/overhead/margin, risk multiplier matrix, AI provider (OpenRouter key placeholder), integration placeholders (calendar, email, phone, SMS), subscription plan, add-on toggles.

### CT Installs Smart Sparky Suite demo workspace (optional nested demo)

Separate workspace branding for industrial showcase:

- Sidebar nav: Dashboard, Schedule, Jobs, Customers, Quotes, Invoices, Materials, Technicians, Supplier Pricing, Reports, Settings
- Top bar: workspace name, search, notifications, Create Job, Create Quote, user avatar

---

## Quoting engine (technical design)

This section consolidates the CT Installs integration plan (Kontrax, EstimatorX, GEstimator, Uber-for-Electrician) into actionable design requirements.

### Design influences

| Source | Key pattern | Apply to Travis |
|--------|-------------|-----------------|
| **EstimatorX** | Project → epic → feature hierarchy; clarity/confidence; risk multiplier matrix | Quote hierarchy + contingency pricing |
| **GEstimator** | Resource-based line items; measurement details; export to Excel | Resource library; cost breakdown; historical price lock |
| **Uber-for-Electrician** | Quote → schedule → execution lifecycle | Multi-step wizard; job creation on acceptance |
| **Kontrax** | Document templates; contract lifecycle; status tracking | Quote PDF templates; sent/viewed/approved states |

### Data hierarchy

```
QuoteProject
├── QuoteTask
│   └── QuoteSubTask
│       ├── clarity, confidence, risk_multiplier
│       ├── base_cost, adjusted_cost
│       └── QuoteItemResource → Resource (with cost_at_time)
├── QuoteAssumption
└── QuoteTemplate (reusable)
```

### Key rules

- **Historical accuracy:** store `cost_at_time` on resource lines; later price updates must not alter approved quotes
- **Multiplier matrix:** configurable table (clarity × confidence → multiplier); editable via admin/settings
- **Templates:** reusable project/task structures for common job types
- **Document generation:** HTML → PDF (Jinja2 + WeasyPrint/wkhtmltopdf) or PDF library; version on revision
- **Activity log:** create, modify, send, view, approve events for audit and analytics

### Multi-step quote wizard (UI)

1. Project info (client, scope, dates)
2. Tasks & sub-tasks (hierarchical or expandable list)
3. Resource assignment per sub-task
4. Review (backend recalculation — do not rely on front-end sums alone)
5. Finalise → generate preview/PDF → update status

### Suggested implementation steps

1. Implement project/task/sub-task hierarchy; migrate flat quotes
2. Add clarity/confidence fields and multiplier logic
3. Build resource library and sub-task resource attachment
4. Migrate database schema (projects, tasks, subtasks, resources, templates, multiplier matrix)
5. Refactor backend: `quoting_engine` module with unit tests
6. Template-based document generation
7. Multi-step UI wizard with validation
8. Collaboration comments (internal); optional email notifications
9. Quote acceptance → job scheduling skeleton
10. QA: unit, integration, UAT, performance; staged rollout with feature flags if needed

---

## CT Installs Smart Sparky Suite

Industrial showcase demonstrating how modular “blox” compose into a specialised plant-facility workflow.

### Overview

Comprehensive modules for plant facility design, cost estimation, and project management:

- AI-driven quoting with real-time 3D clash detection
- Automated workflow management
- Cost estimation and project-tracking analytics
- Role-based access to plant models
- Cross-platform (desktop and mobile)

### Key feature highlights

- **Pricing transparency** — predictable module costs
- **Complete plant view** — holistic 3D model access with permissions
- **Immediate clash detection** — conflicts caught when components are added
- **Collaborative commenting** — annotations on model elements
- **Cross-platform availability** — consistent experience across devices
- **Automated workflow** — change routing, approvals, revision history
- **Performance analytics** — bottlenecks, resource utilisation, schedule variance

### Core modules

1. P&ID Annotation
2. 3D Modeling (with clash detection)
3. Auto-Routing
4. Material Take-Off (MTO)
5. Cost Data Management
6. Reporting
7. Executive Summaries
8. Workflow Automation
9. Audit & Compliance
10. Collaboration Tools

### Supplier scraping module (industrial context)

**Purpose:** Automate price collection from approved supplier sources into the cost database.

**Flow:** User configures trusted supplier URLs → scraping engine extracts product/price data → stored in Cost Data Management with source/date → flows into MTO and estimates → scheduled or manual refresh.

**Benefits:** Faster pricing, improved accuracy, competitive advantage.

**Considerations:**

- Legal/ethical scraping; respect robots.txt and rate limits; prefer APIs/feeds
- Sanity checks on outlier prices
- Error handling when site layouts change
- Security for external access and stored pricing data

**Rollout steps:** Identify suppliers → define data requirements → prototype one site → integration test → user training → launch & monitor → iterate.

---

## Supplier intelligence & take-offs

### Supplier Price Intelligence Engine

Supports (in priority order for v1):

1. Seeded demo data and mock crawl results
2. Manual entry and CSV/Excel import
3. Approved API integrations
4. Firecrawl-style crawling (when permitted)
5. Future in-house scraper

**Workflow:**

1. User adds trusted supplier source (crawl method: API, website, CSV, manual)
2. Travis imports product data (name, SKU, description, unit price, pack size, availability, lead time)
3. Data stored with source, timestamp, confidence score
4. Price changes flagged; major changes enter approval queue
5. Approved prices available in quotes; **historical quote prices remain locked**

**Compliance:** supplier terms, rate limits, robots.txt, API terms, credential security, audit logging. **Do not perform live scraping** unless source is approved and legally permitted.

### Material take-off module

Convert job notes, scopes, specifications, and (future) drawings into structured material lists.

**Extracted fields:** item, description, quantity, unit, cable/conduit/tray lengths, switchgear, labour allowance, waste factor, supplier match, unit/total cost, assumptions.

Every item: source reference, confidence score, approval status, supplier match, last price update.

**Rule:** user must approve before items affect a quote.

### Drawing take-off (future)

PDF upload, preview, markup, measurement scale, count tools, symbol recognition (future), export to quote/material list. v1: visual shell with seeded examples.

### Business memory (staged)

| Stage | Approach |
|-------|----------|
| 1. Structured memory | DB templates, material packs, rates, assumptions, exclusions |
| 2. Retrieval (RAG) | Search similar jobs/tenders/prices when drafting quotes |
| 3. Feedback learning | Store user corrections; improve future suggestions |
| 4. Optional fine-tuning | Future premium; requires consent, review, workspace isolation |

v1 messaging: *“Travis learns from your approved business history using structured memory and retrieval. Custom model training can be added later.”*

### AI agents (review-gated)

| Agent | Role |
|-------|------|
| AI Take-Off Agent | Drawings/scopes → suggested materials and labour |
| AI Quote Improvement Agent | Compare draft vs. history; flag gaps, margin issues, missing items |

**Never silently finalise.** Present review screen; user accepts/rejects each suggestion.

---

## Technical stack & architecture

### Preferred stack

| Layer | Technology |
|-------|------------|
| Frontend | React or Preact, TypeScript |
| Backend | Hono or similar lightweight API |
| Database | SQLite |
| Validation | Zod |
| Routing | URL-based, bookmarkable pages |
| Icons | Lucide or similar |
| Styling | CSS Modules, Tailwind, or component-scoped CSS |
| Deployment (optional) | Vercel, Netlify — demo runs locally without cloud |

### Frontend principles

- Functional components and hooks
- Reusable components: `Navbar`, `Footer`, `ModuleCard`, `TestimonialCard`, `ResourcePicker`, etc.
- Code-splitting by route; lazy-loaded images
- Client-side form validation with clear error feedback
- Cross-browser testing (Chrome, Firefox, Safari, Edge)

### Backend principles

- REST (or GraphQL) API decoupled from UI
- Validation on create/update; useful error messages
- Calculation logic isolated in quoting engine service
- Document generation isolated module
- Unit tests for multipliers, resource summation, migrations

### Project deliverables

- Clean project structure
- Seed data scripts
- Run and build instructions in README
- No hard-coded secrets; API keys in environment variables only (server-side)

---

## Data model

### Core tables

`customers`, `staff`, `jobs`, `job_notes`, `job_checklist`, `materials`, `job_materials`, `quotes`, `quote_tasks`, `quote_subtasks`, `quote_resources`, `quote_assumptions`, `invoices`, `invoice_lines`, `receptionist_calls`, `inbox_items`, `supplier_sources`, `supplier_products`, `supplier_price_history`, `supplier_crawl_runs`, `supplier_crawl_errors`, `ai_activity`, `settings`, `subscriptions`, `contact_messages`, `activity_log`

### Advanced / take-off tables

`takeoffs`, `takeoff_sources`, `takeoff_items`, `drawing_pages`, `drawing_markups`, `quote_templates`, `business_memory_items`, `tender_examples`, `ai_feedback`, `model_runs`, `model_suggestions`, `approved_training_examples`

### Integrity rules

- Preserve source data and user corrections
- Store AI confidence scores and approval status
- Audit trails for price changes, take-offs, quote edits, AI suggestions
- Index foreign keys; test full-quote join performance

---

## API requirements

REST endpoint groups:

- `stats`
- `schedule`
- `jobs`
- `customers`
- `staff` / `technicians`
- `service-types`
- `materials`
- `invoices`
- `quotes`
- `supplier-pricing`
- `takeoffs`
- `reports`
- `contact-messages`

All create/update endpoints: Zod (or equivalent) validation, consistent error shape.

---

## AI provider requirements

Implement an **AI provider abstraction**:

- OpenRouter as first provider
- Free model configuration via environment variable
- Safe fallback to mock responses when no API key
- Clear error handling on API failure
- Interface extensible to OpenAI, Anthropic, local models
- **Never expose API keys in client-side code**

---

## Implementation roadmap

**Workstream mapping (active build tasks):** Workstream A = backend foundation, new tables, seed data, AI provider abstraction. Workstream B = quotes module (list, multi-step builder, lifecycle, job/invoice linkage). Workstream C = AI & operations pages (Assistant, Receptionist, Inbox, Suppliers, Reports, Settings). The phases below detail what each workstream delivers.

### Phase 1 — Foundation (MVP demo)

> **Current state (June 2026):** the scaffold, landing page, dashboard, and core CRUD (customers, jobs, technicians, service types, materials, invoices, schedule) are already built in the dark premium theme. The remaining work is grouped into three workstreams that map directly to the active build tasks: **(A) backend foundation & seed data**, then **(B) quotes module** and **(C) AI & operations pages** (both depend on A; C also follows B to avoid shared-file conflicts).

- [x] Project scaffold (Preact/TS + Hono + Wrangler/D1)
- [x] Landing page (all sections, responsive, dark premium theme)
- [x] Core CRUD: customers, jobs, materials, invoices
- [x] Dashboard with seeded KPIs
- [x] Calendar / schedule view
- [ ] Basic quote builder (flat or single-task) — superseded by Workstream B (full multi-step builder)
- [ ] Contact form with validation and local persistence
- [ ] README with run/build instructions

### Phase 2 — Quoting & operations

- [ ] Project/task/sub-task hierarchy
- [ ] Resource library and line-item costing
- [ ] Clarity/confidence multiplier matrix
- [ ] Quote preview UI
- [ ] Invoice generation from completed jobs
- [ ] Activity log

### Phase 3 — AI & premium surfaces

- [ ] AI assistant (mock + OpenRouter)
- [ ] Receptionist and inbox demo records
- [ ] Supplier price monitor (seeded + simulated updates)
- [ ] Business memory (templates, basic retrieval)
- [ ] Take-off list and review flow (demo)

### Phase 4 — Industrial & integrations

- [ ] CT Installs workspace branding (optional)
- [ ] Drawing review shell
- [ ] Document PDF generation
- [ ] Real integration stubs (calendar, email)
- [ ] Role-based permissions

---

## Honesty & placeholder requirements

Clearly mark as **placeholder** unless fully implemented:

| Feature | v1 expectation |
|---------|----------------|
| Live phone answering | Simulated call logs |
| Live SMS / email | Simulated summaries |
| Live calendar sync | Local calendar only |
| Live supplier scraping | Seeded data + mock refresh |
| Firecrawl / in-house scraper | Settings placeholder |
| PDF / Excel export | UI button; optional simple export |
| 3D plant view, P&ID, auto-routing | Shell / Coming Soon badge |
| Drawing OCR, symbol detection, auto measurement | Not in v1 |
| Custom model training / fine-tuning | Architecture note only |
| Role-based permissions | Visual mock if not enforced |
| Accounting / payroll / HR sync | Placeholder cards |

**Required disclaimer for AI take-offs:**

> AI-assisted take-offs require user review. Travis does not finalise material quantities, pricing, or quote values without approval.

Do not present placeholder services as production-ready.

---

## Success criteria

After build, a user should be able to:

- [ ] Open the app in a browser
- [ ] View the Travis landing page and navigate all sections
- [ ] Submit the contact form and see success state
- [ ] Open the demo dashboard with populated data
- [ ] Create and edit customers, jobs, and materials
- [ ] View and navigate the weekly schedule
- [ ] Assign staff to jobs
- [ ] Create quotes with tasks, resources, assumptions, and risk multipliers
- [ ] View supplier price records and alerts (demo)
- [ ] Generate an invoice from a completed job
- [ ] See dashboard stats update after changes
- [ ] Use the app on mobile without broken layouts

### Post-build documentation

Provide:

1. What was created
2. How to run it (`install`, `dev`, `build`)
3. Main files and structure
4. Known placeholders
5. Recommended next build steps

---

## Appendix — reference repositories (quoting integration)

| Repository | Domain | Patterns borrowed |
|------------|--------|-------------------|
| EstimatorX | Software estimation | Risk-adjusted estimates, templates |
| GEstimator | Civil/electrical desktop | Resource libraries, Excel export |
| Uber-for-Electrician | Service marketplace | Quote-to-schedule lifecycle, mobile UX |
| Kontrax | Contract management | Document templates, status lifecycle |

---

*End of document.*

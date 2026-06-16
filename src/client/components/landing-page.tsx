import { useState } from "preact/hooks";
import {
  CalendarClock, ArrowRight, PhoneCall, Mail, FileText, Calendar, Receipt,
  Boxes, TrendingUp, ShieldCheck, Bot, Bell, Menu, X, Check, Zap,
  PhoneMissed, FileWarning, LayoutGrid, AlarmClock, Users, Wrench,
  BarChart3, Sparkles, Truck, MessageSquare, Calculator,
} from "lucide-preact";

interface LandingPageProps {
  navigate: (to: string) => void;
}

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how" },
  { label: "Modules", href: "#modules" },
  { label: "Pricing", href: "#pricing" },
  { label: "Demo", href: "#demo" },
];

export function LandingPage({ navigate }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const openDemo = () => navigate("/dashboard");

  return (
    <div class="lp">
      <div class="lp-grid-bg" aria-hidden="true" />

      {/* ── Header ─────────────────────────────────────────────── */}
      <header class="lp-header">
        <div class="lp-container lp-header-inner">
          <a class="lp-brand" href="#top" onClick={() => setMenuOpen(false)}>
            <span class="lp-brand-mark"><CalendarClock size={18} /></span>
            <span class="lp-brand-text">
              <span class="lp-brand-name">Travis</span>
              <span class="lp-brand-sub">AI Business Command Centre</span>
            </span>
          </a>

          <nav class="lp-nav">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} class="lp-nav-link">{l.label}</a>
            ))}
          </nav>

          <div class="lp-header-cta">
            <button class="lp-btn lp-btn-ghost" onClick={openDemo}>View Demo</button>
            <button class="lp-btn lp-btn-primary" onClick={openDemo}>Start Building <ArrowRight size={15} /></button>
          </div>

          <button class="lp-menu-toggle" onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle menu">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div class="lp-mobile-menu">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} class="lp-mobile-link" onClick={() => setMenuOpen(false)}>{l.label}</a>
            ))}
            <button class="lp-btn lp-btn-primary lp-btn-block" onClick={() => { setMenuOpen(false); openDemo(); }}>
              Launch the Demo <ArrowRight size={15} />
            </button>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section class="lp-hero" id="top">
        <div class="lp-container lp-hero-inner">
          <div class="lp-hero-copy">
            <span class="lp-eyebrow"><Sparkles size={13} /> AI-assisted, owner-controlled</span>
            <h1 class="lp-h1">
              Your AI co-worker for calls, quotes, jobs,
              <span class="lp-accent"> invoices, and follow-ups.</span>
            </h1>
            <p class="lp-lead">
              Travis answers the calls, drafts the quotes, schedules the jobs, and chases
              the invoices — so you win back hours of admin every week and get paid faster.
            </p>
            <div class="lp-hero-buttons">
              <button class="lp-btn lp-btn-primary lp-btn-lg" onClick={openDemo}>
                Launch the Demo <ArrowRight size={16} />
              </button>
              <a class="lp-btn lp-btn-ghost lp-btn-lg" href="#how">See How Travis Works</a>
            </div>
            <ul class="lp-trust">
              <li>Built for trades</li>
              <li>Built for field service</li>
              <li>Built for small teams</li>
            </ul>
          </div>

          <HeroMockup />
        </div>
      </section>

      {/* ── Problem ────────────────────────────────────────────── */}
      <section class="lp-section">
        <div class="lp-container">
          <div class="lp-section-head">
            <h2 class="lp-h2">Your business is not broken.<br />Your systems are scattered.</h2>
          </div>
          <div class="lp-problem-grid">
            {[
              { icon: PhoneMissed, t: "Missed calls", d: "Lost revenue and a poor first impression every time the phone rings out." },
              { icon: FileWarning, t: "Quotes stuck in drafts", d: "Slow turnaround and inconsistent pricing while jobs go cold." },
              { icon: LayoutGrid, t: "Jobs spread across tools", d: "Notes here, calendar there, spreadsheets everywhere. No single view." },
              { icon: AlarmClock, t: "Invoices forgotten", d: "Cash-flow gaps because follow-ups slip until money gets tight." },
            ].map((c) => (
              <div key={c.t} class="lp-problem-card">
                <span class="lp-problem-icon"><c.icon size={18} /></span>
                <h3>{c.t}</h3>
                <p>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works / Solution ────────────────────────────── */}
      <section class="lp-section lp-section-alt" id="how">
        <div class="lp-container">
          <div class="lp-section-head">
            <span class="lp-kicker">How it works</span>
            <h2 class="lp-h2">Travis brings the work into one dashboard.</h2>
            <p class="lp-sub">One connected flow from first contact to paid invoice — every step hands off to the next.</p>
          </div>
          <div class="lp-flow">
            {[
              { icon: PhoneCall, t: "Call answered" },
              { icon: Users, t: "Customer captured" },
              { icon: Calendar, t: "Job scheduled" },
              { icon: FileText, t: "Quote drafted" },
              { icon: Boxes, t: "Materials checked" },
              { icon: Receipt, t: "Invoice sent" },
              { icon: TrendingUp, t: "Follow-up tracked" },
            ].map((s, i, arr) => (
              <div key={s.t} class="lp-flow-step-wrap">
                <div class="lp-flow-step">
                  <span class="lp-flow-icon"><s.icon size={18} /></span>
                  <span class="lp-flow-label">{s.t}</span>
                </div>
                {i < arr.length - 1 && <ArrowRight class="lp-flow-arrow" size={16} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section class="lp-section" id="features">
        <div class="lp-container">
          <div class="lp-section-head">
            <span class="lp-kicker">Features</span>
            <h2 class="lp-h2">A practical AI co-worker — not a chatbot.</h2>
          </div>

          <div class="lp-feature-row">
            <div class="lp-feature-copy">
              <span class="lp-badge lp-badge-premium">Premium</span>
              <h3 class="lp-h3"><PhoneCall size={20} class="lp-h3-icon" /> A receptionist that answers, books, and briefs you.</h3>
              <p class="lp-sub">Travis picks up, captures the job details, checks your calendar, books the
                appointment, and sends a confirmation — then hands you a clean summary.</p>
              <ul class="lp-checks">
                <li><Check size={15} /> Answers calls and captures job details</li>
                <li><Check size={15} /> Checks the calendar and books appointments</li>
                <li><Check size={15} /> Sends confirmations and escalates urgent calls</li>
              </ul>
              <p class="lp-note">Phone, SMS and voice services require separate provider subscriptions.</p>
            </div>
            <CallSummaryMockup />
          </div>

          <div class="lp-feature-row lp-feature-row-reverse">
            <div class="lp-feature-copy">
              <span class="lp-badge lp-badge-addon">Add-on</span>
              <h3 class="lp-h3"><Mail size={20} class="lp-h3-icon" /> Turn emails into actions.</h3>
              <p class="lp-sub">The inbox assistant reads incoming mail, categorises it, drafts replies,
                and pulls out the tasks and bookings hiding inside.</p>
              <ul class="lp-checks">
                <li><Check size={15} /> Spots quote requests and drafts replies</li>
                <li><Check size={15} /> Extracts tasks and calendar reminders</li>
                <li><Check size={15} /> Links emails to the right customer and job</li>
              </ul>
            </div>
            <InboxMockup />
          </div>

          {/* Quote / Schedule / Invoice columns */}
          <div class="lp-section-head lp-section-head-mt">
            <h3 class="lp-h2 lp-h2-sm">From first contact to paid invoice.</h3>
          </div>
          <div class="lp-tri">
            {[
              { icon: FileText, t: "Quote", items: ["AI-drafted from job notes", "Labour & materials breakdown", "Assumptions, margin & risk"] },
              { icon: Calendar, t: "Schedule", items: ["Weekly calendar view", "Technician assignment", "Status & priority badges"] },
              { icon: Receipt, t: "Invoice", items: ["Generate from a job", "Track sent / paid / overdue", "Automatic reminders"] },
            ].map((col) => (
              <div key={col.t} class="lp-tri-card">
                <span class="lp-tri-icon"><col.icon size={20} /></span>
                <h4>{col.t}</h4>
                <ul class="lp-checks">
                  {col.items.map((it) => <li key={it}><Check size={14} /> {it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Supplier intelligence ──────────────────────────────── */}
      <section class="lp-section lp-section-alt">
        <div class="lp-container">
          <div class="lp-section-head">
            <span class="lp-kicker">Supplier intelligence</span>
            <h2 class="lp-h2">Quote faster with live prices and your own memory.</h2>
            <p class="lp-sub">Supplier pricing, drawing take-offs, and learned business knowledge feed
              every quote — with an approval gate before anything is finalised.</p>
          </div>
          <div class="lp-quad">
            {[
              { icon: Truck, t: "Supplier Price Monitor", d: "Tracks approved-source pricing and flags movement before it erodes margin." },
              { icon: Boxes, t: "Material Take-Offs", d: "Turn a scope or drawing into a material list, ready for review." },
              { icon: FileText, t: "Drawing Review", d: "Preview, mark up, and extract quantities from PDFs." },
              { icon: Sparkles, t: "Tender Memory", d: "Templates, past jobs, and learned corrections inform new quotes." },
            ].map((c) => (
              <div key={c.t} class="lp-quad-card">
                <span class="lp-quad-icon"><c.icon size={18} /></span>
                <h4>{c.t}</h4>
                <p>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Modules ────────────────────────────────────────────── */}
      <section class="lp-section" id="modules">
        <div class="lp-container">
          <div class="lp-section-head">
            <span class="lp-kicker">Modules</span>
            <h2 class="lp-h2">Add the systems you need. Leave the rest.</h2>
            <p class="lp-sub">Each module is a connected block. Start with the essentials and switch on more as you grow.</p>
          </div>
          <div class="lp-module-grid">
            {[
              { icon: Bot, t: "AI Assistant", d: "Drafts, summaries and lookups on command.", badge: "Core" },
              { icon: Users, t: "CRM / Customers", d: "Profiles, history and notes in one place.", badge: "Core" },
              { icon: FileText, t: "Quotes", d: "Multi-step builder with risk adjustment.", badge: "Core" },
              { icon: Receipt, t: "Invoices", d: "Status tracking and overdue reminders.", badge: "Core" },
              { icon: Calendar, t: "Calendar & Scheduling", d: "Weekly view with technician assignment.", badge: "Operator" },
              { icon: Boxes, t: "Materials", d: "Inventory and reorder thresholds.", badge: "Operator" },
              { icon: PhoneCall, t: "AI Receptionist", d: "Call answering, intake and booking.", badge: "Premium" },
              { icon: TrendingUp, t: "Supplier Price Agent", d: "Price monitoring and change alerts.", badge: "Add-on" },
              { icon: BarChart3, t: "Business Health", d: "Weekly owner summaries and analytics.", badge: "Add-on" },
              { icon: ShieldCheck, t: "Compliance & Audit", d: "Activity logs and change tracking.", badge: "Coming Soon" },
            ].map((m) => (
              <div key={m.t} class="lp-module-card">
                <div class="lp-module-top">
                  <span class="lp-module-icon"><m.icon size={18} /></span>
                  <span class={`lp-badge lp-badge-${m.badge.toLowerCase().replace(/\s+/g, "-")}`}>{m.badge}</span>
                </div>
                <h4>{m.t}</h4>
                <p>{m.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ───────────────────────────────────────── */}
      <section class="lp-section lp-section-alt" id="integrations">
        <div class="lp-container">
          <div class="lp-section-head">
            <span class="lp-kicker">Integrations</span>
            <h2 class="lp-h2">Connect the tools you already run on.</h2>
            <p class="lp-sub">Travis is built to plug into your calendar, inbox and AI provider, with phone,
              accounting and supplier feeds on the roadmap. The demo uses placeholders — the architecture is ready for the real connections.</p>
          </div>
          <div class="lp-integration-grid">
            {[
              { icon: Calendar, t: "Calendar", d: "Two-way sync with Google & Outlook Calendar.", badge: "Planned" },
              { icon: Mail, t: "Email", d: "Read and draft from Gmail & Outlook.", badge: "Planned" },
              { icon: Bot, t: "AI models", d: "OpenRouter, OpenAI and Anthropic.", badge: "Ready" },
              { icon: MessageSquare, t: "Phone & SMS", d: "Call answering and texts via voice providers.", badge: "Placeholder" },
              { icon: Calculator, t: "Accounting", d: "Push invoices to Xero & QuickBooks.", badge: "Placeholder" },
              { icon: Truck, t: "Suppliers", d: "Live pricing from approved supplier feeds.", badge: "Placeholder" },
            ].map((c) => (
              <div key={c.t} class="lp-integration-card">
                <div class="lp-integration-top">
                  <span class="lp-quad-icon"><c.icon size={18} /></span>
                  <span class={`lp-badge lp-badge-${c.badge.toLowerCase()}`}>{c.badge}</span>
                </div>
                <h4>{c.t}</h4>
                <p>{c.d}</p>
              </div>
            ))}
          </div>
          <p class="lp-note lp-note-center">
            Live integrations require their own provider accounts and may add third-party costs.
          </p>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section class="lp-section" id="pricing">
        <div class="lp-container">
          <div class="lp-section-head">
            <span class="lp-kicker">Pricing</span>
            <h2 class="lp-h2">Transparent pricing. No hidden fees.</h2>
            <p class="lp-sub">Upgrade, downgrade or cancel anytime. Predictable monthly costs.</p>
          </div>
          <div class="lp-pricing-grid">
            {[
              {
                name: "Starter", who: "Owner-operators", price: "£29",
                features: ["Dashboard & customers", "Jobs, quotes & invoices", "Basic AI assistant", "Basic reports"],
                featured: false,
              },
              {
                name: "Operator", who: "Small teams", price: "£79",
                features: ["Everything in Starter", "Calendar & staff", "Materials & inventory", "Email assistant", "Advanced reports"],
                featured: true,
              },
              {
                name: "Command Centre", who: "Automation-focused", price: "£199",
                features: ["Everything in Operator", "AI receptionist + phone/SMS", "Supplier monitoring", "Document automation", "Premium AI & priority support"],
                featured: false,
              },
            ].map((p) => (
              <div key={p.name} class={`lp-price-card ${p.featured ? "lp-price-featured" : ""}`}>
                {p.featured && <span class="lp-price-tag">Most popular</span>}
                <h3 class="lp-price-name">{p.name}</h3>
                <p class="lp-price-who">{p.who}</p>
                <div class="lp-price-amount"><span>{p.price}</span><small>/mo</small></div>
                <button class={`lp-btn ${p.featured ? "lp-btn-primary" : "lp-btn-ghost"} lp-btn-block`} onClick={openDemo}>
                  {p.featured ? "Start Building" : "Choose plan"}
                </button>
                <ul class="lp-checks lp-price-features">
                  {p.features.map((f) => <li key={f}><Check size={15} /> {f}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p class="lp-note lp-note-center">
            Some services (phone, SMS, email, voice, premium AI, storage) require third-party subscriptions.
          </p>
        </div>
      </section>

      {/* ── Demo ───────────────────────────────────────────────── */}
      <section class="lp-section lp-section-alt" id="demo">
        <div class="lp-container">
          <div class="lp-demo">
            <div class="lp-demo-copy">
              <span class="lp-kicker">Live demo</span>
              <h2 class="lp-h2">See the command centre for yourself.</h2>
              <p class="lp-sub">No sign-up needed. Jump into a working demo loaded with sample customers,
                quotes, jobs and invoices, and see how a full day runs through Travis.</p>
              <div class="lp-demo-buttons">
                <button class="lp-btn lp-btn-primary lp-btn-lg" onClick={openDemo}>
                  Open Demo Dashboard <ArrowRight size={16} />
                </button>
              </div>
              <p class="lp-note">Demo data is simulated. AI, phone and supplier features are shown as illustrative placeholders.</p>
            </div>
            <ul class="lp-demo-list">
              {[
                { icon: BarChart3, t: "Dashboard", d: "KPIs, today's jobs and AI highlights" },
                { icon: FileText, t: "Quotes", d: "Multi-step builder with margin & risk" },
                { icon: Calendar, t: "Schedule", d: "Weekly calendar and technician assignment" },
                { icon: Receipt, t: "Invoices", d: "Track sent, paid and overdue" },
              ].map((d) => (
                <li key={d.t} class="lp-demo-item" onClick={openDemo}>
                  <span class="lp-demo-item-icon"><d.icon size={16} /></span>
                  <span class="lp-demo-item-text"><strong>{d.t}</strong><span>{d.d}</span></span>
                  <ArrowRight size={15} class="lp-demo-item-arrow" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────── */}
      <section class="lp-section">
        <div class="lp-container">
          <div class="lp-cta">
            <Zap size={26} class="lp-cta-icon" />
            <h2 class="lp-h2">Stop running the business from your phone notes, inbox, and memory.</h2>
            <p class="lp-sub">Build your business command centre with Travis.</p>
            <div class="lp-hero-buttons lp-cta-buttons">
              <button class="lp-btn lp-btn-primary lp-btn-lg" onClick={openDemo}>Start Building <ArrowRight size={16} /></button>
              <button class="lp-btn lp-btn-ghost lp-btn-lg" onClick={openDemo}>View Demo</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer class="lp-footer">
        <div class="lp-container lp-footer-inner">
          <div class="lp-brand">
            <span class="lp-brand-mark"><CalendarClock size={16} /></span>
            <span class="lp-brand-name">Travis</span>
          </div>
          <p class="lp-footer-copy">AI Business Command Centre · AI-assisted, owner-controlled</p>
          <button class="lp-footer-demo" onClick={openDemo}>Open Demo Dashboard <ArrowRight size={14} /></button>
        </div>
      </footer>
    </div>
  );
}

/* ── Mockups ──────────────────────────────────────────────────── */

function HeroMockup() {
  return (
    <div class="lp-mock" aria-hidden="true">
      <div class="lp-mock-glow" />
      <div class="lp-mock-window">
        <div class="lp-mock-bar">
          <span class="lp-mock-dot" /><span class="lp-mock-dot" /><span class="lp-mock-dot" />
          <span class="lp-mock-title">Travis · Command Centre</span>
        </div>
        <div class="lp-mock-body">
          <div class="lp-mock-kpis">
            {[
              { l: "Today's jobs", v: "7" },
              { l: "Open quotes", v: "12" },
              { l: "Revenue (mo)", v: "£48.2k" },
              { l: "Overdue", v: "3" },
            ].map((k) => (
              <div key={k.l} class="lp-mock-kpi">
                <span class="lp-mock-kpi-val">{k.v}</span>
                <span class="lp-mock-kpi-label">{k.l}</span>
              </div>
            ))}
          </div>
          <div class="lp-mock-cols">
            <div class="lp-mock-panel">
              <span class="lp-mock-panel-title">Today's schedule</span>
              {[
                { t: "08:30", n: "Panel upgrade — Acme", c: "#06b6d4" },
                { t: "11:00", n: "Switchboard inspect", c: "#a78bfa" },
                { t: "14:15", n: "Emergency callout", c: "#fbbf24" },
              ].map((j) => (
                <div key={j.t} class="lp-mock-job" style={{ borderLeftColor: j.c }}>
                  <span class="lp-mock-job-time">{j.t}</span>
                  <span class="lp-mock-job-name">{j.n}</span>
                </div>
              ))}
            </div>
            <div class="lp-mock-side">
              <div class="lp-mock-ai">
                <span class="lp-mock-ai-head"><Bot size={13} /> AI Assistant</span>
                <span class="lp-mock-ai-line">"Drafted 2 quotes from today's calls."</span>
                <span class="lp-mock-ai-line lp-mock-ai-muted">"Found 3 overdue invoices."</span>
              </div>
              <div class="lp-mock-alert">
                <Bell size={13} />
                <span>Cable tray up 8% — review quote #1182</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CallSummaryMockup() {
  return (
    <div class="lp-feature-mock" aria-hidden="true">
      <div class="lp-mock-window lp-mock-window-sm">
        <div class="lp-mock-bar">
          <PhoneCall size={13} class="lp-mock-bar-icon" />
          <span class="lp-mock-title">Incoming call · 2m 14s</span>
          <span class="lp-mock-pill lp-mock-pill-urgent">Urgent</span>
        </div>
        <div class="lp-mock-body lp-mock-body-pad">
          <div class="lp-mock-field"><span>Caller</span><strong>Dave — Riverside Plant</strong></div>
          <div class="lp-mock-field"><span>Job type</span><strong>Motor control fault</strong></div>
          <div class="lp-mock-field"><span>Booked</span><strong>Thu 09:00 · Mike R.</strong></div>
          <div class="lp-mock-summary">
            "Caller reports a tripping contactor on line 3. Booked the next available slot
            and flagged as urgent. Confirmation sent by SMS."
          </div>
        </div>
      </div>
    </div>
  );
}

function InboxMockup() {
  return (
    <div class="lp-feature-mock" aria-hidden="true">
      <div class="lp-mock-window lp-mock-window-sm">
        <div class="lp-mock-bar">
          <Mail size={13} class="lp-mock-bar-icon" />
          <span class="lp-mock-title">Inbox · 3 actions</span>
        </div>
        <div class="lp-mock-body lp-mock-body-pad">
          {[
            { f: "purchasing@northgate", s: "Quote request: 2x switchboards", tag: "Quote", c: "#06b6d4" },
            { f: "site@harbourworks", s: "Re: schedule for Tuesday", tag: "Booking", c: "#a78bfa" },
            { f: "accounts@meridian", s: "Invoice #1142 — payment", tag: "Invoice", c: "#34d399" },
          ].map((m) => (
            <div key={m.f} class="lp-mock-mail">
              <div class="lp-mock-mail-main">
                <strong>{m.s}</strong>
                <span>{m.f}</span>
              </div>
              <span class="lp-mock-pill" style={{ color: m.c, borderColor: `${m.c}55`, background: `${m.c}18` }}>{m.tag}</span>
            </div>
          ))}
          <div class="lp-mock-draft"><Wrench size={12} /> Draft reply ready for review</div>
        </div>
      </div>
    </div>
  );
}

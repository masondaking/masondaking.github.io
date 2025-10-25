import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Sparkles, Wand2, Lightbulb, FileText, Bug, Compass, PenTool } from "lucide-react";
import { Link } from "react-router-dom";
import { FeatureCard } from "../../components/ui/FeatureCard";

const heroVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
};

const orbVariants = {
  initial: { opacity: 0.35, scale: 0.9 },
  animate: { opacity: 0.75, scale: 1.08 },
};

const floatTransition = {
  duration: 6,
  repeat: Infinity,
  repeatType: "reverse" as const,
  ease: "easeInOut" as const,
};

const workflowSteps = [
  { title: "Imagine", description: "Start with a spark and a scene." },
  { title: "Create", description: "Draft with AI and keep control." },
  { title: "Polish", description: "Tighten voice, pacing, and flow." },
];

const faqsData = [
  { q: "Do you store my API keys?", a: "No. Keys remain in your browser." },
  { q: "Can I add my own endpoint?", a: "Yes. Create a custom provider in settings." },
  { q: "How long can a story be?", a: "From flash pieces to full chapters." },
];

const samplePrompts = [
  {
    label: "Solarpunk Mystery",
    description: "A detective uncovers sabotage inside a climate-positive arcade of gardens.",
  },
  {
    label: "Romantic Heist",
    description: "Two thieves fall for each other during a memory heist in a neon city.",
  },
  {
    label: "Mythic Horror",
    description: "A folklorist excavates sleeping gods beneath a lighthouse town.",
  },
];

const quickStartLinks = [
  { label: "Draft in Studio", to: "/studio", icon: <PenTool size={18} /> },
  { label: "Browse Library", to: "/stories", icon: <Compass size={18} /> },
];

const innovationCards = [
  {
    title: "Command palette",
    badge: "New",
    description: "Open the global palette with Cmd/Ctrl+K to jump anywhere or toggle debug tools.",
    bullets: ["Navigate without leaving the keyboard", "Toggle the debug console instantly"],
    cta: { label: "Try it", to: "/studio" },
  },
  {
    title: "Onboarding checklist",
    badge: "Guide",
    description: "Stay on track with draft, publish, and feedback milestones right inside the Studio sidebar.",
    bullets: ["Track progress automatically", "Celebrate each completed milestone"],
    cta: { label: "See checklist", to: "/studio" },
  },
  {
    title: "Cinematic covers",
    badge: "Gallery",
    description: "Generate multi-style cover art or upload your own and curate a gallery for every story.",
    bullets: ["Three AI-inspired style presets", "Instant gallery with thumbnail selector"],
    cta: { label: "Build covers", to: "/studio" },
  },
  {
    title: "Audio previews",
    badge: "Listen",
    description: "Let readers sample your prose with one-click text-to-speech snippets on every story.",
    bullets: ["Web speech integration", "Toggle playback right from the story"],
    cta: { label: "Hear a sample", to: "/stories" },
  },
];

const faqs = [
  {
    q: "Do you store my API keys?",
    a: "Keys stay in your browser only. We encrypt them with Web Crypto before persisting locally.",
  },
  {
    q: "Can I bring my own AI endpoint?",
    a: "Yes – add a custom provider with a base URL, headers, and prompt template inside the studio settings.",
  },
  {
    q: "How long can stories be?",
    a: "You control the target length. Providers support flash fiction through full-length chapters.",
  },
];

export function LandingPage() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 12 });
  const sy = useSpring(my, { stiffness: 60, damping: 12 });
  const leftX = useTransform(sx, (v) => v * -24);
  const leftY = useTransform(sy, (v) => v * -12);
  const rightX = useTransform(sx, (v) => v * 24);
  const rightY = useTransform(sy, (v) => v * 12);

  const onHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1..1
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1..1
    mx.set(nx);
    my.set(ny);
  };
  const onHeroLeave = () => { mx.set(0); my.set(0); };
  return (
    <div className="landing">
      <section className="hero" onMouseMove={onHeroMouseMove} onMouseLeave={onHeroLeave}>
        <motion.div
          className="hero__background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          <motion.span
            className="hero__aurora"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            transition={{ duration: 1 }}
          />
          <motion.span
            className="hero__orb hero__orb--left"
            style={{ x: leftX, y: leftY }}
            variants={orbVariants}
            initial="initial"
            animate="animate"
            transition={{ ...floatTransition, duration: 8 }}
          />
          <motion.span
            className="hero__orb hero__orb--right"
            style={{ x: rightX, y: rightY }}
            variants={orbVariants}
            initial="initial"
            animate="animate"
            transition={{ ...floatTransition, duration: 7.5, delay: 0.4 }}
          />
          <motion.span
            className="hero__grid"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 0.4, y: 0 }}
            transition={{ duration: 1, delay: 0.32 }}
          />
        </motion.div>
        <motion.div
          className="hero__eyebrow"
          variants={heroVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <Sparkles size={16} /> Story tools for every author
        </motion.div>
        <motion.h1
          className="hero__heading"
          variants={heroVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.18, duration: 0.55 }}
        >
          Write unforgettable stories with AI at your side
        </motion.h1>
        <motion.p
          className="hero__description"
          variants={heroVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.26, duration: 0.55 }}
        >
          Dreamscribe blends narrative craft with orchestrated AI collaborators. Generate fresh drafts, invite critical
          feedback, and sculpt prose line by line – all in a single cinematic workspace.
        </motion.p>
        <motion.div
          className="hero__cta"
          variants={heroVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.32, duration: 0.45 }}
        >
          <Link to="/signup" className="primary-button">
            Start for free <ArrowRight size={18} />
          </Link>
          <Link to="/studio" className="ghost-button">
            Enter the studio
          </Link>
        </motion.div>
        <motion.div
          className="hero__metrics"
          initial="hidden"
          animate="visible"
          variants={heroVariants}
          transition={{ delay: 0.38, duration: 0.45 }}
        >
          <div className="metric-chip">
            <h3>40+</h3>
            <p>Genre presets tuned with narrative prompts</p>
          </div>
          <div className="metric-chip">
            <h3>Multimodel</h3>
            <p>Blend OpenAI, Anthropic, Gemini, and DeepSeek</p>
          </div>
          <div className="metric-chip">
            <h3>Debug first</h3>
            <p>See prompts, tokens, and timing for runs</p>
          </div>
        </motion.div>
      </section>

      <section className="get-started-shell">
        <div className="get-started__billboard">
          <div className="get-started__intro">
            <span className="get-started__eyebrow">Quick start</span>
            <h2>Jump into the studio with a ready-made prompt</h2>
            <p>Choose a vibe, paste it into the Studio, and generate your first draft in under a minute.</p>
            <div className="get-started__cta">
              {quickStartLinks.map((item) => (
                <Link key={item.label} to={item.to} className="primary-button">
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="get-started__prompts">
            {samplePrompts.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                className="prompt-chip"
                onClick={() => navigator.clipboard.writeText(prompt.description).catch(() => {})}
              >
                <strong>{prompt.label}</strong>
                <span>{prompt.description}</span>
              </button>
            ))}
            <p className="get-started__hint">Click to copy a prompt. Paste it into the Studio to try it out.</p>
          </div>
        </div>
      </section>
      <section className="section-shell innovation-lab">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45 }}
        >
          Fresh upgrades in Dreamscribe
        </motion.h2>
        <p className="section-subtitle">These launch-ready tools make the writing loop faster and more fun.</p>
        <div className="innovation-grid">
          {innovationCards.map((card, index) => (
            <motion.article
              key={card.title}
              className="innovation-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
            >
              <header>
                <span className="innovation-badge">{card.badge}</span>
                <h3>{card.title}</h3>
              </header>
              <p>{card.description}</p>
              <ul className="innovation-list">
                {card.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <footer>
                <Link to={card.cta.to} className="primary-button">
                  {card.cta.label} <ArrowRight size={16} />
                </Link>
              </footer>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="section-shell" id="features">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ delay: 0.1, duration: 0.45 }}
        >
          A studio where every draft has backup
        </motion.h2>
        <p className="section-subtitle">Fast, clear, and playful. You stay in charge.</p>
        <div className="card-grid">
          <FeatureCard
            icon={<Wand2 size={24} />}
            title="Intent aware drafting"
            description="Set tone, pace, and POV. We turn intent into prompts."
          >
            <ul className="feature-list">
              <li>Outline to prose pipelines</li>
              <li>Snapshot checkpoints for branches</li>
              <li>Scene level beat guidance</li>
            </ul>
          </FeatureCard>
          <FeatureCard
            icon={<Lightbulb size={24} />}
            title="Feedback that coaches"
            description="Ask for critiques on dialogue, worldbuilding, or narrative tension. Models respond with practical edits."
            delay={0.08}
          >
            <ul className="feature-list">
              <li>Grammar + style aligned to your genre</li>
              <li>Highlight problem sentences automatically</li>
              <li>Rewrite suggestions you can accept inline</li>
            </ul>
          </FeatureCard>
          <FeatureCard
            icon={<Bug size={24} />}
            title="Deep debugging"
            description="Track prompts, tokens, and latency to tune your runs."
            delay={0.16}
          >
            <ul className="feature-list">
              <li>Structured log timeline</li>
              <li>Prompt diffing between revisions</li>
              <li>Abort + retry with one keystroke</li>
            </ul>
          </FeatureCard>
          <FeatureCard
            icon={<FileText size={24} />}
            title="Publish ready exports"
            description="Export to markdown or TXT, copy fast, and sync to apps."
            delay={0.24}
          >
            <ul className="feature-list">
              <li>Built in style sheets for ereaders</li>
              <li>Chapter bundling with auto table of contents</li>
              <li>Version history with restore</li>
            </ul>
          </FeatureCard>
        </div>
      </section>

      <section className="section-shell" id="workflow">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45 }}
        >
          Your writing flow, amplified
        </motion.h2>
        <div className="workflow-grid">
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.title}
              className="workflow-step glass-card"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <span className="workflow-step__index">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="section-shell" id="pricing">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45 }}
        >
          Pricing that respects your stack
        </motion.h2>
        <div className="pricing-grid">
          <motion.div
            className="pricing-card glass-card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45, delay: 0.04 }}
          >
            <h3>Creator</h3>
            <p className="pricing-card__price">Free</p>
            <ul>
              <li>Bring your own API keys</li>
              <li>Unlimited drafts & branches</li>
              <li>Feedback coach + grammar passes</li>
            </ul>
            <Link to="/signup" className="primary-button">
              Start writing
            </Link>
          </motion.div>
          <motion.div
            className="pricing-card glass-card pricing-card--accent"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45, delay: 0.12 }}
          >
            <h3>Studios</h3>
            <p className="pricing-card__price">$12 / seat</p>
            <ul>
              <li>Team prompt library</li>
              <li>Shared debug timeline</li>
              <li>Anthology export + brand kit</li>
            </ul>
            <button type="button" className="ghost-button">
              Talk to us
            </button>
          </motion.div>
        </div>
      </section>

      <section className="section-shell" id="faq">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45 }}
        >
          Answers for curious creators
        </motion.h2>
        <div className="faq-grid">
          {faqsData.map((item, idx) => (
            <motion.div
              key={item.q}
              className="faq-item glass-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: idx * 0.08 }}
            >
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}


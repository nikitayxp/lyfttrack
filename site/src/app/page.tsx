import Image from "next/image";

const BLOG_POSTS = [
  {
    id: "progressive-overload",
    title: "Progressive Overload: The Only Principle You Need",
    excerpt:
      "If you're not progressively overloading, you're not growing. Here's why tracking every set matters and how LyftTrack makes it effortless.",
    date: "Mar 25, 2026",
    readTime: "5 min read",
    tag: "Training",
    tagColor: "#F97316",
  },
  {
    id: "why-track-workouts",
    title: "Why You Should Track Every Workout",
    excerpt:
      "The difference between people who plateau and people who keep growing? Data. Learn why a training log is your most powerful tool in the gym.",
    date: "Mar 20, 2026",
    readTime: "4 min read",
    tag: "Mindset",
    tagColor: "#8B5CF6",
  },
  {
    id: "rir-explained",
    title: "RIR Explained: Train Smarter, Not Harder",
    excerpt:
      "Reps in Reserve (RIR) is a game-changer for managing fatigue and maximising hypertrophy. Here's how LyftTrack helps you dial it in.",
    date: "Mar 15, 2026",
    readTime: "6 min read",
    tag: "Science",
    tagColor: "#22C55E",
  },
  {
    id: "building-lyfttrack",
    title: "Building LyftTrack: From Idea to App",
    excerpt:
      "A behind-the-scenes look at how we're building a modern workout tracker with React Native, Expo and Supabase.",
    date: "Mar 10, 2026",
    readTime: "8 min read",
    tag: "Dev Log",
    tagColor: "#007AFF",
  },
  {
    id: "volume-landmarks",
    title: "Volume Landmarks: How Much Should You Train?",
    excerpt:
      "MEV, MAV, MRV — understanding volume landmarks is key to programming effective training. We break down the science.",
    date: "Mar 5, 2026",
    readTime: "7 min read",
    tag: "Science",
    tagColor: "#22C55E",
  },
  {
    id: "rest-recovery",
    title: "Rest & Recovery: The Missing Piece",
    excerpt:
      "You don't grow in the gym — you grow when you rest. Learn about sleep, nutrition timing and deload weeks.",
    date: "Feb 28, 2026",
    readTime: "5 min read",
    tag: "Recovery",
    tagColor: "#EC4899",
  },
];

function NavBar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-primary)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2 no-underline">
          <Image src="/logo.jpg" alt="LyftTrack" width={140} height={42} className="h-[42px] w-auto" />
        </a>

        <div className="flex items-center gap-6">
          <a
            href="#blog"
            className="text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:text-white no-underline"
          >
            Blog
          </a>
          <a
            href="#"
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 no-underline"
          >
            Get the App
          </a>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--border)]">
      {/* Glow effect */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-[var(--accent)] opacity-[0.06] blur-[120px]" />

      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32 text-center relative">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          LyftTrack Blog
        </div>

        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white md:text-6xl md:leading-[1.1]">
          Track. Lift.{" "}
          <span className="bg-gradient-to-r from-[var(--accent)] to-[#60A5FA] bg-clip-text text-transparent">
            Grow.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
          Insights on training, progressive overload, and building the best
          workout tracker for serious athletes.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <a
            href="#blog"
            className="rounded-full bg-[var(--accent)] px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-[var(--accent)]/25 transition-all hover:brightness-110 no-underline"
          >
            Read Latest Posts
          </a>
          <a
            href="#"
            className="rounded-full border border-[var(--border-strong)] px-8 py-3.5 text-base font-semibold text-[var(--text-secondary)] transition-all hover:border-[var(--accent)] hover:text-white no-underline"
          >
            Download App
          </a>
        </div>
      </div>
    </section>
  );
}

function BlogCard({
  post,
  featured = false,
}: {
  post: (typeof BLOG_POSTS)[number];
  featured?: boolean;
}) {
  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] transition-all hover:border-[var(--accent)]/50 hover:shadow-xl hover:shadow-[var(--accent)]/5 ${
        featured ? "md:col-span-2 md:row-span-2" : ""
      }`}
    >
      {/* Top accent bar */}
      <div
        className="h-1 w-full transition-all group-hover:h-1.5"
        style={{ backgroundColor: post.tagColor }}
      />

      <div className={`p-6 ${featured ? "md:p-10" : ""}`}>
        <div className="mb-4 flex items-center gap-3">
          <span
            className="rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: post.tagColor + "18",
              color: post.tagColor,
            }}
          >
            {post.tag}
          </span>
          <span className="text-xs font-medium text-[var(--text-muted)]">
            {post.date}
          </span>
        </div>

        <h2
          className={`font-extrabold leading-snug tracking-tight text-white mb-3 group-hover:text-[var(--accent)] transition-colors ${
            featured
              ? "text-2xl md:text-3xl"
              : "text-lg"
          }`}
        >
          {post.title}
        </h2>

        <p
          className={`leading-relaxed text-[var(--text-secondary)] mb-6 ${
            featured ? "text-base" : "text-sm"
          }`}
        >
          {post.excerpt}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            {post.readTime}
          </span>
          <span className="text-sm font-semibold text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
            Read more →
          </span>
        </div>
      </div>
    </article>
  );
}

function BlogGrid() {
  const featured = BLOG_POSTS[0];
  const rest = BLOG_POSTS.slice(1);

  return (
    <section id="blog" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            Latest Articles
          </h2>
          <p className="mt-2 text-base text-[var(--text-muted)]">
            Training science, dev logs, and everything in between.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <BlogCard post={featured} featured />
        {rest.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}

function Newsletter() {
  return (
    <section className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-10 md:p-16 text-center">
          {/* Glow */}
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-[var(--accent)] opacity-[0.08] blur-[80px]" />

          <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            Stay in the Loop
          </h2>
          <p className="mt-3 text-base text-[var(--text-secondary)]">
            Get training tips, app updates and exclusive content. No spam, ever.
          </p>

          <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-alt)] px-5 py-3.5 text-sm font-medium text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button className="rounded-xl bg-[var(--accent)] px-8 py-3.5 text-sm font-bold text-white transition-all hover:brightness-110 whitespace-nowrap">
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-primary)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <Image src="/logo.jpg" alt="LyftTrack" width={120} height={36} className="h-[36px] w-auto" />
          </div>

          <p className="text-sm text-[var(--text-muted)]">
            © {new Date().getFullYear()} LyftTrack. Built for athletes, by athletes.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <NavBar />
      <HeroSection />
      <BlogGrid />
      <Newsletter />
      <Footer />
    </>
  );
}

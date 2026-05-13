export type MarketingPost = {
  id: string;
  title: string;
  excerpt: string;
  tag: 'Training' | 'Science' | 'Recovery' | 'Mindset' | 'Product';
  readTimeMinutes: number;
  publishedAt: string;
};

export type RoadmapFeature = {
  id: string;
  title: string;
  description: string;
  stage: 'In Progress' | 'Research' | 'Planned';
  baseVotes: number;
};

export const MARKETING_POSTS: MarketingPost[] = [
  {
    id: 'adaptive-overload',
    title: 'Adaptive Overload: Stop Guessing Your Next Top Set',
    excerpt:
      'How we use recent performance and fatigue signals to suggest smart weight jumps without burning you out.',
    tag: 'Training',
    readTimeMinutes: 6,
    publishedAt: '2026-03-25',
  },
  {
    id: 'weekly-volume-labs',
    title: 'Weekly Volume Labs: The Metric Most Lifters Ignore',
    excerpt:
      'Volume by muscle, not by ego. A practical framework to balance stimulus and recovery across your week.',
    tag: 'Science',
    readTimeMinutes: 7,
    publishedAt: '2026-03-20',
  },
  {
    id: 'warmup-flow',
    title: 'Warmup Flow That Saves 15 Minutes Every Session',
    excerpt:
      'A repeatable warmup template inside LyftTrack that keeps quality high and wasted sets low.',
    tag: 'Training',
    readTimeMinutes: 4,
    publishedAt: '2026-03-17',
  },
  {
    id: 'build-log-q1',
    title: 'Build Log Q1: Shipping Faster Without Breaking User Trust',
    excerpt:
      'The release process, instrumentation and QA checklists behind our most stable quarter so far.',
    tag: 'Product',
    readTimeMinutes: 8,
    publishedAt: '2026-03-12',
  },
  {
    id: 'sleep-and-strength',
    title: 'Sleep and Strength: Why Your Last Rep Depends on Last Night',
    excerpt:
      'A simple scorecard for sleep quality and how to adapt intensity when recovery is compromised.',
    tag: 'Recovery',
    readTimeMinutes: 5,
    publishedAt: '2026-03-08',
  },
  {
    id: 'consistency-loop',
    title: 'The Consistency Loop: Motivation Is a Lagging Indicator',
    excerpt:
      'Build systems that survive low motivation days and keep progression compounding month after month.',
    tag: 'Mindset',
    readTimeMinutes: 5,
    publishedAt: '2026-03-03',
  },
];

export const ROADMAP_FEATURES: RoadmapFeature[] = [
  {
    id: 'coach-share-mode',
    title: 'Coach Share Mode',
    description: 'Send live training blocks to a coach with set-level feedback and compliance tracking.',
    stage: 'In Progress',
    baseVotes: 142,
  },
  {
    id: 'macro-and-weight-sync',
    title: 'Macro and Weight Sync',
    description: 'Sync daily bodyweight and macros to correlate nutrition with strength progression.',
    stage: 'Research',
    baseVotes: 118,
  },
  {
    id: 'video-form-journal',
    title: 'Video Form Journal',
    description: 'Attach short clips to sets, then review technique progression over training cycles.',
    stage: 'Planned',
    baseVotes: 101,
  },
  {
    id: 'session-heatmap',
    title: 'Session Heatmap',
    description: 'Visualize effort density, rest behavior and missed targets across each training block.',
    stage: 'Planned',
    baseVotes: 95,
  },
];

// Stripe Configuration
// Price IDs from Stripe Dashboard

export const STRIPE_CONFIG = {
  // Subscription Plans (LIVE MODE)
  prices: {
    proMonthly: 'price_1SrkmEBnbCkzZ0frTMK3OCGW',
    proSemester: 'price_1SrkltBnbCkzZ0friqAZhVYD',
    proAnnual: 'price_1SrklwBnbCkzZ0frGGrAUgdC',
  },

  // Credit Packs (one-time purchases) (LIVE MODE)
  credits: {
    pack25: { priceId: 'price_1SrklzBnbCkzZ0freRRZNYlF', credits: 25 },
    pack50: { priceId: 'price_1Srkm1BnbCkzZ0frhJ8jcoVN', credits: 50 },
    pack100: { priceId: 'price_1Srkm4BnbCkzZ0frzOYkZXRC', credits: 100 },
  },

  // Plan details for display
  plans: {
    proMonthly: {
      name: 'Pro Monthly',
      price: 14.99,
      period: 'month',
      generations: 1000,
      aiTutorMessages: 1000, // per day
    },
    proSemester: {
      name: 'Pro Semester',
      price: 49.99,
      period: '4 months',
      generations: 1000,
      aiTutorMessages: 1000,
      savings: '~$10 off',
    },
    proAnnual: {
      name: 'Pro Annual',
      price: 99.99,
      period: 'year',
      generations: 1000,
      aiTutorMessages: 1000,
      savings: '~$80 off',
    },
  },

  // Free tier limits
  freeTier: {
    generations: 25,
    aiTutorMessages: 0,
  },

  // Pro tier limits
  proTier: {
    generations: 1000,
    aiTutorMessages: 1000, // per day
  },
};

// Feature access by tier
export const FEATURES = {
  free: {
    flashcards: true,
    quizzes: true,
    summaryNotes: true,
    conceptMaps: false,
    mockTests: false,
    aiTutor: false,
    srsReview: false,
    analytics: false,
  },
  pro: {
    flashcards: true,
    quizzes: true,
    summaryNotes: true,
    conceptMaps: true,
    mockTests: true,
    aiTutor: true,
    srsReview: true,
    analytics: true,
  },
};

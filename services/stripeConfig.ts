// Stripe Configuration
// Price IDs from Stripe Dashboard

export const STRIPE_CONFIG = {
  // Subscription Plans
  prices: {
    proMonthly: 'price_1Sn7frBqCnLJvgINioGtjNlu',
    proSemester: 'price_1Sn7h8BqCnLJvgINum0uluPA',
    proAnnual: 'price_1Sn7o4BqCnLJvgINSjWw3ly8',
  },

  // Credit Packs (one-time purchases)
  credits: {
    pack25: { priceId: 'price_1Sn7pJBqCnLJvgINEwYx5kLI', credits: 25 },
    pack50: { priceId: 'price_1Sn7qWBqCnLJvgINLtBkKpkA', credits: 50 },
    pack100: { priceId: 'price_1Sn7rsBqCnLJvgINalcNIC0v', credits: 100 },
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

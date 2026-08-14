export interface SeedTemplate {
  name: string;
  subject: string;
  bodyText: string;
}

/**
 * §12 — every new user gets these three, short and specific, one ask, no adjectives.
 * Verified in seed-templates.test.ts: each passes hasPersonalizationVariable, has zero
 * validateTemplate warnings, and is under 120 words.
 */
export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    name: "SDE application",
    subject: "SDE application — {{my_name}}, {{my_college}}",
    bodyText: `Hi {{first_name}},

I'm {{my_name}}, a final-year student at {{my_college}}. I saw {{company}} is hiring for {{title}} and wanted to apply directly.

Resume is attached. Happy to share more — projects, coursework, anything useful — if there's a good next step.

Thanks for your time,
{{my_name}}`,
  },
  {
    name: "Referral request",
    subject: "Quick referral question — {{company}}",
    bodyText: `Hi {{first_name}},

I'm {{my_name}}, final year at {{my_college}}, applying for {{title}} roles. {{company}} is high on my list.

Would you be open to referring me, or pointing me to the right person? Resume attached.

Appreciate it either way,
{{my_name}}`,
  },
  {
    name: "Follow-up",
    subject: "Following up — {{title}} at {{company}}",
    bodyText: `Hi {{first_name}},

Following up on my note about the {{title}} role at {{company}} — not sure it reached the right person.

Still very interested, and happy to send anything else that's useful. Resume attached again for convenience.

Thanks,
{{my_name}}`,
  },
];

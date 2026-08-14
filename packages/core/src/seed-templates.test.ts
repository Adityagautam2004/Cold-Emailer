import { describe, expect, it } from "vitest";
import { SEED_TEMPLATES } from "./seed-templates.js";
import { hasPersonalizationVariable, validateTemplate } from "./template.js";

describe("seed templates (§12)", () => {
  it.each(SEED_TEMPLATES)("$name has a personalisation variable", ({ bodyText }) => {
    expect(hasPersonalizationVariable(bodyText)).toBe(true);
  });

  it.each(SEED_TEMPLATES)("$name has zero save-time warnings", ({ subject, bodyText }) => {
    expect(validateTemplate(subject, bodyText)).toEqual([]);
  });

  it.each(SEED_TEMPLATES)("$name body is under 120 words", ({ bodyText }) => {
    const words = bodyText.trim().split(/\s+/).filter(Boolean).length;
    expect(words).toBeLessThan(120);
  });

  it("has exactly the three named templates", () => {
    expect(SEED_TEMPLATES.map((t) => t.name)).toEqual(["SDE application", "Referral request", "Follow-up"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  hasPersonalizationVariable,
  renderTemplate,
  validateContactsAgainstTemplate,
  validateTemplate,
} from "./template.js";

describe("renderTemplate", () => {
  const baseCtx = { hrName: "Priya Sharma", company: "Acme Corp", title: "SDE Intern", myName: "Rahul Verma", myCollege: "IIT Bombay" };

  it("renders every recognised variable", () => {
    const text = "Hi {{first_name}}, I saw {{company}} is hiring a {{title}}. — {{my_name}}, {{my_college}}";
    const result = renderTemplate(text, baseCtx);
    expect(result.ok).toBe(true);
    expect(result.text).toBe("Hi Priya, I saw Acme Corp is hiring a SDE Intern. — Rahul Verma, IIT Bombay");
  });

  it("renders custom.* variables from mapped columns", () => {
    const result = renderTemplate("Ref: {{custom.referral_code}}", { ...baseCtx, custom: { referral_code: "R-42" } });
    expect(result.ok).toBe(true);
    expect(result.text).toBe("Ref: R-42");
  });

  it("is an error, never an empty string, when a variable is missing", () => {
    const result = renderTemplate("Hi {{hr_name}}, I saw {{company}} is hiring", {
      ...baseCtx,
      hrName: null,
      company: null,
    });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(["hr_name", "company"]));
    expect(result.text).toBeUndefined();
  });

  it("flags an unrecognised variable name as unknown, not silently blank", () => {
    const result = renderTemplate("Hi {{hr_nmae}}", baseCtx);
    expect(result.ok).toBe(false);
    expect(result.unknown).toEqual(["hr_nmae"]);
  });

  it("derives first_name as the first token of hr_name", () => {
    const result = renderTemplate("{{first_name}}", { ...baseCtx, hrName: "Dr. Priya Sharma" });
    expect(result.ok).toBe(true);
    expect(result.text).toBe("Dr.");
  });
});

describe("hasPersonalizationVariable (§2.4)", () => {
  it("accepts hr_name, first_name, company, title, custom.*", () => {
    expect(hasPersonalizationVariable("Hi {{hr_name}}")).toBe(true);
    expect(hasPersonalizationVariable("{{company}} is great")).toBe(true);
    expect(hasPersonalizationVariable("{{custom.batch}}")).toBe(true);
  });

  it("rejects a template with only sender-side variables", () => {
    expect(hasPersonalizationVariable("From {{my_name}} at {{my_college}}")).toBe(false);
  });

  it("rejects a template with no variables at all", () => {
    expect(hasPersonalizationVariable("Hello, I am applying for a job.")).toBe(false);
  });
});

describe("validateTemplate save-time warnings", () => {
  it("warns on a body with no variable", () => {
    const warnings = validateTemplate("Application", "Hello, I am interested in your company.");
    expect(warnings.some((w) => w.code === "no-variable")).toBe(true);
  });

  it("warns on a subject over 60 characters", () => {
    const warnings = validateTemplate("x".repeat(61), "Hi {{hr_name}}");
    expect(warnings.some((w) => w.code === "subject-too-long")).toBe(true);
  });

  it("warns on a body over 200 words", () => {
    const warnings = validateTemplate("Subject", `{{hr_name}} ${"word ".repeat(205)}`);
    expect(warnings.some((w) => w.code === "body-too-long")).toBe(true);
  });

  it("warns on spam trigger words", () => {
    expect(validateTemplate("s", "{{hr_name}} guaranteed interview").some((w) => w.code === "spam-trigger-word")).toBe(
      true
    );
  });

  it("warns on an all-caps run", () => {
    expect(validateTemplate("s", "{{hr_name}} THIS IS URGENT").some((w) => w.code === "all-caps-run")).toBe(true);
  });

  it("warns on more than one exclamation mark", () => {
    expect(
      validateTemplate("s", "{{hr_name}} great! amazing!").some((w) => w.code === "too-many-exclamations")
    ).toBe(true);
  });

  it("has no warnings for a clean, personalised template", () => {
    const warnings = validateTemplate("Quick question about {{company}}", "Hi {{hr_name}}, I am interested in the {{title}} role.");
    expect(warnings).toEqual([]);
  });
});

describe("validateContactsAgainstTemplate", () => {
  it("names exactly which rows and which variables are unresolved", () => {
    const contacts = [
      { rowNumber: 2, email: "a@x.com", hrName: "Asha", company: "Acme" },
      { rowNumber: 3, email: "b@x.com", hrName: null, company: "Beta" },
      { rowNumber: 4, email: "c@x.com", hrName: "Chetan", company: null },
    ];
    const rows = validateContactsAgainstTemplate(
      "Hi {{hr_name}}",
      "I saw {{company}} is hiring",
      contacts,
      { myName: "Me", myCollege: "College" }
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.rowNumber === 3)?.variables).toContain("hr_name");
    expect(rows.find((r) => r.rowNumber === 4)?.variables).toContain("company");
  });

  it("returns no rows when every contact resolves cleanly", () => {
    const contacts = [{ rowNumber: 2, email: "a@x.com", hrName: "Asha", company: "Acme" }];
    const rows = validateContactsAgainstTemplate("Hi {{hr_name}}", "{{company}}", contacts, {
      myName: "Me",
      myCollege: "College",
    });
    expect(rows).toEqual([]);
  });
});

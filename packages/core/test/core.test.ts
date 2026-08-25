import { describe, expect, it } from "vitest";
import { RestrictedEvaluator, runSpecification } from "../src/index.js";

describe("runSpecification", () => {
  it("executes basic namespaced commands and decorates their results", async () => {
    const result = await runSpecification({
      source: `<html xmlns:concordion="http://www.concordion.org/2007/concordion"><body>
        <span concordion:assertEquals="greeting">Hello</span>
        <span data-concordion-assert-true="ready">ready</span>
        <span concordion:echo="asyncGreeting()">ignored</span>
      </body></html>`,
      fixture: { greeting: "Hello", ready: true, async asyncGreeting() { return "Async hello"; } },
    });
    expect(result.summary).toEqual({ successes: 2, failures: 0, exceptions: 0, ignored: 0 });
    expect(result.html).toContain("Async hello");
    expect(result.html).toContain("concordion-success");
  });

  it("records failures and exceptions without aborting the report", async () => {
    const result = await runSpecification({
      source: `<html><span data-concordion-assert-equals="value">expected</span><i concordion:execute="missing()"/></html>`,
      fixture: { value: "actual" },
    });
    expect(result.summary.failures).toBe(1);
    expect(result.summary.exceptions).toBe(1);
    expect(result.html).toContain('data-concordion-actual="actual"');
    expect(result.html).toContain("Fixture method not found");
  });

  it("parses ordinary HTML and stores set values as text", async () => {
    const result = await runSpecification({
      source: `<main><p data-concordion-set="#name">Ada &amp; Bob
        <br><span>team</span></p><strong data-concordion-assert-equals="#name">Ada &amp; Bob
        team</strong></main>`,
      fixture: {},
    });
    expect(result.summary.successes).toBe(1);
    expect(result.html).toContain("<html>");
    expect(result.html).toContain("<br>");
  });

  it("runs specification hooks around commands, including async hooks", async () => {
    const events: string[] = [];
    const result = await runSpecification({
      source: `<html><span data-concordion-assert-equals="value">ready</span></html>`,
      fixture: { value: "not ready" },
      hooks: {
        async beforeSpecification({ evaluator }) {
          events.push("before");
          (evaluator as RestrictedEvaluator).setVariable("unused", true);
        },
        afterSpecification() { events.push("after"); },
      },
    });
    expect(events).toEqual(["before", "after"]);
    expect(result.summary.failures).toBe(1);
  });

  it("reports multiple command attributes instead of depending on attribute order", async () => {
    const result = await runSpecification({
      source: `<span data-concordion-echo="value" data-concordion-assert-equals="value">value</span>`,
      fixture: { value: "value" },
    });
    expect(result.summary).toMatchObject({ exceptions: 1, successes: 0 });
    expect(result.html).toContain("Multiple commands per element");
  });

  it("builds a command tree so execute wraps its child command phases", async () => {
    const fixture = {
      value: "before",
      update() { this.value = "after"; },
    };
    const result = await runSpecification({
      source: `<section data-concordion-execute="update()">
        <span data-concordion-assert-equals="value">after</span>
      </section>`,
      fixture,
    });
    expect(result.summary).toMatchObject({ successes: 1, failures: 0, exceptions: 0 });
  });
});

describe("RestrictedEvaluator", () => {
  it("supports variables, paths, literals, arguments, and async fixture methods", async () => {
    const evaluator = new RestrictedEvaluator({
      user: { names: ["Ada"] },
      async greet(name: unknown, count: unknown) { return `${name}:${count}`; },
    });
    evaluator.setVariable("#result", { ok: true });
    await expect(evaluator.evaluate("user.names[0]")).resolves.toBe("Ada");
    await expect(evaluator.evaluate("#result.ok")).resolves.toBe(true);
    await expect(evaluator.evaluate("greet('hello', 2)")).resolves.toBe("hello:2");
    await expect(evaluator.evaluate("process.exit()")) .rejects.toThrow("Unsupported expression");
  });
});

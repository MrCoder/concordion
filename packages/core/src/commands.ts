import type { Command, CommandContext } from "./types.js";

const decorate = (context: CommandContext, status: string): void => {
  context.element.attr("data-concordion-result", status).addClass(`concordion-${status}`);
};

export const builtInCommands: Readonly<Record<string, Command>> = {
  set: {
    async execute(context) {
      context.evaluator.setVariable(context.expression, context.element.text());
    },
  },
  execute: {
    async execute(context) {
      await context.children.setUp();
      await context.evaluator.evaluate(context.expression);
      await context.children.execute();
      await context.children.verify();
    },
  },
  echo: {
    async execute(context) { context.element.text(String(await context.evaluator.evaluate(context.expression) ?? "")); },
  },
  assertEquals: {
    async verify(context) {
      const expected = context.element.text().trim();
      const actual = await context.evaluator.evaluate(context.expression);
      if (String(actual) === expected) {
        context.results.success(); decorate(context, "success");
      } else {
        context.results.failure(); decorate(context, "failure");
        context.element.attr("data-concordion-actual", String(actual));
      }
    },
  },
  assertTrue: booleanAssertion(true),
  assertFalse: booleanAssertion(false),
};

function booleanAssertion(expected: boolean): Command {
  return {
    async verify(context) {
      if (await context.evaluator.evaluate(context.expression) === expected) {
        context.results.success(); decorate(context, "success");
      } else {
        context.results.failure(); decorate(context, "failure");
      }
    },
  };
}

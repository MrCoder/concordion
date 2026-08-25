import { load } from "cheerio";
import type { Element } from "domhandler";
import { builtInCommands } from "./commands.js";
import { RestrictedEvaluator } from "./evaluator.js";
import { DefaultResultRecorder } from "./results.js";
import type {
  ChildCommands, Command, CommandContext, Evaluator, ParserMode, ResultRecorder,
  RunSpecificationOptions, SpecificationResult,
} from "./types.js";

const ATTRIBUTE = /^(?:concordion:|data-concordion-)([\w-]+)$/;

export async function runSpecification(options: RunSpecificationOptions): Promise<SpecificationResult> {
  const parserMode = resolveParserMode(options.source, options.parserMode ?? "auto");
  const $ = parserMode === "xhtml"
    ? load(options.source, { xml: { xmlMode: true, decodeEntities: false } })
    : load(options.source);
  const evaluator = options.evaluator ?? new RestrictedEvaluator(options.fixture);
  const results = new DefaultResultRecorder();
  const commands = { ...builtInCommands, ...options.commands };
  const fixtureContext = { evaluator, results };

  try {
    await options.hooks?.beforeSpecification?.(fixtureContext);
    const roots: CommandNode[] = [];
    for (const element of $("html").toArray()) buildCommandTree(element as Element, roots, $, commands, results);
    await createChildCommands(roots, $, evaluator, results).processSequentially();
  } catch (error) {
    results.exception();
    $("html").first().attr("data-concordion-error", error instanceof Error ? error.message : String(error));
  } finally {
    try {
      await options.hooks?.afterSpecification?.(fixtureContext);
    } catch (error) {
      results.exception();
      $("html").first().attr("data-concordion-after-error", error instanceof Error ? error.message : String(error));
    }
  }
  return { html: parserMode === "xhtml" ? $.xml() : $.html(), summary: results.summary() };
}

interface CommandNode {
  readonly element: Element;
  readonly expression: string;
  readonly command: Command;
  readonly children: CommandNode[];
}

function buildCommandTree(
  element: Element,
  parent: CommandNode[],
  $: CommandContext["$"],
  commands: Readonly<Record<string, Command>>,
  results: DefaultResultRecorder,
): void {
  const attributes = Object.entries(element.attribs).flatMap(([attribute, expression]) => {
    const match = ATTRIBUTE.exec(attribute);
    if (!match) return [];
    const command = commands[toCamelCase(match[1]!)];
    return command ? [{ command, expression }] : [];
  });
  let nextParent = parent;
  if (attributes.length > 1) {
    recordException($(element), results, "Multiple commands per element are not supported");
  } else if (attributes.length === 1) {
    const { command, expression } = attributes[0]!;
    const node: CommandNode = { element, expression, command, children: [] };
    parent.push(node);
    nextParent = node.children;
  }
  for (const child of $(element).children().toArray()) buildCommandTree(child as Element, nextParent, $, commands, results);
}

function createChildCommands(
  nodes: readonly CommandNode[],
  $: CommandContext["$"],
  evaluator: Evaluator,
  results: ResultRecorder,
): ChildCommands {
  const invoke = async (node: CommandNode, phase: "setUp" | "execute" | "verify"): Promise<void> => {
    const context: CommandContext = {
      $, element: $(node.element), evaluator, results, expression: node.expression,
      children: createChildCommands(node.children, $, evaluator, results),
    };
    try {
      await node.command[phase]?.(context);
    } catch (error) {
      recordException(context.element, results, error instanceof Error ? error.message : String(error));
    }
  };
  return {
    size: nodes.length,
    async setUp() { for (const node of nodes) await invoke(node, "setUp"); },
    async execute() { for (const node of nodes) await invoke(node, "execute"); },
    async verify() { for (const node of nodes) await invoke(node, "verify"); },
    async processSequentially() {
      for (const node of nodes) {
        await invoke(node, "setUp");
        await invoke(node, "execute");
        await invoke(node, "verify");
      }
    },
  };
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
}

function resolveParserMode(source: string, mode: ParserMode): Exclude<ParserMode, "auto"> {
  if (mode !== "auto") return mode;
  return /<\?xml\b|xmlns:concordion\s*=/.test(source) ? "xhtml" : "html";
}

function recordException(
  element: ReturnType<CommandContext["$"]>,
  results: ResultRecorder,
  message: string,
): void {
  results.exception();
  element.attr("data-concordion-result", "exception").addClass("concordion-exception");
  element.attr("data-concordion-error", message);
}

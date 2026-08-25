import type { Evaluator, Fixture } from "./types.js";

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const PATH = /^([A-Za-z_$][\w$]*)(?:(?:\.([A-Za-z_$][\w$]*))|(?:\[(\d+)\]))*$/;

export class RestrictedEvaluator implements Evaluator {
  readonly #variables = new Map<string, unknown>();

  public constructor(private readonly fixture: Fixture) {}

  public getVariable(name: string): unknown {
    return this.#variables.get(normalizeVariable(name));
  }

  public setVariable(name: string, value: unknown): void {
    const normalized = normalizeVariable(name);
    if (!IDENTIFIER.test(normalized)) throw new Error(`Invalid variable name: ${name}`);
    this.#variables.set(normalized, value);
  }

  public async evaluate(expression: string): Promise<unknown> {
    const value = expression.trim();
    if (!value) return undefined;
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number(value);
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      return value.slice(1, -1);
    }

    const call = /^([A-Za-z_$][\w$]*)\((.*)\)$/.exec(value);
    if (call) {
      const method = this.fixture[call[1]!];
      if (typeof method !== "function") throw new Error(`Fixture method not found: ${call[1]}`);
      const args = splitArguments(call[2]!).map((argument) => this.evaluate(argument));
      return Reflect.apply(method, this.fixture, await Promise.all(args));
    }

    return resolvePath(value, this.fixture, this.#variables);
  }
}

function normalizeVariable(name: string): string {
  return name.startsWith("#") ? name.slice(1) : name;
}

function resolvePath(expression: string, fixture: Fixture, variables: Map<string, unknown>): unknown {
  const normalized = normalizeVariable(expression);
  if (!PATH.test(normalized)) throw new Error(`Unsupported expression: ${expression}`);
  const parts = normalized.match(/[A-Za-z_$][\w$]*|\d+/g) ?? [];
  const root = parts.shift()!;
  let current: unknown = variables.has(root) ? variables.get(root) : fixture[root];
  for (const part of parts) {
    if (current === null || current === undefined || (typeof current !== "object" && typeof current !== "function")) {
      throw new Error(`Cannot read '${part}' in expression: ${expression}`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function splitArguments(source: string): string[] {
  if (!source.trim()) return [];
  const result: string[] = [];
  let quote = "";
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if ((character === "'" || character === '"') && source[index - 1] !== "\\") quote = quote === character ? "" : quote || character;
    if (character === "," && !quote) {
      result.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(source.slice(start).trim());
  return result;
}

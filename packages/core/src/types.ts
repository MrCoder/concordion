import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

export type Awaitable<T> = T | Promise<T>;
export type Fixture = Record<string, unknown>;
export type ParserMode = "auto" | "html" | "xhtml";

export interface FixtureContext {
  readonly evaluator: Evaluator;
  readonly results: ResultRecorder;
}

export interface FixtureHooks {
  beforeSpecification?(context: FixtureContext): Awaitable<void>;
  afterSpecification?(context: FixtureContext): Awaitable<void>;
}

export interface Evaluator {
  getVariable(name: string): unknown;
  setVariable(name: string, value: unknown): void;
  evaluate(expression: string): Awaitable<unknown>;
}

export interface ResultSummary {
  successes: number;
  failures: number;
  exceptions: number;
  ignored: number;
}

export interface CommandContext {
  readonly $: CheerioAPI;
  readonly element: Cheerio<Element>;
  readonly evaluator: Evaluator;
  readonly results: ResultRecorder;
  readonly expression: string;
  readonly children: ChildCommands;
}

export interface ChildCommands {
  readonly size: number;
  setUp(): Awaitable<void>;
  execute(): Awaitable<void>;
  verify(): Awaitable<void>;
  processSequentially(): Awaitable<void>;
}

export interface Command {
  setUp?(context: CommandContext): Awaitable<void>;
  execute?(context: CommandContext): Awaitable<void>;
  verify?(context: CommandContext): Awaitable<void>;
}

export interface ResultRecorder {
  success(): void;
  failure(): void;
  exception(): void;
  ignored(): void;
  summary(): Readonly<ResultSummary>;
}

export interface RunSpecificationOptions {
  source: string;
  fixture: Fixture;
  hooks?: FixtureHooks;
  parserMode?: ParserMode;
  evaluator?: Evaluator;
  commands?: Readonly<Record<string, Command>>;
}

export interface SpecificationResult {
  html: string;
  summary: Readonly<ResultSummary>;
}

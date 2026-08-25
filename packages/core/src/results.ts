import type { ResultRecorder, ResultSummary } from "./types.js";

export class DefaultResultRecorder implements ResultRecorder {
  readonly #result: ResultSummary = { successes: 0, failures: 0, exceptions: 0, ignored: 0 };
  public success(): void { this.#result.successes += 1; }
  public failure(): void { this.#result.failures += 1; }
  public exception(): void { this.#result.exceptions += 1; }
  public ignored(): void { this.#result.ignored += 1; }
  public summary(): Readonly<ResultSummary> { return { ...this.#result }; }
}

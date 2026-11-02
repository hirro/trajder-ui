import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Sparkline from "./Sparkline.svelte";

describe("Sparkline", () => {
  it("renders a line path for multiple values", () => {
    const { container } = render(Sparkline, { values: [1, 2, 3, 2, 4] });
    const path = container.querySelector("path.spark-line");
    expect(path?.getAttribute("d")).toBeTruthy();
  });

  it("renders nothing for an empty series", () => {
    const { container } = render(Sparkline, { values: [] });
    expect(container.querySelector("path.spark-line")).toBeNull();
  });

  it("draws a zero baseline only when the series spans zero", () => {
    const { container } = render(Sparkline, { values: [-2, 1, 3], zeroBaseline: true });
    expect(container.querySelector("line.spark-zero")).not.toBeNull();
  });
});

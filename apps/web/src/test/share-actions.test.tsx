import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareActions } from "../components/share-actions.js";

describe("ShareActions", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });

  it("copies a link and exposes email and text fallbacks", async () => {
    const writeText = vi.fn(async () => undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ShareActions url="https://journal.example.test/c/share" title="Favorites" />);
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith("https://journal.example.test/c/share");
    expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute("href", expect.stringContaining("mailto:"));
    expect(screen.getByRole("link", { name: "Text" })).toHaveAttribute("href", expect.stringContaining("sms:"));
  });

  it("supports native sharing and reports copy or share failures without treating cancellation as an error", async () => {
    const share = vi.fn(async () => undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<ShareActions url="https://journal.example.test/c/share" title="Favorites" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Share" })).toBeVisible());
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: "Favorites" }));
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copy failed"));

    share.mockRejectedValueOnce(new Error("share failed"));
    await user.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sharing failed"));

    share.mockRejectedValueOnce(new DOMException("cancelled", "AbortError"));
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByRole("status")).toHaveTextContent("Sharing failed");
  });
});

import Groq from "groq-sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AiServiceError, callJSON } from "../src/lib/ai/groq";

const response = (content: string) => ({
  choices: [{ message: { content } }],
  usage: { total_tokens: 12 },
});

const fakeClient = (implementation: () => unknown) => ({
  chat: { completions: { create: vi.fn(implementation) } },
}) as unknown as Groq;

const schema = z.object({ ok: z.boolean() });

const noWait = vi.fn(async () => undefined);

describe("Groq JSON hardening", () => {
  it("turns invalid JSON into a typed unavailable error", async () => {
    const client = fakeClient(() => response("not-json"));

    await expect(
      callJSON("Respond with valid JSON only.", "test", schema, {
        client,
        sleep: noWait,
      }),
    ).rejects.toBeInstanceOf(AiServiceError);
    expect(client.chat.completions.create).toHaveBeenCalledTimes(3);
  });

  it("retries a 429 and respects retry-after", async () => {
    const rateLimit = Object.assign(new Error("busy"), {
      status: 429,
      headers: new Headers({ "retry-after": "0" }),
    });
    const create = vi
      .fn()
      .mockRejectedValueOnce(rateLimit)
      .mockResolvedValueOnce(response('{"ok":true}'));
    const client = { chat: { completions: { create } } } as unknown as Groq;
    const sleep = vi.fn(async () => undefined);

    await expect(
      callJSON("Respond with valid JSON only.", "test", schema, { client, sleep }),
    ).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalledWith(0);
  });

  it("retries a timeout and then succeeds", async () => {
    const timeout = Object.assign(new Error("request timed out"), {
      name: "TimeoutError",
    });
    const create = vi
      .fn()
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(response('{"ok":true}'));
    const client = { chat: { completions: { create } } } as unknown as Groq;
    const sleep = vi.fn(async () => undefined);

    await expect(
      callJSON("Respond with valid JSON only.", "test", schema, { client, sleep }),
    ).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalledWith(1500);
  });
});

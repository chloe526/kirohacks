import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useMicCapture } from "@/hooks/useMicCapture";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockTrackStop = vi.fn();
const mockTrack = { stop: mockTrackStop };
const mockStream = {
  getTracks: () => [mockTrack],
};

const mockRecorderStop = vi.fn();
const mockRecorderStart = vi.fn();
let mockRecorderOnDataAvailable: ((e: { data: Blob }) => void) | null = null;

const MockMediaRecorder = vi.fn().mockImplementation(() => ({
  start: mockRecorderStart,
  stop: mockRecorderStop,
  state: "recording",
  set ondataavailable(fn: (e: { data: Blob }) => void) {
    mockRecorderOnDataAvailable = fn;
  },
}));
(MockMediaRecorder as unknown as { isTypeSupported: (t: string) => boolean }).isTypeSupported =
  vi.fn().mockReturnValue(true);

let mockWsOnOpen: (() => void) | null = null;
let mockWsOnClose: (() => void) | null = null;
let mockWsSend: ReturnType<typeof vi.fn>;
let mockWsClose: ReturnType<typeof vi.fn>;
let mockWsReadyState: number;

const MockWebSocket = vi.fn().mockImplementation(() => {
  mockWsSend = vi.fn();
  mockWsClose = vi.fn();
  mockWsReadyState = WebSocket.CONNECTING;
  const ws = {
    send: mockWsSend,
    close: mockWsClose,
    get readyState() {
      return mockWsReadyState;
    },
    set onopen(fn: () => void) {
      mockWsOnOpen = fn;
    },
    set onclose(fn: () => void) {
      mockWsOnClose = fn;
    },
    set onerror(_fn: unknown) {},
    set onmessage(_fn: unknown) {},
    binaryType: "arraybuffer",
  };
  return ws;
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    },
  });
  mockWsOnOpen = null;
  mockWsOnClose = null;
  mockRecorderOnDataAvailable = null;
  vi.clearAllMocks();
  (MockMediaRecorder as unknown as { isTypeSupported: (t: string) => boolean }).isTypeSupported =
    vi.fn().mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useMicCapture", () => {
  it("initial state: isMuted=true, connectionState=idle", () => {
    const { result } = renderHook(() =>
      useMicCapture("10.0.0.1", false)
    );
    expect(result.current.isMuted).toBe(true);
    expect(result.current.connectionState).toBe("idle");
  });

  it("calls getUserMedia when active=true", async () => {
    renderHook(() => useMicCapture("10.0.0.1", true));
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    });
  });

  it("sets connectionState=permission-denied when getUserMedia is denied", async () => {
    const err = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(err);

    const { result } = renderHook(() => useMicCapture("10.0.0.1", true));
    await waitFor(() => {
      expect(result.current.connectionState).toBe("permission-denied");
    });
    expect(MockWebSocket).not.toHaveBeenCalled();
  });

  it("opens WebSocket to ws://{robotHost}:8080/audio-input", async () => {
    renderHook(() => useMicCapture("10.0.0.1", true));
    await waitFor(() => expect(MockWebSocket).toHaveBeenCalled());
    expect(MockWebSocket).toHaveBeenCalledWith("ws://10.0.0.1:8080/audio-input");
  });

  it("initialises MediaRecorder with audio/webm;codecs=opus and timeslice 200", async () => {
    renderHook(() => useMicCapture("10.0.0.1", true));
    await waitFor(() => expect(MockWebSocket).toHaveBeenCalled());
    act(() => { mockWsOnOpen?.(); });
    expect(MockMediaRecorder).toHaveBeenCalledWith(
      mockStream,
      expect.objectContaining({ mimeType: "audio/webm;codecs=opus" })
    );
    expect(mockRecorderStart).toHaveBeenCalledWith(200);
  });

  it("falls back to audio/webm when Opus not supported", async () => {
    (MockMediaRecorder as unknown as { isTypeSupported: (t: string) => boolean }).isTypeSupported =
      vi.fn().mockReturnValue(false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    renderHook(() => useMicCapture("10.0.0.1", true));
    await waitFor(() => expect(MockWebSocket).toHaveBeenCalled());
    act(() => { mockWsOnOpen?.(); });

    expect(MockMediaRecorder).toHaveBeenCalledWith(
      mockStream,
      expect.objectContaining({ mimeType: "audio/webm" })
    );
    expect(warnSpy).toHaveBeenCalled();
  });

  it("does NOT send when muted (isMuted=true by default)", async () => {
    const { result } = renderHook(() => useMicCapture("10.0.0.1", true));
    await waitFor(() => expect(MockWebSocket).toHaveBeenCalled());
    act(() => {
      mockWsOnOpen?.();
      mockWsReadyState = WebSocket.OPEN;
    });

    const blob = new Blob(["audio"], { type: "audio/webm" });
    act(() => { mockRecorderOnDataAvailable?.({ data: blob }); });

    expect(mockWsSend).not.toHaveBeenCalled();
  });

  it("sends binary frames when unmuted and WS is open", async () => {
    const { result } = renderHook(() => useMicCapture("10.0.0.1", true));
    await waitFor(() => expect(MockWebSocket).toHaveBeenCalled());
    act(() => {
      mockWsOnOpen?.();
      mockWsReadyState = WebSocket.OPEN;
    });

    // Unmute
    act(() => { result.current.toggleMute(); });
    expect(result.current.isMuted).toBe(false);

    const blob = new Blob(["audio"], { type: "audio/webm" });
    act(() => { mockRecorderOnDataAvailable?.({ data: blob }); });

    expect(mockWsSend).toHaveBeenCalledWith(blob);
  });

  it("cleanup on active=false: stops MediaRecorder, closes WS, stops tracks", async () => {
    const { rerender } = renderHook(
      ({ active }) => useMicCapture("10.0.0.1", active),
      { initialProps: { active: true } }
    );
    await waitFor(() => expect(MockWebSocket).toHaveBeenCalled());
    act(() => {
      mockWsOnOpen?.();
      mockWsReadyState = WebSocket.OPEN;
    });

    rerender({ active: false });

    expect(mockRecorderStop).toHaveBeenCalled();
    expect(mockWsClose).toHaveBeenCalled();
    expect(mockTrackStop).toHaveBeenCalled();
  });

  it("retries up to AUDIO_RECONNECT_ATTEMPTS on unexpected WS close", async () => {
    const { result } = renderHook(() => useMicCapture("10.0.0.1", true));
    await waitFor(() => expect(MockWebSocket).toHaveBeenCalled());
    act(() => {
      mockWsOnOpen?.();
      mockWsReadyState = WebSocket.OPEN;
    });

    // Simulate unexpected close
    act(() => { mockWsOnClose?.(); });
    expect(result.current.reconnectCount).toBe(1);
    expect(result.current.connectionState).toBe("connecting");

    // Advance timer to trigger retry
    act(() => { vi.runAllTimers(); });
    await waitFor(() => expect(MockWebSocket).toHaveBeenCalledTimes(2));
  });

  it("mock mode: no WS/MediaRecorder, reports connected + isMuted=true", () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK_API", "true");
    const { result } = renderHook(() => useMicCapture("10.0.0.1", true));
    expect(result.current.connectionState).toBe("connected");
    expect(result.current.isMuted).toBe(true);
    expect(MockWebSocket).not.toHaveBeenCalled();
    expect(MockMediaRecorder).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

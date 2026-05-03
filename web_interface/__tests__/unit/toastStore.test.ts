import { describe, it, expect, beforeEach } from "vitest";
import { useToastStore } from "@/stores/toastStore";

describe("toastStore", () => {
  beforeEach(() => {
    // Reset the store before each test
    useToastStore.setState({ toasts: [] });
  });

  it("starts with empty toasts array", () => {
    const { toasts } = useToastStore.getState();
    expect(toasts).toEqual([]);
  });

  it("adds a success toast", () => {
    const { addToast } = useToastStore.getState();
    
    addToast("Test success message", "success");
    
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      message: "Test success message",
      variant: "success",
      id: expect.any(String),
    });
  });

  it("adds an error toast", () => {
    const { addToast } = useToastStore.getState();
    
    addToast("Test error message", "error");
    
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      message: "Test error message",
      variant: "error",
      id: expect.any(String),
    });
  });

  it("adds multiple toasts", () => {
    const { addToast } = useToastStore.getState();
    
    addToast("First message", "success");
    addToast("Second message", "error");
    
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(2);
    expect(toasts[0].message).toBe("First message");
    expect(toasts[1].message).toBe("Second message");
  });

  it("removes a toast by id", () => {
    const { addToast, removeToast } = useToastStore.getState();
    
    addToast("First message", "success");
    addToast("Second message", "error");
    
    let { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(2);
    
    const firstToastId = toasts[0].id;
    removeToast(firstToastId);
    
    ({ toasts } = useToastStore.getState());
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Second message");
  });

  it("generates unique ids for each toast", () => {
    const { addToast } = useToastStore.getState();
    
    addToast("Message 1", "success");
    addToast("Message 2", "success");
    addToast("Message 3", "success");
    
    const { toasts } = useToastStore.getState();
    const ids = toasts.map(toast => toast.id);
    const uniqueIds = new Set(ids);
    
    expect(uniqueIds.size).toBe(3); // All IDs should be unique
  });
});
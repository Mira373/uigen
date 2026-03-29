import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignInAction = vi.mocked(signInAction);
const mockSignUpAction = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

const SUCCESS = { success: true };
const FAILURE = { success: false, error: "Invalid credentials" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);
});

describe("useAuth", () => {
  describe("initial state", () => {
    it("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signIn", () => {
    it("returns the result from the signIn action on success", async () => {
      mockSignInAction.mockResolvedValue(SUCCESS);
      mockGetProjects.mockResolvedValue([{ id: "proj-1" } as any]);

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "password123");
      });

      expect(returnValue).toEqual(SUCCESS);
    });

    it("returns the result from the signIn action on failure", async () => {
      mockSignInAction.mockResolvedValue(FAILURE);

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrongpass");
      });

      expect(returnValue).toEqual(FAILURE);
    });

    it("sets isLoading to true while signing in and false after", async () => {
      let resolveSignIn!: (val: any) => void;
      mockSignInAction.mockReturnValue(new Promise((res) => (resolveSignIn = res)));
      mockGetProjects.mockResolvedValue([{ id: "proj-1" } as any]);

      const { result } = renderHook(() => useAuth());

      let signInPromise: Promise<any>;
      act(() => {
        signInPromise = result.current.signIn("user@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn(SUCCESS);
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading even when signIn action throws", async () => {
      mockSignInAction.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("does not redirect when sign in fails", async () => {
      mockSignInAction.mockResolvedValue(FAILURE);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "wrongpass");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("signUp", () => {
    it("returns the result from the signUp action on success", async () => {
      mockSignUpAction.mockResolvedValue(SUCCESS);
      mockGetProjects.mockResolvedValue([{ id: "proj-1" } as any]);

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("newuser@example.com", "password123");
      });

      expect(returnValue).toEqual(SUCCESS);
    });

    it("returns the result from the signUp action on failure", async () => {
      const failure = { success: false, error: "Email already registered" };
      mockSignUpAction.mockResolvedValue(failure);

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "password123");
      });

      expect(returnValue).toEqual(failure);
    });

    it("sets isLoading to true while signing up and false after", async () => {
      let resolveSignUp!: (val: any) => void;
      mockSignUpAction.mockReturnValue(new Promise((res) => (resolveSignUp = res)));
      mockGetProjects.mockResolvedValue([{ id: "proj-1" } as any]);

      const { result } = renderHook(() => useAuth());

      let signUpPromise: Promise<any>;
      act(() => {
        signUpPromise = result.current.signUp("newuser@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp(SUCCESS);
        await signUpPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading even when signUp action throws", async () => {
      mockSignUpAction.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("does not redirect when sign up fails", async () => {
      mockSignUpAction.mockResolvedValue(FAILURE);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("user@example.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("post sign-in redirect logic", () => {
    it("creates a project from anon work and redirects to it when anon work has messages", async () => {
      mockSignInAction.mockResolvedValue(SUCCESS);
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "make a button" }],
        fileSystemData: { "/App.jsx": { content: "<div/>" } },
      });
      mockCreateProject.mockResolvedValue({ id: "anon-project-id" } as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "make a button" }],
          data: { "/App.jsx": { content: "<div/>" } },
        })
      );
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      expect(mockGetProjects).not.toHaveBeenCalled();
    });

    it("does not use anon work when messages array is empty", async () => {
      mockSignInAction.mockResolvedValue(SUCCESS);
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mockGetProjects.mockResolvedValue([{ id: "existing-proj" } as any]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-proj");
    });

    it("redirects to the most recent project when no anon work exists", async () => {
      mockSignInAction.mockResolvedValue(SUCCESS);
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([
        { id: "recent-proj" } as any,
        { id: "older-proj" } as any,
      ]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/recent-proj");
    });

    it("creates a new project and redirects when user has no existing projects", async () => {
      mockSignInAction.mockResolvedValue(SUCCESS);
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "brand-new-proj" } as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/brand-new-proj");
    });

    it("applies the same post sign-in logic after a successful signUp", async () => {
      mockSignUpAction.mockResolvedValue(SUCCESS);
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([{ id: "signup-proj" } as any]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/signup-proj");
    });
  });
});

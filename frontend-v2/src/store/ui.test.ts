import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUIStore } from './ui';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useUIStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({
      sidebarOpen: false,
      mobileMenuOpen: false,
      searchOpen: false,
      hasSeenOnboarding: false,
      _onboardingLoaded: false,
    });
  });

  describe('sidebar', () => {
    it('should set sidebar open state', () => {
      useUIStore.getState().setSidebarOpen(true);
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it('should toggle sidebar', () => {
      expect(useUIStore.getState().sidebarOpen).toBe(false);
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);
    });
  });

  describe('mobile menu', () => {
    it('should set mobile menu open state', () => {
      useUIStore.getState().setMobileMenuOpen(true);
      expect(useUIStore.getState().mobileMenuOpen).toBe(true);
    });
  });

  describe('search modal', () => {
    it('should set search open state', () => {
      useUIStore.getState().setSearchOpen(true);
      expect(useUIStore.getState().searchOpen).toBe(true);
    });

    it('should toggle search open state', () => {
      expect(useUIStore.getState().searchOpen).toBe(false);
      useUIStore.getState().toggleSearchOpen();
      expect(useUIStore.getState().searchOpen).toBe(true);
      useUIStore.getState().toggleSearchOpen();
      expect(useUIStore.getState().searchOpen).toBe(false);
    });
  });

  describe('onboarding', () => {
    it('should set onboarding seen and persist to localStorage', () => {
      useUIStore.getState().setHasSeenOnboarding(true);
      expect(useUIStore.getState().hasSeenOnboarding).toBe(true);
      expect(useUIStore.getState()._onboardingLoaded).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('hodl_onboarding_seen', 'true');
    });

    it('should hydrate onboarding from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('true');
      useUIStore.getState().hydrateOnboarding();
      expect(useUIStore.getState().hasSeenOnboarding).toBe(true);
      expect(useUIStore.getState()._onboardingLoaded).toBe(true);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('hodl_onboarding_seen');
    });

    it('should hydrate as false when localStorage is empty', () => {
      localStorageMock.getItem.mockReturnValue(null);
      useUIStore.getState().hydrateOnboarding();
      expect(useUIStore.getState().hasSeenOnboarding).toBe(false);
      expect(useUIStore.getState()._onboardingLoaded).toBe(true);
    });
  });
});

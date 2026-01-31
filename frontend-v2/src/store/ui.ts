import { create } from 'zustand';

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Mobile menu
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  // Search modal
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  toggleSearchOpen: () => void;

  // Onboarding
  hasSeenOnboarding: boolean;
  _onboardingLoaded: boolean;
  setHasSeenOnboarding: (seen: boolean) => void;
  hydrateOnboarding: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Sidebar
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Mobile menu
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  // Search modal
  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  toggleSearchOpen: () => set((state) => ({ searchOpen: !state.searchOpen })),

  // Onboarding - lazy-loaded from localStorage (client-localstorage-schema rule)
  hasSeenOnboarding: false,
  _onboardingLoaded: false,
  setHasSeenOnboarding: (seen) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hodl_onboarding_seen', String(seen));
    }
    set({ hasSeenOnboarding: seen, _onboardingLoaded: true });
  },
  // Call this once on app mount to hydrate from localStorage
  hydrateOnboarding: () => {
    if (typeof window !== 'undefined') {
      const seen = localStorage.getItem('hodl_onboarding_seen') === 'true';
      set({ hasSeenOnboarding: seen, _onboardingLoaded: true });
    }
  },
}));

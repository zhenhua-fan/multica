import { create } from 'zustand';
import type { StorageAdapter } from '../types';
import { getCurrentSlug, registerForWorkspaceRehydration } from '../platform/workspace-storage';
import { createLogger } from '../logger';

const logger = createLogger('channel.store');
const CHANNEL_STORAGE_KEY = 'multica:channel:activeChannelId';
const RECENT_KEY = 'multica:channel:recentChannels';
const SIDEBAR_KEY = 'multica:channel:sidebarOpen';

export interface ChannelState {
  activeChannelId: string | null;
  recentChannels: string[];
  channelSidebarOpen: boolean;

  setActiveChannel: (id: string) => void;
  toggleSidebar: () => void;
}

export interface ChannelStoreOptions {
  storage: StorageAdapter;
}

export function createChannelStore(options: ChannelStoreOptions) {
  const { storage } = options;

  const wsKey = (base: string) => {
    const slug = getCurrentSlug();
    return slug ? `${base}:${slug}` : base;
  };

  const storedOpen = storage.getItem(wsKey(SIDEBAR_KEY));
  const initialOpen = storedOpen === null ? true : storedOpen === 'true';

  const parseRecent = (): string[] => {
    const raw = storage.getItem(wsKey(RECENT_KEY));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  const store = create<ChannelState>((set, get) => ({
    activeChannelId: storage.getItem(wsKey(CHANNEL_STORAGE_KEY)),
    recentChannels: parseRecent(),
    channelSidebarOpen: initialOpen,

    setActiveChannel: (id) => {
      logger.info('setActiveChannel', { from: get().activeChannelId, to: id });
      storage.setItem(wsKey(CHANNEL_STORAGE_KEY), id);
      const nextRecent = [id, ...get().recentChannels.filter((c) => c !== id)].slice(0, 10);
      storage.setItem(wsKey(RECENT_KEY), JSON.stringify(nextRecent));
      set({ activeChannelId: id, recentChannels: nextRecent });
    },
    toggleSidebar: () => {
      const next = !get().channelSidebarOpen;
      logger.debug('toggleSidebar', { to: next });
      storage.setItem(wsKey(SIDEBAR_KEY), String(next));
      set({ channelSidebarOpen: next });
    },
  }));

  registerForWorkspaceRehydration(() => {
    const nextChannel = storage.getItem(wsKey(CHANNEL_STORAGE_KEY));
    const nextRecent = parseRecent();
    const nextOpen = (() => {
      const v = storage.getItem(wsKey(SIDEBAR_KEY));
      return v === null ? true : v === 'true';
    })();
    logger.info('workspace rehydration', { nextChannel, recentCount: nextRecent.length });
    store.setState({
      activeChannelId: nextChannel,
      recentChannels: nextRecent,
      channelSidebarOpen: nextOpen,
    });
  });

  return store;
}

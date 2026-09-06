import type { Track } from 'riffy';

export type LoopMode = 'none' | 'track' | 'queue';

export type { Track } from 'riffy';

export interface PlayerSnapshot {
    title: string;
    author: string;
    duration: number;
    thumbnail: string | null;
    requester?: unknown;
    playing: boolean;
    paused: boolean;
    position: number;
    volume: number;
    loop: LoopMode;
    autoplay: boolean;
    queueLength: number;
}

export interface ResolvedTracks {
    loadType: 'playlist' | 'track' | 'search' | 'empty' | 'error';
    tracks: Track[];
    name: string | null;
}

export interface PlayerAppState {
    nowPlayingMessageId: string | null;
    textChannelId: string;
    lastFilter: string | null;
    lastQuery?: string;
    lastRequester?: unknown;
    failsafePending?: boolean;
    recoveries?: number;
}

export interface SlashCommand {
    data: import('discord.js').SlashCommandBuilder | import('discord.js').SlashCommandOptionsOnlyBuilder;
    execute: (interaction: import('discord.js').ChatInputCommandInteraction) => Promise<void>;
}

export interface MessageCommand {
    name: string;
    aliases: string[];
    description: string;
    execute: (message: import('discord.js').Message, args: string[]) => Promise<void>;
}
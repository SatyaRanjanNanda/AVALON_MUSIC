import { GatewayIntentBits, type Client } from 'discord.js';
import type { Riffy } from 'riffy';
import type { PlayerManager } from './manager/PlayerManager';
import type { StatusManager } from './utils/statusManager';
import type { SettingsStore } from './utils/settings';

export let client: Client;
export let riffy: Riffy;
export let music: PlayerManager;
export let status: StatusManager;
export let settings: SettingsStore;

export function setClient(value: Client): void {
    client = value;
}

export function setRiffy(value: Riffy): void {
    riffy = value;
}

export function setMusic(value: PlayerManager): void {
    music = value;
}

export function setStatus(value: StatusManager): void {
    status = value;
}

export function setSettings(value: SettingsStore): void {
    settings = value;
}

export const IntentsForClient: GatewayIntentBits[] = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
];
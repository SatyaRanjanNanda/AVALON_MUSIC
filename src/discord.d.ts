import type { Riffy } from 'riffy';
import type { PlayerManager } from './manager/PlayerManager';
import type { StatusManager } from './utils/statusManager';
import type { CentralEmbedHandler } from './utils/centralEmbed';

declare module 'discord.js' {
    interface Client {
        riffy: Riffy;
        playerHandler?: PlayerManager;
        statusManager?: StatusManager;
        centralEmbed?: CentralEmbedHandler;
    }

    interface Message {
        shivaValidated?: boolean;
        securityToken?: string;
    }

    interface ChatInputCommandInteraction {
        shivaValidated?: boolean;
        securityToken?: string;
    }
}

export {};
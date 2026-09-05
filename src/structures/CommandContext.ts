import { ChatInputCommandInteraction, Message, GuildMember, TextChannel, User, MessagePayload, MessageReplyOptions } from 'discord.js';

export class CommandContext {
    public isInteraction: boolean;
    public interaction?: ChatInputCommandInteraction;
    public message?: Message;
    public args: string[];

    constructor(payload: ChatInputCommandInteraction | Message, args: string[] = []) {
        if (payload instanceof ChatInputCommandInteraction) {
            this.isInteraction = true;
            this.interaction = payload;
            this.args = args;
        } else {
            this.isInteraction = false;
            this.message = payload;
            this.args = args;
        }
    }

    public get member(): GuildMember | null {
        return (this.isInteraction ? this.interaction?.member : this.message?.member) as GuildMember | null;
    }

    public get user(): User {
        return this.isInteraction ? this.interaction!.user : this.message!.author;
    }

    public get guildId(): string | null {
        return this.isInteraction ? this.interaction!.guildId : this.message!.guildId;
    }

    public get channel(): TextChannel | null {
        return (this.isInteraction ? this.interaction!.channel : this.message!.channel) as TextChannel | null;
    }

    public async deferReply(options?: { ephemeral?: boolean }): Promise<void> {
        if (this.isInteraction) {
            await this.interaction!.deferReply(options);
        } else {
            await this.channel?.sendTyping();
        }
    }

    public async reply(content: string | MessagePayload | MessageReplyOptions): Promise<any> {
        if (this.isInteraction) {
            if (this.interaction!.deferred || this.interaction!.replied) {
                return await this.interaction!.followUp(content);
            }
            return await this.interaction!.reply(content);
        } else {
            return await this.message!.reply(content);
        }
    }

    public async editReply(content: string | MessagePayload | MessageReplyOptions): Promise<any> {
        if (this.isInteraction) {
            return await this.interaction!.editReply(content);
        } else {
            return await this.message!.reply(content);
        }
    }
}


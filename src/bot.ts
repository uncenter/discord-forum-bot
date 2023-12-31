import type { Client, GuildMember, Message, User } from 'discord.js';

import { Events } from 'discord.js';

import { config } from '~/env';

export interface CommandRegistration {
	aliases: string[];
	description?: string;
	listener: (message: Message, content: string) => Promise<void>;
}

interface Command {
	admin: boolean;
	aliases: string[];
	description?: string;
	listener: (message: Message, content: string) => Promise<void>;
}

export class Bot {
	commands = new Map<string, Command>();

	constructor(public client: Client<true>) {
		client.on(Events.MessageCreate, (message) => {
			const triggerWithPrefix = message.content.split(/\s/)[0];
			const matchingPrefix = config.COMMAND_PREFIXES.find((p) =>
				triggerWithPrefix.startsWith(p),
			);
			if (matchingPrefix) {
				const content = message.content
					.slice(Math.max(0, triggerWithPrefix.length + 1))
					.trim();

				const command = this.getByTrigger(
					triggerWithPrefix.slice(matchingPrefix.length),
				);

				if (
					!command ||
					(command.admin && !this.isAdmin(message.author))
				) {
					return;
				}
				command.listener(message, content).catch((error) => {
					this.client.emit('error', error);
				});
			}
		});
	}

	registerCommand(registration: CommandRegistration) {
		const command: Command = {
			...registration,
			admin: false,
		};
		for (const a of command.aliases) {
			this.commands.set(a, command);
		}
	}

	registerAdminCommand(registration: CommandRegistration) {
		const command: Command = {
			...registration,
			admin: true,
		};
		for (const a of command.aliases) {
			this.commands.set(a, command);
		}
	}

	getByTrigger(trigger: string): Command | undefined {
		return this.commands.get(trigger);
	}

	// eslint-disable-next-line unicorn/prevent-abbreviations
	isMod(member: GuildMember | null) {
		return member?.permissions.has('ManageMessages') ?? false;
	}

	isAdmin(user: User) {
		return config.ADMINS.includes(user.id);
	}

	isHelper(message: Message) {
		if (
			!message.guild ||
			!message.member ||
			!message.channel.isTextBased()
		) {
			return false;
		}

		if (
			!message.member.roles.cache.has(config.HELPER_ROLE_ID) &&
			!message.member.permissions.has('ManageMessages')
		) {
			return false;
		}

		return true;
	}

	async getTargetUser(message: Message): Promise<User | undefined> {
		const query = message.content.split(/\s/)[1];

		const mentioned = message.mentions.members?.first()?.user;
		if (mentioned) return mentioned;

		if (!query) return;

		// Search by ID
		const queriedUser = await this.client.users
			.fetch(query)
			.catch(() => {});
		if (queriedUser) return queriedUser;

		// Search by name, likely a better way to do this...
		for (const user of this.client.users.cache.values()) {
			if (user.tag === query || user.username === query) {
				return user;
			}
		}
	}
}

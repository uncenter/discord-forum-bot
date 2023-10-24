import type { Message, Client, User, GuildMember } from 'discord.js';

import { Events } from 'discord.js';

import { config } from '~/env';

export interface CommandRegistration {
	aliases: string[];
	description?: string;
	listener: (msg: Message, content: string) => Promise<void>;
}

interface Command {
	admin: boolean;
	aliases: string[];
	description?: string;
	listener: (msg: Message, content: string) => Promise<void>;
}

export class Bot {
	commands = new Map<string, Command>();

	constructor(public client: Client<true>) {
		client.on(Events.MessageCreate, (msg) => {
			const triggerWithPrefix = msg.content.split(/\s/)[0];
			const matchingPrefix = config.COMMAND_PREFIXES.find((p) =>
				triggerWithPrefix.startsWith(p),
			);
			if (matchingPrefix) {
				const content = msg.content
					.slice(Math.max(0, triggerWithPrefix.length + 1))
					.trim();

				const command = this.getByTrigger(
					triggerWithPrefix.slice(matchingPrefix.length),
				);

				if (!command || (command.admin && !this.isAdmin(msg.author))) {
					return;
				}
				command.listener(msg, content).catch((error) => {
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

	isMod(member: GuildMember | null) {
		return member?.permissions.has('ManageMessages') ?? false;
	}

	isAdmin(user: User) {
		return config.ADMINS.includes(user.id);
	}

	isHelper(msg: Message) {
		if (!msg.guild || !msg.member || !msg.channel.isTextBased()) {
			return false;
		}

		if (
			!msg.member.roles.cache.has(config.HELPER_ROLE_ID) &&
			!msg.member.permissions.has('ManageMessages')
		) {
			return false;
		}

		return true;
	}

	async getTargetUser(msg: Message): Promise<User | undefined> {
		const query = msg.content.split(/\s/)[1];

		const mentioned = msg.mentions.members?.first()?.user;
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

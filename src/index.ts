import 'dotenv/config';

import {
	Client,
	Events,
	GatewayIntentBits,
	OAuth2Scopes,
	Partials,
	PermissionFlagsBits,
} from 'discord.js';
import { cyan } from 'kleur/colors';

import { Bot } from '~/bot';
import { config } from '~/env';
import {
	expandGitHubLinksModule,
	handleButtonEventsModule,
	helpForumModule,
} from '~/modules';
import { startServer } from '~/server';
import { logger } from '~/utils/logger';

const modules = [
	helpForumModule,
	expandGitHubLinksModule,
	handleButtonEventsModule,
];

const client = new Client({
	partials: [
		Partials.Reaction,
		Partials.Message,
		Partials.User,
		Partials.Channel,
	],
	allowedMentions: {
		parse: ['users', 'roles'],
	},
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.MessageContent,
	],
}).setMaxListeners(Number.POSITIVE_INFINITY);

client.once(Events.ClientReady, async () => {
	logger.success('Connected to Discord gateway!');

	const bot = new Bot(client);

	logger.info(
		'Invite link:',
		cyan(
			client.generateInvite({
				scopes: [OAuth2Scopes.Bot],
				permissions: [
					PermissionFlagsBits.AddReactions,
					PermissionFlagsBits.ViewChannel,
					PermissionFlagsBits.BanMembers,
					PermissionFlagsBits.KickMembers,
					PermissionFlagsBits.CreatePublicThreads,
					PermissionFlagsBits.CreatePrivateThreads,
					PermissionFlagsBits.EmbedLinks,
					PermissionFlagsBits.ManageChannels,
					PermissionFlagsBits.ManageRoles,
					PermissionFlagsBits.ModerateMembers,
					PermissionFlagsBits.MentionEveryone,
					PermissionFlagsBits.MuteMembers,
					PermissionFlagsBits.SendMessages,
					PermissionFlagsBits.SendMessagesInThreads,
					PermissionFlagsBits.ReadMessageHistory,
					PermissionFlagsBits.ManageMessages,
				],
			}),
		),
	);

	for (const module of modules) {
		await module(bot);
	}

	if (config.NODE_ENV !== 'development') {
		logger.warn('Running in production mode!');
	}
});

const main = async () => {
	try {
		await startServer({ client });
		await client.login(config.DISCORD_TOKEN);
	} catch (error) {
		logger.error(error);
		process.exit(1);
	}
};

main();

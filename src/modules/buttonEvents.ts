import type { Bot } from '~/bot';
import type { AnyThreadChannel } from 'discord.js';

import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Events,
} from 'discord.js';

import { questionMeetsRequirements } from '~/modules/helpForum';

export const EMBED_DELETE_BUTTON =
	new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setStyle(ButtonStyle.Danger)
			.setLabel('Delete')
			.setCustomId(`delete-message`),
	);

export async function handleButtonEventsModule(bot: Bot) {
	bot.client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isButton()) return;

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const [event, ...data] = interaction.customId.split('::');

		if (event === 'delete-message') {
			await interaction.message.delete();
		} else if (event === 'try-again-thread-requirements') {
			const thread = bot.client.channels.cache.get(
				data[0],
			) as AnyThreadChannel;
			const { embed, components } = await questionMeetsRequirements(
				thread,
				true,
			);
			await interaction.update({
				embeds: [embed],
				components: components,
			});
		}
	});
}

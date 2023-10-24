import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Events,
} from 'discord.js';
import { Bot } from '~/bot';

export const EMBED_DELETE_BUTTON =
	new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setStyle(ButtonStyle.Danger)
			.setLabel('Delete')
			.setCustomId(`delete-message`),
	);

export async function handleButtonEvents(bot: Bot) {
	bot.client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isButton()) return;

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const [event, ...data] = interaction.customId.split('::');

		if (event === 'delete-message') {
			await interaction.message.delete();
		}
	});
}

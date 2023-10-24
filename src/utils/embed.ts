import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import {
	HEX_BLUE,
	HEX_GREEN,
	HEX_PURPLE,
	HEX_RED,
	HEX_YELLOW,
} from '~/utils/constants';

export type EmbedMessage = {
	title: string;
	description?: string;
	deletable?: boolean;
	fields?: { name: string; value: string }[];
	components?: ActionRowBuilder<ButtonBuilder>[];
	type: 'error' | 'warning' | 'success' | 'info' | 'special';
};

export function buildEmbedMessage(message: EmbedMessage) {
	const embed = new EmbedBuilder().setTitle(message.title);
	let color;
	switch (message.type) {
		case 'error': {
			color = HEX_RED;
			break;
		}
		case 'warning': {
			color = HEX_YELLOW;
			break;
		}
		case 'success': {
			color = HEX_GREEN;
			break;
		}
		case 'info': {
			color = HEX_BLUE;
			break;
		}
		case 'special': {
			color = HEX_PURPLE;
			break;
		}
	}
	embed.setColor(color);
	if (message.description) {
		embed.setDescription(message.description);
	}
	if (message.fields) {
		embed.addFields(message.fields);
	}
	return embed;
}

import {
	DMChannel,
	EmbedBuilder,
	NewsChannel,
	PartialDMChannel,
	PrivateThreadChannel,
	PublicThreadChannel,
	StageChannel,
	TextChannel,
	VoiceChannel,
} from 'discord.js';
import {
	HEX_BLUE,
	HEX_GREEN,
	HEX_PURPLE,
	HEX_RED,
	HEX_YELLOW,
} from '~/utils/constants';
import { EMBED_DELETE_BUTTON } from '~/modules/buttonEvents';

type EmbedMessage = {
	title: string;
	description?: string;
};

type SendableChannel =
	| DMChannel
	| PartialDMChannel
	| NewsChannel
	| StageChannel
	| TextChannel
	| PrivateThreadChannel
	| PublicThreadChannel
	| VoiceChannel;

export async function sendErrorMessage(
	channel: SendableChannel,
	message: EmbedMessage,
) {
	await sendDeletableMessage(channel, { ...message, color: HEX_RED });
}
export async function sendWarningMessage(
	channel: SendableChannel,
	message: EmbedMessage,
) {
	await sendDeletableMessage(channel, { ...message, color: HEX_YELLOW });
}
export async function sendInfoMessage(
	channel: SendableChannel,
	message: EmbedMessage,
) {
	await sendDeletableMessage(channel, { ...message, color: HEX_BLUE });
}
export async function sendSuccessMessage(
	channel: SendableChannel,
	message: EmbedMessage,
) {
	await sendDeletableMessage(channel, { ...message, color: HEX_GREEN });
}
export async function sendSpecialMessage(
	channel: SendableChannel,
	message: EmbedMessage,
) {
	await sendDeletableMessage(channel, { ...message, color: HEX_PURPLE });
}

async function sendDeletableMessage(
	channel:
		| DMChannel
		| PartialDMChannel
		| NewsChannel
		| StageChannel
		| TextChannel
		| PrivateThreadChannel
		| PublicThreadChannel
		| VoiceChannel,
	message: EmbedMessage & {
		color: number;
	},
) {
	const embed = new EmbedBuilder()
		.setTitle(message.title)
		.setColor(message.color);
	if (message.description) {
		embed.setDescription(message.description);
	}
	await channel.send({
		embeds: [embed],
		components: [EMBED_DELETE_BUTTON],
	});
}

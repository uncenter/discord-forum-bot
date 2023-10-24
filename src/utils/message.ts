import {
	DMChannel,
	NewsChannel,
	PartialDMChannel,
	PrivateThreadChannel,
	PublicThreadChannel,
	StageChannel,
	TextChannel,
	VoiceChannel,
} from 'discord.js';
import { EMBED_DELETE_BUTTON } from '~/modules/buttonEvents';
import { EmbedMessage, EmbedMessageType, buildEmbedMessage } from './embed';

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
	await sendDeletableMessage(channel, message, 'error');
}
export async function sendWarningMessage(
	channel: SendableChannel,
	message: EmbedMessage,
) {
	await sendDeletableMessage(channel, message, 'warning');
}
export async function sendSuccessMessage(
	channel: SendableChannel,
	message: EmbedMessage,
) {
	await sendDeletableMessage(channel, message, 'success');
}
export async function sendInfoMessage(
	channel: SendableChannel,
	message: EmbedMessage,
) {
	await sendDeletableMessage(channel, message, 'info');
}
export async function sendSpecialMessage(
	channel: SendableChannel,
	message: EmbedMessage,
) {
	await sendDeletableMessage(channel, message, 'special');
}

async function sendDeletableMessage(
	channel: SendableChannel,
	message: EmbedMessage,
	type: EmbedMessageType,
) {
	await channel.send({
		embeds: [buildEmbedMessage(message, type)],
		components:
			message.components ||
			(message.deletable === true ? [EMBED_DELETE_BUTTON] : []),
	});
}

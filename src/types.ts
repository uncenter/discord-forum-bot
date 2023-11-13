export type ForumThread = {
	ownerId: string;
	requestForHelpMessage?: string;
	lastHelpRequest?: number;
};

export type Snippet = {
	usageCount: number;
	content: {
		title: string;
		description: string;
	};
};

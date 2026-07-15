import type { ServerLoad } from "@sveltejs/kit"

// Register page is always accessible — it's used for initial admin setup
// and for navigating from the login page.
export const load: ServerLoad = async () => {
	return {};
};

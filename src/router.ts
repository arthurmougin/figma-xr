import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "./store/auth.store";

const routes = [
	{path: "/companion", name: "companion", component: () => import("./views/CompanionView.vue")},
	{
		path: "/",
		name: "landingpage",
		component: () => import("./views/LandingPage.vue"),
	},
	{
		path: "/projects",
		name: "projects",
		component: () => import("./views/Projects.vue"),
	},
	{
		path: "/view/:projectId",
		name: "xrview",
		component: () => import("./views/XRView.vue"),
		props: true,
	},
	{
		path: "/:pathMatch(.*)*",
		name: "notFound",
		redirect: { name: "landingpage" },
	},
];

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
});
router.beforeEach(async (to, _from) => {
	const authStore = useAuthStore();

	if (to.query.callback !== undefined) {
		const connected = await authStore.initCallbackRoute(to);
		return { name: connected ? "projects" : "landingpage", replace: true };
	}

	if (to.name === "xrview" || to.name === "projects") {
		//test if logged in
		if (await authStore.checkLogin()) {
			return true;
		} else {
			return { name: "landingpage" };
		}
	}
	return true;
});

export default router;

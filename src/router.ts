import { createRouter, createWebHistory } from "vue-router";
import LandingPageVue from "./views/LandingPage.vue";
import ProjectsVue from "./views/Projects.vue";
import XRViewVue from "./views/XRView.vue";
import { useAuthStore } from "./store/auth.store";

const routes = [
	{path: "/companion", name: "companion", component: () => import("./views/CompanionView.vue")},
	{
		path: "/",
		name: "landingpage",
		component: LandingPageVue,
	},
	{
		path: "/projects",
		name: "projects",
		component: ProjectsVue,
	},
	{
		path: "/view/:projectId",
		name: "xrview",
		component: XRViewVue,
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

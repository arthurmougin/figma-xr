import { createRouter, createWebHistory } from "vue-router";
import LandingPageVue from "./views/LandingPage.vue";
import ProjectsVue from "./views/Projects.vue";
import XRViewVue from "./views/XRView.vue";
import { useAuthStore } from "./store/auth.store";
import { LogStateOptions } from "./definition.d";

const routes = [
	{
		path: "/figma-xr/home",
		name: "landingpage",
		component: LandingPageVue,
	},
	{
		path: "/figma-xr/projects",
		name: "projects",
		component: ProjectsVue,
	},
	{
		path: "/figma-xr/view/:projectId",
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
	history: createWebHistory(),
	routes,
});

router.beforeEach(async (to, from) => {
	const authStore = useAuthStore();

	if (to.query.callback !== undefined) {
		await authStore.initCallbackRoute(to);
	}

	if (to.name === "xrview" || to.name === "projects") {
		//test if logged in
		if (authStore.state === LogStateOptions["logged in"]) {
			return true;
		} else {
			return { name: "landingpage" };
		}
	}
	return true;
});

export default router;

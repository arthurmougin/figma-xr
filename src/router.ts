import { createRouter, createWebHistory } from "vue-router";
import LandingPageVue from "./views/LandingPage.vue";
import ProjectsVue from "./views/Projects.vue";
import XRViewVue from "./views/XRView.vue";
import { useAuthStore } from "./store/auth.store";
import { LogStateOptions } from "./definition.d";

const routes = [
	{
		// http://localhost:5173/figma-xr/callback?code=IGYjKKLl17bMs3cGO3Ik9UeKl&state=sh1fq
		path: "/figma-xr/callback",
		name: "callback",
		redirect: { name: "projects" },
	},
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
	/*{
		path: "/:pathMatch(.*)*",
		name: "notFound",
		redirect: { name: "landingpage" },
	},*/
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

router.beforeEach(async (to, from) => {
	console.log(window.location.href);
	console.log("to", to, "from", from);
	const authStore = useAuthStore();
	if (to.redirectedFrom?.path === "/figma-xr/callback") {
		console.log("Callback route detected");
		await authStore.initCallbackRoute(to);
	}

	if (to.name === "xrview" || to.name === "projects") {
		//test if logged in
		console.log(authStore.state === LogStateOptions["logged in"]);
		if (authStore.state === LogStateOptions["logged in"]) {
			return true;
		} else {
			console.log("User is not logged in");
			return { name: "landingpage" };
		}
	}
	return true;
});

export default router;

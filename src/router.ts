import { createRouter, createWebHistory } from 'vue-router'
import LandingPageVue from './views/LandingPage.vue'
import ProjectsVue from './views/Projects.vue'
import XRViewVue from './views/XRView.vue'
import { useStore } from './store'

const routes = [
    {
        path: '/figma-xr',
        name: 'landingpage',
        component: LandingPageVue
    },
    {
        path: '/figma-xr/projects',
        name: 'projects',
        component: ProjectsVue,
        meta: {
            requiresAuth: true
        }
    },
    {
        path: '/figma-xr/view/:projectId',
        name: 'xrview',
        component: XRViewVue,
        meta: {
            requiresAuth: true
        },
        props: true
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'notFound',
        redirect : { name: 'landingpage' }
    },
]

const router = createRouter({   
    history: createWebHistory(),
    routes,
})

router.beforeEach(async (to, _from, next) => {
 if (to.matched.some(record => record.meta.requiresAuth)) {
    const store = useStore()
    if (store.isLoggedIn == false) {
      next('landingpage');
    } else {
      next();
    }
  } else {
    next();
  }
})

export default router
import { createRouter, createWebHistory } from 'vue-router'
import LandingPageVue from './views/LandingPage.vue'
import ProjectsVue from './views/Projects.vue'
import XRViewVue from './views/XRView.vue'
import { isLoggedIn } from './utils'

const routes = [
    {
        path: '/figma-xr',
        name: 'landingpage',
        component: LandingPageVue
    },
    {
        path: '/figma-xr/projects',
        name: 'projects',
        component: ProjectsVue
    },
    {
        path: '/figma-xr/:projectId',
        name: 'xrview',
        component: XRViewVue
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

router.beforeEach((to, from) => {
    console.log('to', to, 'from', from)
    if(from.name === 'xrview' || to.name === 'projects') {
        //test if logged in
        if (isLoggedIn()) {
            return true
        }
        else {
            return { name: 'landingpage' }
        }
    }
    else {
        if (isLoggedIn()) {
            return { name: 'projects' }
        }
    }
    return true
})

export default router
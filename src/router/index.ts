import Vue from 'vue'
import VueRouter, { RouteConfig } from 'vue-router'
import Sources from '../views/Sources.vue'

Vue.use(VueRouter)

const routes: Array<RouteConfig> = [
  {
    path: '/',
    name: 'Sources',
    component: Sources
  },
  // {
  //   path: '/sources',
  //   name: 'Sources',
  //   // route level code-splitting
  //   // this generates a separate chunk (about.[hash].js) for this route
  //   // which is lazy-loaded when the route is visited.
  //   component: () => import(/* webpackChunkName: "sources" */ '../views/Sources.vue')
  // }
]

const router = new VueRouter({
  routes
})

export default router

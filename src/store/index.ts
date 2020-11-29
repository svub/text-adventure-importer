import Vue from 'vue'
import Vuex from 'vuex'
import { Book, Config } from '../shared/entities';

Vue.use(Vuex)

interface AppState {
  book: Book | null;
  config: Config | null;
}

const state: AppState = {
  book: null,
  config: null,
}

export default new Vuex.Store({
  state,
  mutations: {
    setBook(state, { book }: { book: Book }) {
      state.book = book;
    },
    setConfig(state, { config }: { config: Config }) {
      state.config = config;
    },
  },
  actions: {
  },
  modules: {
  }
})

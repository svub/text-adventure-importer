import Vue from 'vue'
import Vuex from 'vuex'
import { Book, Config } from '../shared/entities';
import VuexPersistence from 'vuex-persist';
import { getField, updateField } from 'vuex-map-fields';

Vue.use(Vuex)

interface AppState {
  book: Book | null;
  config: Config | null;
  sources: string;
  azureKey: string | null;
  azureRegion: string | null;
  azureVoice: string | null;
  decisionIntroSingle: string;
  decisionIntro: string;
  decisionConjunction: string;
  maxMBytesPerZip: number;
  replacements: string;
  synthesisProgress: number;
  synthesisLimit: number;
}

const state: AppState = {
  book: null,
  config: null,
  sources: "",
  azureKey: null,
  azureRegion: null,
  azureVoice: "de-DE-KillianNeural",
  decisionIntroSingle: "",
  decisionIntro: "",
  decisionConjunction: "",
  maxMBytesPerZip: 100,
  replacements: "",
  synthesisProgress: 0,
  synthesisLimit: 0,
}

const vuexLocal = new VuexPersistence<AppState>({
  storage: window.localStorage
})

export default new Vuex.Store<AppState>({
  state,
  getters: {
    getField, 
  },
  mutations: {
    setBook(state, { book }: { book: Book }) {
      state.book = book;
    },
    setConfig(state, { config }: { config: Config }) {
      state.config = config;
    },
    // setAzureKey(state, azureKey: string) {
    //   state.azureKey = azureKey;
    // },
    // setAzureRegion(state, azureRegion: string) {
    //   state.azureRegion = azureRegion;
    // },
    // setAzureVoice(state, azureVoice: string) {
    //   state.azureVoice = azureVoice;
    // },
    updateField,
  },
  actions: {
  },
  modules: {
  },
  plugins: [vuexLocal.plugin],
})

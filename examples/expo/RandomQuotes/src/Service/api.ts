import axios from 'axios'
import { store } from '../Stores'
import { clearUser } from '../Stores/User/User'
import { BASE_URL } from './constant'

const axiosInstance = axios.create({ baseURL: BASE_URL })

axiosInstance.interceptors.request.use(
  (config) => {
    // const { token, language } = store.getState().user
    // config.headers['Accept-Language'] = language
    // if (!config?.url?.includes('login') && !config?.url?.includes('register')) {
    //     const authHeaderToken = token
    //     if (authHeaderToken) {
    //         config.headers.Authorization = `Bearer ${authHeaderToken}`
    //     }
    // }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('Axios instance: ', error, error?.response?.status)
    const code = error?.response?.status
    if (code === 401) {
      store.dispatch(clearUser())
    }
    return Promise.reject(error)
  }
)

export { axiosInstance }

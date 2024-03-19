import axios from 'axios'
import _get from 'lodash/get'

const handleError = (error: any) => {
  let message
  let code
  if (axios.isAxiosError(error) && error.response) {
    const detailError = _get(error, 'response.data.data.detail', '')
    console.log('ERROR CODE::: ', error?.response, error?.response?.status)
    code = _get(error, 'response.status', null)
    message = detailError || error.response?.data?.message || error.response?.statusText
  } else {
    message = String(error)
  }
  return { message, code }
}

export default handleError

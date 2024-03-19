import handleError from '../Helpers/handleError'
import { axiosInstance } from '../Service/api'
import { END_POINT } from '../Service/constant'
import { useState } from 'react'
import { useQuery } from 'react-query'

const request = async (tag: string) => {
  const { data } = await axiosInstance.request({
    method: 'GET',
    url: END_POINT.quotes + '?tags=' + tag + '&limit=9999&maxLength=9999',
  })
  return data?.results || []
}

const useListQuoteByTag = (tag: string) => {
  const [error, setError] = useState<string | null>(null)

  const { isError, data, isFetching, refetch } = useQuery({
    queryKey: ['get-useListQuoteByTag'],
    queryFn: () => request(tag),
    onSuccess: (result) => {},
    onError: (err) => {
      const { message } = handleError(err)
      setError(message || 'Something went wrong')
    },
    enabled: true,
  })
  return { isError, isFetching, data, error, refetch, setError }
}

export { useListQuoteByTag }

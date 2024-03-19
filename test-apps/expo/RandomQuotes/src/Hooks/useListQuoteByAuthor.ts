import handleError from '../Helpers/handleError'
import { axiosInstance } from '../Service/api'
import { END_POINT } from '../Service/constant'
import { useState } from 'react'
import { useQuery } from 'react-query'

const request = async (author: string) => {
  const { data } = await axiosInstance.request({
    method: 'GET',
    url: END_POINT.quotes + '?author=' + author + '&limit=9999&maxLength=9999',
  })
  return data?.results || []
}

const useListQuoteByAuthor = (author: string) => {
  const [error, setError] = useState<string | null>(null)

  const { isError, data, isFetching, refetch } = useQuery({
    queryKey: ['get-useListQuoteByAuthor'],
    queryFn: () => request(author),
    onSuccess: (result) => {},
    onError: (err) => {
      const { message } = handleError(err)
      setError(message || 'Something went wrong')
    },
    enabled: true,
  })
  return { isError, isFetching, data, error, refetch, setError }
}

export { useListQuoteByAuthor }

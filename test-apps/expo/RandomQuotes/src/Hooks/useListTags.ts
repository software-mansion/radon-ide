import handleError from '../Helpers/handleError'
import { axiosInstance } from '../Service/api'
import { END_POINT } from '../Service/constant'
import { useState } from 'react'
import { useQuery } from 'react-query'

const request = async () => {
  const { data } = await axiosInstance.request({
    method: 'GET',
    url: END_POINT.tags,
  })
  return data || []
}

const useListTags = () => {
  const [error, setError] = useState<string | null>(null)

  const { isError, data, isFetching, refetch } = useQuery({
    queryKey: ['get-useListTags'],
    queryFn: () => request(),
    onSuccess: (result) => {},
    onError: (err) => {
      const { message } = handleError(err)
      setError(message || 'Something went wrong')
    },
    enabled: true,
  })
  return { isError, isFetching, data, error, refetch, setError }
}

export { useListTags }

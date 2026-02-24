import axios from 'axios'

const client = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  paramsSerializer: {
    indexes: null, // serialize arrays as status=a&status=b (FastAPI style)
  },
})

export default client

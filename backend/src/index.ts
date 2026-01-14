import { toNodeHandler } from 'better-auth/node'
import express from 'express'
import path from 'path'
import { auth } from './lib/auth.js'
import ENV from './config/ENV.js'
import eventRoutes from './routes/events.route.js'
import clubProfileRoutes from './routes/clubProfile.route.js'


const app = express()

const __dirname = import.meta.dirname

app.all('/api/auth/{*any}', toNodeHandler(auth))
app.use(express.json())
app.use("/api/event", eventRoutes)
app.use("/api/event", clubProfileRoutes)

app.use(express.static(path.join(__dirname, '../../frontend/dist')))

app.get('/{*splat}', async (_, res) =>
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'))
)

if (ENV.MODE === "DEV") app.listen(3000, () => console.log(`Server is running on port 3000 in ${ENV.MODE} mode`))

export default app

import { toNodeHandler } from 'better-auth/node'
import express from 'express'
import path from 'path'
import { auth } from './lib/auth.js'
import ENV from './config/ENV.js'
import eventRoutes from './routes/events.route.js'
import clubProfileRoutes from './routes/clubProfile.route.js'
import chatBotRoutes from './routes/chatBot.route.js'
import userRoutes from './routes/user.route.js'
import bookRoutes from './routes/books.route.js'
import classroomRoutes from './routes/classroom.route.js'
import chatRoutes from './routes/chat.route.js'

const app = express()

const __dirname = import.meta.dirname

app.all('/api/auth/{*any}', toNodeHandler(auth))
app.use(express.json())
app.use("/api/events", eventRoutes)
app.use("/api/clubs", clubProfileRoutes)
app.use("/api/chatbot", chatBotRoutes);
app.use("/api/users", userRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/classroom", classroomRoutes);
app.use("/api/chat", chatRoutes);

app.use(express.static(path.join(__dirname, '../../frontend/dist')))

app.get('/{*splat}', async (_, res) =>
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'))
)

if (ENV.MODE === "DEV") app.listen(3000, () => console.log(`Server is running on port 3000 in ${ENV.MODE} mode`))

export default app

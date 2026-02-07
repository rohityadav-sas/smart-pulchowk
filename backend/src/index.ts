import { toNodeHandler } from 'better-auth/node'
import express from 'express'
import path from 'path'
import { createServer } from 'http'
import compression from 'compression'
import { auth } from './lib/auth.js'
import ENV from './config/ENV.js'
import eventRoutes from './routes/events.route.js'
import clubProfileRoutes from './routes/clubProfile.route.js'
import chatBotRoutes from './routes/chatBot.route.js'
import userRoutes from './routes/user.route.js'
import bookRoutes from './routes/books.route.js'
import classroomRoutes from './routes/classroom.route.js'
import chatRoutes from './routes/chat.route.js'
import noticeRoutes from './routes/notice.route.js'
import adminRoutes from './routes/admin.route.js'
import searchRoutes from './routes/search.route.js'

const app = express()
const httpServer = createServer(app)

const __dirname = import.meta.dirname

app.all('/api/auth/{*any}', toNodeHandler(auth))
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use("/api/events", eventRoutes)
app.use("/api/clubs", clubProfileRoutes)
app.use("/api/chatbot", chatBotRoutes);
app.use("/api/users", userRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/classroom", classroomRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/search", searchRoutes);

app.use(
  express.static(path.join(__dirname, '../../frontend/dist'), {
    etag: true,
    setHeaders: (res, filePath) => {
      const fileName = path.basename(filePath)

      if (fileName === 'index.html') {
        res.setHeader('Cache-Control', 'no-cache')
        return
      }

      const isHashedAsset =
        /\.[A-Za-z0-9_-]{8,}\.(js|css|woff2?|ttf|png|jpe?g|svg)$/.test(fileName)

      if (isHashedAsset) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      } else {
        res.setHeader('Cache-Control', 'public, max-age=3600')
      }
    },
  }),
)

app.get('/{*splat}', async (_, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'))
})

if (ENV.MODE === "DEV") httpServer.listen(3000, () => console.log(`Server is running on port 3000 in ${ENV.MODE} mode`))

export default app

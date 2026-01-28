import dotenv from 'dotenv'

if (!process.env.MODE) {
  dotenv.config({
    path: '../.env.local',
  })
}


const getEnvVar = (key: string): string => {
  const value = process.env[key]
  if (value === undefined)
    throw new Error(`Environment variable ${key} is not set`)
  return value
}

const ENV = {
  BETTER_AUTH_SECRET: getEnvVar('BETTER_AUTH_SECRET'),
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  GOOGLE_CLIENT_ID: getEnvVar('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: getEnvVar('GOOGLE_CLIENT_SECRET'),
  MODE: getEnvVar('MODE'),
  GEMINI_API_KEY: getEnvVar('GEMINI_API_KEY'),
  CLOUDINARY_CLOUD_NAME: getEnvVar('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: getEnvVar('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: getEnvVar('CLOUDINARY_API_SECRET'),
  FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
}

export default ENV

import { Request, Response } from 'express'
import { resolveStudentConciergeQuery } from '../services/chatbot-concierge.service.js'

export const chatAI = async (req: Request, res: Response) => {
  try {
    const query =
      typeof req.body?.query === 'string' ? req.body.query.trim() : ''

    if (!query) {
      return res.json({
        success: false,
        message: 'No query provided',
        errorType: 'empty_query',
      })
    }

    if (query.length > 500) {
      return res.json({
        success: false,
        message: 'Query is too long. Please keep it under 500 characters.',
        errorType: 'query_too_long',
      })
    }

    const response = await resolveStudentConciergeQuery(query, {
      allowLlm: true,
    })

    return res.json({
      success: true,
      data: response,
    })
  } catch (error: any) {
    console.error('error in AI: ', error)

    // Detect quota exceeded errors
    const errorMessage = error.message || 'Internal server error'
    const isQuotaError =
      errorMessage.includes('429') ||
      errorMessage.includes('quota') ||
      errorMessage.includes('Too Many Requests')

    return res.json({
      success: false,
      message: isQuotaError
        ? 'API limit reached. Please try again in a minute.'
        : errorMessage,
      errorType: isQuotaError ? 'quota_exceeded' : 'general_error',
    })
  }
}

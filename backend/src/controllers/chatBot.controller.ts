import locationData from '../data/campus_data.json' with { type: 'json' }
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Request, Response } from 'express'
import ENV from '../config/ENV.js'

const genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY)

export const chatAI = async (req: Request, res: Response) => {
  try {
    const { query } = req.body

    if (!query) {
      return res.json({
        success: false,
        message: 'No query provided',
      })
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })

    const prompt = `You are a campus navigation assistant helping users find locations on campus.

Campus locations:
${JSON.stringify(locationData, null, 2)}

User question: ${query}

IMPORTANT INSTRUCTIONS:
- Do NOT mention latitude/longitude coordinates in your message
- Use descriptive location directions like "near the cafeteria", "next to the library", "behind the admin building"
- Be conversational and helpful
- Give clear directions using building names and landmarks

Return JSON:
{
  "message": "your helpful response WITHOUT coordinates",
  "locations": [
    {
      "building_id": "id",
      "building_name": "name",
      "coordinates": {"lat": number, "lng": number},
      "service_name": "service name or null",
      "service_location": "location or null",
      "role": "start" | "end" | "destination" (use "start" and "end" for directions, "destination" for single locations)
    }
  ],
  "action": "show_route" | "show_location" | "show_multiple_locations"
}

CRITICAL RULES FOR DIRECTIONS/ROUTES:
- If user asks for "directions", "route", "navigate from X to Y", "how to get from X to Y", "take me from X to Y":
  → action MUST be "show_route"
  → locations array MUST have EXACTLY 2 items:
    1. First item: the START location with role: "start"
    2. Second item: the END/destination location with role: "end"
  → Message should describe how to walk between the two locations

- If user just asks "where is X" or "show me X" → action: "show_location", single location with role: "destination"
- If user asks about multiple unrelated locations → action: "show_multiple_locations"

Example for directions:
User: "Show me directions from Pulchowk Library to Campus Mess"
Response:
{
  "message": "From Pulchowk Library, head south past the ICTC Building and continue towards the main entrance area. The Campus Mess will be on your right, near the helicopter parking area.",
  "locations": [
    {
      "building_id": "pulchowk-library",
      "building_name": "Pulchowk Library",
      "coordinates": {"lat": 27.681579366803874, "lng": 85.3194349446735},
      "role": "start"
    },
    {
      "building_id": "campus-mess",
      "building_name": "Campus Mess",
      "coordinates": {"lat": 27.68100688137129, "lng": 85.31953172446174},
      "role": "end"
    }
  ],
  "action": "show_route"
}

Respond ONLY with JSON.`

    const result = await model.generateContent(prompt)
    const response = JSON.parse(result.response.text())

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

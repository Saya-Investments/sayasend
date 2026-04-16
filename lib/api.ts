/**
 * API Client for Cloud Run integration
 * This file contains functions to communicate with the Cloud Run backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://your-cloud-run-url.run.app'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`API call failed: ${errorMessage}`)
    return { success: false, error: errorMessage }
  }
}

async function internalApiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `API error: ${response.status} ${response.statusText}`)
    }

    return { success: true, data: data.data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Internal API call failed: ${errorMessage}`)
    return { success: false, error: errorMessage }
  }
}

/**
 * Fetch campaigns from Cloud Run
 */
export async function getCampaigns() {
  return apiCall('/api/campaigns')
}

/**
 * Fetch campaign by ID
 */
export async function getCampaignById(id: string) {
  return apiCall(`/api/campaigns/${id}`)
}

/**
 * Create a new campaign
 */
export async function createCampaign(campaignData: any) {
  return apiCall('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(campaignData),
  })
}

/**
 * Send campaign
 */
export async function sendCampaign(campaignId: string) {
  return apiCall(`/api/campaigns/${campaignId}/send`, {
    method: 'POST',
  })
}

/**
 * Fetch templates from Cloud Run
 */
export async function getTemplates() {
  return apiCall('/api/templates')
}

/**
 * Fetch template by ID
 */
export async function getTemplateById(id: string) {
  return apiCall(`/api/templates/${id}`)
}

/**
 * Create a new template
 */
export async function createTemplate(templateData: any) {
  return apiCall('/api/templates', {
    method: 'POST',
    body: JSON.stringify(templateData),
  })
}

/**
 * Fetch contacts based on filters from BigQuery via Cloud Run
 */
export async function getContactsByFilters(filters: {
  segmento?: string
  estrategia?: string
}) {
  const queryParams = new URLSearchParams()
  if (filters.segmento) queryParams.append('segmento', filters.segmento)
  if (filters.estrategia) queryParams.append('estrategia', filters.estrategia)

  return apiCall(`/api/contacts?${queryParams.toString()}`)
}

/**
 * Fetch campaign metrics
 */
export async function getCampaignMetrics(campaignId: string) {
  return apiCall(`/api/campaigns/${campaignId}/metrics`)
}

export async function getBigQueryDatabases() {
  return internalApiCall('/api/bigquery/databases')
}

export async function getBigQueryContacts(filters: {
  databaseName: string
  segmento?: string
  estrategia?: string
}) {
  const queryParams = new URLSearchParams({
    databaseName: filters.databaseName,
  })

  if (filters.segmento) queryParams.append('segmento', filters.segmento)
  if (filters.estrategia) queryParams.append('estrategia', filters.estrategia)

  return internalApiCall(`/api/bigquery/contacts?${queryParams.toString()}`)
}

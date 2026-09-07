/**
 * BOKKARA AIRLINE SEARCH API
 *
 * Endpoint:
 * GET /api/airline-search?flight=BW601
 *
 * Architecture:
 *
 * Shopify
 *   ↓
 * /api/airline-search
 *   ↓
 * SerpApi Google Search
 *   ↓
 * Google Flight Status information
 *   ↓
 * Normalized Bokkara response
 */

const SERPAPI_URL = "https://serpapi.com/search";


// ============================================================
// CORS
// ============================================================

function setCors(res, origin) {
  const allowedOrigins = [
    "https://bokkara.com",
    "https://www.bokkara.com",
    "https://bokkara.myshopify.com"
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Access-Control-Max-Age",
    "86400"
  );
}


// ============================================================
// HELPERS
// ============================================================

function cleanString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const result = value.trim();
    return result || null;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return null;
}


function firstString(...values) {
  for (const value of values) {
    const result = cleanString(value);

    if (result) {
      return result;
    }
  }

  return null;
}


function firstNumber(...values) {
  for (const value of values) {
    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return number;
      }
    }
  }

  return null;
}


function normalizeFlightNumber(value) {
  const text = cleanString(value);

  if (!text) {
    return null;
  }

  return text
    .replace(/\s+/g, "")
    .toUpperCase();
}


function normalizeStatus(value) {
  const text = cleanString(value);

  if (!text) {
    return null;
  }

  return text;
}


function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


// ============================================================
// RECURSIVE SEARCH
// ============================================================

function findValuesDeep(object, keys, results = []) {
  if (!object || typeof object !== "object") {
    return results;
  }

  if (Array.isArray(object)) {
    for (const item of object) {
      findValuesDeep(item, keys, results);
    }

    return results;
  }

  for (const [key, value] of Object.entries(object)) {
    const normalizedKey = key.toLowerCase();

    if (
      keys.some(
        candidate =>
          normalizedKey === candidate.toLowerCase()
      )
    ) {
      results.push(value);
    }

    if (value && typeof value === "object") {
      findValuesDeep(value, keys, results);
    }
  }

  return results;
}


function findFirstValueDeep(object, keys) {
  const values = findValuesDeep(object, keys);

  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}


// ============================================================
// AIRPORT NORMALIZATION
// ============================================================

function normalizeAirport(value) {
  if (!value) {
    return {
      code: null,
      name: null,
      city: null,
      country: null
    };
  }

  if (typeof value === "string") {
    const text = value.trim();

    const codeMatch = text.match(
      /\b[A-Z]{3}\b/
    );

    return {
      code: codeMatch
        ? codeMatch[0]
        : null,
      name: text,
      city: null,
      country: null
    };
  }

  if (!isObject(value)) {
    return {
      code: null,
      name: null,
      city: null,
      country: null
    };
  }

  return {
    code: firstString(
      value.code,
      value.iata,
      value.iata_code,
      value.airport_code
    ),

    name: firstString(
      value.name,
      value.airport_name,
      value.title
    ),

    city: firstString(
      value.city,
      value.city_name,
      value.location
    ),

    country: firstString(
      value.country,
      value.country_name
    )
  };
}


// ============================================================
// TIME NORMALIZATION
// ============================================================

function normalizeTime(value) {
  if (!value) {
    return {
      scheduled: null,
      estimated: null,
      actual: null,
      timezone: null
    };
  }

  if (typeof value === "string") {
    return {
      scheduled: value,
      estimated: null,
      actual: null,
      timezone: null
    };
  }

  if (!isObject(value)) {
    return {
      scheduled: null,
      estimated: null,
      actual: null,
      timezone: null
    };
  }

  return {
    scheduled: firstString(
      value.scheduled,
      value.scheduled_time,
      value.departure_time,
      value.arrival_time,
      value.time
    ),

    estimated: firstString(
      value.estimated,
      value.estimated_time
    ),

    actual: firstString(
      value.actual,
      value.actual_time
    ),

    timezone: firstString(
      value.timezone,
      value.time_zone
    )
  };
}


// ============================================================
// AIRLINE NORMALIZATION
// ============================================================

function normalizeAirline(value) {
  if (!value) {
    return {
      name: null,
      logo: null,
      code: null
    };
  }

  if (typeof value === "string") {
    return {
      name: value,
      logo: null,
      code: null
    };
  }

  if (!isObject(value)) {
    return {
      name: null,
      logo: null,
      code: null
    };
  }

  return {
    name: firstString(
      value.name,
      value.airline,
      value.title,
      value.operator
    ),

    logo: firstString(
      value.logo,
      value.logo_url,
      value.image,
      value.image_url,
      value.thumbnail
    ),

    code: firstString(
      value.code,
      value.iata,
      value.airline_code
    )
  };
}


// ============================================================
// AIRCRAFT NORMALIZATION
// ============================================================

function normalizeAircraft(value) {
  if (!value) {
    return {
      name: null,
      registration: null
    };
  }

  if (typeof value === "string") {
    return {
      name: value,
      registration: null
    };
  }

  if (!isObject(value)) {
    return {
      name: null,
      registration: null
    };
  }

  return {
    name: firstString(
      value.name,
      value.type,
      value.model,
      value.aircraft
    ),

    registration: firstString(
      value.registration,
      value.registration_number,
      value.tail_number
    )
  };
}


// ============================================================
// FIND LIKELY FLIGHT OBJECTS
// ============================================================

function collectObjects(object, results = []) {
  if (!object || typeof object !== "object") {
    return results;
  }

  if (Array.isArray(object)) {
    for (const item of object) {
      collectObjects(item, results);
    }

    return results;
  }

  results.push(object);

  for (const value of Object.values(object)) {
    if (value && typeof value === "object") {
      collectObjects(value, results);
    }
  }

  return results;
}


function scoreFlightObject(object, requestedFlight) {
  if (!isObject(object)) {
    return -Infinity;
  }

  let score = 0;

  const requested = normalizeFlightNumber(
    requestedFlight
  );

  const flightNumbers = [
    object.flight,
    object.flight_number,
    object.flightNumber,
    object.number,
    object.flight_num
  ];

  for (const value of flightNumbers) {
    const normalized = normalizeFlightNumber(value);

    if (
      normalized &&
      requested &&
      normalized.includes(requested)
    ) {
      score += 100;
    }
  }

  const keys = Object.keys(object).map(
    key => key.toLowerCase()
  );

  const usefulKeys = [
    "flight",
    "flight_number",
    "flightnumber",
    "airline",
    "departure",
    "arrival",
    "origin",
    "destination",
    "status",
    "aircraft",
    "terminal",
    "gate"
  ];

  for (const key of usefulKeys) {
    if (keys.includes(key)) {
      score += 5;
    }
  }

  return score;
}


function findBestFlightObject(data, requestedFlight) {
  const objects = collectObjects(data);

  let best = null;
  let bestScore = -Infinity;

  for (const object of objects) {
    const score = scoreFlightObject(
      object,
      requestedFlight
    );

    if (score > bestScore) {
      bestScore = score;
      best = object;
    }
  }

  return best;
}


// ============================================================
// TEXT EXTRACTION
// ============================================================

function extractFlightNumber(data, requestedFlight) {
  const value = findFirstValueDeep(
    data,
    [
      "flight_number",
      "flightNumber",
      "flight",
      "number"
    ]
  );

  return normalizeFlightNumber(
    firstString(value, requestedFlight)
  );
}


function extractDate(data) {
  return firstString(
    findFirstValueDeep(data, [
      "date",
      "flight_date",
      "departure_date",
      "departureDate"
    ])
  );
}


function extractStatus(data) {
  const value = findFirstValueDeep(
    data,
    [
      "status",
      "flight_status",
      "status_text",
      "status_description"
    ]
  );

  if (isObject(value)) {
    return {
      value: firstString(
        value.value,
        value.status,
        value.name,
        value.title,
        value.text
      ),

      description: firstString(
        value.description,
        value.status_description,
        value.detail,
        value.text
      ),

      delay: firstString(
        value.delay,
        value.delay_text
      )
    };
  }

  return {
    value: normalizeStatus(value),
    description: normalizeStatus(value),
    delay: null
  };
}


// ============================================================
// MAIN NORMALIZER
// ============================================================

function normalizeFlightData(
  serpData,
  requestedFlight
) {
  const bestObject =
    findBestFlightObject(
      serpData,
      requestedFlight
    ) || {};

  const departureValue =
    bestObject.departure ||
    bestObject.origin ||
    findFirstValueDeep(
      serpData,
      [
        "departure",
        "origin"
      ]
    );

  const arrivalValue =
    bestObject.arrival ||
    bestObject.destination ||
    findFirstValueDeep(
      serpData,
      [
        "arrival",
        "destination"
      ]
    );

  const airlineValue =
    bestObject.airline ||
    findFirstValueDeep(
      serpData,
      ["airline"]
    );

  const aircraftValue =
    bestObject.aircraft ||
    findFirstValueDeep(
      serpData,
      ["aircraft"]
    );

  const departureObject =
    isObject(departureValue)
      ? departureValue
      : {};

  const arrivalObject =
    isObject(arrivalValue)
      ? arrivalValue
      : {};

  const departureAirport =
    normalizeAirport(
      departureObject.airport ||
      departureObject.airport_name ||
      departureObject
    );

  const arrivalAirport =
    normalizeAirport(
      arrivalObject.airport ||
      arrivalObject.airport_name ||
      arrivalObject
    );

  const departureTime =
    normalizeTime(
      departureObject.time ||
      departureObject.times ||
      departureObject
    );

  const arrivalTime =
    normalizeTime(
      arrivalObject.time ||
      arrivalObject.times ||
      arrivalObject
    );

  const airline =
    normalizeAirline(
      airlineValue
    );

  const aircraft =
    normalizeAircraft(
      aircraftValue
    );

  const status =
    extractStatus(
      serpData
    );

  const flightNumber =
    extractFlightNumber(
      serpData,
      requestedFlight
    );

  const date =
    extractDate(
      serpData
    );

  const duration =
    firstString(
      bestObject.duration,
      bestObject.flight_duration,
      findFirstValueDeep(
        serpData,
        [
          "duration",
          "flight_duration"
        ]
      )
    );

  const terminal =
    firstString(
      departureObject.terminal,
      bestObject.terminal,
      findFirstValueDeep(
        serpData,
        ["terminal"]
      )
    );

  const gate =
    firstString(
      departureObject.gate,
      bestObject.gate,
      findFirstValueDeep(
        serpData,
        ["gate"]
      )
    );

  const baggage =
    firstString(
      arrivalObject.baggage,
      bestObject.baggage,
      findFirstValueDeep(
        serpData,
        ["baggage"]
      )
    );

  const progress =
    firstNumber(
      bestObject.progress,
      bestObject.progress_percentage,
      bestObject.progressPercentage,
      findFirstValueDeep(
        serpData,
        [
          "progress",
          "progress_percentage",
          "progressPercentage"
        ]
      )
    );

  const progressText =
    firstString(
      bestObject.progress_text,
      bestObject.progressText,
      findFirstValueDeep(
        serpData,
        [
          "progress_text",
          "progressText"
        ]
      )
    );

  return {
    number: flightNumber,

    airline: {
      name: airline.name,
      logo: airline.logo,
      code: airline.code
    },

    status: {
      value: status.value,
      description: status.description,
      delay: status.delay
    },

    date,

    departure: {
      airport: departureAirport,

      time: departureTime,

      terminal,

      gate
    },

    arrival: {
      airport: arrivalAirport,

      time: arrivalTime,

      terminal: firstString(
        arrivalObject.terminal
      ),

      gate: firstString(
        arrivalObject.gate
      ),

      baggage
    },

    aircraft,

    duration,

    progress: {
      percentage: progress,
      text: progressText
    },

    requested_flight: requestedFlight
  };
}


// ============================================================
// ERROR RESPONSE
// ============================================================

function sendError(
  res,
  statusCode,
  code,
  message,
  extra = {}
) {
  return res.status(statusCode).json({
    success: false,

    error: {
      code,
      message
    },

    ...extra
  });
}


// ============================================================
// API HANDLER
// ============================================================

export default async function handler(req, res) {

  const origin =
    req.headers.origin || "";

  setCors(res, origin);


  // ----------------------------------------------------------
  // OPTIONS
  // ----------------------------------------------------------

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }


  // ----------------------------------------------------------
  // METHOD
  // ----------------------------------------------------------

  if (req.method !== "GET") {
    return sendError(
      res,
      405,
      "METHOD_NOT_ALLOWED",
      "Only GET requests are supported."
    );
  }


  // ----------------------------------------------------------
  // API KEY
  // ----------------------------------------------------------

  const apiKey =
    process.env.SERPAPI_KEY;

  if (!apiKey) {
    console.error(
      "SERPAPI_KEY environment variable is missing."
    );

    return sendError(
      res,
      500,
      "SERVER_CONFIGURATION_ERROR",
      "The flight search service is not configured."
    );
  }


  // ----------------------------------------------------------
  // FLIGHT NUMBER
  // ----------------------------------------------------------

  let flight =
    req.query.flight;

  if (Array.isArray(flight)) {
    flight = flight[0];
  }

  flight =
    normalizeFlightNumber(flight);


  if (!flight) {
    return sendError(
      res,
      400,
      "MISSING_FLIGHT",
      "Please provide a flight number."
    );
  }


  // ----------------------------------------------------------
  // VALIDATE FLIGHT NUMBER
  // ----------------------------------------------------------

  const flightPattern =
    /^[A-Z0-9]{2,3}[0-9]{1,4}$/;

  if (!flightPattern.test(flight)) {
    return sendError(
      res,
      400,
      "INVALID_FLIGHT",
      "Please enter a valid flight number such as BW601."
    );
  }


  // ----------------------------------------------------------
  // SEARCH QUERY
  // ----------------------------------------------------------

  const searchQuery =
    `${flight} flight status`;


  // ----------------------------------------------------------
  // SERPAPI REQUEST
  // ----------------------------------------------------------

  const params =
    new URLSearchParams({
      engine: "google",

      q: searchQuery,

      device: "mobile",

      hl: "en",

      gl: "us",

      api_key: apiKey,

      output: "json"
    });


  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      15000
    );


  let serpResponse;

  try {

    serpResponse =
      await fetch(
        `${SERPAPI_URL}?${params.toString()}`,
        {
          method: "GET",

          headers: {
            Accept: "application/json"
          },

          signal:
            controller.signal
        }
      );

  } catch (error) {

    clearTimeout(timeout);

    console.error(
      "SerpApi request failed:",
      error
    );

    if (
      error &&
      error.name === "AbortError"
    ) {
      return sendError(
        res,
        504,
        "SERPAPI_TIMEOUT",
        "The flight search service took too long to respond."
      );
    }

    return sendError(
      res,
      502,
      "SERPAPI_CONNECTION_ERROR",
      "Unable to connect to the flight search service."
    );
  }

  clearTimeout(timeout);


  // ----------------------------------------------------------
  // READ RESPONSE
  // ----------------------------------------------------------

  let serpData;

  try {

    serpData =
      await serpResponse.json();

  } catch (error) {

    console.error(
      "Invalid SerpApi JSON response:",
      error
    );

    return sendError(
      res,
      502,
      "INVALID_SERPAPI_RESPONSE",
      "The flight search service returned an invalid response."
    );
  }


  // ----------------------------------------------------------
  // SERPAPI ERROR
  // ----------------------------------------------------------

  if (!serpResponse.ok) {

    console.error(
      "SerpApi HTTP error:",
      serpData
    );

    return sendError(
      res,
      502,
      "SERPAPI_ERROR",
      "The flight search service returned an error.",

      {
        serpapi_status:
          serpResponse.status
      }
    );
  }


  if (
    serpData.error
  ) {

    console.error(
      "SerpApi API error:",
      serpData.error
    );

    return sendError(
      res,
      502,
      "SERPAPI_API_ERROR",
      "The flight search service returned an error."
    );
  }


  // ----------------------------------------------------------
  // NORMALIZE
  // ----------------------------------------------------------

  const normalizedFlight =
    normalizeFlightData(
      serpData,
      flight
    );


  // ----------------------------------------------------------
  // DETERMINE WHETHER WE FOUND
  // ----------------------------------------------------------

  const hasUsefulFlightData =
    Boolean(
      normalizedFlight.number ||
      normalizedFlight.airline.name ||
      normalizedFlight.departure.airport.code ||
      normalizedFlight.arrival.airport.code ||
      normalizedFlight.status.value
    );


  if (!hasUsefulFlightData) {

    return res.status(404).json({

      success: false,

      error: {
        code: "FLIGHT_NOT_FOUND",

        message:
          `No flight information was found for ${flight}.`
      },

      query: {
        flight,

        search:
          searchQuery,

        engine:
          "google",

        device:
          "mobile"
      },

      raw: serpData
    });
  }


  // ----------------------------------------------------------
  // SUCCESS
  // ----------------------------------------------------------

  return res.status(200).json({

    success: true,

    query: {

      flight,

      search:
        searchQuery,

      engine:
        "google",

      device:
        "mobile"
    },

    flight:
      normalizedFlight,

    // Keep the complete SerpApi response available.
    // This makes it possible to add more fields later
    // without needing to change the backend architecture.
    raw:
      serpData
  });
}

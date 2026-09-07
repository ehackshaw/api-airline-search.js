/**
 * ============================================================
 * BOKKARA AIRLINE SEARCH API
 * ============================================================
 *
 * Endpoint:
 *
 * GET /api/airline-search?flight=BW601&date=2026-09-12
 *
 * IMPORTANT:
 * This endpoint returns ONLY the requested flight/date.
 *
 * It does NOT return:
 * - available_dates
 * - other dates
 * - unrelated flight records
 *
 * Expected SerpApi structure:
 *
 * {
 *   flight_result: {
 *     title,
 *     flight_designator,
 *     route,
 *     available_dates: [],
 *     dates: [
 *       {
 *         date,
 *         metadata: {},
 *         departure_airport: {},
 *         arrival_airport: {},
 *         ...
 *       }
 *     ],
 *     airline,
 *     airline_iata_code
 *   }
 * }
 *
 * ============================================================
 */

const SERPAPI_URL = "https://serpapi.com/search.json";

const REQUEST_TIMEOUT_MS = 20000;


/* ============================================================
   CORS
============================================================ */

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
}


/* ============================================================
   SAFE STRING
============================================================ */

function cleanString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const valueString = String(value).trim();

  if (!valueString) {
    return null;
  }

  return valueString;
}


/* ============================================================
   NORMALIZE FLIGHT NUMBER
============================================================ */

function normalizeFlightNumber(value) {
  const valueString = cleanString(value);

  if (!valueString) {
    return null;
  }

  return valueString
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}


/* ============================================================
   NORMALIZE DATE
============================================================ */

function normalizeDate(value) {
  const valueString = cleanString(value);

  if (!valueString) {
    return null;
  }

  const match = valueString.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return null;
  }

  return valueString;
}


/* ============================================================
   DATE VALIDATION
============================================================ */

function isValidDate(dateString) {
  if (!dateString) {
    return false;
  }

  const date = new Date(
    `${dateString}T00:00:00Z`
  );

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.toISOString().slice(0, 10) === dateString
  );
}


/* ============================================================
   SAFE INTEGER
============================================================ */

function toNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


/* ============================================================
   COPY OBJECT WITHOUT MUTATION
============================================================ */

function cloneObject(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return value;
  }

  if (
    typeof value !== "object"
  ) {
    return value;
  }

  return JSON.parse(
    JSON.stringify(value)
  );
}


/* ============================================================
   FIND FLIGHT RESULT
============================================================ */

function findFlightResult(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  /*
   * Most likely location.
   */
  if (
    data.flight_result &&
    typeof data.flight_result === "object"
  ) {
    return data.flight_result;
  }

  /*
   * Sometimes nested under answer_box.
   */
  if (
    data.answer_box &&
    typeof data.answer_box === "object"
  ) {
    if (
      data.answer_box.flight_result &&
      typeof data.answer_box.flight_result === "object"
    ) {
      return data.answer_box.flight_result;
    }
  }

  /*
   * Sometimes nested under knowledge_graph.
   */
  if (
    data.knowledge_graph &&
    typeof data.knowledge_graph === "object"
  ) {
    if (
      data.knowledge_graph.flight_result &&
      typeof data.knowledge_graph.flight_result === "object"
    ) {
      return data.knowledge_graph.flight_result;
    }
  }

  /*
   * Recursive fallback.
   */
  const visited = new Set();

  function search(node) {
    if (
      !node ||
      typeof node !== "object"
    ) {
      return null;
    }

    if (visited.has(node)) {
      return null;
    }

    visited.add(node);

    if (
      node.flight_result &&
      typeof node.flight_result === "object"
    ) {
      return node.flight_result;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const result = search(item);

        if (result) {
          return result;
        }
      }

      return null;
    }

    for (const key of Object.keys(node)) {
      const result = search(node[key]);

      if (result) {
        return result;
      }
    }

    return null;
  }

  return search(data);
}


/* ============================================================
   FIND DATES ARRAY
============================================================ */

function findDatesArray(flightResult) {
  if (
    !flightResult ||
    typeof flightResult !== "object"
  ) {
    return [];
  }

  if (
    Array.isArray(flightResult.dates)
  ) {
    return flightResult.dates;
  }

  return [];
}


/* ============================================================
   FIND EXACT DATE
============================================================ */

function findExactDate(
  flightResult,
  requestedDate
) {
  const dates =
    findDatesArray(flightResult);

  if (!dates.length) {
    return null;
  }

  /*
   * Exact string match only.
   *
   * We intentionally DO NOT:
   *
   * - choose the nearest date
   * - choose the first date
   * - choose today's date
   * - choose another available date
   */

  return (
    dates.find((item) => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return false;
      }

      return (
        cleanString(item.date) ===
        requestedDate
      );
    }) || null
  );
}


/* ============================================================
   MERGE METADATA SAFELY
============================================================ */

function normalizeMetadata(
  record,
  flightResult
) {
  const metadata =
    record &&
    typeof record.metadata === "object"
      ? cloneObject(record.metadata)
      : {};

  const result = {
    ...metadata
  };

  /*
   * Only fill values when they are genuinely
   * available elsewhere.
   */

  if (
    !result.airline_iata_code &&
    flightResult.airline_iata_code
  ) {
    result.airline_iata_code =
      flightResult.airline_iata_code;
  }

  if (
    !result.flight_number &&
    record.flight_designator
  ) {
    result.flight_number =
      record.flight_designator;
  }

  return result;
}


/* ============================================================
   NORMALIZE AIRPORT
============================================================ */

function normalizeAirport(
  airport,
  fallbackId,
  fallbackCity
) {
  if (
    !airport ||
    typeof airport !== "object"
  ) {
    return null;
  }

  const result = cloneObject(
    airport
  );

  /*
   * Preserve EVERYTHING SerpApi gives us.
   */

  if (
    !result.id &&
    fallbackId
  ) {
    result.id = fallbackId;
  }

  if (
    !result.city &&
    fallbackCity
  ) {
    result.city = fallbackCity;
  }

  return result;
}


/* ============================================================
   NORMALIZE EXACT FLIGHT RECORD
============================================================ */

function buildExactFlightResult(
  flightResult,
  dateRecord,
  requestedDate,
  requestedFlight
) {
  if (
    !flightResult ||
    !dateRecord
  ) {
    return null;
  }

  const metadata =
    normalizeMetadata(
      dateRecord,
      flightResult
    );

  /*
   * Start with only the requested date.
   *
   * We DO NOT copy:
   *
   * flightResult.dates
   * flightResult.available_dates
   */

  const result = {
    title:
      cleanString(
        flightResult.title
      ),

    flight_designator:
      cleanString(
        dateRecord.flight_designator ||
        flightResult.flight_designator ||
        requestedFlight
      ),

    route:
      cleanString(
        flightResult.route
      ),

    date:
      requestedDate,

    metadata,

    airline:
      cleanString(
        flightResult.airline
      ),

    airline_iata_code:
      cleanString(
        flightResult.airline_iata_code ||
        metadata.airline_iata_code
      )
  };


  /* ==========================================================
     COPY ALL DATE-SPECIFIC FIELDS
  ========================================================== */

  const excludedKeys = new Set([
    "date",
    "metadata"
  ]);

  for (
    const key of Object.keys(dateRecord)
  ) {
    if (
      excludedKeys.has(key)
    ) {
      continue;
    }

    result[key] =
      cloneObject(
        dateRecord[key]
      );
  }


  /* ==========================================================
     AIRPORT NORMALIZATION
  ========================================================== */

  const origin =
    cleanString(
      metadata.origin
    );

  const destination =
    cleanString(
      metadata.destination
    );

  const departureCity =
    result.departure_airport &&
    typeof result.departure_airport === "object"
      ? cleanString(
          result.departure_airport.city
        )
      : null;

  const arrivalCity =
    result.arrival_airport &&
    typeof result.arrival_airport === "object"
      ? cleanString(
          result.arrival_airport.city
        )
      : null;

  if (
    result.departure_airport &&
    typeof result.departure_airport === "object"
  ) {
    result.departure_airport =
      normalizeAirport(
        result.departure_airport,
        origin,
        departureCity
      );
  }

  if (
    result.arrival_airport &&
    typeof result.arrival_airport === "object"
  ) {
    result.arrival_airport =
      normalizeAirport(
        result.arrival_airport,
        destination,
        arrivalCity
      );
  }


  /* ==========================================================
     DURATION
  ========================================================== */

  if (
    result.duration !== undefined
  ) {
    result.duration =
      toNumber(
        result.duration
      );
  }


  /* ==========================================================
     DELAYS
  ========================================================== */

  if (
    result.metadata &&
    typeof result.metadata === "object"
  ) {
    if (
      result.metadata.departure_delay !==
      undefined
    ) {
      result.metadata.departure_delay =
        toNumber(
          result.metadata.departure_delay
        );
    }

    if (
      result.metadata.arrival_delay !==
      undefined
    ) {
      result.metadata.arrival_delay =
        toNumber(
          result.metadata.arrival_delay
        );
    }
  }


  return result;
}


/* ============================================================
   CHECK SERPAPI ERROR
============================================================ */

function getSerpApiError(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  if (data.error) {
    return cleanString(
      data.error
    );
  }

  return null;
}


/* ============================================================
   FETCH WITH TIMEOUT
============================================================ */

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = REQUEST_TIMEOUT_MS
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    const response =
      await fetch(
        url,
        {
          ...options,
          signal:
            controller.signal
        }
      );

    return response;

  } finally {
    clearTimeout(timeout);
  }
}


/* ============================================================
   MAIN HANDLER
============================================================ */

export default async function handler(
  req,
  res
) {
  setCors(res);

  /*
   * OPTIONS
   */

  if (
    req.method === "OPTIONS"
  ) {
    return res
      .status(204)
      .end();
  }


  /*
   * GET ONLY
   */

  if (
    req.method !== "GET"
  ) {
    return res
      .status(405)
      .json({
        success: false,
        error:
          "Method not allowed. Use GET."
      });
  }


  /*
   * API KEY
   */

  const apiKey =
    process.env.SERPAPI_KEY;

  if (!apiKey) {
    console.error(
      "SERPAPI_KEY is missing."
    );

    return res
      .status(500)
      .json({
        success: false,
        error:
          "Flight search service is not configured."
      });
  }


  /*
   * REQUEST PARAMETERS
   */

  const rawFlight =
    req.query &&
    req.query.flight;

  const rawDate =
    req.query &&
    req.query.date;


  /*
   * FLIGHT
   */

  const flight =
    normalizeFlightNumber(
      rawFlight
    );

  if (!flight) {
    return res
      .status(400)
      .json({
        success: false,
        error:
          "Missing flight number.",
        example:
          "/api/airline-search?flight=BW601&date=2026-09-12"
      });
  }


  /*
   * DATE
   */

  const date =
    normalizeDate(
      rawDate
    );

  if (!date) {
    return res
      .status(400)
      .json({
        success: false,
        error:
          "Missing or invalid date.",
        expected_format:
          "YYYY-MM-DD",
        example:
          "/api/airline-search?flight=BW601&date=2026-09-12"
      });
  }


  if (!isValidDate(date)) {
    return res
      .status(400)
      .json({
        success: false,
        error:
          "Invalid calendar date.",
        date
      });
  }


  /*
   * SERPAPI SEARCH
   *
   * The date is explicitly included in the
   * search query so Google is asked about
   * the exact requested flight/date.
   */

  const searchQuery =
    `${flight} flight status ${date}`;


  const params =
    new URLSearchParams({
      engine: "google",
      q: searchQuery,
      api_key: apiKey,
      device: "mobile",
      hl: "en",
      gl: "us"
    });


  const requestUrl =
    `${SERPAPI_URL}?${params.toString()}`;


  console.log(
    `[BOKKARA FLIGHT] Searching ${flight} for ${date}`
  );


  /*
   * FETCH SERPAPI
   */

  let serpResponse;

  try {
    serpResponse =
      await fetchWithTimeout(
        requestUrl,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json"
          }
        }
      );

  } catch (error) {
    console.error(
      "[BOKKARA FLIGHT] SerpApi request failed:",
      error
    );

    if (
      error &&
      error.name === "AbortError"
    ) {
      return res
        .status(504)
        .json({
          success: false,
          error:
            "Flight search timed out.",
          flight,
          date
        });
    }

    return res
      .status(502)
      .json({
        success: false,
        error:
          "Unable to contact flight search service.",
        flight,
        date
      });
  }


  /*
   * RESPONSE STATUS
   */

  if (
    !serpResponse.ok
  ) {
    let errorBody = null;

    try {
      errorBody =
        await serpResponse.json();
    } catch (_) {
      errorBody = null;
    }

    console.error(
      "[BOKKARA FLIGHT] SerpApi HTTP error:",
      serpResponse.status,
      errorBody
    );

    return res
      .status(502)
      .json({
        success: false,
        error:
          "Flight search provider returned an error.",
        provider_status:
          serpResponse.status,
        flight,
        date
      });
  }


  /*
   * PARSE JSON
   */

  let serpData;

  try {
    serpData =
      await serpResponse.json();

  } catch (error) {
    console.error(
      "[BOKKARA FLIGHT] Invalid JSON from SerpApi:",
      error
    );

    return res
      .status(502)
      .json({
        success: false,
        error:
          "Invalid response from flight search provider.",
        flight,
        date
      });
  }


  /*
   * SERPAPI ERROR
   */

  const serpError =
    getSerpApiError(
      serpData
    );

  if (serpError) {
    return res
      .status(502)
      .json({
        success: false,
        error:
          serpError,
        flight,
        date
      });
  }


  /*
   * FIND FLIGHT RESULT
   */

  const flightResult =
    findFlightResult(
      serpData
    );


  if (!flightResult) {
    console.log(
      `[BOKKARA FLIGHT] No flight_result found for ${flight} ${date}`
    );

    return res
      .status(404)
      .json({
        success: false,
        error:
          "Flight information was not found.",
        flight,
        date,
        raw: serpData
      });
  }


  /*
   * FIND EXACT DATE
   */

  const exactDateRecord =
    findExactDate(
      flightResult,
      date
    );


  /*
   * VERY IMPORTANT:
   *
   * We do NOT fall back to another date.
   */

  if (!exactDateRecord) {
    console.log(
      `[BOKKARA FLIGHT] Exact date not found: ${flight} ${date}`
    );

    return res
      .status(404)
      .json({
        success: false,
        error:
          "No flight information is available for the selected date.",
        flight,
        date,
        raw: {
          /*
           * We intentionally don't expose
           * the complete flight_result here.
           *
           * The user asked for the exact date only.
           */
          provider:
            "SerpApi"
        }
      });
  }


  /*
   * BUILD EXACT DATE RESULT
   */

  const exactFlight =
    buildExactFlightResult(
      flightResult,
      exactDateRecord,
      date,
      flight
    );


  if (!exactFlight) {
    return res
      .status(500)
      .json({
        success: false,
        error:
          "Unable to process the flight information.",
        flight,
        date
      });
  }


  /*
   * RESPONSE
   *
   * IMPORTANT:
   *
   * We intentionally construct a NEW
   * flight_result object.
   *
   * We do NOT return the original
   * flight_result because that would
   * expose all dates.
   */

  const responseFlightResult = {
    ...exactFlight
  };


  /*
   * FINAL RESPONSE
   */

  return res
    .status(200)
    .json({
      success: true,

      query: {
        flight,
        date,
        search:
          searchQuery,
        engine:
          "google",
        device:
          "mobile"
      },

      flight_result:
        responseFlightResult,

      /*
       * Full provider response is retained
       * for debugging/development.
       *
       * If you don't want ANY other dates
       * exposed to the browser, remove `raw`
       * before production.
       */
      raw: serpData
    });
}

/**
 * BOKKARA AIRLINE SEARCH API
 * Vercel Serverless Function
 *
 * Endpoint:
 * /api/airline-search?flight=JBU117&date=2026-09-08
 *
 * Environment variable required:
 * SERPAPI_KEY
 *
 * Accepts:
 *   JBU117
 *   JBU 117
 *   B6117
 *   B6 117
 *   JetBlue 117
 *
 * The API searches multiple representations of the flight number
 * and normalizes the response into one consistent structure.
 */

const SERPAPI_URL = "https://serpapi.com/search.json";
const REQUEST_TIMEOUT_MS = 25000;

/* =========================================================
   CORS
========================================================= */

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
}

/* =========================================================
   JSON RESPONSE
========================================================= */

function sendJson(res, status, data) {
  res.status(status).json(data);
}

/* =========================================================
   CLEAN STRING
========================================================= */

function clean(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

/* =========================================================
   NORMALIZE FLIGHT NUMBER
========================================================= */

function normalizeFlight(value) {
  return clean(value)
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

/* =========================================================
   PARSE FLIGHT NUMBER
========================================================= */

function parseFlightNumber(value) {
  const normalized = normalizeFlight(value);

  /*
   * Standard:
   * B6117
   * EK181
   * UA160
   */
  let match = normalized.match(/^([A-Z0-9]{2,3})(\d{1,5})$/);

  if (match) {
    return {
      original: normalized,
      airlineCode: match[1],
      number: match[2]
    };
  }

  /*
   * Some users may enter:
   * JBU 117
   * JBU-117
   */
  const spaced = clean(value)
    .toUpperCase()
    .match(/^([A-Z0-9]{2,3})[\s-]+(\d{1,5})$/);

  if (spaced) {
    return {
      original: normalized,
      airlineCode: spaced[1],
      number: spaced[2]
    };
  }

  return {
    original: normalized,
    airlineCode: "",
    number: ""
  };
}

/* =========================================================
   AIRLINE CODE MAP
========================================================= */

/*
 * ICAO -> IATA
 *
 * JBU = JetBlue ICAO
 * B6  = JetBlue IATA
 *
 * The user can continue entering JBU117,
 * but Google/SerpApi generally works better
 * with the published IATA designator B6 117.
 */

const ICAO_TO_IATA = {
  JBU: "B6",
  UAL: "UA",
  DAL: "DL",
  AAL: "AA",
  ASA: "AS",
  SWA: "WN",
  FFT: "F9",
  NKS: "NK",
  AAY: "G4",
  UAE: "EK",
  QTR: "QR",
  BAW: "BA",
  AFR: "AF",
  KLM: "KL",
  DLH: "LH",
  THY: "TK",
  ACA: "AC",
  WJA: "WS",
  VOI: "Y4",
  AMX: "AM",
  AZA: "AZ",
  TAP: "TP",
  IBX: "IB",
  IBE: "IB",
  VLG: "VY",
  EIN: "EI",
  ETD: "EY",
  SIA: "SQ",
  CPA: "CX",
  JAL: "JL",
  ANA: "NH",
  KAL: "KE",
  AIC: "AI",
  MAS: "MH",
  QFA: "QF",
  VIR: "VS",
  ELY: "LY",
  SAS: "SK",
  FIN: "AY",
  LOT: "LO",
  SWR: "LX",
  AZU: "AD"
};

/* =========================================================
   AIRLINE NAMES
========================================================= */

const AIRLINE_NAMES = {
  B6: "JetBlue",
  UA: "United Airlines",
  DL: "Delta Air Lines",
  AA: "American Airlines",
  AS: "Alaska Airlines",
  WN: "Southwest Airlines",
  F9: "Frontier Airlines",
  NK: "Spirit Airlines",
  G4: "Allegiant Air",
  EK: "Emirates",
  QR: "Qatar Airways",
  BA: "British Airways",
  AF: "Air France",
  KL: "KLM",
  LH: "Lufthansa",
  TK: "Turkish Airlines",
  AC: "Air Canada",
  WS: "WestJet",
  Y4: "Volaris",
  AM: "Aeromexico",
  AZ: "ITA Airways",
  TP: "TAP Air Portugal",
  IB: "Iberia",
  VY: "Vueling",
  EI: "Aer Lingus",
  EY: "Etihad Airways",
  SQ: "Singapore Airlines",
  CX: "Cathay Pacific",
  JL: "Japan Airlines",
  NH: "ANA",
  KE: "Korean Air",
  AI: "Air India",
  MH: "Malaysia Airlines",
  QF: "Qantas",
  VS: "Virgin Atlantic",
  LY: "EL AL",
  SK: "SAS",
  AY: "Finnair",
  LO: "LOT Polish Airlines",
  LX: "SWISS",
  AD: "Azul"
};

/* =========================================================
   BUILD SEARCH TERMS
========================================================= */

function buildSearches(flightInput, date) {
  const parsed = parseFlightNumber(flightInput);

  const original = parsed.original;
  const number = parsed.number;
  const inputCode = parsed.airlineCode;

  const iataCode =
    ICAO_TO_IATA[inputCode] ||
    inputCode;

  const airlineName =
    AIRLINE_NAMES[iataCode] ||
    "";

  const searches = [];

  /*
   * Most important:
   * B6 117 flight status September 8 2026
   */

  if (iataCode && number) {
    searches.push(
      `${iataCode} ${number} flight status ${date}`
    );
  }

  /*
   * Compact version
   */

  if (iataCode && number) {
    searches.push(
      `${iataCode}${number} flight status ${date}`
    );
  }

  /*
   * Airline name
   */

  if (airlineName && number) {
    searches.push(
      `${airlineName} ${number} flight status ${date}`
    );
  }

  /*
   * Original user input
   */

  if (original) {
    searches.push(
      `${original} flight status ${date}`
    );
  }

  /*
   * ICAO representation
   */

  if (
    inputCode &&
    inputCode !== iataCode &&
    number
  ) {
    searches.push(
      `${inputCode} ${number} flight status ${date}`
    );
  }

  /*
   * Remove duplicates
   */

  return [...new Set(searches)];
}

/* =========================================================
   FETCH SERPAPI
========================================================= */

async function searchSerpApi(query) {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    throw new Error(
      "SERPAPI_KEY is not configured in Vercel."
    );
  }

  const url = new URL(SERPAPI_URL);

  url.searchParams.set(
    "engine",
    "google"
  );

  url.searchParams.set(
    "q",
    query
  );

  url.searchParams.set(
    "api_key",
    apiKey
  );

  url.searchParams.set(
    "hl",
    "en"
  );

  url.searchParams.set(
    "gl",
    "us"
  );

  url.searchParams.set(
    "google_domain",
    "google.com"
  );

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      url.toString(),
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal: controller.signal
      }
    );

    const text =
      await response.text();

    let json;

    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        `SerpApi returned invalid JSON. HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        json.error ||
        `SerpApi HTTP ${response.status}`
      );
    }

    if (json.error) {
      throw new Error(json.error);
    }

    return json;

  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   NORMALIZE AIRPORT
========================================================= */

function normalizeAirport(value) {
  if (!value) {
    return {
      airport_code: "",
      city: "",
      name: ""
    };
  }

  if (typeof value === "string") {
    return {
      airport_code: value.trim(),
      city: "",
      name: value.trim()
    };
  }

  return {
    airport_code:
      clean(
        value.airport_name ||
        value.code ||
        value.id ||
        value.airport_code
      ),

    city:
      clean(
        value.location ||
        value.city ||
        value.city_name
      ),

    name:
      clean(
        value.name ||
        value.airport_name
      )
  };
}

/* =========================================================
   PARSE TIME
========================================================= */

function getTime(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return clean(
    value.time ||
    value.planned_time ||
    value.actual_time ||
    value.datetime ||
    value.date
  );
}

/* =========================================================
   EXTRACT DEPARTURE
========================================================= */

function extractDeparture(data) {
  const departure =
    data?.departure ||
    data?.departure_airport ||
    {};

  return {
    airport_code:
      clean(
        departure.airport_name ||
        departure.id ||
        departure.code ||
        departure.airport_code
      ),

    city:
      clean(
        departure.location ||
        departure.city ||
        departure.city_name
      ),

    date:
      clean(
        departure.date
      ),

    planned_time:
      clean(
        departure.planned_time ||
        departure.scheduled_time ||
        departure.time ||
        departure.departure_time
      ),

    actual_time:
      clean(
        departure.actual_time ||
        departure.actual_departure ||
        departure.actual_time
      ),

    terminal:
      clean(
        departure.terminal
      ),

    gate:
      clean(
        departure.gate
      )
  };
}

/* =========================================================
   EXTRACT ARRIVAL
========================================================= */

function extractArrival(data) {
  const arrival =
    data?.arrival ||
    data?.arrival_airport ||
    {};

  return {
    airport_code:
      clean(
        arrival.airport_name ||
        arrival.id ||
        arrival.code ||
        arrival.airport_code
      ),

    city:
      clean(
        arrival.location ||
        arrival.city ||
        arrival.city_name
      ),

    date:
      clean(
        arrival.date
      ),

    planned_time:
      clean(
        arrival.planned_time ||
        arrival.scheduled_time ||
        arrival.time ||
        arrival.arrival_time
      ),

    actual_time:
      clean(
        arrival.actual_time ||
        arrival.actual_arrival ||
        arrival.actual_time
      ),

    terminal:
      clean(
        arrival.terminal
      ),

    gate:
      clean(
        arrival.gate
      )
  };
}

/* =========================================================
   FIND FLIGHT STATUS IN ANSWER BOX
========================================================= */

function findAnswerBoxFlight(results, requestedFlight) {
  const answerBox =
    results?.answer_box;

  if (!answerBox) {
    return null;
  }

  if (
    answerBox.type !==
    "flight_status"
  ) {
    return null;
  }

  /*
   * Single flight
   */

  if (
    answerBox.flight_number ||
    answerBox.flight_status ||
    answerBox.departure ||
    answerBox.arrival
  ) {
    return answerBox;
  }

  /*
   * Multiple flights
   */

  if (
    Array.isArray(answerBox.flights)
  ) {
    const requested =
      normalizeFlight(requestedFlight);

    const exact =
      answerBox.flights.find(
        flight => {
          const candidate =
            normalizeFlight(
              flight.flight_number ||
              flight.flight_name ||
              ""
            );

          return (
            candidate === requested
          );
        }
      );

    if (exact) {
      return exact;
    }

    /*
     * If there is only one result,
     * use it.
     */

    if (
      answerBox.flights.length === 1
    ) {
      return answerBox.flights[0];
    }

    /*
     * Try matching the numeric part.
     */

    const parsed =
      parseFlightNumber(
        requestedFlight
      );

    if (parsed.number) {
      const numericMatch =
        answerBox.flights.find(
          flight => {
            const text =
              normalizeFlight(
                flight.flight_number ||
                flight.flight_name ||
                ""
              );

            return text.endsWith(
              parsed.number
            );
          }
        );

      if (numericMatch) {
        return numericMatch;
      }
    }
  }

  return null;
}

/* =========================================================
   FIND FLIGHT RESULT
========================================================= */

function findFlightResult(
  results,
  requestedFlight
) {
  const flightResult =
    results?.flight_result;

  if (!flightResult) {
    return null;
  }

  /*
   * Some SerpApi responses return
   * the flight directly.
   */

  if (
    flightResult.flight_designator ||
    flightResult.flight_number ||
    flightResult.route ||
    flightResult.dates
  ) {
    return flightResult;
  }

  return null;
}

/* =========================================================
   EXTRACT FLIGHT FROM FLIGHT RESULT
========================================================= */

function extractFlightFromResult(
  result,
  requestedFlight,
  requestedDate
) {
  if (!result) {
    return null;
  }

  /*
   * Newer Flight Result format
   *
   * flight_result.dates[]
   */

  if (
    Array.isArray(result.dates)
  ) {
    const dateMatch =
      result.dates.find(
        item =>
          clean(item.date) ===
          requestedDate
      );

    if (dateMatch) {
      return {
        ...result,
        selected_date:
          dateMatch
      };
    }

    /*
     * If there is only one date,
     * use it.
     */

    if (
      result.dates.length === 1
    ) {
      return {
        ...result,
        selected_date:
          result.dates[0]
      };
    }
  }

  return result;
}

/* =========================================================
   NORMALIZE FLIGHT
========================================================= */

function normalizeFlightData(
  raw,
  requestedFlight,
  requestedDate
) {
  if (!raw) {
    return null;
  }

  const parsed =
    parseFlightNumber(
      requestedFlight
    );

  let flightNumber =
    clean(
      raw.flight_number ||
      raw.flight_designator ||
      raw.flight_name ||
      raw.title
    );

  /*
   * Extract airline code and number
   * from strings such as:
   *
   * "JetBlue B6 117"
   * "B6 117"
   * "B6117"
   */

  let airlineCode =
    parsed.airlineCode;

  let numericFlight =
    parsed.number;

  const flightText =
    clean(
      raw.flight_designator ||
      raw.flight_number ||
      raw.flight_name ||
      raw.title
    );

  const codeMatch =
    flightText.match(
      /\b([A-Z0-9]{2,3})\s*-?\s*(\d{1,5})\b/i
    );

  if (codeMatch) {
    const detectedCode =
      codeMatch[1].toUpperCase();

    const detectedNumber =
      codeMatch[2];

    if (!airlineCode) {
      airlineCode =
        detectedCode;
    }

    if (!numericFlight) {
      numericFlight =
        detectedNumber;
    }

    if (
      ICAO_TO_IATA[
        detectedCode
      ]
    ) {
      airlineCode =
        ICAO_TO_IATA[
          detectedCode
        ];
    }
  }

  /*
   * Convert ICAO code to IATA.
   */

  if (
    ICAO_TO_IATA[airlineCode]
  ) {
    airlineCode =
      ICAO_TO_IATA[
        airlineCode
      ];
  }

  /*
   * Airline name
   */

  const airline =
    clean(
      raw.airline ||
      raw.airline_name ||
      AIRLINE_NAMES[
        airlineCode
      ] ||
      ""
    );

  /*
   * Departure / Arrival
   */

  let departure =
    extractDeparture(raw);

  let arrival =
    extractArrival(raw);

  /*
   * Some flight_result structures
   * store selected date metadata.
   */

  const selectedDate =
    raw.selected_date;

  if (
    selectedDate?.metadata
  ) {
    const metadata =
      selectedDate.metadata;

    airlineCode =
      clean(
        metadata.airline_iata_code ||
        airlineCode
      );

    numericFlight =
      clean(
        metadata.flight_number ||
        numericFlight
      );

    if (
      metadata.origin &&
      !departure.airport_code
    ) {
      departure.airport_code =
        metadata.origin;
    }

    if (
      metadata.destination &&
      !arrival.airport_code
    ) {
      arrival.airport_code =
        metadata.destination;
    }
  }

  /*
   * Route
   */

  let route =
    clean(
      raw.destination ||
      raw.route
    );

  if (!route) {
    const from =
      departure.city ||
      departure.airport_code;

    const to =
      arrival.city ||
      arrival.airport_code;

    if (from || to) {
      route =
        `${from || "—"} to ${to || "—"}`;
    }
  }

  /*
   * Status
   */

  const status =
    clean(
      raw.flight_status ||
      raw.status ||
      raw.flightState ||
      selectedDate?.metadata?.status
    );

  /*
   * Latest update
   */

  const updatedText =
    clean(
      raw.latest_update ||
      raw.updated ||
      raw.update ||
      raw.updated_text
    );

  /*
   * Source
   */

  let source = "";
  let sourceUrl = "";

  if (
    Array.isArray(raw.sources) &&
    raw.sources.length
  ) {
    source =
      clean(
        raw.sources[0]?.name
      );

    sourceUrl =
      clean(
        raw.sources[0]?.link
      );
  }

  /*
   * Title
   */

  const finalFlightNumber =
    numericFlight ||
    parsed.number ||
    "";

  const designator =
    airlineCode && finalFlightNumber
      ? `${airlineCode} ${finalFlightNumber}`
      : flightNumber;

  const title =
    clean(
      raw.title ||
      `${airline || ""} ${designator}`
    );

  /*
   * Date
   */

  const date =
    clean(
      requestedDate ||
      selectedDate?.date
    );

  /*
   * Canonical result
   */

  const canonical = {
    airline:
      airline || "—",

    airline_code:
      airlineCode || "—",

    flight_number:
      finalFlightNumber || "—",

    flight_designator:
      designator || "—",

    title:
      title || "—",

    status:
      status || "—",

    route:
      route || "—",

    date:
      date || "—",

    departure: {
      airport_code:
        departure.airport_code || "—",

      city:
        departure.city || "—",

      date:
        departure.date || date || "—",

      planned_time:
        departure.planned_time || "—",

      actual_time:
        departure.actual_time || "—",

      terminal:
        departure.terminal || "—",

      gate:
        departure.gate || "—"
    },

    arrival: {
      airport_code:
        arrival.airport_code || "—",

      city:
        arrival.city || "—",

      date:
        arrival.date || date || "—",

      planned_time:
        arrival.planned_time || "—",

      actual_time:
        arrival.actual_time || "—",

      terminal:
        arrival.terminal || "—",

      gate:
        arrival.gate || "—"
    },

    updated_text:
      updatedText || "—",

    source:
      source || "—",

    source_url:
      sourceUrl || "",

    /*
     * Compatibility fields for
     * existing Bokkara frontend.
     */

    origin_code:
      departure.airport_code || "—",

    destination_code:
      arrival.airport_code || "—",

    origin_city:
      departure.city || "—",

    destination_city:
      arrival.city || "—",

    departure_time:
      departure.planned_time || "—",

    actual_departure:
      departure.actual_time || "—",

    scheduled_departure:
      departure.planned_time || "—",

    actual_arrival:
      arrival.actual_time || "—",

    scheduled_arrival:
      arrival.planned_time || "—",

    departure_terminal:
      departure.terminal || "—",

    departure_gate:
      departure.gate || "—",

    arrival_terminal:
      arrival.terminal || "—",

    arrival_gate:
      arrival.gate || "—",

    local_time_text:
      updatedText || "—"
  };

  return canonical;
}

/* =========================================================
   SEARCH ONE QUERY
========================================================= */

async function findFlight(
  query,
  requestedFlight,
  requestedDate
) {
  const results =
    await searchSerpApi(query);

  /*
   * 1. Google Flight Status Answer Box
   */

  const answerFlight =
    findAnswerBoxFlight(
      results,
      requestedFlight
    );

  if (answerFlight) {
    const normalized =
      normalizeFlightData(
        answerFlight,
        requestedFlight,
        requestedDate
      );

    if (normalized) {
      return {
        data: normalized,
        serpapi: results,
        method: "answer_box"
      };
    }
  }

  /*
   * 2. Google Flight Result
   */

  const flightResult =
    findFlightResult(
      results,
      requestedFlight
    );

  if (flightResult) {
    const extracted =
      extractFlightFromResult(
        flightResult,
        requestedFlight,
        requestedDate
      );

    const normalized =
      normalizeFlightData(
        extracted,
        requestedFlight,
        requestedDate
      );

    if (normalized) {
      return {
        data: normalized,
        serpapi: results,
        method: "flight_result"
      };
    }
  }

  return null;
}

/* =========================================================
   MAIN HANDLER
========================================================= */

export default async function handler(
  req,
  res
) {
  setCors(res);

  /*
   * OPTIONS
   */

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  /*
   * GET ONLY
   */

  if (req.method !== "GET") {
    return sendJson(
      res,
      405,
      {
        success: false,
        error:
          "Method not allowed. Use GET."
      }
    );
  }

  /*
   * INPUT
   */

  const flight =
    clean(
      req.query?.flight
    );

  const date =
    clean(
      req.query?.date
    );

  /*
   * Validate flight
   */

  if (!flight) {
    return sendJson(
      res,
      400,
      {
        success: false,
        error:
          "Missing flight parameter."
      }
    );
  }

  /*
   * Validate date
   */

  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return sendJson(
      res,
      400,
      {
        success: false,
        error:
          "Invalid date. Use YYYY-MM-DD."
      }
    );
  }

  /*
   * Validate API key before
   * doing any searches.
   */

  if (!process.env.SERPAPI_KEY) {
    return sendJson(
      res,
      500,
      {
        success: false,
        error:
          "SERPAPI_KEY is missing from Vercel environment variables."
      }
    );
  }

  /*
   * Parse flight
   */

  const parsed =
    parseFlightNumber(flight);

  const normalizedFlight =
    normalizeFlight(flight);

  /*
   * Build search queries
   */

  const searches =
    buildSearches(
      flight,
      date
    );

  /*
   * Search each representation
   *
   * Stop immediately when we get
   * a usable flight result.
   */

  let found = null;

  const errors = [];

  for (
    const query of searches
  ) {
    try {
      found =
        await findFlight(
          query,
          flight,
          date
        );

      if (found) {
        break;
      }

    } catch (error) {
      errors.push({
        query,
        error:
          error?.message ||
          String(error)
      });
    }
  }

  /*
   * Successful result
   */

  if (found?.data) {
    return sendJson(
      res,
      200,
      {
        success: true,

        query: {
          flight,
          normalized_flight:
            normalizedFlight,
          date
        },

        search: {
          airline_input:
            parsed.airlineCode || null,

          airline_iata:
            ICAO_TO_IATA[
              parsed.airlineCode
            ] ||
            parsed.airlineCode ||
            null,

          flight_number:
            parsed.number || null,

          queries_used:
            searches,

          method:
            found.method
        },

        /*
         * Main response
         */

        flight:
          found.data,

        /*
         * Compatibility
         */

        flight_result:
          found.data,

        data:
          found.data
      }
    );
  }

  /*
   * No result
   */

  return sendJson(
    res,
    200,
    {
      success: false,

      error:
        `No flight status was found for ${formatFlightForDisplay(
          flight
        )} on ${date}.`,

      query: {
        flight,
        normalized_flight:
          normalizedFlight,
        date
      },

      search: {
        airline_input:
          parsed.airlineCode || null,

        airline_iata:
          ICAO_TO_IATA[
            parsed.airlineCode
          ] ||
          parsed.airlineCode ||
          null,

        flight_number:
          parsed.number || null,

        queries_used:
          searches
      },

      /*
       * Useful for debugging Vercel
       * without exposing the SerpApi key.
       */

      search_errors:
        errors
    }
  );
}

/* =========================================================
   DISPLAY FLIGHT
========================================================= */

function formatFlightForDisplay(
  value
) {
  const parsed =
    parseFlightNumber(value);

  const code =
    ICAO_TO_IATA[
      parsed.airlineCode
    ] ||
    parsed.airlineCode;

  if (
    code &&
    parsed.number
  ) {
    return `${code} ${parsed.number}`;
  }

  return clean(value);
}
